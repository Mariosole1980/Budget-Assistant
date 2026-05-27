const https = require('https');
const fs = require('fs');

const url = 'https://9591a5a3.money-manager-pwa.pages.dev/app.js';
const file = fs.createWriteStream('app.js');

https.get(url, (response) => {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Original app.js downloaded successfully!');
  });
}).on('error', (err) => {
  fs.unlink('app.js', () => {});
  console.error('Download error:', err.message);
});
