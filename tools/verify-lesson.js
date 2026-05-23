#!/usr/bin/env node
// Per-file verifier — runs the L2 + L3 of each JSON file passed as args.
// Same runner semantics as tools/validate-data.js. Sub-agents call this to
// self-check their authored lessons before reporting back.
//
//   node tools/verify-lesson.js data/<slug>/<id>.json [more files...]
//
// Exit code 0 on all-pass, 1 on any failure (with details printed).

const fs = require('fs');

function formatArg(a) {
  if (typeof a === 'string') return a;
  if (typeof a === 'number' || typeof a === 'boolean') return String(a);
  if (a === null) return 'null';
  if (a === undefined) return 'undefined';
  return JSON.stringify(a);
}
async function runCode(code) {
  const lines = [];
  const c = {
    log:   (...a) => lines.push(a.map(formatArg).join(' ')),
    error: (...a) => lines.push(a.map(formatArg).join(' ')),
    warn:  (...a) => lines.push(a.map(formatArg).join(' '))
  };
  try {
    const f = new Function('console', code);
    const r = f(c);
    if (r && typeof r.then === 'function') await r;
    await new Promise(r => setTimeout(r, 0));
    return { output: lines.join('\n'), error: null };
  } catch (e) {
    return { output: lines.join('\n'), error: e.message };
  }
}
function match(a, b) { return a.trim() === b.trim(); }

(async () => {
  let pass = 0, fail = 0;
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: verify-lesson.js <file.json> [...]'); process.exit(2); }
  for (const file of files) {
    const l = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (l.L2 && l.L2.exercises) {
      for (let i = 0; i < l.L2.exercises.length; i++) {
        const ex = l.L2.exercises[i];
        const parts = ex.template.split('___');
        let filled = parts[0];
        for (let b = 0; b < ex.blanks.length; b++) filled += ex.blanks[b].answer + parts[b + 1];
        const r = await runCode(filled);
        if (r.error)                                  { console.log('FAIL', file, 'L2#' + i, 'error:', r.error); fail++; }
        else if (!match(r.output, ex.expectedOutput)) { console.log('FAIL', file, 'L2#' + i, 'got:', JSON.stringify(r.output), 'want:', JSON.stringify(ex.expectedOutput)); fail++; }
        else pass++;
      }
    }
    if (l.L3 && l.L3.canonical) {
      const r = await runCode(l.L3.canonical);
      if (r.error)                                  { console.log('FAIL', file, 'L3 error:', r.error); fail++; }
      else if (!match(r.output, l.L3.expectedOutput)){ console.log('FAIL', file, 'L3 got:', JSON.stringify(r.output), 'want:', JSON.stringify(l.L3.expectedOutput)); fail++; }
      else pass++;
    }
  }
  console.log(pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})();
