const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🎬 Creating video with FFmpeg...\n');

const ffmpeg = 'C:\\\\ffmpeg\\\\bin\\\\ffmpeg.exe';
const out = 'processed';

// Ensure output directory exists
if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

// Step 1: Merge all audio
console.log('Step 1: Merging audio tracks...');

const audioFiles = [
    'audio/01-hook.mp3', 'audio/02-vision.mp3', 'audio/03-treasury.mp3',
    'audio/04-giving.mp3', 'audio/05-apps.mp3', 'audio/06-automation.mp3',
    'audio/07-discord-cta.mp3', 'audio/08-video-system.mp3', 'audio/09-final-cta.mp3'
];

const audioInputs = audioFiles.map((f, i) => `-i "${f}"`).join(' ');
const audioFilter = audioFiles.map((_, i) => `[${i}:a]`).join('') + `concat=n=${audioFiles.length}:v=0:a=1[outa]`;

const mergeAudioCmd = `"${ffmpeg}" -y ${audioInputs} -filter_complex "${audioFilter}" -map "[outa]" ${out}/full-audio.mp3`;

exec(mergeAudioCmd, (error, stdout, stderr) => {
    if (error) {
        console.error('Error merging audio:', error);
        process.exit(1);
    }

    console.log('✓ Audio merged\n');

    // Step 2: Create slideshow from images  
    console.log('Step 2: Creating slideshow...');

    const imagePattern = 'raw/photo_%d_2026-01-05_08-39-59.jpg';
    const slideshowCmd = `"${ffmpeg}" -y -framerate 1/8 -start_number 1 -i "${imagePattern}" ` +
        `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30" ` +
        `-c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -t 336 ${out}/slideshow.mp4`;

    exec(slideshowCmd, (error, stdout, stderr) => {
        if (error) {
            console.error('Error creating slideshow:', error);
            process.exit(1);
        }

        console.log('✓ Slideshow created\n');

        // Step 3: Combine slideshow + audio
        console.log('Step 3: Merging video + audio...');

        const finalCmd = `"${ffmpeg}" -y -i ${out}/slideshow.mp4 -i ${out}/full-audio.mp3 ` +
            `-c:v copy -c:a aac -b:a 320k -shortest -movflags +faststart ` +
            `${out}/video-1-what-im-building.mp4`;

        exec(finalCmd, (error, stdout, stderr) => {
            if (error) {
                console.error('Error creating final video:', error);
                process.exit(1);
            }

            // Cleanup
            fs.unlinkSync(`${out}/full-audio.mp3`);
            fs.unlinkSync(`${out}/slideshow.mp4`);

            const stats = fs.statSync(`${out}/video-1-what-im-building.mp4`);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

            console.log('\n✅ SUCCESS!');
            console.log(`\nFile: ${out}/video-1-what-im-building.mp4`);
            console.log(`Size: ${sizeMB} MB`);
            console.log('Format: 1080x1920 vertical, H.264, 30fps, 320kbps audio');
            console.log('\nReady to upload to YouTube Shorts, TikTok, X!');
        });
    });
});
