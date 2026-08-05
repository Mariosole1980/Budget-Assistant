const fs = require('fs');
['c:/Users/mario/Desktop/money-manager/app.js', 'c:/Users/mario/Desktop/money-manager/live_app.js'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/(\.\.\.dbPayload \} = );(\s*return dbPayload;\s*\})/g, '$1t;$2');
  content = content.replace(/(\.\.\.dbPayload \} = );/g, '$1transaction;');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed ' + file);
});
