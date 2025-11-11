export const bulletPointsPrompt = (): string => `
Provide a bullet point list in chronological order of the main events that happened in this RPG session.
Be concise but descriptive, focusing on key actions and events.
Use clear language suitable for summarizing RPG gameplay.
Make sure to distinguish between player actions and in-world events.
Each bullet point should be a single sentence.
Do not mention particular dice rolls.
Do not include any introductory or concluding statements such as "Here are the bullet points".
`.trim();
