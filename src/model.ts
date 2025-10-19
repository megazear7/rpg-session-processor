import OpenAI from 'openai';
import path from "path";
import { env } from './env.js';
import { promises as fs } from 'fs';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export const model = 'gpt-audio-2025-08-28';

export const client = new OpenAI({
    apiKey: env.MODEL_API_KEY,
    baseURL: 'https://api.openai.com/v1',
});

export async function sendAndSave(audioFile: string, outputFile: string, prompt: string): Promise<void> {
    const filePath = path.join(process.cwd(), 'output', outputFile);
    console.log(`Generating ${outputFile}...`);
    const summary = await sendMessage(audioFile, prompt.trim());
    await fs.writeFile(filePath, summary, 'utf-8');
    console.log(`Response saved to ${outputFile}`);
}

export async function sendMessage(audioFile: string, prompt: string): Promise<string> {
    return getResponse(await buildMessages(audioFile, prompt));
}

export async function getResponse(messages: Array<ChatCompletionMessageParam>): Promise<string> {
    const response = await client.chat.completions.create({ model, messages });

    return response.choices[0]?.message?.content || '';
}

export async function buildMessages(audioFile: string, prompt: string): Promise<Array<ChatCompletionMessageParam>> {
    const filePath = path.join(process.cwd(), 'input', audioFile);

    try {
        await fs.access(filePath);
    } catch {
        throw new Error(`Audio file not found at ${filePath}`);
    }

    const audioBuffer = await fs.readFile(filePath);
    const base64Audio = audioBuffer.toString('base64');
    const messages: Array<ChatCompletionMessageParam> = [];

    messages.push(
        {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: prompt
                },
                {
                    type: 'input_audio',
                    input_audio: {
                        data: base64Audio,
                        format: 'mp3',
                    },
                }
            ]
        }
    );

    return messages;
}
