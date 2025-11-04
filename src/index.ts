import { sendAndSave } from './model.js';
import { summaryPrompt } from './prompt.summary.js';
import { storyPrompt } from './prompt.story.js';
import { audioFileName } from './cli.js';

console.log(`🎵 Processing audio file: ${audioFileName}`);
await sendAndSave(audioFileName, 'story', 6, storyPrompt());
await sendAndSave(audioFileName, 'summary', 3, summaryPrompt());
