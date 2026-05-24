#!/usr/bin/env node
// validate-files.js — validate lesson JSON files in isolation (L2 fills + L3
// canonical only). Use when authoring new lessons before they're in the
// manifest; the main validate-data.js requires manifest/disk parity which
// would fail mid-authoring.
//
// Usage:
//   node tools/validate-files.js data/algorithms/s-matrix-neighbors.json [more...]
//
// Runner semantics mirror validate-data.js exactly (which mirrors index.html's
// runCode + outputsMatch).

const fs = require('fs');

function fmt(a) {
  if (typeof a === 'string') return a;
  if (typeof a === 'number' || typeof a === 'boolean') return String(a);
  if (a === null) return 'null';
  if (a === undefined) return 'undefined';
  return JSON.stringify(a);
}

async function runCode(code) {
  const lines = [];
  const fakeConsole = {
    log: (...a) => lines.push(a.map(fmt).join(' ')),
    error: (...a) => lines.push(a.map(fmt).join(' ')),
    warn: (...a) => lines.push(a.map(fmt).join(' '))
  };
  try {
    const fn = new Function('console', code);
    const res = fn(fakeConsole);
    if (res && typeof res.then === 'function') await res;
    await new Promise(r => setTimeout(r, 0));
    return { output: lines.join('\n'), error: null };
  } catch (err) {
    return { output: lines.join('\n'), error: err.message };
  }
}

(async () => {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error('usage: node tools/validate-files.js <lesson.json> [more...]');
    process.exit(2);
  }
  let totalFail = 0;
  for (const p of paths) {
    const L = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`\n=== ${L.id} (${p}) ===`);
    const l1n = L.L1?.questions?.length || 0;
    const l2n = L.L2?.exercises?.length || 0;
    if (l1n < 3) console.log(`  ⚠ density: only ${l1n} L1 questions (PROFILE.md says ≥3)`);
    if (l2n < 2) console.log(`  ⚠ density: only ${l2n} L2 exercises (PROFILE.md says ≥2)`);
    if (L.L2?.exercises) {
      for (let i = 0; i < L.L2.exercises.length; i++) {
        const ex = L.L2.exercises[i];
        const parts = ex.template.split('___');
        let filled = parts[0];
        for (let b = 0; b < ex.blanks.length; b++) {
          filled += ex.blanks[b].answer + parts[b + 1];
        }
        const r = await runCode(filled);
        if (r.error) {
          console.log(`L2#${i} ERROR: ${r.error}`);
          totalFail++;
        } else if (r.output.trim() !== ex.expectedOutput.trim()) {
          console.log(`L2#${i} MISMATCH:\n  got: ${JSON.stringify(r.output)}\n  exp: ${JSON.stringify(ex.expectedOutput)}`);
          totalFail++;
        } else {
          console.log(`L2#${i} OK`);
        }
      }
    }
    if (L.L3?.canonical) {
      const r = await runCode(L.L3.canonical);
      if (r.error) {
        console.log(`L3 ERROR: ${r.error}`);
        totalFail++;
      } else if (r.output.trim() !== L.L3.expectedOutput.trim()) {
        console.log(`L3 MISMATCH:\n  got: ${JSON.stringify(r.output)}\n  exp: ${JSON.stringify(L.L3.expectedOutput)}`);
        totalFail++;
      } else {
        console.log(`L3 OK`);
      }
    }
  }
  console.log(`\n${totalFail === 0 ? 'ALL OK' : totalFail + ' FAILURE(S)'}`);
  process.exit(totalFail === 0 ? 0 : 1);
})();
