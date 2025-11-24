import OpenAI from 'openai';
import path from "path";
import { promises as fs } from 'fs';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { fileTypeFromBuffer } from 'file-type';
import ffmpeg from 'fluent-ffmpeg';
import { textClientModel, audioClientModel, ClientModel } from './models.js';
import { synthesisPrompt } from './prompt.synthesis.js';
import { titlePrompt } from './prompt.title.js';
import { bulletPointsPrompt } from './prompt.bullet-points.js';
import { playByPlayPrompt } from './prompt.play-by-play.js';
import { storyPrompt } from './prompt.story.js';
import { dmNotesPrompt } from './prompt.dm-notes.js';
import { summaryPrompt } from './prompt.summary.js';
import { createEvent } from './contentful.js';
import { imagePrompt } from './prompt.image.js';

export const outputDir = path.join(process.cwd(), 'output');
export const instructionsPath = path.join(process.cwd(), 'instructions.txt');
export const instructions = await fs.readFile(instructionsPath, 'utf-8');

/**
 * @param audioFile The audio file to process
 * @param outputName The name of the output file
 * @param length The number of words per minute of audio
 * @param prompt The prompt to use for generation
 */
export async function sendAndSave(audioFile: string, wordsPerMinute: number): Promise<void> {
    // Prepare output directory and prompts
    console.log(`🚀 Generating...`);
    await fs.mkdir(outputDir, { recursive: true });

    // Prepare audio file (convert M4A to MP3 if needed)
    const { processedAudioFile, convertedFilePath } = await prepareAudioFile(audioFile);

    const audioFileBase = path.basename(processedAudioFile, path.extname(processedAudioFile));
    const baseLength = await determineLengthInMinutes(processedAudioFile) * wordsPerMinute;

    console.log(`🎧 Audio file processed: ${processedAudioFile}`);
    console.log(`⏳ Estimated length: ${baseLength} minutes`);

    // Create bullet point summary from the audio
    const bulletPointsPromptRendered = bulletPointsPrompt();
    const bulletPoints = await sendAudioMessage(processedAudioFile, bulletPointsPromptRendered);
    const bulletPointsPath = path.join(process.cwd(), 'output', `${audioFileBase}-bullet-points.txt`);
    await fs.writeFile(bulletPointsPath, bulletPoints, 'utf-8');
    console.log(`🚀 Bullet Points saved to ${bulletPointsPath}`);

    // Create session summary from the bullet points
    const playByPlayWordCount = Math.ceil(baseLength * 0.8);
    const playByPlayPromptRendered = playByPlayPrompt(bulletPoints, playByPlayWordCount);
    const playByPlay = await sendTextMessage(playByPlayPromptRendered);
    const playByPlayPath = path.join(process.cwd(), 'output', `${audioFileBase}-play-by-play.txt`);
    await fs.writeFile(playByPlayPath, playByPlay, 'utf-8');
    console.log(`🚀 Play by Play saved to ${playByPlayPath}`);

    // Create dm notes from the bullet points
    const dmNotesWordCount = Math.ceil(baseLength * 0.6);
    const dmNotesPromptRendered = dmNotesPrompt(bulletPoints, dmNotesWordCount);
    const dmNotes = await sendTextMessage(dmNotesPromptRendered);
    const dmNotesPath = path.join(process.cwd(), 'output', `${audioFileBase}-dm-notes.txt`);
    await fs.writeFile(dmNotesPath, dmNotes, 'utf-8');
    console.log(`🚀 DM Notes saved to ${dmNotesPath}`);

    // Create a summary from the bullet points
    const summaryWordCount = Math.ceil(baseLength * 0.4);
    const summaryPromptRendered = summaryPrompt(bulletPoints, summaryWordCount);
    const summary = await sendTextMessage(summaryPromptRendered);
    const summaryPath = path.join(process.cwd(), 'output', `${audioFileBase}-summary.txt`);
    await fs.writeFile(summaryPath, summary, 'utf-8');
    console.log(`🚀 Summary saved to ${summaryPath}`);

    // Create story from the bullet points
    const storyWordCount = Math.ceil(baseLength * 1.2);
    const storyPromptRendered = storyPrompt(bulletPoints, storyWordCount);
    const story = await sendTextMessage(storyPromptRendered);
    const storyPath = path.join(process.cwd(), 'output', `${audioFileBase}-story.txt`);
    await fs.writeFile(storyPath, story, 'utf-8');
    console.log(`🚀 Story saved to ${storyPath}`);

    // Create title
    const titlePromptRendered = titlePrompt(story);
    const title = await sendTextMessage(titlePromptRendered);
    const titlePath = path.join(process.cwd(), 'output', `${audioFileBase}-title.txt`);
    await fs.writeFile(titlePath, title, 'utf-8');
    console.log(`🚀 Title saved to ${titlePath}`);

    const imagePromptRendered = imagePrompt(story);
    const image = await sendTextMessage(imagePromptRendered);
    const imagePath = path.join(process.cwd(), 'output', `${audioFileBase}-image.txt`);
    await fs.writeFile(imagePath, image, 'utf-8');
    console.log(`🚀 Image saved to ${imagePath}`);

    console.log('🚀 Sending to Contentful');
    await createEvent(title, summary, story, dmNotes);
}

async function sendTextMessage(prompt: string): Promise<string> {
    console.log(`🚀 Sending message to text model`);
    const messages: Array<ChatCompletionMessageParam> = [
        {
            role: 'system',
            content: instructions,
        },
        {
            role: 'user',
            content: prompt,
        },
    ];
    const result = await getResponse(messages, textClientModel);
    console.log(`🚀 Message processing completed`);
    return result;
}

/**
 * Returns the number of words to use based on audio length and factor.
 * @param audioFile The audio file to determine length for
 * @returns The adjusted length in words
 */
async function determineLengthInMinutes(audioFile: string): Promise<number> {
    const filePath = path.join(process.cwd(), 'input', audioFile);
    const duration = await getAudioDuration(filePath);
    return Math.ceil(duration / 60);
}

async function sendAudioMessage(audioFile: string, prompt: string): Promise<string> {
    console.log(`🚀 Starting processing for audio file: ${audioFile}`);

    const maxDuration = 45 * 60; // 45 minutes in seconds
    const filePath = await validateAudioFile(audioFile);
    const duration = await getAudioDuration(filePath);
    console.log(`📏 Audio duration: ${formatDuration(duration)}`);

    if (duration <= maxDuration) {
        console.log('⚡ Audio is short enough for direct listening');
        return await listenDirect(audioFile, prompt);
    }

    console.log('✂️  Audio is long, splitting into parts');
    const bulletPoints = await splitAndListen(audioFile, filePath, duration, maxDuration, prompt);

    console.log('🔗 Synthesizing bullet points into final result');
    const finalResult = await sendTextMessage(synthesisPrompt(bulletPoints));

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

async function listenDirect(audioFile: string, prompt: string): Promise<string> {
    console.log('🎙️  Listen directly');
    const messages = await buildAudioMessages(audioFile, prompt);
    const result = await getResponse(messages, audioClientModel);
    console.log('🎙️  Listen directly completed');
    return result;
}

async function splitAndListen(
    audioFile: string,
    filePath: string,
    duration: number,
    maxDuration: number,
    prompt: string
): Promise<string[]> {
    const parts = Math.ceil(duration / maxDuration);
    const bulletPoints: string[] = [];
    console.log(`📊 Total parts to process: ${parts}`);

    for (let i = 0; i < parts; i++) {
        const partIndex = i + 1;
        const progressFile = getProgressFileName(audioFile, partIndex);

        try {
            const existingBulletPoints = await fs.readFile(progressFile, 'utf-8');
            if (existingBulletPoints) {
                console.log(`⏭️  Skipping part ${partIndex}/${parts}`);
                bulletPoints.push(existingBulletPoints);
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

        console.log(`🎙️  Listening to part ${partIndex}`);
        const messages = await buildAudioMessages(partFile, prompt);
        const partBulletPoints = await getResponse(messages, audioClientModel);

        // Persist progress
        await fs.writeFile(progressFile, partBulletPoints, 'utf-8');
        console.log(`💾 Saved bullet points for part ${partIndex}`);

        bulletPoints.push(partBulletPoints);

        // Clean up part file
        await fs.unlink(partPath);
        console.log(`🗑️  Cleaned up temporary file: ${partFile}`);
    }

    console.log('📝 Listened to all parts');
    return bulletPoints;
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

async function getResponse(messages: Array<ChatCompletionMessageParam>, model: ClientModel): Promise<string> {
    const chatConfig: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: model.model,
        messages,
    };

    if (model.model === audioClientModel.model) {
        chatConfig['modalities'] = ['text'];
    }

    const response = await model.client.chat.completions.create(chatConfig);
    return response.choices[0]?.message?.content || '';
}

async function buildAudioMessages(audioFile: string, prompt: string): Promise<Array<ChatCompletionMessageParam>> {
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
            role: 'system',
            content: instructions,
        },
        {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: prompt,
                },
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

async function convertM4aToMp3(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('mp3')
            .on('end', () => resolve())
            .on('error', reject)
            .save(outputPath);
    });
}

async function prepareAudioFile(audioFile: string): Promise<{ processedAudioFile: string, convertedFilePath: string | null }> {
    const inputFilePath = path.join(process.cwd(), 'input', audioFile);
    const buffer = await fs.readFile(inputFilePath);
    let processedAudioFile = audioFile;
    let convertedFilePath: string | null = null;

    if (audioFile.toLowerCase().endsWith('.m4a')) {
        console.log('🔄 Converting M4A to MP3...');
        const audioFileBase = path.basename(audioFile, path.extname(audioFile));
        convertedFilePath = path.join(process.cwd(), 'input', `${audioFileBase}.mp3`);
        await convertM4aToMp3(inputFilePath, convertedFilePath);
        processedAudioFile = `${audioFileBase}.mp3`;
        console.log('✅ Conversion completed');
    }

    return { processedAudioFile, convertedFilePath };
}
