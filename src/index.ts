import fs from 'fs';
import { storyPrompt, summaryPrompt } from './prompts.js';
import { storyPath, summaryPath } from './fs.js';
import { initializeMessages, sendNewMessage } from './model.js';

const messages = await initializeMessages();

console.log('Generating story from audio...');
const story = await sendNewMessage(messages, storyPrompt);
fs.writeFileSync(storyPath, story, 'utf-8');
console.log(`Story saved to ${storyPath}`);

console.log('Generating session summary...');
const summary = await sendNewMessage(messages, summaryPrompt);
fs.writeFileSync(summaryPath, summary, 'utf-8');
console.log(`Summary saved to ${summaryPath}`);
