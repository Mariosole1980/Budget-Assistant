function stripLeadingEmoji(str) {
  if (!str) return '';
  let i = 0;
  const codes = [];
  for (let j = 0; j < str.length; j++) {
    codes.push(str.charCodeAt(j));
  }
  while (i < codes.length) {
    const c = codes[i];
    // High surrogate (emoji start)
    if (c >= 0xD800 && c <= 0xDBFF) {
      i += 2; // skip surrogate pair (2 code units)
      // Skip trailing space after emoji
      while (i < codes.length && codes[i] === 0x20) i++;
    }
    // BMP private use area
    else if (c >= 0xE000 && c <= 0xF8FF) {
      i += 1;
      while (i < codes.length && codes[i] === 0x20) i++;
    }
    // BMP symbols / dingbats (like U+2764 heart, etc.)
    else if (c >= 0x2600 && c <= 0x27BF) {
      i += 1;
      while (i < codes.length && codes[i] === 0x20) i++;
    }
    // Variation selector or replacement char
    else if (c === 0xFFFD || (c >= 0xFE00 && c <= 0xFE0F)) {
      i += 1;
      while (i < codes.length && codes[i] === 0x20) i++;
    }
    // Regular character - stop stripping
    else {
      break;
    }
  }
  return str.substring(i).trim();
}

const tests = [
  "❤️ ΥΓΕΙΑ",
  "🏡 ΣΠΙΤΙ",
  "🛒 ΔΙΑΤΡΟΦΗ",
  "🏠ΓΡΑΦΕΙΟ Β2",
  "🚗 ΑΥΤΟΚΙΝΗΤΟ",
  "🎉ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ",
  "🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ",
  "🏋️ΓΥΜΝΑΣΤΗΡΙΟ",
  "👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ",
  "🚇 ΜΕΤΑΚΙΝΗΣΗ",
  "🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ",
  "🎬 ΣΥΝΔΡΟΜΕΣ",
  "🎓 ΕΚΠΑΙΔΕΥΣΗ"
];

for (const t of tests) {
  console.log(`"${t}" => "${stripLeadingEmoji(t)}"`);
}
