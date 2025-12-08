export const songPrompt = (story: string): string => `
${story}

Turn the above story into a song that tells the story.
Include a speaking part in each verse, where a character from the story says a line that fits with the verse.
Keep it short, no more than 3 verses and a repeated chorus that is easy to sing to.
`.trim();
