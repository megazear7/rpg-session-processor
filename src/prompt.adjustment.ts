export const adjustmentPrompt = (content: string, targetWordCount: number, currentWordCount: number): string => `
You are given text content and need to adjust it to be approximately ${targetWordCount} words in length. The original content has ${currentWordCount} words.

Please modify the content to meet the target word count while:
- Maintaining the core meaning and key information
- Preserving the original structure and flow
- Keeping the same level of detail and style
- Not adding new information or interpretations
- Making reasonable expansions or contractions as needed

If the content needs to be expanded, add relevant details that would naturally fit. If it needs to be condensed, remove redundant information while keeping essential points.

Original content:
${content}

Adjusted content (${targetWordCount} words):
`;
