const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

// Global mock environment
global.window = global;
global.window.addEventListener = () => {};
global.history = { pushState: () => {}, state: null };
global.location = { pathname: '/', search: '', hash: '' };
global.document = {
  getElementById: (id) => {
    return {
      style: {},
      classList: { add: () => {}, remove: () => {} },
      appendChild: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    };
  },
  querySelectorAll: () => [],
  addEventListener: () => {},
  body: { classList: { add: () => {}, remove: () => {} } }
};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.navigator = { userAgent: "test" };
global.requestAnimationFrame = (cb) => cb();

try {
  eval(appJs);
  console.log("app.js evaluated fine");
  openSettingsCategoryManager();
  console.log("openSettingsCategoryManager executed cleanly!");
} catch (e) {
  console.error("Caught error:", e.stack);
}
