const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = 0;
while ((idx = appJs.indexOf('.delete()', idx)) !== -1) {
  const slice = appJs.substring(Math.max(0, idx - 150), idx + 250);
  if (slice.includes('recurring') || slice.includes('template')) {
    console.log("Found template delete at pos:", idx);
    console.log(slice);
    console.log("==========================================");
  }
  idx += '.delete()'.length;
}

idx = 0;
while ((idx = appJs.indexOf('filter(', idx)) !== -1) {
  const slice = appJs.substring(Math.max(0, idx - 50), idx + 200);
  if (slice.includes('recurring') || slice.includes('Template')) {
    console.log("Found template filter at pos:", idx);
    console.log(slice);
    console.log("------------------------------------------");
  }
  idx += 'filter('.length;
}
