export const synthesisPrompt = (bulletPoints: string[]): string => `
Bullet Points:
${bulletPoints.map((t, i) => `Part ${i + 1}: ${t}`).join('\n\n')}

You have been given bullet points from different parts of a single audio file.
Each bullet point comes from an audio model that listened to a segment of the full audio.
Your task is to combine these bullet points into a single, coherent list of bullet points of the entire audio file.
Ensure the combined text flows naturally, removing any redundancies or overlaps between parts.
Do not add any new content or interpretations.
Do not include any "here is your transcription" preamble.
`.trim();
