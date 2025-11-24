export const imagePrompt = (story: string): string => `
${story}

Pick a scene from the above story and provide a Midjourney prompt for the chosen scene.
The prompt should be descriptive and vivid, capturing the essence of the scene.
Do not include any "here is your prompt" preamble in the prompt.
`.trim();
