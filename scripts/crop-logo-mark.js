const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ICON_PATH = path.join(__dirname, '..', 'icon.png');
const OUT_PATH = path.join(__dirname, '..', 'logo-mark.png');

async function crop() {
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
      <canvas id="c" width="420" height="380"></canvas>
      <script>
        const img = new Image();
        img.onload = () => {
          const c = document.getElementById('c');
          const ctx = c.getContext('2d');
          // Crop only the neon chart graphic (excluding bottom text 'Budget Assistant')
          // Source: sx: 46, sy: 30, sWidth: 420, sHeight: 375
          ctx.drawImage(img, 50, 40, 412, 360, 0, 0, 420, 380);
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
  console.log('✅ Cropped logo-mark.png successfully saved to:', OUT_PATH);
}

crop().catch(console.error);
