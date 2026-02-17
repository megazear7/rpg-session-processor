export const lyricsPrompt = (story: string, verseCount: number): string => `
When writing the song lyrics, use square brackets to denote the verse and chorus on a line preceding the section.
For spoken parts, use square brackets with the sound of the voice such as [Female spoken line] or [Deep male spoken line], do not include the name of the character speaking, just describe the sound of their voice.

Here is an example:

"""
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
"""

Here is the story for which you will write a song:
"""
${story}
"""

Turn the above story into a song that tells the story.
Include a speaking part in at least one verse, where a character from the story says a line that fits with the verse.
Remember to not include the character's name, just describe the sound of their voice in square brackets.
Include a repeated chorus that is easy to sing to and ${verseCount} verses that tell the story in more detail.
Only include the song lyrics in your response. Do not include any explanations, title, or other text.
`.trim();
