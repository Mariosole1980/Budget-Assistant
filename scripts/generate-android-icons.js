/* Regenerate Android mipmap launcher PNGs and drawable splash screens from user_logo.png using sharp. */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_IMAGE = path.join(ROOT, 'assets', 'logo', 'user_logo.png');
const BG_COLOR = '#0c0d12';

// Legacy launcher icon sizes per density (launcher icon = 48dp base).
const densities = {
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192,
};

// Splash screen dimensions (width x height) per density for portrait and landscape
const splashDimensions = {
    'drawable': { width: 1080, height: 1920, logoSize: 600 },
    'drawable-port-mdpi': { width: 320, height: 480, logoSize: 220 },
    'drawable-port-hdpi': { width: 480, height: 800, logoSize: 320 },
    'drawable-port-xhdpi': { width: 720, height: 1280, logoSize: 480 },
    'drawable-port-xxhdpi': { width: 1080, height: 1920, logoSize: 680 },
    'drawable-port-xxxhdpi': { width: 1440, height: 2560, logoSize: 900 },

    'drawable-land-mdpi': { width: 480, height: 320, logoSize: 220 },
    'drawable-land-hdpi': { width: 800, height: 480, logoSize: 320 },
    'drawable-land-xhdpi': { width: 1280, height: 720, logoSize: 480 },
    'drawable-land-xxhdpi': { width: 1920, height: 1080, logoSize: 680 },
    'drawable-land-xxxhdpi': { width: 2560, height: 1440, logoSize: 900 },
};

// Add night variants too
Object.keys(splashDimensions).forEach((key) => {
    if (key.startsWith('drawable-port-') && !key.includes('night')) {
        splashDimensions[key.replace('drawable-port-', 'drawable-port-night-')] = splashDimensions[key];
    }
    if (key.startsWith('drawable-land-') && !key.includes('night')) {
        splashDimensions[key.replace('drawable-land-', 'drawable-land-night-')] = splashDimensions[key];
    }
});

const resDir = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

(async () => {
    if (!fs.existsSync(SOURCE_IMAGE)) {
        console.error('Source image not found:', SOURCE_IMAGE);
        process.exit(1);
    }
    const imgBuf = fs.readFileSync(SOURCE_IMAGE);

    // 1. Generate Mipmap Launcher Icons
    for (const [density, size] of Object.entries(densities)) {
        const dir = path.join(resDir, `mipmap-${density}`);
        fs.mkdirSync(dir, { recursive: true });

        // Legacy launcher + round icons (full logo)
        for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
            await sharp(imgBuf)
                .resize(size, size, { fit: 'cover' })
                .png()
                .toFile(path.join(dir, name));
            console.log('Wrote', path.join(`mipmap-${density}`, name), `(${size}x${size})`);
        }

        // Adaptive icon background (solid dark matching image background)
        await sharp({
            create: {
                width: size,
                height: size,
                channels: 4,
                background: BG_COLOR,
            },
        }).png().toFile(path.join(dir, 'ic_launcher_background.png'));

        // Adaptive icon foreground (centered logo in safe-zone)
        const fgSize = Math.round(size * 0.72);
        const fg = await sharp(imgBuf)
            .resize(fgSize, fgSize, { fit: 'cover' })
            .png()
            .toBuffer();

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

    // 2. Generate Splash Screens across drawables
    for (const [dirName, dim] of Object.entries(splashDimensions)) {
        const dir = path.join(resDir, dirName);
        fs.mkdirSync(dir, { recursive: true });

        const logoResized = await sharp(imgBuf)
            .resize(dim.logoSize, dim.logoSize, { fit: 'contain' })
            .png()
            .toBuffer();

        const left = Math.round((dim.width - dim.logoSize) / 2);
        const top = Math.round((dim.height - dim.logoSize) / 2);

        await sharp({
            create: {
                width: dim.width,
                height: dim.height,
                channels: 4,
                background: BG_COLOR,
            },
        })
            .composite([{ input: logoResized, left, top }])
            .png()
            .toFile(path.join(dir, 'splash.png'));

        console.log('Wrote splash to', dirName, `(${dim.width}x${dim.height})`);
    }

    // 3. Generate Notification Small Icons (pure white silhouette on transparent background)
    const logoMarkPath = path.join(ROOT, 'logo-mark.png');
    if (fs.existsSync(logoMarkPath)) {
        const notifSizes = {
            'drawable-mdpi': 24,
            'drawable-hdpi': 36,
            'drawable-xhdpi': 48,
            'drawable-xxhdpi': 72,
            'drawable-xxxhdpi': 96,
            'drawable': 48
        };

        const { data, info } = await sharp(logoMarkPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 20) {
                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
            }
        }

        const whiteSilhouette = await sharp(data, {
            raw: { width: info.width, height: info.height, channels: 4 }
        }).png().toBuffer();

        for (const [folder, size] of Object.entries(notifSizes)) {
            const targetDir = path.join(resDir, folder);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
            const targetFile = path.join(targetDir, 'ic_stat_icon_config_sample.png');

            const innerSize = Math.round(size * 0.85);
            const resized = await sharp(whiteSilhouette)
                .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const pad = Math.round((size - innerSize) / 2);
            await sharp({
                create: {
                    width: size,
                    height: size,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            })
                .composite([{ input: resized, left: pad, top: pad }])
                .png()
                .toFile(targetFile);

            console.log('Wrote notification icon to', path.join(folder, 'ic_stat_icon_config_sample.png'), `(${size}x${size})`);
        }
    }

    console.log('Done generating Android launcher icons, notification icons, and splash screens.');
})().catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
});

