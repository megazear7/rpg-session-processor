import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { JobSnapshotSchema, STEP_DEFINITIONS, type JobSnapshot, type Step, type StepKey } from './shared.js';

dotenv.config();

const repoRoot = process.cwd();
const inputDir = path.join(repoRoot, 'input');
const sourcePublicDir = path.join(repoRoot, 'UI', 'public');
const builtPublicDir = path.join(repoRoot, 'dist', 'UI', 'public');
const PORT = Number(process.env.PORT || 3000);

await fs.mkdir(inputDir, { recursive: true });

const app = express();
const jobs = new Map<string, JobSnapshot>();

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, callback) => callback(null, inputDir),
        filename: (req, file, callback) => {
            const requestWithJob = req as express.Request & { jobId?: string };
            const jobId = requestWithJob.jobId ?? randomUUID();
            requestWithJob.jobId = jobId;
            callback(null, `${jobId}-${sanitizeFileName(file.originalname)}`);
        },
    }),
    fileFilter: (_req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        if (extension === '.mp3' || extension === '.m4a') {
            callback(null, true);
            return;
        }

        callback(new Error('Only .mp3 and .m4a files can be uploaded.'));
    },
});

app.use(express.json());
app.use(express.static(sourcePublicDir));
app.use('/assets', express.static(builtPublicDir));

app.get('/', (_req, res) => {
    res.sendFile(path.join(sourcePublicDir, 'index.html'));
});

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        message: 'RPG Session Processor UI server running',
    });
});

app.post('/api/jobs', upload.single('audio'), (req, res, next) => {
    void (async () => {
        const file = req.file;
        const jobId = (req as express.Request & { jobId?: string }).jobId;

        if (!file || !jobId) {
            res.status(400).json({ error: 'Please upload a .mp3 or .m4a file using the audio field.' });
            return;
        }

        const job: JobSnapshot = {
            id: jobId,
            fileName: file.originalname,
            status: 'queued',
            progress: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            steps: STEP_DEFINITIONS.map((step) => ({
                ...step,
                status: step.key === 'upload' ? 'completed' : 'pending',
                detail: step.key === 'upload' ? 'Audio uploaded to the local processor' : undefined,
            })),
            artifacts: [],
        };

        jobs.set(jobId, job);
        res.status(202).json(JobSnapshotSchema.parse(job));

        void runJob(jobId, file.filename);
    })().catch(next);
});

app.get('/api/jobs/:jobId', (req, res) => {
    const params = z.object({ jobId: z.string().min(1) }).safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'A job id is required.' });
        return;
    }

    const job = jobs.get(params.data.jobId);
    if (!job) {
        res.status(404).json({ error: 'Job not found.' });
        return;
    }

    res.json(JobSnapshotSchema.parse(job));
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ error: error.message });
});

app.listen(PORT, () => {
    console.log(`Zelt Stack UI server running at http://localhost:${PORT}`);
});

async function runJob(jobId: string, uploadedFileName: string): Promise<void> {
    updateJob(jobId, (job) => ({
        ...job,
        status: 'in_progress',
        steps: updateStep(job.steps, 'prepare', 'in_progress', 'Waiting for the processor to start'),
    }));

    try {
        const { sendAndSave } = await import('../src/model.js');
        const result = await sendAndSave(uploadedFileName, {
            onStepUpdate: async ({ key, status, detail }) => {
                updateJob(jobId, (job) => ({
                    ...job,
                    status: 'in_progress',
                    steps: updateStep(job.steps, key, status, detail),
                }));
            },
            onArtifact: async (artifact) => {
                updateJob(jobId, (job) => ({
                    ...job,
                    artifacts: mergeArtifact(job.artifacts, artifact),
                }));
            },
        });

        updateJob(jobId, (job) => ({
            ...job,
            status: 'completed',
            progress: 100,
            steps: job.steps.map((step) =>
                step.status === 'pending'
                    ? { ...step, status: 'completed', detail: step.detail ?? 'Finished' }
                    : step
            ),
            artifacts: result.artifacts,
        }));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown processing error';
        updateJob(jobId, (job) => ({
            ...job,
            status: 'failed',
            error: message,
            steps: markCurrentStepFailed(job.steps, message),
        }));
    }
}

function sanitizeFileName(fileName: string): string {
    return path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '-');
}

function updateJob(jobId: string, updater: (job: JobSnapshot) => JobSnapshot): void {
    const job = jobs.get(jobId);
    if (!job) {
        return;
    }

    const updated = updater(job);
    const completedSteps = updated.steps.filter((step) => step.status === 'completed').length;
    const progress = updated.status === 'completed'
        ? 100
        : Math.round((completedSteps / updated.steps.length) * 100);

    jobs.set(jobId, JobSnapshotSchema.parse({
        ...updated,
        progress,
        updatedAt: new Date().toISOString(),
    }));
}

function updateStep(steps: Step[], key: StepKey, status: Step['status'], detail?: string): Step[] {
    return steps.map((step) => step.key === key ? {
        ...step,
        status,
        detail,
    } : step);
}

function mergeArtifact(artifacts: JobSnapshot['artifacts'], artifact: JobSnapshot['artifacts'][number]): JobSnapshot['artifacts'] {
    const existing = artifacts.findIndex((entry) => entry.key === artifact.key);
    if (existing === -1) {
        return [...artifacts, artifact];
    }

    return artifacts.map((entry, index) => index === existing ? artifact : entry);
}

function markCurrentStepFailed(steps: Step[], message: string): Step[] {
    const activeStep = [...steps].reverse().find((step) => step.status === 'in_progress');
    if (!activeStep) {
        return steps;
    }

    return steps.map((step) => step.key === activeStep.key ? {
        ...step,
        status: 'failed',
        detail: message,
    } : step);
}
