import { LitElement, css, html } from 'lit';

const STEP_DEFINITIONS = [
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

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface Step {
    key: typeof STEP_DEFINITIONS[number]['key'];
    label: string;
    status: StepStatus;
    detail?: string;
}

interface Artifact {
    key: string;
    label: string;
    fileName: string;
    content: string;
}

interface JobSnapshot {
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

class RpgSessionUi extends LitElement {
    static properties = {
        job: { state: true },
        isSubmitting: { state: true },
        errorMessage: { state: true },
        copiedArtifactKey: { state: true },
    };

    static styles = css`
        :host {
            display: block;
            min-height: 100vh;
            padding: 32px 20px 48px;
            color: #e2e8f0;
        }

        .shell {
            width: min(1120px, 100%);
            margin: 0 auto;
            display: grid;
            gap: 24px;
        }

        .hero,
        .panel,
        .artifact-card,
        .step-card {
            border: 1px solid rgba(148, 163, 184, 0.18);
            background: rgba(15, 23, 42, 0.82);
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
            border-radius: 20px;
        }

        .hero {
            padding: 28px;
            display: grid;
            gap: 18px;
        }

        .eyebrow {
            margin: 0;
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: #38bdf8;
        }

        h1 {
            margin: 0;
            font-size: clamp(2rem, 4vw, 3.5rem);
            line-height: 1.05;
        }

        p {
            margin: 0;
            color: #cbd5e1;
            line-height: 1.6;
        }

        .hero-grid,
        .status-grid,
        .artifact-grid {
            display: grid;
            gap: 16px;
        }

        .hero-grid {
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            align-items: end;
        }

        .panel {
            padding: 22px;
        }

        .upload-form {
            display: grid;
            gap: 12px;
        }

        .upload-row {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }

        .upload-label {
            display: grid;
            gap: 8px;
            flex: 1 1 320px;
        }

        input[type="file"] {
            width: 100%;
            padding: 14px 16px;
            border-radius: 14px;
            border: 1px dashed rgba(56, 189, 248, 0.45);
            background: rgba(15, 23, 42, 0.55);
            color: #e2e8f0;
        }

        button {
            border: none;
            border-radius: 14px;
            padding: 14px 18px;
            cursor: pointer;
            transition: transform 120ms ease, opacity 120ms ease;
        }

        button:hover {
            transform: translateY(-1px);
        }

        button:disabled {
            cursor: wait;
            opacity: 0.65;
            transform: none;
        }

        .primary-button,
        .copy-button {
            background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
            color: #020617;
            font-weight: 700;
        }

        .status-grid,
        .artifact-grid {
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }

        .progress-shell {
            display: grid;
            gap: 8px;
        }

        .progress-meta {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            color: #cbd5e1;
            font-size: 0.95rem;
        }

        .progress-track,
        .step-track {
            position: relative;
            height: 12px;
            border-radius: 999px;
            overflow: hidden;
            background: rgba(148, 163, 184, 0.18);
        }

        .progress-bar,
        .step-bar {
            position: absolute;
            inset: 0 auto 0 0;
            border-radius: inherit;
            background: linear-gradient(90deg, #38bdf8 0%, #a855f7 100%);
        }

        .step-card {
            padding: 18px;
            display: grid;
            gap: 10px;
        }

        .step-top,
        .artifact-top {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
        }

        .step-title,
        .artifact-title {
            font-weight: 700;
        }

        .badge {
            padding: 6px 10px;
            border-radius: 999px;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            background: rgba(148, 163, 184, 0.16);
            color: #e2e8f0;
        }

        .badge.completed {
            background: rgba(34, 197, 94, 0.18);
            color: #86efac;
        }

        .badge.in_progress {
            background: rgba(56, 189, 248, 0.18);
            color: #7dd3fc;
        }

        .badge.failed {
            background: rgba(248, 113, 113, 0.18);
            color: #fca5a5;
        }

        .step-card.completed .step-bar {
            width: 100%;
            background: linear-gradient(90deg, #22c55e 0%, #4ade80 100%);
        }

        .step-card.in_progress .step-bar {
            width: 65%;
        }

        .step-card.failed .step-bar {
            width: 100%;
            background: linear-gradient(90deg, #ef4444 0%, #fb7185 100%);
        }

        .step-card.pending .step-bar {
            width: 12%;
            opacity: 0.25;
        }

        .artifact-card {
            padding: 18px;
            display: grid;
            gap: 14px;
        }

        .artifact-card pre {
            margin: 0;
            max-height: 240px;
            overflow: auto;
            padding: 16px;
            border-radius: 16px;
            background: rgba(2, 6, 23, 0.65);
            color: #dbeafe;
            white-space: pre-wrap;
            word-break: break-word;
            font-family: "SFMono-Regular", ui-monospace, Menlo, monospace;
            font-size: 0.87rem;
            line-height: 1.55;
        }

        .empty-state {
            padding: 22px;
            border-radius: 20px;
            border: 1px dashed rgba(148, 163, 184, 0.25);
            color: #94a3b8;
            text-align: center;
        }

        .error {
            color: #fca5a5;
        }

        @media (max-width: 720px) {
            :host {
                padding-inline: 14px;
            }
        }
    `;

    declare job?: JobSnapshot;
    declare isSubmitting: boolean;
    declare errorMessage?: string;
    declare copiedArtifactKey?: string;
    private poller?: number;

    constructor() {
        super();
        this.isSubmitting = false;
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stopPolling();
    }

    render() {
        const job = this.job;
        const steps = job?.steps ?? STEP_DEFINITIONS.map((step) => ({ ...step, status: 'pending' as const }));

        return html`
            <div class="shell">
                <section class="hero">
                    <p class="eyebrow">Local Zelt Stack UI</p>
                    <div class="hero-grid">
                        <div>
                            <h1>Watch session processing happen in real time.</h1>
                            <p>Upload an MP3 or M4A recording, track each processing phase, and copy generated artifacts the moment they appear.</p>
                        </div>
                        <div class="panel">
                            <form class="upload-form" @submit=${this.handleSubmit}>
                                <label class="upload-label">
                                    <span>Audio file</span>
                                    <input id="audio-file" name="audio" type="file" accept=".mp3,.m4a,audio/mpeg,audio/mp4">
                                </label>
                                <div class="upload-row">
                                    <button class="primary-button" ?disabled=${this.isSubmitting}>
                                        ${this.isSubmitting ? 'Uploading…' : 'Start processing'}
                                    </button>
                                    <p>${job ? `Current job: ${job.fileName}` : 'No session running yet.'}</p>
                                </div>
                                ${this.errorMessage ? html`<p class="error">${this.errorMessage}</p>` : null}
                            </form>
                        </div>
                    </div>
                    <div class="progress-shell">
                        <div class="progress-meta">
                            <span>${this.getStatusHeadline(job)}</span>
                            <strong>${job?.progress ?? 0}%</strong>
                        </div>
                        <div class="progress-track">
                            <div class="progress-bar" style=${`width: ${job?.progress ?? 0}%`}></div>
                        </div>
                    </div>
                </section>

                <section class="panel">
                    <div class="step-top">
                        <div>
                            <h2>Pipeline status</h2>
                            <p>Each stage updates as the backend progresses through the existing processor workflow.</p>
                        </div>
                    </div>
                    <div class="status-grid">
                        ${steps.map((step) => this.renderStep(step))}
                    </div>
                </section>

                <section class="panel">
                    <div class="step-top">
                        <div>
                            <h2>Artifacts</h2>
                            <p>Generated files show up here as soon as each step finishes.</p>
                        </div>
                    </div>
                    ${job?.artifacts.length
                        ? html`<div class="artifact-grid">${job.artifacts.map((artifact) => html`
                            <article class="artifact-card">
                                <div class="artifact-top">
                                    <div>
                                        <div class="artifact-title">${artifact.label}</div>
                                        <p>${artifact.fileName}</p>
                                    </div>
                                    <button class="copy-button" @click=${() => this.copyArtifact(artifact.key, artifact.content)}>
                                        ${this.copiedArtifactKey === artifact.key ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <pre>${artifact.content}</pre>
                            </article>
                        `)}</div>`
                        : html`<div class="empty-state">Artifacts will appear here after each processing step finishes.</div>`}
                </section>
            </div>
        `;
    }

    private renderStep(step: Step) {
        return html`
            <article class=${`step-card ${step.status}`}>
                <div class="step-top">
                    <div class="step-title">${step.label}</div>
                    <span class=${`badge ${step.status}`}>${step.status.replace('_', ' ')}</span>
                </div>
                <div class="step-track">
                    <div class="step-bar"></div>
                </div>
                <p>${step.detail ?? this.getDefaultStepDetail(step)}</p>
            </article>
        `;
    }

    private async handleSubmit(event: Event) {
        event.preventDefault();
        this.errorMessage = undefined;

        const input = this.renderRoot.querySelector<HTMLInputElement>('#audio-file');
        const file = input?.files?.[0];
        if (!file) {
            this.errorMessage = 'Choose an MP3 or M4A file first.';
            return;
        }

        const formData = new FormData();
        formData.append('audio', file);

        this.isSubmitting = true;

        try {
            const response = await fetch('/api/jobs', {
                method: 'POST',
                body: formData,
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Upload failed.');
            }

            this.job = payload as JobSnapshot;
            this.startPolling();
            if (input) {
                input.value = '';
            }
        } catch (error) {
            this.errorMessage = error instanceof Error ? error.message : 'Upload failed.';
        } finally {
            this.isSubmitting = false;
        }
    }

    private startPolling() {
        this.stopPolling();
        if (!this.job) {
            return;
        }

        this.poller = window.setInterval(async () => {
            if (!this.job) {
                this.stopPolling();
                return;
            }

            const response = await fetch(`/api/jobs/${this.job.id}`);
            if (!response.ok) {
                this.stopPolling();
                return;
            }

            this.job = await response.json() as JobSnapshot;
            if (this.job.status === 'completed' || this.job.status === 'failed') {
                this.stopPolling();
            }
        }, 1500);
    }

    private stopPolling() {
        if (this.poller !== undefined) {
            window.clearInterval(this.poller);
            this.poller = undefined;
        }
    }

    private getStatusHeadline(job?: JobSnapshot) {
        if (!job) {
            return 'Ready for a new upload';
        }

        if (job.status === 'failed') {
            return job.error ? `Failed: ${job.error}` : 'Processing failed';
        }

        if (job.status === 'completed') {
            return 'Processing complete';
        }

        return `Processing ${job.fileName}`;
    }

    private getDefaultStepDetail(step: Step) {
        if (step.status === 'completed') {
            return 'Done.';
        }

        if (step.status === 'in_progress') {
            return 'Working…';
        }

        return 'Waiting for earlier steps.';
    }

    private async copyArtifact(key: string, content: string) {
        await navigator.clipboard.writeText(content);
        this.copiedArtifactKey = key;
        window.setTimeout(() => {
            if (this.copiedArtifactKey === key) {
                this.copiedArtifactKey = undefined;
            }
        }, 1500);
    }
}

customElements.define('rpg-session-ui', RpgSessionUi);
