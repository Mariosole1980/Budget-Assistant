const sharp = require('sharp');
const path = require('path');

(async () => {
  const img = sharp('assets/logo/user_logo.png');
  // Crop strictly the neon chart area (y: 190 to 805, x: 160 to 860)
  const chartCrop = await img.extract({ left: 160, top: 190, width: 700, height: 615 }).png().toBuffer();

  const { data, info } = await sharp(chartCrop).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const maxVal = Math.max(r, g, b);
    const minVal = Math.min(r, g, b);
    const chroma = maxVal - minVal;

    // Background JPEG noise has low brightness and low chroma
    if (maxVal < 38 || (maxVal < 65 && chroma < 18)) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    } else {
      // Smooth anti-aliased edge
      const alpha = Math.min(255, Math.round(((maxVal - 38) / 35) * 255));
      data[i + 3] = alpha;
    }
  }

  const cleanIconBuf = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  }).trim().png().toBuffer();

  const cleanIconPath = path.join('C:\\Users\\mario\\.gemini\\antigravity\\brain\\d00c3a35-fc18-43bf-940c-2561fd43c2eb', 'exact_authentic_icon_clean.png');
  await sharp(cleanIconBuf).toFile(cleanIconPath);

  // Now render the splash preview
  const W = 1080;
  const H = 2400;
  const iconResized = await sharp(cleanIconBuf).resize(520, 520, { fit: 'contain' }).png().toBuffer();

  const textSvg = Buffer.from(`
    <svg width="${W}" height="450" viewBox="0 0 ${W} 450" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 76px; font-weight: 800; fill: #ffffff; letter-spacing: -0.5px; }
        .subtitle { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 34px; font-weight: 500; fill: #94a3b8; letter-spacing: 0.5px; }
      </style>
      <text x="${W / 2}" y="130" text-anchor="middle" class="title">Budget Assistant</text>
      <text x="${W / 2}" y="210" text-anchor="middle" class="subtitle">Smart Finance. Elevated.</text>
    </svg>
  `);

  const previewPath = path.join('C:\\Users\\mario\\.gemini\\antigravity\\brain\\d00c3a35-fc18-43bf-940c-2561fd43c2eb', 'splash_crystal_clean_preview.png');
  await sharp({
    create: { width: W, height: H, channels: 4, background: '#0c0d12' }
  })
    .composite([
      { input: iconResized, left: Math.round((W - 520) / 2), top: Math.round((H / 2) - 390) },
      { input: textSvg, left: 0, top: Math.round((H / 2) + 160) }
    ])
    .png()
    .toFile(previewPath);

  console.log('Crystal clean preview saved at', previewPath);
})();
