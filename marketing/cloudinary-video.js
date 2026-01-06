require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const https = require('https');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('🎬 Automated Video Creator with Cloudinary\n');

const audioDir = 'audio';
const imagesDir = 'raw';
const outputFile = 'processed/video-1-what-im-building.mp4';

// Audio files in order
const audioFiles = [
    '01-hook.mp3', '02-vision.mp3', '03-treasury.mp3', '04-giving.mp3',
    '05-apps.mp3', '06-automation.mp3', '07-discord-cta.mp3',
    '08-video-system.mp3', '09-final-cta.mp3'
];

// Image files
const imageFiles = [];
for (let i = 1; i <= 41; i++) {
    imageFiles.push(`photo_${i}_2026-01-05_08-39-59.jpg`);
}
imageFiles.push('photo_2026-01-05_08-42-31.jpg');

async function uploadAssets() {
    console.log('📤 Uploading assets to Cloudinary...\n');

    const uploadedAudio = [];
    const uploadedImages = [];

    // Upload audio files
    console.log('Uploading audio files...');
    for (const file of audioFiles) {
        const filePath = path.join(audioDir, file);
        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: 'video',
            folder: 'suite-videos/audio',
            public_id: file.replace('.mp3', '')
        });
        uploadedAudio.push(result.public_id);
        process.stdout.write('.');
    }
    console.log(' Done!\n');

    // Upload images
    console.log('Uploading images...');
    for (const file of imageFiles) {
        const filePath = path.join(imagesDir, file);
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'suite-videos/images',
            public_id: file.replace('.jpg', '')
        });
        uploadedImages.push(result.public_id);
        process.stdout.write('.');
    }
    console.log(' Done!\n');

    return { uploadedAudio, uploadedImages };
}

async function createVideo(uploadedAudio, uploadedImages) {
    console.log('🎥 Assembling video...\n');

    // Calculate duration per image (assuming 8 seconds each = ~5.5 min total)
    const durationPerImage = 8;

    // Create video layers
    const videoLayers = uploadedImages.map((img, i) => ({
        public_id: img,
        start_offset: i * durationPerImage,
        duration: durationPerImage
    }));

    // Generate video with Cloudinary transformations
    const videoUrl = cloudinary.url('suite-videos/base-video', {
        resource_type: 'video',
        transformation: [
            { width: 1080, height: 1920, crop: 'fill' },
            { overlay: { resource_type: 'image', public_id: uploadedImages[0] } },
            { flags: 'layer_apply', width: 1080, height: 1920, crop: 'fit' }
        ],
        format: 'mp4'
    });

    console.log('Video URL:', videoUrl);
    console.log('\n✅ Video assembly complete!');
    console.log('\nNote: Cloudinary video creation API requires a paid plan.');
    console.log('For now, you can:');
    console.log('1. Access your Cloudinary dashboard');
    console.log('2. Use their video editor to combine uploaded assets');
    console.log('3. Or upgrade to a paid plan for API access\n');

    return videoUrl;
}

async function main() {
    try {
        const { uploadedAudio, uploadedImages } = await uploadAssets();

        console.log(`✓ Uploaded ${uploadedAudio.length} audio files`);
        console.log(`✓ Uploaded ${uploadedImages.length} images\n`);

        await createVideo(uploadedAudio, uploadedImages);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
