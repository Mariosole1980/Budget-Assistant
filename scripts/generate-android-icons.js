/* Regenerate Android legacy mipmap launcher PNGs from the SVG logo. */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const LOGO_SVG = path.join(ROOT, 'assets', 'logo', 'budget-assistant-logo.svg');
const FG_SVG = path.join(ROOT, 'assets', 'logo', 'foreground.svg');
const BG_COLOR = '#181b22';

// Legacy launcher icon sizes per density (launcher icon = 48dp base).
const densities = {
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192,
};

const resDir = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

(async () => {
    const logoBuf = fs.readFileSync(LOGO_SVG);
    const fgBuf = fs.readFileSync(FG_SVG);

    for (const [density, size] of Object.entries(densities)) {
        const dir = path.join(resDir, `mipmap-${density}`);

        // Legacy launcher + round icons (full logo with background).
        for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
            await sharp(logoBuf).resize(size, size).png().toFile(path.join(dir, name));
            console.log('Wrote', path.join(`mipmap-${density}`, name), `(${size}x${size})`);
        }

        // Adaptive icon background (solid dark color).
        await sharp({
            create: {
                width: size,
                height: size,
                channels: 4,
                background: BG_COLOR,
            },
        }).png().toFile(path.join(dir, 'ic_launcher_background.png'));
        console.log('Wrote', path.join(`mipmap-${density}`, 'ic_launcher_background.png'), `(${size}x${size})`);

        // Adaptive icon foreground (transparent logo, centered with safe-zone padding).
        const fgSize = Math.round(size * 0.66);
        const fg = await sharp(fgBuf).resize(fgSize, fgSize).png().toBuffer();
        await sharp({
            create: {
                width: size,
                height: size,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
        })
            .composite([{ input: fg, left: Math.round((size - fgSize) / 2), top: Math.round((size - fgSize) / 2) }])
            .png()
            .toFile(path.join(dir, 'ic_launcher_foreground.png'));
        console.log('Wrote', path.join(`mipmap-${density}`, 'ic_launcher_foreground.png'), `(${size}x${size})`);
    }
    console.log('Done.');
})().catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
});
