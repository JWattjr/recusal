import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(root, 'frontend');
const output = path.join(root, 'dist');
for (const file of ['index.html', 'styles.css', 'wallet.css', 'app.js', 'config.json']) {
  const info = await stat(path.join(frontend, file));
  if (!info.isFile()) throw new Error(`Missing frontend file: ${file}`);
}
const html = await readFile(path.join(frontend, 'index.html'), 'utf8');
const app = await readFile(path.join(frontend, 'app.js'), 'utf8');
if (!html.includes('Inspect this ruling') || !html.includes('Fictional microgrant round')) {
  throw new Error('Landing page is missing the featured public ruling entry point.');
}
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const selectors = [...app.matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]);
const missing = [...new Set(selectors.filter((selector) => !ids.has(selector)))];
if (missing.length) throw new Error(`App code references missing page IDs: ${missing.join(', ')}`);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(frontend, output, { recursive: true });
console.log(`Static frontend copied to ${output}`);
