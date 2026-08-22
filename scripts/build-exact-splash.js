const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const resDir = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

const splashDimensions = {
  'drawable': { width: 1080, height: 2400, markSize: 440 },
  'drawable-port-mdpi': { width: 320, height: 480, markSize: 160 },
  'drawable-port-hdpi': { width: 480, height: 800, markSize: 220 },
  'drawable-port-xhdpi': { width: 720, height: 1280, markSize: 320 },
  'drawable-port-xxhdpi': { width: 1080, height: 1920, markSize: 440 },
  'drawable-port-xxxhdpi': { width: 1440, height: 2560, markSize: 580 },

  'drawable-land-mdpi': { width: 480, height: 320, markSize: 140 },
  'drawable-land-hdpi': { width: 800, height: 480, markSize: 200 },
  'drawable-land-xhdpi': { width: 1280, height: 720, markSize: 260 },
  'drawable-land-xxhdpi': { width: 1920, height: 1080, markSize: 360 },
  'drawable-land-xxxhdpi': { width: 2560, height: 1440, markSize: 460 },
};

Object.keys(splashDimensions).forEach((key) => {
  if (key.startsWith('drawable-port-') && !key.includes('night')) {
    splashDimensions[key.replace('drawable-port-', 'drawable-port-night-')] = splashDimensions[key];
  }
  if (key.startsWith('drawable-land-') && !key.includes('night')) {
    splashDimensions[key.replace('drawable-land-', 'drawable-land-night-')] = splashDimensions[key];
  }
});

(async () => {
  const logoPath = path.join(ROOT, 'logo-mark.png');

  for (const [dirName, dim] of Object.entries(splashDimensions)) {
    const dir = path.join(resDir, dirName);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const markResized = await sharp(logoPath)
      .resize(dim.markSize, dim.markSize, { fit: 'contain' })
      .png()
      .toBuffer();

    const isPort = dim.height >= dim.width;
    const markTop = isPort
      ? Math.round((dim.height - dim.markSize) / 2) - Math.round(dim.height * 0.05)
      : Math.round((dim.height - dim.markSize) / 2);
    const markLeft = Math.round((dim.width - dim.markSize) / 2);

    const titleSize = Math.max(16, Math.round(dim.width * 0.065));
    const subSize = Math.max(9, Math.round(titleSize * 0.38));
    const textHeight = Math.round(dim.height * 0.16);

    const textSvg = Buffer.from(`
      <svg width="${dim.width}" height="${textHeight}" viewBox="0 0 ${dim.width} ${textHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .wordmark { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; font-size: ${titleSize}px; fill: #F2F4F8; letter-spacing: -0.5px; }
          .tagline { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600; font-size: ${subSize}px; fill: #8A93A6; letter-spacing: 3px; text-transform: uppercase; }
        </style>
        <text x="${dim.width / 2}" y="${Math.round(textHeight * 0.4)}" text-anchor="middle" class="wordmark">Budget Assistant</text>
        <text x="${dim.width / 2}" y="${Math.round(textHeight * 0.8)}" text-anchor="middle" class="tagline">SMART FINANCE, ELEVATED</text>
      </svg>
    `);
    const textBuf = await sharp(textSvg).png().toBuffer();

    // Dark background matching user specification: #0F1219 to #171B26
    const bgSvg = Buffer.from(`
      <svg width="${dim.width}" height="${dim.height}" viewBox="0 0 ${dim.width} ${dim.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bg" cx="50%" cy="18%" r="85%">
            <stop offset="0%" stop-color="#232A3B"/>
            <stop offset="48%" stop-color="#171B26"/>
            <stop offset="100%" stop-color="#0F1219"/>
          </radialGradient>
        </defs>
        <rect width="${dim.width}" height="${dim.height}" fill="url(#bg)" />
      </svg>
    `);
    const bgBuf = await sharp(bgSvg).png().toBuffer();

    const textTop = isPort
      ? markTop + dim.markSize + Math.round(dim.height * 0.02)
      : markTop + dim.markSize + 10;

    await sharp(bgBuf)
      .composite([
        { input: markResized, left: markLeft, top: markTop },
        { input: textBuf, left: 0, top: textTop }
      ])
      .png()
      .toFile(path.join(dir, 'splash.png'));

    console.log('Wrote splash.png to', dirName);
  }

  // 2. Generate Android 12+ Splash Logo (pure transparent glyph inside 288x288)
  const splashLogoPath = path.join(resDir, 'drawable', 'splash_logo.png');
  await sharp(logoPath)
    .resize(288, 288, { fit: 'contain' })
    .png()
    .toFile(splashLogoPath);
  console.log('Wrote splash_logo.png to drawable');

  // Copy preview
  const previewPath = 'C:\\Users\\mario\\.gemini\\antigravity\\brain\\d00c3a35-fc18-43bf-940c-2561fd43c2eb\\splash_chosen_design.png';
  fs.copyFileSync(path.join(resDir, 'drawable-port-xxhdpi', 'splash.png'), previewPath);
  console.log('Saved preview to', previewPath);
})();
