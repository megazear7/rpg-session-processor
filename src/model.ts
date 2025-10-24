import OpenAI from 'openai';
import path from "path";
import { env } from './env.js';
import { promises as fs } from 'fs';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { fileTypeFromBuffer } from 'file-type';
import ffmpeg from 'fluent-ffmpeg';

export const audioModel = 'gpt-audio-2025-08-28';
export const textModel = 'gpt-4.1-2025-04-14';

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
    console.log(`🚀 Starting processing for audio file: ${audioFile}`);

    const instructions = await readInstructions();
    const enhancedPrompt = instructions ? `${instructions}\n\n${prompt}` : prompt;

    const filePath = await validateAudioFile(audioFile);
    const duration = await getAudioDuration(filePath);
    console.log(`📏 Audio duration: ${formatDuration(duration)}`);

    const maxDuration = 30 * 60; // 30 minutes in seconds

    if (duration <= maxDuration) {
        console.log('⚡ Audio is short enough for direct transcription');
        return await transcribeDirect(audioFile, enhancedPrompt);
    }

    console.log('✂️  Audio is long, splitting into parts');
    const transcriptions = await splitAndTranscribe(audioFile, filePath, duration, maxDuration, enhancedPrompt);

    console.log('🔗 Synthesizing transcriptions into final result');
    const finalResult = await synthesizeTranscriptions(transcriptions, instructions);

    console.log('🧹 Cleaning up progress files');
    await cleanupProgressFiles(audioFile);

    console.log('✅ Processing completed successfully');
    return finalResult;
}

async function validateAudioFile(audioFile: string): Promise<string> {
    const filePath = path.join(process.cwd(), 'input', audioFile);
    console.log(`🔍 Validating audio file: ${filePath}`);

    try {
        await fs.access(filePath);
    } catch {
        throw new Error(`Audio file not found: ${filePath}`);
    }

    // Read and validate file type
    const audioBuffer = await fs.readFile(filePath);
    if (audioBuffer.length === 0) {
        throw new Error(`Audio file is empty: ${filePath}`);
    }

    const fileType = await fileTypeFromBuffer(audioBuffer);
    if (!fileType || fileType.mime !== 'audio/mpeg') {
        throw new Error(`File is not a valid MP3: ${filePath}`);
    }

    console.log('✅ Audio file validated');
    return filePath;
}

async function transcribeDirect(audioFile: string, prompt: string): Promise<string> {
    console.log('🎙️  Starting direct transcription');
    const messages = await buildMessages(audioFile, prompt);
    const result = await getResponse(messages);
    console.log('🎙️  Direct transcription completed');
    return result;
}

async function splitAndTranscribe(
    audioFile: string,
    filePath: string,
    duration: number,
    maxDuration: number,
    prompt: string
): Promise<string[]> {
    const parts = Math.ceil(duration / maxDuration);
    const transcriptions: string[] = [];
    console.log(`📊 Total parts to process: ${parts}`);

    for (let i = 0; i < parts; i++) {
        const partIndex = i + 1;
        const progressFile = getProgressFileName(audioFile, partIndex);

        // Check if this part is already transcribed
        try {
            const existingTranscription = await fs.readFile(progressFile, 'utf-8');
            if (existingTranscription.trim()) {
                console.log(`⏭️  Skipping part ${partIndex}/${parts} (already transcribed)`);
                transcriptions.push(existingTranscription);
                continue;
            }
        } catch {
            // File doesn't exist or is empty, proceed
        }

        console.log(`🎵 Processing part ${partIndex}/${parts}`);
        const startTime = i * maxDuration;
        const partDuration = Math.min(maxDuration, duration - startTime);
        const partFile = `${audioFile}_part_${partIndex}.mp3`;
        const partPath = path.join(process.cwd(), 'input', partFile);

        console.log(`✂️  Creating audio part: ${partFile} (${formatDuration(partDuration)})`);
        await splitAudio(filePath, partPath, startTime, partDuration);

        console.log(`🎙️  Transcribing part ${partIndex}`);
        const partTranscription = await getResponse(await buildMessages(partFile, prompt));

        // Persist progress
        await fs.writeFile(progressFile, partTranscription, 'utf-8');
        console.log(`💾 Saved transcription for part ${partIndex}`);

        transcriptions.push(partTranscription);

        // Clean up part file
        await fs.unlink(partPath);
        console.log(`🗑️  Cleaned up temporary file: ${partFile}`);
    }

    console.log('📝 All parts transcribed');
    return transcriptions;
}

async function synthesizeTranscriptions(transcriptions: string[], instructions: string | null): Promise<string> {
    console.log('🤖 Starting synthesis with text model');

    const instructionsText = instructions ? `\n\nAdditional Instructions:\n${instructions}` : '';

    const synthesisPrompt = `You are given transcriptions from different parts of a single audio file. Each transcription comes from an audio model that listened to a 30-minute segment of the full audio. Your task is to combine these transcriptions into a single, coherent transcription of the entire audio file. Ensure the combined text flows naturally, removing any redundancies or overlaps between parts. Do not add any new content or interpretations.${instructionsText}

Transcriptions:
${transcriptions.map((t, i) => `Part ${i + 1}: ${t}`).join('\n\n')}

Combined transcription:`;

    const synthesisMessages: Array<ChatCompletionMessageParam> = [
        {
            role: 'user',
            content: synthesisPrompt,
        },
    ];

    const result = await getResponse(synthesisMessages, textModel);
    console.log('🤖 Synthesis completed');
    return result;
}

async function cleanupProgressFiles(audioFile: string): Promise<void> {
    const outputDir = path.join(process.cwd(), 'output');
    const files = await fs.readdir(outputDir);
    const progressFiles = files.filter(file => file.startsWith(`${audioFile}_part_`) && file.endsWith('.txt'));

    for (const file of progressFiles) {
        await fs.unlink(path.join(outputDir, file));
        console.log(`🗑️  Cleaned up progress file: ${file}`);
    }
}

function getProgressFileName(audioFile: string, partIndex: number): string {
    return path.join(process.cwd(), 'output', `${audioFile}_part_${partIndex}.txt`);
}

function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export async function getResponse(messages: Array<ChatCompletionMessageParam>, model: string = audioModel): Promise<string> {
    const config: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages
    };

    if (model === audioModel) {
        config['modalities'] = ['text'];
    }

    const response = await client.chat.completions.create(config);
    return response.choices[0]?.message?.content || '';
}

export async function buildMessages(audioFile: string, prompt: string): Promise<Array<ChatCompletionMessageParam>> {
    const filePath = path.join(process.cwd(), 'input', audioFile);
    console.log(`Reading audio file from ${filePath}...`);

    // Check if file exists
    try {
        await fs.access(filePath);
    } catch {
        throw new Error(`Audio file not found at ${filePath}`);
    }

    // Read and validate file
    const audioBuffer = await fs.readFile(filePath);
    if (audioBuffer.length === 0) {
        throw new Error(`Audio file is empty: ${filePath}`);
    }

    // Validate file type
    const fileType = await fileTypeFromBuffer(audioBuffer);
    if (!fileType || fileType.mime !== 'audio/mpeg') {
        throw new Error(`File is not a valid MP3: ${filePath}`);
    }

    // Encode to base64
    const base64Audio = audioBuffer.toString('base64');
    if (base64Audio.length === 0) {
        throw new Error('Failed to encode audio file to base64');
    }

    const messages: Array<ChatCompletionMessageParam> = [
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
                {
                    type: 'text',
                    text: prompt,
                },
            ],
        },
    ];

    return messages;
}

async function getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
            if (err) reject(err);
            else resolve(metadata.format.duration || 0);
        });
    });
}

async function splitAudio(filePath: string, partPath: string, startTime: number, partDuration: number): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg(filePath)
            .setStartTime(startTime)
            .setDuration(partDuration)
            .output(partPath)
            .on('end', () => resolve())
            .on('error', reject)
            .run();
    });
}

async function readInstructions(): Promise<string | null> {
    const instructionsPath = path.join(process.cwd(), 'input', 'instructions.txt');
    try {
        const instructions = await fs.readFile(instructionsPath, 'utf-8');
        return instructions.trim() || null;
    } catch {
        console.log('⚠️  Instructions file not found or empty, proceeding without it');
        return null;
    }
}
