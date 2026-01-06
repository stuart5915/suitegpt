const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

console.log('🎬 Creating video...\n');

const audioDir = 'audio';
const imagesDir = 'raw';
const outputFile = 'processed/video-1-what-im-building.mp4';

// Audio files in order
const audioFiles = [
    '01-hook.mp3', '02-vision.mp3', '03-treasury.mp3', '04-giving.mp3',
    '05-apps.mp3', '06-automation.mp3', '07-discord-cta.mp3',
    '08-video-system.mp3', '09-final-cta.mp3'
].map(f => path.join(audioDir, f));

// Get all image files
const imageFiles = [];
for (let i = 1; i <= 41; i++) {
    imageFiles.push(path.join(imagesDir, `photo_${i}_2026-01-05_08-39-59.jpg`));
}
imageFiles.push(path.join(imagesDir, 'photo_2026-01-05_08-42-31.jpg'));

console.log(`Found ${imageFiles.length} images`);
console.log(`Found ${audioFiles.length} audio files\n`);

// Step 1: Concatenate all audio files
console.log('Step 1: Merging audio tracks...');
const tempAudio = 'processed/temp-audio.mp3';

let audioConcat = ffmpeg();
audioFiles.forEach(file => audioConcat.input(file));

audioConcat
    .on('error', err => {
        console.error('Audio merge failed:', err.message);
        process.exit(1);
    })
    .on('end', () => {
        console.log('✓ Audio merged\n');

        // Step 2: Create slideshow with images
        console.log('Step 2: Creating slideshow from images...');

        // Calculate duration per image based on total audio length
        ffmpeg.ffprobe(tempAudio, (err, metadata) => {
            if (err) {
                console.error('Failed to get audio duration:', err.message);
                process.exit(1);
            }

            const totalDuration = metadata.format.duration;
            const durationPerImage = totalDuration / imageFiles.length;

            console.log(`Total duration: ${totalDuration.toFixed(1)}s`);
            console.log(`Duration per image: ${durationPerImage.toFixed(1)}s\n`);

            // Create slideshow
            let slideshow = ffmpeg();

            imageFiles.forEach(img => {
                slideshow.input(img).inputOptions([`-loop 1`, `-t ${durationPerImage}`]);
            });

            const filterComplex = imageFiles.map((_, i) =>
                `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`
            ).join(';');

            const concat = imageFiles.map((_, i) => `[v${i}]`).join('') + `concat=n=${imageFiles.length}:v=1:a=0[outv]`;

            slideshow
                .input(tempAudio)
                .complexFilter(`${filterComplex};${concat}`)
                .outputOptions([
                    '-map [outv]',
                    '-map ' + imageFiles.length + ':a',
                    '-c:v libx264',
                    '-preset slow',
                    '-crf 18',
                    '-pix_fmt yuv420p',
                    '-c:a aac',
                    '-b:a 320k',
                    '-shortest',
                    '-movflags +faststart'
                ])
                .output(outputFile)
                .on('progress', progress => {
                    process.stdout.write(`\rProgress: ${progress.percent ? progress.percent.toFixed(1) : 0}%`);
                })
                .on('error', err => {
                    console.error('\n\nVideo creation failed:', err.message);
                    fs.unlinkSync(tempAudio);
                    process.exit(1);
                })
                .on('end', () => {
                    console.log('\n\n✅ SUCCESS!');

                    const stats = fs.statSync(outputFile);
                    console.log(`\nFile: ${outputFile}`);
                    console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                    console.log(`Format: 1080x1920 vertical, H.264, 30fps`);
                    console.log('\nReady to upload to YouTube Shorts, TikTok, X!');

                    // Cleanup
                    fs.unlinkSync(tempAudio);
                })
                .run();
        });
    })
    .mergeToFile(tempAudio);
