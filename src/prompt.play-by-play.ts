export const playByPlayPrompt = (bulletPoints: string, length: number): string => `
Overview of tabletop RPG session:
${bulletPoints}

You have been given an overview containing the key events from a TTRPG session.
Your task is to provide a concise play by play of the session.
Focus on the players, their actions, and events in the game at the table, not the in-world story.
Use short sentences and simple language so it is easy for the game master to quickly review what happened.
Focus on the meta aspects of the session rather than the in-world narrative.
Focus on details that will be important for the game master to remember for future sessions.
This could include player decisions, characters that died or were introduced, loot acquired, experience gained, and important plot points.
It should be about ${length} words in length.
Do not mention the word count in the summary and do not include any "Here is your summary" preamble.
`.trim();
