function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const testStrings = [
  'καφές',
  'ΚΑΦΈΣ',
  'αεροπλάνο',
  'ΑΕΡΟΠΛΆΝΟ',
  'αγορά',
  'ΑΓΟΡΆ',
  'Μάιος',
  'μαϊος',
  'Μαΐου'
];

testStrings.forEach(s => {
  console.log(`Original: "${s}" -> Normalized: "${normalizeText(s)}"`);
});
