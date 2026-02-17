export const storyPrompt = (bulletPoints: string, length: number): string => `
Overview of tabletop roleplaying session:
${bulletPoints}

You have been given an overview containing the key events from a tabletop roleplaying session.
Your task is to create an engaging and narrative-driven story of this session.
It should be written in paragraph form and focus on the actions of the characters in the story, not the game mechanics or rules.
The story should capture the essence of the session, including key events, character decisions, and plot developments.
Do not list events in bullet points. Instead, write a cohesive narrative.
Do not write like AI. Instead, write like a very good fantasy author.
Avoid words that AI typically uses, such as "shadowy", "whisper", "rhythm", and "threads".
It should be between ${length * 0.5} and ${length * 1.5} words in length.
Do not mention the word count in the story and do not include any "Here is your story" preamble.
`.trim();
