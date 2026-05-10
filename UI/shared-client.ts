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

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Step {
    key: StepKey;
    label: string;
    status: StepStatus;
    detail?: string;
}

export interface Artifact {
    key: string;
    label: string;
    fileName: string;
    content: string;
}

export interface JobSnapshot {
    id: string;
    fileName: string;
    status: 'queued' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    createdAt: string;
    updatedAt: string;
    error?: string;
    steps: Step[];
    artifacts: Artifact[];
}
