import fs from 'node:fs';
import path from 'node:path';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

const assetsDir = path.resolve('dist/assets');
const bundles = fs.readdirSync(assetsDir).filter((name) => /^index-.*\.js$/.test(name));
if (!bundles.length) throw new Error('No Vite index bundle found');

const targets = [
  { line: 1263, column: 13130, label: 'stack-frame' },
  { line: 38, column: 3371, label: 'window-error' },
];

for (const bundle of bundles) {
  const bundlePath = path.join(assetsDir, bundle);
  const code = fs.readFileSync(bundlePath, 'utf8');
  const lines = code.split('\n');
  const mapPath = `${bundlePath}.map`;
  const map = fs.existsSync(mapPath) ? new TraceMap(JSON.parse(fs.readFileSync(mapPath, 'utf8'))) : null;
  console.log(`BUNDLE ${bundle} LINES ${lines.length}`);
  for (const target of targets) {
    const text = lines[target.line - 1] ?? '';
    if (!text) continue;
    console.log(`TARGET ${target.label} ${target.line}:${target.column} LINE_LENGTH ${text.length}`);
    console.log('CONTEXT_START');
    console.log(text.slice(Math.max(0, target.column - 600), Math.min(text.length, target.column + 600)));
    console.log('CONTEXT_END');
    for (const needle of ['.count', 'count:', 'count)', 'count}']) {
      const hits = [];
      let idx = text.indexOf(needle);
      while (idx >= 0) {
        if (Math.abs(idx - target.column) < 2500) hits.push(idx);
        idx = text.indexOf(needle, idx + 1);
      }
      console.log(`NEEDLE ${needle} ${JSON.stringify(hits)}`);
    }
    if (map) {
      for (const col of [target.column - 300, target.column, target.column + 300]) {
        const pos = originalPositionFor(map, { line: target.line, column: Math.max(0, col) });
        console.log(`MAP ${target.label} ${col} ${JSON.stringify(pos)}`);
      }
    }
  }
}
