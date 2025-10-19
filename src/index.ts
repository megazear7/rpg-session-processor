import { sendAndSave } from './model.js';

await sendAndSave('audio.mp3', 'story.txt', `
You are an expert game master and writer specializing in tabletop roleplaying games.
I will provide an audio file containing a recorded TTRPG session.
Your task is to listen to the audio, analyze the content, and create an engaging and narrative-driven session summary.
It should be written in paragraph form and focus on the actions of the characters in the story, not the game mechanics or rules.
The summary should capture the essence of the session, including key events, character decisions, and plot developments.
Do not list events in bullet points. Instead, weave them into a cohesive narrative that reflects the flow of the session.
Do not write like AI. Instead, write like a very good fantasy author.
It should be 200-400 words.
Do not mention the word count in the summary and do not include any "Here is your story" preamble.
`);

await sendAndSave('audio.mp3', 'summary.txt', `
Please provide a concise summary of the session audio.
Focus on the players, their actions, and events in the game at the table, not the in-world story.
Use bullet points, short sentences, and simple language so it is easy for the game master to quickly review what happened.
It should be 100-200 words.
Do not mention the word count in the summary and do not include any "Here is your summary" preamble.
`);
