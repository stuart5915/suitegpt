const svgtofont = require('svgtofont').default;
const path = require('path');
const fs = require('fs');

// Map SVG filenames (codepoints) to actual Unicode characters
const svgDir = path.resolve(__dirname, 'svg-emoji');
const files = fs.readdirSync(svgDir).filter(f => f.endsWith('.svg'));

console.log(`Found ${files.length} SVG files`);

// Build codepoint map: icon name (without .svg) -> unicode char
const unicodeMap = {};
files.forEach(f => {
    const cp = f.replace('.svg', '');
    const char = String.fromCodePoint(parseInt(cp, 16));
    unicodeMap[cp] = char;
});

svgtofont({
    src: svgDir,
    dist: path.resolve(__dirname, 'dist'),
    fontName: 'InclawIcons',
    css: false,
    startUnicode: 0xE000, // fallback — shouldn't be used since we map explicitly
    svgicons2svgfont: {
        fontHeight: 1000,
        normalize: true,
        centerHorizontally: true,
        centerVertically: true,
    },
    getIconUnicode(name) {
        // name = filename without extension (e.g. "1F680")
        if (unicodeMap[name]) {
            return unicodeMap[name];
        }
        console.log('  No mapping for:', name);
        return undefined;
    }
}).then(() => {
    console.log('Font built! Check dist/ folder');
    // List output files
    const dist = path.resolve(__dirname, 'dist');
    if (fs.existsSync(dist)) {
        fs.readdirSync(dist).forEach(f => {
            const stat = fs.statSync(path.join(dist, f));
            console.log(`  ${f} (${Math.round(stat.size / 1024)}KB)`);
        });
    }
}).catch(err => {
    console.error('Build failed:', err);
});
