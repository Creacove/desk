import fs from 'node:fs';
import path from 'node:path';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

const assetsDir = path.resolve('dist/assets');
const bundle = fs.readdirSync(assetsDir).find((name) => /^index-.*\.js$/.test(name));
if (!bundle) throw new Error('No Vite index bundle found');
const bundlePath = path.join(assetsDir, bundle);
const code = fs.readFileSync(bundlePath, 'utf8');
const lines = code.split('\n');
const line = 38;
const column = 3371;
const text = lines[line - 1] ?? '';
console.log(`BUNDLE ${bundle}`);
console.log(`LINE_LENGTH ${text.length}`);
console.log('CONTEXT_START');
console.log(text.slice(Math.max(0, column - 500), Math.min(text.length, column + 500)));
console.log('CONTEXT_END');
for (const needle of ['.count', 'count:', 'count)']) {
  const hits = [];
  let idx = text.indexOf(needle);
  while (idx >= 0) {
    if (Math.abs(idx - column) < 1500) hits.push(idx);
    idx = text.indexOf(needle, idx + 1);
  }
  console.log(`NEEDLE ${needle} ${JSON.stringify(hits)}`);
}
const mapPath = `${bundlePath}.map`;
if (fs.existsSync(mapPath)) {
  const map = new TraceMap(JSON.parse(fs.readFileSync(mapPath, 'utf8')));
  for (const col of [column - 300, column, column + 300]) {
    const pos = originalPositionFor(map, { line, column: Math.max(0, col) });
    console.log(`MAP ${col} ${JSON.stringify(pos)}`);
  }
}
