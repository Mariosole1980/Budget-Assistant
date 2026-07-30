const fs = require('fs');

const filesToCopy = [
  'app.js',
  'index.html',
  'style.css',
  'sw.js',
  'version.json'
];

filesToCopy.forEach(file => {
  const src = `c:/Users/mario/Desktop/money-manager/${file}`;
  const dest = `c:/Users/mario/Desktop/money-manager/www/${file}`;
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to www/${file}`);
  }
});
