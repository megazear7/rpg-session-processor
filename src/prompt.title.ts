export const titlePrompt = (story: string): string => `
${story}

You have been given a detailed narrative of a TTRPG session.
Your task is to create a concise and descriptive title for the above content.
Do not include any quotes or punctuation.
Do not include any "here is your title" preamble in the title.
`.trim();
