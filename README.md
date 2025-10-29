# TTRPG Session Processor

A AI-powered tool that transcribes and summarizes tabletop roleplaying game (TTRPG) sessions from audio recordings. Uses OpenAI's latest audio and text models to create narrative summaries and bullet-point recaps of gaming sessions.

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

### Set up environment variables

Create a `.env` file in the root directory.

```env
MODEL_API_KEY=your_openai_api_key_here
```

### Update instructions

Update the player and character relationships in `src/index.ts`:

```typescript
const instructions = `
The players are:
 - Player Name

The characters are:
 - Character Name: Description played by Player Name
`;
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
