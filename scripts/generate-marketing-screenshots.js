const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ASSETS_DIR = 'C:\\Users\\mario\\Desktop\\PlayStore_Assets';
const OUT_DIR = path.join(ASSETS_DIR, 'Marketing_Mockups');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Base64 encode an image
function getBase64Image(filePath) {
  const bitmap = fs.readFileSync(filePath);
  return `data:image/png;base64,${bitmap.toString('base64')}`;
}

const slides = [
  {
    file: '01_Real_Transactions.png',
    outName: '01_Marketing_Transactions.png',
    badge: '💰 ΕΛΕΓΧΟΣ ΟΙΚΟΝΟΜΙΚΩΝ',
    title: 'ΚΑΤΑΓΡΑΦΗ ΕΞΟΔΩΝ<br>& ΚΑΘΑΡΟ ΥΠΟΛΟΙΠΟ',
    subtitle: 'Παρακολούθησε έσοδα, έξοδα και υπόλοιπο σε πραγματικό χρόνο με 1 κλικ.',
    bgGradient: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 60%, #050811 100%)',
    accentColor: '#38bdf8'
  },
  {
    file: '02_Real_Family_Hub.png',
    outName: '02_Marketing_Family_Cloud.png',
    badge: '👨‍👩‍👧 ΟΙΚΟΓΕΝΕΙΑ & CLOUD',
    title: 'ΚΟΙΝΟΣ ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ<br>& ΔΙΑΧΕΙΡΙΣΗ ΜΕΛΩΝ',
    subtitle: 'Σύνδεσε όλα τα μέλη, μοιράσου έξοδα & δες τις αλλαγές live σε όλες τις συσκευές.',
    bgGradient: 'radial-gradient(circle at 50% 20%, #0c4a6e 0%, #0f172a 60%, #050811 100%)',
    accentColor: '#38bdf8'
  },
  {
    file: '04_Real_AI_Advisor_Chat.png',
    outName: '03_Marketing_AI_Advisor.png',
    badge: '🤖 AI ΣΥΜΒΟΥΛΟΣ',
    title: 'ΟΙΚΟΝΟΜΙΚΟΣ ΣΥΜΒΟΥΛΟΣ AI<br>ΠΑΝΤΑ ΔΙΠΛΑ ΣΟΥ',
    subtitle: 'Έξυπνη ανάλυση συνηθειών και πρακτικές συμβουλές για να αυξήσεις την αποταμίευση.',
    bgGradient: 'radial-gradient(circle at 50% 20%, #2e1065 0%, #0f172a 60%, #050811 100%)',
    accentColor: '#c084fc'
  },
  {
    file: '03_Real_Category_Budgets.png',
    outName: '04_Marketing_Budgets.png',
    badge: '🎯 ΕΞΥΠΝΟΙ ΠΡΟΫΠΟΛΟΓΙΣΜΟΙ',
    title: 'ΜΗΝΙΑΙΑ ΟΡΙΑ BUDGETS<br>& ΕΛΕΓΧΟΣ ΣΠΑΤΑΛΗΣ',
    subtitle: 'Όρισε budgets ανά κατηγορία και δες πόσα μπορείς να ξοδεύεις κάθε μέρα.',
    bgGradient: 'radial-gradient(circle at 50% 20%, #064e3b 0%, #0f172a 60%, #050811 100%)',
    accentColor: '#34d399'
  },
  {
    file: '02_Real_Statistics.png',
    outName: '05_Marketing_Statistics.png',
    badge: '📊 ΑΝΑΛΥΤΙΚΑ ΣΤΑΤΙΣΤΙΚΑ',
    title: 'ΑΝΑΛΥΤΙΚΑ ΣΤΑΤΙΣΤΙΚΑ<br>& ΚΑΤΑΝΟΜΗ ΕΞΟΔΩΝ',
    subtitle: 'Αναλυτικά γραφήματα, ποσοστά εξόδων και μηνιαίες συγκρίσεις με μια ματιά.',
    bgGradient: 'radial-gradient(circle at 50% 20%, #701a75 0%, #0f172a 60%, #050811 100%)',
    accentColor: '#f472b6'
  },
  {
    file: '05_Real_Accounts_Health.png',
    outName: '06_Marketing_Financial_Health.png',
    badge: '🏦 ΛΟΓΑΡΙΑΣΜΟΙ & ΥΓΕΙΑ',
    title: 'ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ (FHS)<br>& ΠΡΟΒΛΕΨΗ ΑΠΟΤΑΜΙΕΥΣΗΣ',
    subtitle: 'Διαχείριση Τραπεζών, Καρτών & Μετρητών με δείκτη οικονομικής υγείας.',
    bgGradient: 'radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 60%, #050811 100%)',
    accentColor: '#60a5fa'
  },
  {
    file: '06_Real_Transaction_Modal.png',
    outName: '07_Marketing_Add_Transaction.png',
    badge: '⚡ ΑΜΕΣΗ ΚΑΤΑΧΩΡΙΣΗ',
    title: 'ΓΡΗΓΟΡΗ ΠΡΟΣΘΗΚΗ<br>& ΕΠΑΝΑΛΑΜΒΑΝΟΜΕΝΑ',
    subtitle: 'Δόσεις, πάγιες εντολές, σημειώσεις και αυτόματη κατηγοριοποίηση σε δευτερόλεπτα.',
    bgGradient: 'radial-gradient(circle at 50% 20%, #7c2d12 0%, #0f172a 60%, #050811 100%)',
    accentColor: '#fb923c'
  }
];

const http = require('http');

function generateHtml(slide) {
  const imgSrc = getBase64Image(path.join(ASSETS_DIR, slide.file));
  return `
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Plus+Jakarta+Sans:wght@600;700;800&subset=greek,latin&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      width: 1080px;
      height: 2400px;
      background: ${slide.bgGradient};
      font-family: 'Roboto', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      overflow: hidden;
      position: relative;
    }

    /* Ambient glow elements */
    .glow-sphere-1 {
      position: absolute;
      top: 4%;
      left: 50%;
      transform: translateX(-50%);
      width: 850px;
      height: 850px;
      background: radial-gradient(circle, ${slide.accentColor}30 0%, rgba(0,0,0,0) 70%);
      pointer-events: none;
      filter: blur(70px);
    }

    /* Top text header section */
    .header-section {
      width: 100%;
      padding: 110px 50px 40px 50px;
      text-align: center;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 24px;
      border-radius: 100px;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.16);
      backdrop-filter: blur(14px);
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: ${slide.accentColor};
      margin-bottom: 26px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }

    .headline {
      font-size: 60px;
      font-weight: 900;
      line-height: 1.22;
      letter-spacing: -0.5px;
      margin-bottom: 20px;
      color: #ffffff;
      text-shadow: 0 4px 24px rgba(0,0,0,0.6);
    }

    .subheadline {
      font-size: 28px;
      font-weight: 400;
      line-height: 1.45;
      color: #94a3b8;
      max-width: 920px;
      letter-spacing: -0.2px;
    }

    /* Smartphone Device Frame */
    .device-container {
      position: absolute;
      bottom: -60px;
      width: 880px;
      height: 1720px;
      z-index: 5;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .phone-frame {
      width: 100%;
      height: 100%;
      background: #0b0f19;
      border-radius: 56px 56px 0 0;
      border: 12px solid #252a38;
      border-bottom: none;
      box-shadow: 
        0 -25px 80px rgba(0, 0, 0, 0.85),
        0 0 0 2px rgba(255, 255, 255, 0.1),
        inset 0 0 0 2px rgba(0, 0, 0, 0.8);
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .screen-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
    }
  </style>
</head>
<body>
  <div class="glow-sphere-1"></div>

  <div class="header-section">
    <div class="badge-pill">${slide.badge}</div>
    <h1 class="headline">${slide.title}</h1>
    <p class="subheadline">${slide.subtitle}</p>
  </div>

  <div class="device-container">
    <div class="phone-frame">
      <img class="screen-image" src="${imgSrc}" alt="App Screen">
    </div>
  </div>
</body>
</html>
  `;
}

async function run() {
  console.log('🚀 Generating Play Store Marketing Promo Mockups (1080x2400)...');
  let currentHtml = '';
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(currentHtml);
  });
  await new Promise(r => server.listen(8099, r));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 2400, deviceScaleFactor: 1 });

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    console.log(`🎨 Creating [${i + 1}/${slides.length}] ${slide.outName}...`);
    currentHtml = generateHtml(slide);
    await page.goto('http://localhost:8099/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));

    const outPath = path.join(OUT_DIR, slide.outName);
    await page.screenshot({ path: outPath, type: 'png' });
  }

  await browser.close();
  server.close();
  console.log(`✨ All Marketing Mockups generated in: ${OUT_DIR}`);
}

run().catch(console.error);
