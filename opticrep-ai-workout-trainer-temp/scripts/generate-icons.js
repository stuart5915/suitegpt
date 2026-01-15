const sharp = require('sharp');

const size = 1024;
const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#18181b"/>
  <circle cx="512" cy="400" r="200" fill="#8b5cf6"/>
  <rect x="362" y="550" width="300" height="60" rx="30" fill="#8b5cf6"/>
  <rect x="300" y="530" width="80" height="100" rx="10" fill="#a78bfa"/>
  <rect x="620" y="530" width="80" height="100" rx="10" fill="#a78bfa"/>
</svg>`;

async function generateIcons() {
    try {
        // Generate main icon
        await sharp(Buffer.from(svg))
            .resize(1024, 1024)
            .png()
            .toFile('assets/icon.png');
        console.log('Created assets/icon.png (1024x1024)');

        // Generate adaptive icon (foreground)
        await sharp(Buffer.from(svg))
            .resize(1024, 1024)
            .png()
            .toFile('assets/adaptive-icon.png');
        console.log('Created assets/adaptive-icon.png (1024x1024)');

        // Generate splash icon
        await sharp(Buffer.from(svg))
            .resize(512, 512)
            .png()
            .toFile('assets/splash-icon.png');
        console.log('Created assets/splash-icon.png (512x512)');

        // Generate favicon
        await sharp(Buffer.from(svg))
            .resize(48, 48)
            .png()
            .toFile('assets/favicon.png');
        console.log('Created assets/favicon.png (48x48)');

        console.log('All icons generated successfully!');
    } catch (err) {
        console.error('Error generating icons:', err);
    }
}

generateIcons();
