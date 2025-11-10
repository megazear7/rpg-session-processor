# TTRPG Session Processor

A AI-powered tool that transcribes and summarizes tabletop roleplaying game (TTRPG) sessions from audio recordings. Uses OpenAI's latest audio and text models to create narrative summaries and bullet-point recaps of gaming sessions.

## TODO

Change the process:

1. Use audio model to get bullet point outline of the events.
2. Conver that into a short DM summary of where events ended with a text model.
3. Conver it into a narrative with a text model.

## Features

- 🎙️ **Audio Transcription**: Processes MP3 audio files of any length using OpenAI's advanced audio models
- ✂️ **Smart Splitting**: Automatically splits long audio files (>30 minutes) into manageable segments
- 📝 **Dual Summaries**:
  - **Story Summary**: Narrative-driven recap written like a fantasy author (200 words)
  - **Session Summary**: Bullet-point overview for quick reference (100 words)
- 🏷️ **Auto-Titles**: Generates descriptive titles for each session
- 🔄 **Progress Tracking**: Saves intermediate results to avoid reprocessing on interruptions
- 🎯 **Character Mapping**: Pre-configured player and character relationships

## Prerequisites

- Node.js 18+
- OpenAI API key with access to:
  - Audio models (`gpt-audio-2025-08-28`)
  - Text models (`gpt-4.1-2025-04-14`)
- FFmpeg (for audio processing)

## Installation

### Clone and install dependencies

```bash
npm install
```

### Configurations

Create a `.env` file in the root directory.

```env
MODEL_API_KEY=your_openai_api_key_here
```

Create a `config.json` file in the root directory.

```json
{
    "models": {
        "text": {
            "model": "grok-4-0709",
            "baseURL": "https://api.x.ai/v1"
        },
        "audio": {
            "model": "gpt-audio-mini-2025-10-06",
            "baseURL": "https://api.openai.com/v1"
        }
    }
}
```

Create an `instructions.txt` file in the root directory.

```txt
You are an AI assistant that helps writes stories and take notes based on tabletop roleplaying game session audio recordings.
Your name is "Wiz", the game master at the table may address you directly in the audio and give you specific instructions to follow.

The players are:
 - Bob
 - Joe
 - Steve (Sometimes referred to as either Gram or Mom)

The game master is:
 - Smith (Sometimes referred to as dad when Bob is speaking)

The characters are:
 - Ragano: A Wood Elf Rogue played by Bob
 - Drokel: A Human Fighter played by Joe
 - Harok: A Halfling Rogue played by Steve
```

## Usage

### 1. Prepare Your Audio

Place your TTRPG session recording (MP3 format) in the `input/` directory:

### 2. Run the Processor

```bash
npm start <audio-file.mp3>
```

For example:
```bash
npm start session1.mp3
npm start family-dnd-recording.mp3
```

This will generate three output files in the `output/` directory:
- `story.txt` - Narrative summary (~200 words)
- `summary.txt` - Bullet-point summary (~100 words)
- `title.txt` - Session title

## How It Works

### Audio Processing Pipeline

1. **Parameter Validation**: Reads audio filename from command line arguments
2. **File Validation**: Checks audio file format and integrity
3. **Duration Analysis**: Determines if splitting is needed (>30 minutes)
4. **Smart Splitting**: Divides long recordings into 30-minute segments
5. **Parallel Transcription**: Processes segments concurrently using audio AI
6. **Synthesis**: Combines transcriptions into coherent summaries
7. **Length Adjustment**: Uses text AI to meet target word counts

### AI Models Used

- **Audio Model**: `gpt-audio-2025-08-28` - For transcription and understanding spoken content
- **Text Model**: `gpt-4.1-2025-04-14` - For synthesis, summarization, and content adjustment

## Output Formats

### Story Summary (story.txt)
A narrative-driven recap written in the style of a fantasy author, focusing on character actions and story events rather than game mechanics.

### Session Summary (summary.txt)
A concise bullet-point overview perfect for game masters to quickly review what happened during the session.

### Title (title.txt)
A descriptive title that captures the essence of the session.
