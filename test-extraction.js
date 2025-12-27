#!/usr/bin/env node

import ProductExtractor from './src/extractor.js';

const url = process.argv[2] || 'https://www.ugg.com/women-slippers/cozy-slipper/1117659.html';

console.log(`Testing extraction for: ${url}\n`);

const extractor = new ProductExtractor();
await extractor.init();

const result = await extractor.extract(url, { compact: true });

console.log('\n=== EXTRACTION RESULT ===');
console.log(JSON.stringify(result, null, 2));

await extractor.close();
