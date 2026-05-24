#!/usr/bin/env node
// One-shot migration: for lessons where reference.code and L3.canonical share
// a function body but L3 has been stripped of comments, propagate the reference
// comments to L3. Works by detecting the function definition's range in both
// strings and replacing L3's range with reference's range verbatim.
//
// Usage:  node tools/migrations/sync-comments-to-l3.js <file1.json> <file2.json> ...
//
// Heuristic: function body = from line starting with `function ` (or `class `)
// to the matching `}` at column 0. Everything before/after that range in L3 is
// preserved (helpers above, test code below). If the reference body and the
// raw L3 body (with comments stripped) don't match line-for-line, the file
// is skipped with a warning so we don't corrupt anything.

const fs = require('fs');

function extractBody(src) {
  const lines = src.split('\n');
  let start = -1, end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (start === -1 && /^(function |class |const \w+ = function)/.test(lines[i])) {
      start = i;
    } else if (start !== -1 && /^\}/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end, lines };
}

function stripLineComments(line) {
  return line.replace(/\s*\/\/.*$/, '').trimEnd();
}

const files = process.argv.slice(2);
let synced = 0, skipped = 0;
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ref = data.reference?.code || '';
  const l3  = data.L3?.canonical || '';
  if (!ref || !l3) { skipped++; continue; }

  const r = extractBody(ref);
  const l = extractBody(l3);
  if (r.start === -1 || r.end === -1 || l.start === -1 || l.end === -1) {
    console.log(`SKIP  ${file}  — could not find function body`);
    skipped++; continue;
  }

  const refBody = r.lines.slice(r.start, r.end + 1);
  const l3Body  = l.lines.slice(l.start, l.end + 1);

  // Verify: stripping comments from ref body should produce the same sequence
  // as stripping comments from L3 body (line by line, blank lines preserved).
  const refStripped = refBody.map(stripLineComments).filter(s => s !== '');
  const l3Stripped  = l3Body.map(stripLineComments).filter(s => s !== '');
  if (refStripped.length !== l3Stripped.length ||
      refStripped.some((s, i) => s !== l3Stripped[i])) {
    console.log(`SKIP  ${file}  — function bodies differ (manual edit needed)`);
    skipped++; continue;
  }

  // Replace L3's body with reference's body verbatim, keep L3's pre/post lines.
  const newL3Lines = [
    ...l.lines.slice(0, l.start),
    ...refBody,
    ...l.lines.slice(l.end + 1),
  ];
  data.L3.canonical = newL3Lines.join('\n');

  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  synced++;
  console.log(`OK    ${file}`);
}
console.log(`\n${synced} synced, ${skipped} skipped.`);
