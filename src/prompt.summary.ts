export const summaryPrompt = (bulletPoints: string, length: number): string => `
Overview of tabletop roleplaying session:
${bulletPoints}

You have been given an overview containing the key events from a tabletop roleplaying session.
Your task is to write a single paragraph summary of the session in ${length * 0.5} and ${length * 1.5} words or less.
Focus on the most important and memorable details from the session.
Focus on how the session started and ended. Skip over less important middle parts.
Use clear and concise language to create a summary that is easy to read and understand.
Do not mention the word count in the summary and do not include any "Here is your summary" preamble.
`.trim();
