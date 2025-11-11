import { sendAndSave } from './model.js';
import { audioFileName } from './cli.js';

console.log(`🎵 Processing audio file: ${audioFileName}`);

await sendAndSave(audioFileName, 4);
