/* Generate Play Store / PWA icon PNGs from the SVG logo using sharp. */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SVG = path.join(ROOT, 'assets', 'logo', 'budget-assistant-logo.svg');

const outputs = [
    // Root PWA icons
    { file: path.join(ROOT, 'icon.png'), size: 512 },
    { file: path.join(ROOT, 'icon-192.png'), size: 192 },
    // assets folder
    { file: path.join(ROOT, 'assets', 'icon.png'), size: 512 },
    { file: path.join(ROOT, 'assets', 'splash.png'), size: 512 },
    // logo source PNGs
    { file: path.join(ROOT, 'assets', 'logo', 'budget-assistant-logo-512.png'), size: 512 },
    { file: path.join(ROOT, 'assets', 'logo', 'budget-assistant-logo-192.png'), size: 192 },
    // www build folder (deployed PWA)
    { file: path.join(ROOT, 'www', 'icon.png'), size: 512 },
    { file: path.join(ROOT, 'www', 'icon-192.png'), size: 192 },
    { file: path.join(ROOT, 'www', 'assets', 'icon.png'), size: 512 },
    { file: path.join(ROOT, 'www', 'assets', 'splash.png'), size: 512 },
    // Capacitor bundled web assets
    { file: path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public', 'icon.png'), size: 512 },
    { file: path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public', 'icon-192.png'), size: 192 },
    { file: path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public', 'assets', 'icon.png'), size: 512 },
    { file: path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public', 'assets', 'splash.png'), size: 512 },
];

(async () => {
    const svgBuf = fs.readFileSync(SVG);
    for (const out of outputs) {
        fs.mkdirSync(path.dirname(out.file), { recursive: true });
        await sharp(svgBuf)
            .resize(out.size, out.size)
            .png()
            .toFile(out.file);
        console.log('Wrote', path.relative(ROOT, out.file), `(${out.size}x${out.size})`);
    }
    console.log('Done.');
})().catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
});
