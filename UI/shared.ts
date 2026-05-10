import { z } from 'zod';

export const STEP_DEFINITIONS = [
    { key: 'upload', label: 'Upload' },
    { key: 'prepare', label: 'Prepare Audio' },
    { key: 'transcribe', label: 'Transcribe' },
    { key: 'diarize', label: 'Diarize' },
    { key: 'playByPlay', label: 'Play by Play' },
    { key: 'dmNotes', label: 'DM Notes' },
    { key: 'summarize', label: 'Summarize' },
    { key: 'story', label: 'Story' },
    { key: 'title', label: 'Title' },
    { key: 'image', label: 'Image Prompt' },
    { key: 'lyrics', label: 'Lyrics Prompt' },
    { key: 'song', label: 'Song Prompt' },
    { key: 'publish', label: 'Publish' },
] as const;

export type StepKey = typeof STEP_DEFINITIONS[number]['key'];

export const StepStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed']);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const JobStatusSchema = z.enum(['queued', 'in_progress', 'completed', 'failed']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const ArtifactSchema = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    fileName: z.string().min(1),
    content: z.string(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const StepSchema = z.object({
    key: z.enum(STEP_DEFINITIONS.map((step) => step.key) as [StepKey, ...StepKey[]]),
    label: z.string().min(1),
    status: StepStatusSchema,
    detail: z.string().optional(),
});
export type Step = z.infer<typeof StepSchema>;

export const JobSnapshotSchema = z.object({
    id: z.string().min(1),
    fileName: z.string().min(1),
    status: JobStatusSchema,
    progress: z.number().min(0).max(100),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    error: z.string().optional(),
    steps: z.array(StepSchema),
    artifacts: z.array(ArtifactSchema),
});
export type JobSnapshot = z.infer<typeof JobSnapshotSchema>;

export function createSteps(): Step[] {
    return STEP_DEFINITIONS.map((step) => ({
        ...step,
        status: 'pending',
    }));
}
