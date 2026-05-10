import { z } from 'zod';
import { STEP_DEFINITIONS, type StepKey } from './shared-client.js';

export { STEP_DEFINITIONS };
export type { StepKey };

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
