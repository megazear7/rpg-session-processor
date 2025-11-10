import { sendAndSave } from './model.js';
import { summaryPrompt } from './prompt.summary.js';
import { storyPrompt } from './prompt.story.js';
import { audioFileName } from './cli.js';

console.log(`🎵 Processing audio file: ${audioFileName}`);
await sendAndSave(audioFileName, 'bullet', 1.5, `
Provide a bullet point list in chronological order of the main events that happened in this RPG session.
Be concise but descriptive, focusing on key actions and events.
Use clear language suitable for summarizing RPG gameplay.
`);
// await sendAndSave(audioFileName, 'story', 4, storyPrompt());
// await sendAndSave(audioFileName, 'summary', 2, summaryPrompt());
