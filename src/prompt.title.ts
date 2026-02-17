export const titlePrompt = (story: string): string => `
${story}

You have been given a detailed narrative of a table top roleplaying session.
Your task is to create a concise and engaging title for the above content.
the title should capture the essence of the story and entice potential readers to explore it further.
Do not include any quotes or punctuation.
Do not include any "here is your title" preamble in the title.
`.trim();
