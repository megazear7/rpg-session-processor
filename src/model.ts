import OpenAI from 'openai';
import { env } from './env.js';
import fs from 'fs';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { audioPath } from './fs.js';

export const model = 'gpt-audio-2025-08-28';

export const client = new OpenAI({
    apiKey: env.MODEL_API_KEY,
    baseURL: 'https://api.openai.com/v1',
});

export async function initializeMessages(): Promise<Array<ChatCompletionMessageParam>> {
    if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found at ${audioPath}`);
    }

    const audioBuffer = fs.readFileSync(audioPath);
    const base64Audio = audioBuffer.toString('base64');
    return [
        {
            role: 'user',
            content: [
                {
                    type: 'input_audio',
                    input_audio: {
                        data: base64Audio,
                        format: 'mp3',
                    },
                },
            ],
        },
    ];
}

export async function getResponse(messages: Array<ChatCompletionMessageParam>): Promise<string> {
    const response = await client.chat.completions.create({ model, messages });

    return response.choices[0]?.message?.content || '';
}

export function addMessage(messages: Array<ChatCompletionMessageParam>, prompt: string) {
    messages.push({ role: 'user', content: [ { type: 'text', text: prompt } ] });
}

export async function sendNewMessage(messages: Array<ChatCompletionMessageParam>, prompt: string): Promise<string> {
    addMessage(messages, prompt);
    return getResponse(messages);
}
