export const lyricsPrompt = (story: string): string => `
When writing the song lyrics, use square brackets to denote the verse and chorus on a line preceding the section.
For spoken parts, use square brackets with the sound of the voice such as [Female spoken line] or [Deep male spoken line].

Here is an example:

[Verse 1]
In the land where shadows creep,  
Heroes rise from their sleep.
[Deep male spoken line] "We must stand tall, for the night is deep!"  
Through the dark, our spirits leap,  
To the dawn, our hopes we keep.

[Chorus]
Sing the song of light and might,  
Through the darkest, longest night.  
With hearts ablaze, we'll win the fight,  
Together strong, we'll make it right.

Here is the story for which you will write a song:

${story}

Turn the above story into a song that tells the story.
Include a speaking part in each verse, where a character from the story says a line that fits with the verse.
Keep it short, no more than 3 verses and a repeated chorus that is easy to sing to.
Only include the song lyrics in your response. Do not include any explanations, title, or other text.
`.trim();
