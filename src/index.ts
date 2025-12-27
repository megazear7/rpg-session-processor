import { sendAndSave } from './model.js';
import { audioFileName } from './cli.js';
import { config } from './config.js';

console.log(`🎵 Processing audio file: ${audioFileName}`);

await sendAndSave(audioFileName);
