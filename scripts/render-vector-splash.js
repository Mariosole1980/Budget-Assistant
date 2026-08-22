const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

(async () => {
  const ROOT = path.resolve(__dirname, '..');
  const svgPath = path.join(ROOT, 'assets', 'logo', 'budget_neon_chart_vector.svg');
  const svgBuf = fs.readFileSync(svgPath);

  const iconResized = await sharp(svgBuf).resize(500, 500).png().toBuffer();

  const W = 1080;
  const H = 2400;

  const textSvg = Buffer.from(`
    <svg width="${W}" height="450" viewBox="0 0 ${W} 450" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 74px; font-weight: 800; fill: #ffffff; letter-spacing: -0.5px; }
        .subtitle { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 32px; font-weight: 500; fill: #94a3b8; letter-spacing: 0.5px; }
      </style>
      <text x="${W / 2}" y="130" text-anchor="middle" class="title">Budget Assistant</text>
      <text x="${W / 2}" y="210" text-anchor="middle" class="subtitle">Smart Finance. Elevated.</text>
    </svg>
  `);

  const outPath = 'C:\\Users\\mario\\.gemini\\antigravity\\brain\\d00c3a35-fc18-43bf-940c-2561fd43c2eb\\splash_vector_pristine_preview.png';

  await sharp({
    create: { width: W, height: H, channels: 4, background: '#0c0d12' }
  })
    .composite([
      { input: iconResized, left: Math.round((W - 500) / 2), top: Math.round((H / 2) - 390) },
      { input: textSvg, left: 0, top: Math.round((H / 2) + 150) }
    ])
    .png()
    .toFile(outPath);

  console.log('Pristine vector preview rendered at', outPath);
})();
