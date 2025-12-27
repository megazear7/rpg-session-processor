export const audioFileName = process.argv[2];

if (!audioFileName) {
    console.error('❌ Error: Please provide an audio file name as the first argument');
    console.error('Usage: npm start input/<audio-file.mp3>');
    process.exit(1);
}
