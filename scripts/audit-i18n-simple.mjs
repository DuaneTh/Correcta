import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the dictionaries file
const dictPath = path.join(__dirname, '../lib/i18n/dictionaries.ts');
const content = fs.readFileSync(dictPath, 'utf8');

// Count leaf keys by extracting all property assignments with string values
// This is a simpler approach that doesn't require eval
function countKeys(section) {
  // Extract the section from the file
  const regex = new RegExp(`${section}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},?\\s*\\n\\s*${section === 'fr' ? 'en:' : '} as const'}`, 'm');
  const match = content.match(regex);

  if (!match) {
    console.error(`Could not find ${section} section`);
    return 0;
  }

  const sectionContent = match[1];

  // Count all lines that look like: key: 'value' or key: "value"
  // This includes nested properties
  const keyPattern = /^\s+\w+:\s*['"][^'"]*['"]\s*,?\s*$/gm;
  const keys = sectionContent.match(keyPattern) || [];

  return keys.length;
}

const frCount = countKeys('fr');
const enCount = countKeys('en');

console.log('=== SIMPLE DICTIONARY AUDIT ===\n');
console.log(`FR keys: ${frCount}`);
console.log(`EN keys: ${enCount}`);

if (frCount === enCount) {
  console.log('\n✅ Key counts match!');
  process.exit(0);
} else {
  console.log(`\n❌ Key count mismatch: ${Math.abs(frCount - enCount)} difference`);
  process.exit(1);
}
