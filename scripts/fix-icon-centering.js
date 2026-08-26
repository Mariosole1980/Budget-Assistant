const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_IMAGE = path.join(ROOT, "logo-mark.png");
const BG_COLOR = "#0F1219";

const densities = {
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192,
};

async function run() {
    if (!fs.existsSync(SOURCE_IMAGE)) {
        console.error("Source image not found:", SOURCE_IMAGE);
        process.exit(1);
    }
    
    // 1. Trim the raw logo so all transparent asymmetric margins are removed
    const trimmedBuf = await sharp(SOURCE_IMAGE).trim().png().toBuffer();
    const resDir = path.join(ROOT, "android", "app", "src", "main", "res");

    for (const [density, size] of Object.entries(densities)) {
        const dir = path.join(resDir, `mipmap-${density}`);
        fs.mkdirSync(dir, { recursive: true });

        // Safe zone sizing for standard launcher icons (0.64 for square/circle legacy icons)
        const legacyFgSize = Math.round(size * 0.64);
        const legacyFg = await sharp(trimmedBuf)
            .resize(legacyFgSize, legacyFgSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();
        const legacyMeta = await sharp(legacyFg).metadata();
        const legacyLeft = Math.round((size - legacyMeta.width) / 2);
        const legacyTop = Math.round((size - legacyMeta.height) / 2);

        // Square legacy launcher icon (perfectly centered on dark background)
        await sharp({
            create: { width: size, height: size, channels: 4, background: BG_COLOR }
        })
            .composite([{ input: legacyFg, left: legacyLeft, top: legacyTop }])
            .png()
            .toFile(path.join(dir, "ic_launcher.png"));

        // Circular legacy launcher icon
        const circleMask = Buffer.from(
            `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
        );
        const squareBuf = await sharp({
            create: { width: size, height: size, channels: 4, background: BG_COLOR }
        })
            .composite([{ input: legacyFg, left: legacyLeft, top: legacyTop }])
            .png()
            .toBuffer();

        await sharp(squareBuf)
            .composite([{ input: circleMask, blend: "dest-in" }])
            .png()
            .toFile(path.join(dir, "ic_launcher_round.png"));

        // Adaptive icon background
        await sharp({
            create: { width: size, height: size, channels: 4, background: BG_COLOR }
        }).png().toFile(path.join(dir, "ic_launcher_background.png"));

        // Adaptive icon foreground (Android standard safe-zone: 0.58 of the 108dp canvas)
        // This guarantees NO cropping on Samsung squircle, Pixel circle, or Xiaomi shapes!
        const adaptiveFgSize = Math.round(size * 0.58);
        const adaptiveFg = await sharp(trimmedBuf)
            .resize(adaptiveFgSize, adaptiveFgSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();
        const adaptiveMeta = await sharp(adaptiveFg).metadata();
        const adaptiveLeft = Math.round((size - adaptiveMeta.width) / 2);
        const adaptiveTop = Math.round((size - adaptiveMeta.height) / 2);

        await sharp({
            create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
        })
            .composite([{ input: adaptiveFg, left: adaptiveLeft, top: adaptiveTop }])
            .png()
            .toFile(path.join(dir, "ic_launcher_foreground.png"));

        console.log(`Generated centered icons for mipmap-${density} (${size}x${size})`);
    }

    // Also update web / PWA 192 and 512 icons and assets/icon.png
    const icon512Size = 512;
    const fg512Size = Math.round(icon512Size * 0.64);
    const fg512 = await sharp(trimmedBuf)
        .resize(fg512Size, fg512Size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer();
    const meta512 = await sharp(fg512).metadata();
    const left512 = Math.round((icon512Size - meta512.width) / 2);
    const top512 = Math.round((icon512Size - meta512.height) / 2);

    const icon512Buf = await sharp({
        create: { width: icon512Size, height: icon512Size, channels: 4, background: BG_COLOR }
    })
        .composite([{ input: fg512, left: left512, top: top512 }])
        .png()
        .toBuffer();

    await sharp(icon512Buf).toFile(path.join(ROOT, "assets", "icon.png"));
    await sharp(icon512Buf).toFile(path.join(ROOT, "icon-512.png"));
    await sharp(icon512Buf).resize(192, 192).toFile(path.join(ROOT, "icon-192.png"));
    if (fs.existsSync(path.join(ROOT, "public"))) {
        await sharp(icon512Buf).toFile(path.join(ROOT, "public", "icon-512.png"));
        await sharp(icon512Buf).resize(192, 192).toFile(path.join(ROOT, "public", "icon-192.png"));
        await sharp(icon512Buf).toFile(path.join(ROOT, "public", "assets", "icon.png"));
    }

    // Generate a visual Samsung Squircle preview to show in artifact
    const squircleSvg = Buffer.from(
        `<svg width="${icon512Size}" height="${icon512Size}"><rect x="0" y="0" width="${icon512Size}" height="${icon512Size}" rx="130" ry="130" fill="#fff"/></svg>`
    );
    const adaptivePreviewFg = await sharp(trimmedBuf)
        .resize(Math.round(icon512Size * 0.58), Math.round(icon512Size * 0.58), { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer();
    const adaptiveMeta512 = await sharp(adaptivePreviewFg).metadata();
    const adaptiveLeft512 = Math.round((icon512Size - adaptiveMeta512.width) / 2);
    const adaptiveTop512 = Math.round((icon512Size - adaptiveMeta512.height) / 2);

    const fullAdaptiveBuf = await sharp({
        create: { width: icon512Size, height: icon512Size, channels: 4, background: BG_COLOR }
    })
        .composite([{ input: adaptivePreviewFg, left: adaptiveLeft512, top: adaptiveTop512 }])
        .png()
        .toBuffer();

    const squirclePreviewBuf = await sharp(fullAdaptiveBuf)
        .composite([{ input: squircleSvg, blend: "dest-in" }])
        .png()
        .toBuffer();

    const previewOut = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\b95fce75-d014-4439-bb80-3ef94123a918\\samsung_squircle_fixed_preview.png";
    await sharp(squirclePreviewBuf).toFile(previewOut);

    console.log("SUCCESS! All icons updated and preview saved at:", previewOut);
}

run().catch(console.error);
