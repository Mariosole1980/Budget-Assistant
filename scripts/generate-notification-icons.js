const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const LOGO_MARK_PATH = path.join(ROOT, 'logo-mark.png');
const RES_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const ARTIFACT_DIR = 'C:\\Users\\mario\\.gemini\\antigravity\\brain\\b95fce75-d014-4439-bb80-3ef94123a918';

// Android Notification Icon Target Sizes (dp -> px)
const DENSITIES = {
  'drawable-mdpi': 24,
  'drawable-hdpi': 36,
  'drawable-xhdpi': 48,
  'drawable-xxhdpi': 72,
  'drawable-xxxhdpi': 96,
  'drawable': 48
};

async function generate() {
  console.log('Generating crisp Android status bar notification icons...');

  if (!fs.existsSync(LOGO_MARK_PATH)) {
    throw new Error('logo-mark.png not found at: ' + LOGO_MARK_PATH);
  }

  // 1. Process logo-mark to create a high-precision, noise-free alpha mask
  const { data, info } = await sharp(LOGO_MARK_PATH)
    .trim()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const whiteData = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    const maxChannel = Math.max(r, g, b);
    let effectiveAlpha = Math.min(a, maxChannel);

    if (effectiveAlpha < 30) {
      effectiveAlpha = 0;
    } else {
      effectiveAlpha = Math.min(255, Math.round(((effectiveAlpha - 30) / (220 - 30)) * 255));
    }

    whiteData[i] = 255;     // R
    whiteData[i + 1] = 255; // G
    whiteData[i + 2] = 255; // B
    whiteData[i + 3] = effectiveAlpha; // A
  }

  const baseSilhouette = await sharp(whiteData, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .trim()
    .png()
    .toBuffer();

  // 2. Generate per density bucket with optimal padding (safe zone: ~78% of canvas)
  for (const [folder, size] of Object.entries(DENSITIES)) {
    const targetFolder = path.join(RES_DIR, folder);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    const targetFile = path.join(targetFolder, 'ic_stat_icon_config_sample.png');

    const glyphSize = Math.round(size * 0.78);
    const pad = Math.round((size - glyphSize) / 2);

    const resizedGlyph = await sharp(baseSilhouette)
      .resize(glyphSize, glyphSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: resizedGlyph, left: pad, top: pad }])
      .png()
      .toFile(targetFile);

    console.log(`  [OK] Wrote ${folder}/ic_stat_icon_config_sample.png (${size}x${size})`);
  }

  // 3. Create high-res Preview & Mockup for User Review
  if (fs.existsSync(ARTIFACT_DIR)) {
    const previewIcon = await sharp(baseSilhouette)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const previewPath = path.join(ARTIFACT_DIR, 'notification_icon_preview.png');
    await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 4,
        background: '#0F1219' // App dark background
      }
    })
      .composite([{ input: previewIcon, left: 32, top: 32 }])
      .png()
      .toFile(previewPath);

    console.log('  [OK] Created notification preview in artifact directory.');
  }

  console.log('Done! Android notification icons generated successfully.');
}

generate().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
