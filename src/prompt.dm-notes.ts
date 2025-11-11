export const dmNotesPrompt = (bulletPoints: string, length: number): string => `
Overview of tabletop RPG session:
${bulletPoints}

You have been given an overview containing the key events from a TTRPG session.
Focus on the most important details that the game master needs to remember for future sessions.
Take note characters that died or were introduced, loot acquired, experience gained, and important plot points.
Use clear and concise language to create a summary that is easy to read and understand and is written in paragraph form.
Focus on how the session ended so that the game master can pick up where they left off.
It should be about ${length} words in length.
Do not mention the word count in the summary and do not include any "Here is your summary" preamble.
`.trim();
