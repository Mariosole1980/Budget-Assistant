/* Generate app-icon variant PNGs from the variant SVGs. */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

const variants = [
    { svg: 'variant1_teal.svg', png: 'variant1_teal_BA.png' },
    { svg: 'variant2_white_teal.svg', png: 'variant2_white_teal_BA.png' },
    { svg: 'variant3_navy_mint.svg', png: 'variant3_navy_mint_BA.png' },
];

const outDirs = [
    path.join(ROOT, 'assets', 'app-icon'),
    path.join(ROOT, 'www', 'assets', 'app-icon'),
    path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public', 'assets', 'app-icon'),
];

(async () => {
    for (const v of variants) {
        const svgBuf = fs.readFileSync(path.join(ROOT, 'assets', 'logo', v.svg));
        for (const dir of outDirs) {
            fs.mkdirSync(dir, { recursive: true });
            await sharp(svgBuf).resize(512, 512).png().toFile(path.join(dir, v.png));
            console.log('Wrote', path.join(path.relative(ROOT, dir), v.png));
        }
    }
    console.log('Done.');
})().catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
});
