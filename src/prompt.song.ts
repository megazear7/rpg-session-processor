export const songPrompt = (lyrics: string, example: string, songMod: string | undefined): string => `
Create a Suno prompt describing a song based on the following lyrics:

Lyrics:
"""
${lyrics.trim()}
"""

The prompt should be similar to the example below, but tailored to the provided lyrics.

Example Prompt:
"""
${example.trim()}
"""
${songMod ? `\nModify. the example song based on this description: ${songMod}\n` : ''}
Only include the song description in your response.
Do not include the lyrics or any other text.
Keep it a similar length to the example prompt.
`.trim();
