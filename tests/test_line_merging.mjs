import assert from 'node:assert';
import fs from 'node:fs';

// Read app.js content and extract formatMergedLines function
const appJs = fs.readFileSync('frontend/app.js', 'utf-8');

// Match the formatMergedLines function using regex
const funcMatch = appJs.match(/function formatMergedLines\([\s\S]*?\n\}/);
if (!funcMatch) {
  throw new Error('Could not find formatMergedLines in app.js');
}

// Evaluate the function in the current scope
const formatMergedLines = new Function(`${funcMatch[0]}; return formatMergedLines;`)();

console.log('Running Multilingual Line Merging unit tests...');

// 1. Japanese (Kanji & Kana) - seamless merge without spaces
const jaText = '冒険の\n始まり';
assert.strictEqual(formatMergedLines(jaText), '冒険の始まり');
console.log('✔ Test 1: Japanese seamless merge without spaces passed');

// 2. Chinese (Simplified & Traditional) - seamless merge without spaces
const zhText = '今天天气\n非常好';
assert.strictEqual(formatMergedLines(zhText), '今天天气非常好');

const zhTwText = '繁體中文\n測試語句';
assert.strictEqual(formatMergedLines(zhTwText), '繁體中文測試語句');
console.log('✔ Test 2: Chinese (Simplified & Traditional) merge passed');

// 3. Korean (Hangul) - merge with spaces
const koText = '안녕하세요\n반갑습니다';
assert.strictEqual(formatMergedLines(koText), '안녕하세요 반갑습니다');
console.log('✔ Test 3: Korean (Hangul) merge with space passed');

// 4. English / ASCII - merge with space
const enText = 'Console\nCapture';
assert.strictEqual(formatMergedLines(enText), 'Console Capture');
console.log('✔ Test 4: English merge with space passed');

// 5. European Accented & Non-ASCII Letters (French, Spanish, German, Russian)
const frText = 'très\nbien';
assert.strictEqual(formatMergedLines(frText), 'très bien');

const esText = 'año\nnuevo';
assert.strictEqual(formatMergedLines(esText), 'año nuevo');

const deText = 'große\nÜberraschung';
assert.strictEqual(formatMergedLines(deText), 'große Überraschung');

const ruText = 'Привет\nмир';
assert.strictEqual(formatMergedLines(ruText), 'Привет мир');
console.log('✔ Test 5: Accented and Cyrillic script merge passed');

// 6. European De-hyphenation across line wraps
const hyphenEn = 'inter-\nnational';
assert.strictEqual(formatMergedLines(hyphenEn), 'international');

const hyphenDe = 'un-\nglaublich';
assert.strictEqual(formatMergedLines(hyphenDe), 'unglaublich');
console.log('✔ Test 6: European de-hyphenation passed');

// 7. Edge cases: Empty, single line, multiple breaks
assert.strictEqual(formatMergedLines(''), '');
assert.strictEqual(formatMergedLines('Single line'), 'Single line');
assert.strictEqual(formatMergedLines('First\n\nSecond'), 'First Second');
console.log('✔ Test 7: Edge cases passed');

console.log('All Multilingual Line Merging unit tests passed successfully!\n');
