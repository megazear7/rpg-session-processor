export const synthesisPrompt = (transcriptions: string[]): string => `
You are given transcriptions from different parts of a single audio file.
Each transcription comes from an audio model that listened to a 30-minute segment of the full audio.
Your task is to combine these transcriptions into a single, coherent transcription of the entire audio file.
Ensure the combined text flows naturally, removing any redundancies or overlaps between parts.
Do not add any new content or interpretations.

Transcriptions:
${transcriptions.map((t, i) => `Part ${i + 1}: ${t}`).join('\n\n')}

Do not include any "here is your transcription" preamble.
`;
