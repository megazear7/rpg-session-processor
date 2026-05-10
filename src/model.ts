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
import { lyricsPrompt } from './prompt.lyrics.js';
import { songPrompt } from './prompt.song.js';
import { config } from './config.js';

export const NO_INSTRUCTIONS = 'NO_INSTRUCTIONS';

export type ProcessingStepKey =
    | 'prepare'
    | 'transcribe'
    | 'diarize'
    | 'playByPlay'
    | 'dmNotes'
    | 'summarize'
    | 'story'
    | 'title'
    | 'image'
    | 'lyrics'
    | 'song'
    | 'publish';

export type ProcessingStepState = 'in_progress' | 'completed';

export type ProcessingArtifactKey =
    | 'bulletPoints'
    | 'playByPlay'
    | 'dmNotes'
    | 'summary'
    | 'story'
    | 'title'
    | 'imagePrompt'
    | 'lyricsPrompt'
    | 'songPrompt';

export interface ProcessingArtifact {
    key: ProcessingArtifactKey;
    label: string;
    fileName: string;
    content: string;
}

export interface SendAndSaveOptions {
    onStepUpdate?: (step: {
        key: ProcessingStepKey;
        status: ProcessingStepState;
        detail?: string;
    }) => Promise<void> | void;
    onArtifact?: (artifact: ProcessingArtifact) => Promise<void> | void;
}

export interface SendAndSaveResult {
    outputDir: string;
    audioFileBase: string;
    artifacts: ProcessingArtifact[];
}

/**
 * @param audioFile The audio file to process
 * @param outputName The name of the output file
 * @param length The number of words per minute of audio
 * @param prompt The prompt to use for generation
 */
export async function sendAndSave(audioFilePath: string, options: SendAndSaveOptions = {}): Promise<SendAndSaveResult> {
    const audioFile = path.basename(audioFilePath);
    const artifacts: ProcessingArtifact[] = [];
    // Prepare output directory and prompts
    console.log(`🚀 Generating...`);

    // Prepare audio file (convert M4A to MP3 if needed)
    await notifyStep(options, 'prepare', 'in_progress', 'Preparing audio for processing');
    const { processedAudioFile } = await prepareAudioFile(audioFile);
    await notifyStep(options, 'prepare', 'completed', `Audio ready: ${processedAudioFile}`);

    const audioFileBase = path.basename(processedAudioFile, path.extname(processedAudioFile));
    const baseLength = await determineBaseLength(processedAudioFile);
    const instructions = await fs.readFile('config/instructions.txt', 'utf-8');
    const exampleSong = await fs.readFile('config/song.txt', 'utf-8');
    const songMod = getSongMod();

    const outputDir = path.join('output', audioFileBase);
    await fs.mkdir(outputDir, { recursive: true });
    const progressDir = path.join('output', audioFileBase, 'progress');
    await fs.mkdir(progressDir, { recursive: true });

    console.log(`🎧 Audio file processed: ${processedAudioFile}`);
    console.log(`⏳ Estimated length: ${baseLength} words`);

    // Create bullet point summary from the audio
    const bulletPointsPromptRendered = bulletPointsPrompt();
    await notifyStep(options, 'transcribe', 'in_progress', 'Listening to the uploaded session');
    await notifyStep(options, 'diarize', 'in_progress', 'Inferring speaker changes from the audio context');
    const bulletPoints = await sendAudioMessage(outputDir, processedAudioFile, instructions, bulletPointsPromptRendered, options);
    const bulletPointsPath = await saveArtifact(outputDir, {
        key: 'bulletPoints',
        label: 'Bullet Points',
        fileName: `${audioFileBase}-bullet-points.txt`,
        content: bulletPoints,
    }, artifacts, options);
    console.log(`🚀 Bullet Points saved to ${bulletPointsPath}`);
    await notifyStep(options, 'transcribe', 'completed', 'Transcript outline created');
    await notifyStep(options, 'diarize', 'completed', 'Speaker context captured in bullet points');

    // Create session summary from the bullet points
    const playByPlayWordCount = Math.ceil(baseLength * 0.8);
    const playByPlayPromptRendered = playByPlayPrompt(bulletPoints, playByPlayWordCount);
    await notifyStep(options, 'playByPlay', 'in_progress', `Generating a detailed recap (${playByPlayWordCount} words target)`);
    const playByPlay = await sendTextMessage(instructions, playByPlayPromptRendered);
    const playByPlayPath = await saveArtifact(outputDir, {
        key: 'playByPlay',
        label: 'Play by Play',
        fileName: `${audioFileBase}-play-by-play.txt`,
        content: playByPlay,
    }, artifacts, options);
    console.log(`🚀 Play by Play saved to ${playByPlayPath}`);
    await notifyStep(options, 'playByPlay', 'completed', 'Detailed recap ready');

    // Create dm notes from the bullet points
    const dmNotesWordCount = Math.ceil(baseLength * 0.6);
    const dmNotesPromptRendered = dmNotesPrompt(bulletPoints, dmNotesWordCount);
    await notifyStep(options, 'dmNotes', 'in_progress', `Drafting GM notes (${dmNotesWordCount} words target)`);
    const dmNotes = await sendTextMessage(instructions, dmNotesPromptRendered);
    const dmNotesPath = await saveArtifact(outputDir, {
        key: 'dmNotes',
        label: 'DM Notes',
        fileName: `${audioFileBase}-dm-notes.txt`,
        content: dmNotes,
    }, artifacts, options);
    console.log(`🚀 DM Notes saved to ${dmNotesPath}`);
    await notifyStep(options, 'dmNotes', 'completed', 'GM notes are ready');

    // Create a summary from the bullet points
    const summaryWordCount = Math.ceil(baseLength * 0.4);
    const summaryPromptRendered = summaryPrompt(bulletPoints, summaryWordCount);
    await notifyStep(options, 'summarize', 'in_progress', `Creating summary (${summaryWordCount} words target)`);
    const summary = await sendTextMessage(instructions, summaryPromptRendered);
    const summaryPath = await saveArtifact(outputDir, {
        key: 'summary',
        label: 'Summary',
        fileName: `${audioFileBase}-summary.txt`,
        content: summary,
    }, artifacts, options);
    console.log(`🚀 Summary saved to ${summaryPath}`);
    await notifyStep(options, 'summarize', 'completed', 'Summary ready');

    // Create story from the bullet points
    const storyWordCount = Math.ceil(baseLength * 1.75);
    const storyPromptRendered = storyPrompt(bulletPoints, storyWordCount);
    await notifyStep(options, 'story', 'in_progress', `Writing story (${storyWordCount} words target)`);
    const story = await sendTextMessage(instructions, storyPromptRendered);
    const storyPath = await saveArtifact(outputDir, {
        key: 'story',
        label: 'Story',
        fileName: `${audioFileBase}-story.txt`,
        content: story,
    }, artifacts, options);
    console.log(`🚀 Story saved to ${storyPath}`);
    await notifyStep(options, 'story', 'completed', 'Narrative story ready');

    // Create title
    const titlePromptRendered = titlePrompt(story);
    await notifyStep(options, 'title', 'in_progress', 'Generating a session title');
    const title = await sendTextMessage(NO_INSTRUCTIONS, titlePromptRendered);
    const titlePath = await saveArtifact(outputDir, {
        key: 'title',
        label: 'Title',
        fileName: `${audioFileBase}-title.txt`,
        content: title,
    }, artifacts, options);
    console.log(`🚀 Title saved to ${titlePath}`);
    await notifyStep(options, 'title', 'completed', 'Title ready');

    // Create image prompt
    const imagePromptRendered = imagePrompt(story);
    await notifyStep(options, 'image', 'in_progress', 'Generating an image prompt');
    const image = await sendTextMessage(NO_INSTRUCTIONS, imagePromptRendered);
    const imagePath = await saveArtifact(outputDir, {
        key: 'imagePrompt',
        label: 'Image Prompt',
        fileName: `${audioFileBase}-image-prompt.txt`,
        content: image,
    }, artifacts, options);
    console.log(`🚀 Image saved to ${imagePath}`);
    await notifyStep(options, 'image', 'completed', 'Image prompt ready');

    // Create lyrics prompt
    const verseCount = Math.floor(Math.random() * 3) + 2; // Randomly choose between 2 and 4 verses
    const lyricsPromptRendered = lyricsPrompt(story, verseCount);
    await notifyStep(options, 'lyrics', 'in_progress', `Writing lyrics with ${verseCount} verses`);
    const lyrics = await sendTextMessage(NO_INSTRUCTIONS, lyricsPromptRendered);
    const lyricsPath = await saveArtifact(outputDir, {
        key: 'lyricsPrompt',
        label: 'Lyrics Prompt',
        fileName: `${audioFileBase}-lyrics-prompt.txt`,
        content: lyrics,
    }, artifacts, options);
    console.log(`🚀 Lyrics saved to ${lyricsPath}`);
    await notifyStep(options, 'lyrics', 'completed', 'Lyrics prompt ready');

    // Create song prompt
    const songPromptRendered = songPrompt(story, exampleSong, songMod);
    await notifyStep(options, 'song', 'in_progress', 'Drafting the song prompt');
    const song = await sendTextMessage(NO_INSTRUCTIONS, songPromptRendered);
    const songPath = await saveArtifact(outputDir, {
        key: 'songPrompt',
        label: 'Song Prompt',
        fileName: `${audioFileBase}-song-prompt.txt`,
        content: song,
    }, artifacts, options);
    console.log(`🚀 Song saved to ${songPath}`);
    await notifyStep(options, 'song', 'completed', 'Song prompt ready');

    console.log('🚀 Sending to Contentful');
    await notifyStep(options, 'publish', 'in_progress', 'Sending the session to Contentful');
    await createEvent(title, summary, story, dmNotes);
    await notifyStep(options, 'publish', 'completed', 'Contentful entry created');

    return {
        outputDir,
        audioFileBase,
        artifacts,
    };
}

async function sendTextMessage(instructions: string, prompt: string): Promise<string> {
    console.log(`🚀 Sending message to text model`);

    const messages: Array<ChatCompletionMessageParam> = [];

    if (instructions !== NO_INSTRUCTIONS) {
        messages.push({
            role: 'system',
            content: instructions,
        });
    }

    messages.push({
        role: 'user',
        content: prompt,
    });

    const result = await getResponse(messages, textClientModel);
    console.log(`🚀 Message processing completed`);
    return result;
}

async function determineBaseLength(audioFile: string): Promise<number> {
    const audioLengthInMinutes = await determineLengthInMinutes(audioFile);
    const baseLength = audioLengthInMinutes * config.length.wordsPerMinuteOfAudio;
    if (config.length.minimumWords && baseLength < config.length.minimumWords) {
        return config.length.minimumWords || baseLength;
    }
    if (config.length.maximumWords && baseLength > config.length.maximumWords) {
        return config.length.maximumWords;
    }
    return baseLength;
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

async function sendAudioMessage(
    outputDir: string,
    audioFile: string,
    instructions: string,
    prompt: string,
    options: SendAndSaveOptions = {}
): Promise<string> {
    console.log(`🚀 Starting processing for audio file: ${audioFile}`);

    const maxDuration = 45 * 60; // 45 minutes in seconds
    const filePath = await validateAudioFile(audioFile);
    const duration = await getAudioDuration(filePath);
    console.log(`📏 Audio duration: ${formatDuration(duration)}`);

    if (duration <= maxDuration) {
        console.log('⚡ Audio is short enough for direct listening');
        return await listenDirect(filePath, instructions, prompt);
    }

    console.log('✂️  Audio is long, splitting into parts');
    const bulletPoints = await splitAndListen(outputDir, audioFile, filePath, duration, maxDuration, instructions, prompt, options);

    // Save bulletPoints to file before synthesis
    const bulletPointsPath = path.join(outputDir, `${audioFile}-all-bullet-points.txt`);
    await fs.writeFile(bulletPointsPath, bulletPoints.join('\n\n'), 'utf-8');
    console.log(`💾 Saved combined bullet points to ${bulletPointsPath}`);

    console.log('🔗 Synthesizing bullet points into final result');
    const finalResult = await sendTextMessage(instructions, synthesisPrompt(bulletPoints));

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

async function listenDirect(audioFile: string, instructions: string, prompt: string): Promise<string> {
    console.log('🎙️  Listen directly');
    const messages = await buildAudioMessages(audioFile, instructions, prompt);
    const result = await getResponse(messages, audioClientModel);
    console.log('🎙️  Listen directly completed');
    return result;
}

async function splitAndListen(
    outputDir: string,
    audioFile: string,
    filePath: string,
    duration: number,
    maxDuration: number,
    instructions: string,
    prompt: string,
    options: SendAndSaveOptions = {}
): Promise<string[]> {
    const parts = Math.ceil(duration / maxDuration);
    const bulletPoints: string[] = [];
    console.log(`📊 Total parts to process: ${parts}`);

    for (let i = 0; i < parts; i++) {
        const partIndex = i + 1;
        const progressFile = getProgressFileName(outputDir, audioFile, partIndex);

        try {
            const existingBulletPoints = await fs.readFile(progressFile, 'utf-8');
            if (existingBulletPoints) {
                console.log(`⏭️  Skipping part ${partIndex}/${parts}`);
                await notifyStep(options, 'transcribe', 'in_progress', `Loaded saved audio segment ${partIndex} of ${parts}`);
                await notifyStep(options, 'diarize', 'in_progress', `Loaded saved speaker context ${partIndex} of ${parts}`);
                bulletPoints.push(existingBulletPoints);
                continue;
            }
        } catch {
            // File doesn't exist or is empty, proceed
        }

        console.log(`🎵 Processing part ${partIndex}/${parts}`);
        await notifyStep(options, 'transcribe', 'in_progress', `Processing audio segment ${partIndex} of ${parts}`);
        await notifyStep(options, 'diarize', 'in_progress', `Tracking speakers in segment ${partIndex} of ${parts}`);
        const startTime = i * maxDuration;
        const partDuration = Math.min(maxDuration, duration - startTime);
        const partFile = `${audioFile}_part_${partIndex}.mp3`;
        const partPath = path.join(outputDir, "progress", partFile);

        console.log(`✂️  Creating audio part: ${partFile} (${formatDuration(partDuration)})`);
        await splitAudio(filePath, partPath, startTime, partDuration);

        console.log(`🎙️  Listening to part ${partIndex}`);
        const messages = await buildAudioMessages(partPath, instructions, prompt);
        const partBulletPoints = await getResponse(messages, audioClientModel);

        // Persist progress
        await fs.writeFile(progressFile, partBulletPoints, 'utf-8');
        console.log(`💾 Saved bullet points for part ${partIndex}`);

        bulletPoints.push(partBulletPoints);
    }

    console.log('📝 Listened to all parts');
    return bulletPoints;
}

function getProgressFileName(outputDir: string, audioFile: string, partIndex: number): string {
    return path.join(outputDir, 'progress', `${audioFile}_part_${partIndex}.txt`);
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

async function buildAudioMessages(filePath: string, instructions: string, prompt: string): Promise<Array<ChatCompletionMessageParam>> {
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

function getSongMod(): string | undefined{
    const modifiers = config.song.modifiers;
    if (modifiers.length === 0) {
        return undefined;
    }
    const randomIndex = Math.floor(Math.random() * modifiers.length);
    return modifiers[randomIndex];
}

async function notifyStep(
    options: SendAndSaveOptions,
    key: ProcessingStepKey,
    status: ProcessingStepState,
    detail?: string
): Promise<void> {
    await options.onStepUpdate?.({ key, status, detail });
}

async function saveArtifact(
    outputDir: string,
    artifact: ProcessingArtifact,
    artifacts: ProcessingArtifact[],
    options: SendAndSaveOptions
): Promise<string> {
    const artifactPath = path.join(outputDir, artifact.fileName);
    await fs.writeFile(artifactPath, artifact.content, 'utf-8');
    artifacts.push(artifact);
    await options.onArtifact?.(artifact);
    return artifactPath;
}
