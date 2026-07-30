const fs = require('fs');

// We will mock the state to test the engine
global.state = {
  lang: 'el',
  categories: [
    { name: 'Σούπερ Μάρκετ', type: 'expense' },
    { name: 'Βενζίνη', type: 'expense' },
    { name: 'Διασκέδαση', type: 'expense' }
  ],
  financialMemory: {
    merchantTokens: {
      'αβ': { count: 5, category: 'Σούπερ Μάρκετ', lastUsed: new Date().toISOString() },
      'shell': { count: 3, category: 'Βενζίνη', lastUsed: new Date().toISOString() },
      'bp': { count: 10, category: 'Βενζίνη', lastUsed: new Date().toISOString() }
    }
  },
  advisorContext: { state: 'IDLE', pendingData: {}, history: [] }
};

global.saveAdvisorContext = () => {};
global.formatCurrency = (amt) => `${amt} €`;
global.normalizeGreekString = (str) => {
    return str.toLowerCase()
      .replace(/ά/g, 'α').replace(/έ/g, 'ε').replace(/ή/g, 'η').replace(/ί/g, 'ι')
      .replace(/ό/g, 'ο').replace(/ύ/g, 'υ').replace(/ώ/g, 'ω')
      .replace(/ϊ/g, 'ι').replace(/ϋ/g, 'υ').replace(/ΐ/g, 'ι').replace(/ΰ/g, 'υ')
      .replace(/ς/g, 'σ');
};

// We need stringSimilarity
global.stringSimilarity = (s1, s2) => {
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;
    return (longer.length - global.editDistance(longer, shorter)) / parseFloat(longer.length);
};

global.editDistance = (s1, s2) => {
    let costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i == 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
};

// Now evaluate the file, excluding window, document stuff
const code = fs.readFileSync('./app.js', 'utf8');

// We'll extract only the specific functions we need to test using regex or just mock window
const testContext = {
    state: global.state,
    saveAdvisorContext: global.saveAdvisorContext,
    formatCurrency: global.formatCurrency,
    normalizeGreekString: global.normalizeGreekString,
    stringSimilarity: global.stringSimilarity,
    editDistance: global.editDistance,
    console: console,
    Math: Math,
    Date: Date,
    parseFloat: parseFloat,
    parseInt: parseInt,
    isNaN: isNaN,
    Object: Object,
    Array: Array
};

// Using eval in a dirty way is hard, let's just parse the necessary functions manually or load app.js in a VM.
const vm = require('vm');
const script = new vm.Script(code);
const sandbox = {
    window: { submitCoachTransaction: () => {} },
    document: { getElementById: () => ({value: ''}) },
    ...testContext
};
vm.createContext(sandbox);

try {
    script.runInContext(sandbox);
    
    // Test cases
    const queries = [
        "έδωσα 50 ευρώ στον αβ",
        "εβαλα 30 shell",
        "ξόδεψα 20 για σινεμά", // no token history
        "πόσα ξόδεψα"
    ];
    
    for (let q of queries) {
        console.log(`\n--- QUERY: "${q}" ---`);
        const result = sandbox.processCoachQuery(q);
        console.log(result);
    }

} catch (e) {
    console.error("Test failed:", e);
}
