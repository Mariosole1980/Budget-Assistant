const fs = require('fs');

// Create minimal JSDOM / mock DOM environment
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "outside-only" });
const window = dom.window;
const document = window.document;

// Execute app.js in dom context
try {
  dom.runVMScript(new (require("vm").Script)(appJs));
  console.log("app.js evaluated successfully");

  // Call openSettingsCategoryManager()
  window.openSettingsCategoryManager();
  console.log("openSettingsCategoryManager executed without error!");
  
  const list = document.getElementById('category-manager-list');
  console.log("category-manager-list innerHTML length:", list ? list.innerHTML.length : "NULL");
} catch (e) {
  console.error("Runtime error during openSettingsCategoryManager:", e);
}
