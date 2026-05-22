#!/usr/bin/env node
// One-shot: split the inline <style> + last <script> blocks out of index.html
// into app.css and app.js. The remaining HTML references both via <link> and
// <script src>. CDN <script> tags (CodeMirror, Tailwind) stay inline.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const HTML = path.join(ROOT, 'index.html');
const CSS = path.join(ROOT, 'app.css');
const JS = path.join(ROOT, 'app.js');

let src = fs.readFileSync(HTML, 'utf8');

// ── 1. Pull out the single <style>…</style> block ────────────────────────
const styleMatch = src.match(/^  <style>\n([\s\S]*?)\n  <\/style>\n/m);
if (!styleMatch) throw new Error('Could not find <style> block');
const styleBody = styleMatch[1];
// Drop the 4-space leading indent so the CSS reads cleanly on its own.
const cssOut = styleBody.replace(/^ {4}/gm, '').trim() + '\n';
fs.writeFileSync(CSS, cssOut);
const cssLines = cssOut.split('\n').length;

// ── 2. Pull out the LAST <script>…</script> block (the app code) ─────────
// The earlier <script src=…> tags for CodeMirror stay inline.
const scriptRe = /^  <script>\n([\s\S]*?)\n  <\/script>\n/gm;
let lastMatch = null;
let m;
while ((m = scriptRe.exec(src)) !== null) lastMatch = m;
if (!lastMatch) throw new Error('Could not find inline <script> block');
const scriptBody = lastMatch[1];
const jsOut = scriptBody.replace(/^ {2}/gm, '').trim() + '\n';
fs.writeFileSync(JS, jsOut);
const jsLines = jsOut.split('\n').length;

// ── 3. Splice the HTML: replace style and script with link / script src ──
// Order matters — we mutate by string replace, so do the script first to
// avoid index drift (its match is later in the file).
src = src.slice(0, lastMatch.index)
      + '  <script src="app.js" defer></script>\n'
      + src.slice(lastMatch.index + lastMatch[0].length);
src = src.replace(styleMatch[0], '  <link rel="stylesheet" href="app.css">\n');

fs.writeFileSync(HTML, src);
const htmlLines = src.split('\n').length;

console.log(`Split complete.`);
console.log(`  index.html : ${htmlLines} lines (was ~1970)`);
console.log(`  app.css    : ${cssLines} lines`);
console.log(`  app.js     : ${jsLines} lines`);
