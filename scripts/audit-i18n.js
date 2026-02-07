const fs = require('fs');
const path = require('path');

// Read the dictionaries file
const dictPath = path.join(__dirname, '../lib/i18n/dictionaries.ts');
const content = fs.readFileSync(dictPath, 'utf8');

// Parse the file using eval (we control the content)
const moduleExports = {};
const exports = moduleExports;
const module = { exports: moduleExports };

// Extract just the dictionaries object
const dictMatch = content.match(/const dictionaries = ({[\s\S]*?}) as const/);
if (!dictMatch) {
  console.error('Could not parse dictionaries object');
  process.exit(1);
}

const dictionaries = eval('(' + dictMatch[1] + ')');

// Extract all leaf paths from an object
function extractLeafPaths(obj, prefix = '') {
  const paths = [];
  for (const key in obj) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      paths.push(...extractLeafPaths(obj[key], fullPath));
    } else {
      paths.push({ path: fullPath, value: obj[key] });
    }
  }
  return paths;
}

// Extract paths from both locales
const frPaths = extractLeafPaths(dictionaries.fr);
const enPaths = extractLeafPaths(dictionaries.en);

const frPathSet = new Set(frPaths.map(p => p.path));
const enPathSet = new Set(enPaths.map(p => p.path));

// Find missing keys
const missingInEn = [...frPathSet].filter(p => !enPathSet.has(p));
const missingInFr = [...enPathSet].filter(p => !enPathSet.has(p));

console.log('=== DICTIONARY AUDIT RESULTS ===\n');

if (missingInEn.length > 0) {
  console.log('❌ Keys in FR but missing in EN:');
  missingInEn.forEach(p => console.log(`  - ${p}`));
  console.log('');
}

if (missingInFr.length > 0) {
  console.log('❌ Keys in EN but missing in FR:');
  missingInFr.forEach(p => console.log(`  - ${p}`));
  console.log('');
}

// Find empty or placeholder values
const frIssues = frPaths.filter(p => {
  const val = String(p.value);
  return val === '' || val.includes('TODO') || val.includes('FIXME') || val.includes('XXX');
});

const enIssues = enPaths.filter(p => {
  const val = String(p.value);
  return val === '' || val.includes('TODO') || val.includes('FIXME') || val.includes('XXX');
});

if (frIssues.length > 0) {
  console.log('⚠️  FR keys with empty/placeholder values:');
  frIssues.forEach(p => console.log(`  - ${p.path}: "${p.value}"`));
  console.log('');
}

if (enIssues.length > 0) {
  console.log('⚠️  EN keys with empty/placeholder values:');
  enIssues.forEach(p => console.log(`  - ${p.path}: "${p.value}"`));
  console.log('');
}

// Summary
if (missingInEn.length === 0 && missingInFr.length === 0 && frIssues.length === 0 && enIssues.length === 0) {
  console.log('✅ All checks passed!');
  console.log(`   - ${frPaths.length} keys in FR`);
  console.log(`   - ${enPaths.length} keys in EN`);
  console.log('   - No missing keys');
  console.log('   - No placeholder values');
} else {
  console.log('Summary:');
  console.log(`  - Total FR keys: ${frPaths.length}`);
  console.log(`  - Total EN keys: ${enPaths.length}`);
  console.log(`  - Missing in EN: ${missingInEn.length}`);
  console.log(`  - Missing in FR: ${missingInFr.length}`);
  console.log(`  - FR issues: ${frIssues.length}`);
  console.log(`  - EN issues: ${enIssues.length}`);

  process.exit(1);
}
