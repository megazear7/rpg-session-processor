import OpenAI from 'openai';
import path from "path";
import { promises as fs } from 'fs';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { fileTypeFromBuffer } from 'file-type';
import ffmpeg from 'fluent-ffmpeg';
import { textClientModel, audioClientModel, ClientModel } from './models.js';
import { synthesisPrompt } from './prompt.synthesis.js';
import { titlePrompt } from './prompt.title.js';
import { adjustmentPrompt } from './prompt.adjustment.js';

export const outputDir = path.join(process.cwd(), 'output');

/**
 * @param audioFile The audio file to process
 * @param outputName The name of the output file
 * @param length The number of words per minute of audio
 * @param prompt The prompt to use for generation
 */
export async function sendAndSave(audioFile: string, outputName: string, wordsPerMinute: number, prompt: string): Promise<void> {
    // Prepare output directory and prompts
    console.log(`🚀 Generating ${outputName}...`);
    await fs.mkdir(outputDir, { recursive: true });
    const audioFileBase = path.basename(audioFile, path.extname(audioFile));
    const instructionsPath = path.join(process.cwd(), 'instructions.txt');
    const instructions = await fs.readFile(instructionsPath, 'utf-8');
    const length = await determineLengthInMinutes(audioFile) * wordsPerMinute;

    // Create full output
    const renderedPrompt = `${instructions}\n\n${prompt}`;
    const content = await sendMessage(audioFile, renderedPrompt.trim());
    const filePathFull = path.join(process.cwd(), 'output', `${audioFileBase}-${outputName}-full.txt`);
    await fs.writeFile(filePathFull, content, 'utf-8');

    // Create final output
    const finalContent = await adjustContentLength(content, length);
    const filePathFinal = path.join(process.cwd(), 'output', `${audioFileBase}-${outputName}.txt`);
    await fs.writeFile(filePathFinal, finalContent, 'utf-8');

    // Create title
    const titlePathFull = path.join(process.cwd(), 'output', `${audioFileBase}-title.txt`);
    await createTitle(finalContent, titlePathFull);
    console.log(`🚀 Response saved to ${filePathFinal}`);
}

/**
 * Returns the number of words to use based on audio length and factor.
 * @param audioFile The audio file to determine length for
 * @returns The adjusted length in words
 */
export async function determineLengthInMinutes(audioFile: string): Promise<number> {
    const filePath = path.join(process.cwd(), 'input', audioFile);
    const duration = await getAudioDuration(filePath);
    return Math.ceil(duration / 60);
}

export async function sendMessage(audioFile: string, prompt: string): Promise<string> {
    console.log(`🚀 Starting processing for audio file: ${audioFile}`);

    const filePath = await validateAudioFile(audioFile);
    const duration = await getAudioDuration(filePath);
    console.log(`📏 Audio duration: ${formatDuration(duration)}`);

    const maxDuration = 30 * 60; // 30 minutes in seconds

    if (duration <= maxDuration) {
        console.log('⚡ Audio is short enough for direct transcription');
        return await transcribeDirect(audioFile, prompt);
    }

    console.log('✂️  Audio is long, splitting into parts');
    const transcriptions = await splitAndTranscribe(audioFile, filePath, duration, maxDuration, prompt);

    console.log('🔗 Synthesizing transcriptions into final result');
    const finalResult = await synthesizeTranscriptions(transcriptions);

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
    const result = await getResponse(messages, audioClientModel);
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
        const partTranscription = await getResponse(await buildMessages(partFile, prompt), audioClientModel);

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

async function synthesizeTranscriptions(transcriptions: string[]): Promise<string> {
    console.log('🤖 Starting synthesis with text model');

    const synthesisMessages: Array<ChatCompletionMessageParam> = [
        {
            role: 'user',
            content: synthesisPrompt(transcriptions),
        },
    ];

    const result = await getResponse(synthesisMessages, textClientModel);
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

export async function getResponse(messages: Array<ChatCompletionMessageParam>, model: ClientModel): Promise<string> {
    const chatConfig: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: model.model,
        messages
    };

    if (model.model === textClientModel.model) {
        chatConfig['modalities'] = ['text'];
    }

    const response = await model.client.chat.completions.create(chatConfig);
    return response.choices[0]?.message?.content || '';
}

export async function buildMessages(audioFile: string, prompt: string): Promise<Array<ChatCompletionMessageParam>> {
    const filePath = path.join(process.cwd(), 'input', audioFile);
    console.log(`🔍 Reading audio file from ${filePath}...`);

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

export async function createTitle(story: string, outputFile: string): Promise<void> {
    const response = await textClientModel.client.chat.completions.create({
        model: textClientModel.model,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: titlePrompt(story),
                    },
                ],
            },
        ]
    });
    const title = response.choices[0]?.message?.content || '';
    console.log(`📝 Title: ${title}`);
    await fs.writeFile(outputFile, title, 'utf-8');
    console.log(`💾 Saved title to ${outputFile}`);
}

async function adjustContentLength(content: string, targetWordCount: number): Promise<string> {
    console.log(`📝 Adjusting content to approximately ${targetWordCount} words using text model`);

    const currentWordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    console.log(`📊 Current word count: ${currentWordCount}, Target: ${targetWordCount}`);

    if (Math.abs(currentWordCount - targetWordCount) / targetWordCount < 0.1) {
        console.log('✅ Content already close to target length, skipping adjustment');
        return content;
    }

    const messages: Array<ChatCompletionMessageParam> = [
        {
            role: 'user',
            content: adjustmentPrompt(content, targetWordCount, currentWordCount),
        },
    ];

    const adjustedContent = await getResponse(messages, textClientModel);

    const finalWordCount = adjustedContent.split(/\s+/).filter(word => word.length > 0).length;
    console.log(`📝 Content adjusted to ${finalWordCount} words`);

    return adjustedContent;
}
