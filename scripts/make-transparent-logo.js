const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ICON_PATH = path.join(__dirname, '..', 'icon.png');
const OUT_PATH = path.join(__dirname, '..', 'logo-mark.png');

async function makeTransparent() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 512, height: 512 });

  const iconBase64 = fs.readFileSync(ICON_PATH).toString('base64');
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
        canvas { display: block; }
      </style>
    </head>
    <body>
      <canvas id="c" width="412" height="360"></canvas>
      <script>
        const img = new Image();
        img.onload = () => {
          const c = document.getElementById('c');
          const ctx = c.getContext('2d');
          
          // Draw cropped neon chart
          ctx.drawImage(img, 50, 40, 412, 360, 0, 0, 412, 360);
          
          const imgData = ctx.getImageData(0, 0, 412, 360);
          const data = imgData.data;
          
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Perceived luminance of the glow
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            
            if (lum < 16) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
              data[i + 3] = 0;
            } else {
              // Alpha is proportional to luminance
              const aNorm = Math.min(1.0, (lum - 12) / 120);
              data[i + 3] = Math.floor(aNorm * 255);
              
              // Unmultiply color from black so it stays luminous and vibrant
              data[i] = Math.min(255, Math.floor(r / Math.max(0.15, aNorm)));
              data[i + 1] = Math.min(255, Math.floor(g / Math.max(0.15, aNorm)));
              data[i + 2] = Math.min(255, Math.floor(b / Math.max(0.15, aNorm)));
            }
          }
          
          ctx.putImageData(imgData, 0, 0);
          window.done = true;
        };
        img.src = "data:image/png;base64,${iconBase64}";
      </script>
    </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForFunction('window.done === true');

  const canvasHandle = await page.$('#c');
  await canvasHandle.screenshot({ path: OUT_PATH, omitBackground: true });

  await browser.close();
  console.log('✨ 100% Transparent logo-mark.png saved successfully to:', OUT_PATH);
}

makeTransparent().catch(console.error);
