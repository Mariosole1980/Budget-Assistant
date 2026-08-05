const fs = require('fs');
['c:/Users/mario/Desktop/money-manager/app.js', 'c:/Users/mario/Desktop/money-manager/live_app.js'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  const injectCode = `
  if (themeDisplay && themeDisplay.parentElement) {
    themeDisplay.parentElement.style.background = "rgba(var(--accent-rgb, 124, 106, 247), 0.12)";
    themeDisplay.parentElement.style.border = "1px solid rgba(var(--accent-rgb, 124, 106, 247), 0.3)";
    themeDisplay.style.color = "var(--accent)";
    const icon = themeDisplay.parentElement.querySelector("i");
    if (icon) icon.style.color = "var(--accent)";
  }
  if (currencyDisplay && currencyDisplay.parentElement) {
    currencyDisplay.parentElement.style.background = "rgba(var(--accent-rgb, 124, 106, 247), 0.12)";
    currencyDisplay.parentElement.style.border = "1px solid rgba(var(--accent-rgb, 124, 106, 247), 0.3)";
    currencyDisplay.style.color = "var(--accent)";
    const icon = currencyDisplay.parentElement.querySelector("i");
    if (icon) icon.style.color = "var(--accent)";
  }`;

  const target = "themeDisplay.textContent = themeLabels[theme] || theme;\n  }";
  if (content.includes(target)) {
    content = content.replace(target, target + injectCode);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed ' + file);
  } else {
    console.log('Target not found in ' + file);
  }
});
