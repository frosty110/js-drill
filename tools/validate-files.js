#!/usr/bin/env node
// validate-files.js — validate lesson JSON files in isolation (L2 fills + L3
// canonical only). Use when authoring new lessons before they're in the
// manifest; the main validate-data.js requires manifest/disk parity which
// would fail mid-authoring.
//
// Usage:
//   node tools/validate-files.js data/algorithms/s-matrix-neighbors.json [more...]
//
// Runner semantics come from the app itself — see tools/lib/runner-node.js.
// This file used to carry its own copy, which is how a lesson could be
// certified here and then graded differently in front of the user.

const fs = require('fs');
const { runCode, outputsMatch } = require('./lib/runner-node.js');

(async () => {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error('usage: node tools/validate-files.js <lesson.json> [more...]');
    process.exit(2);
  }
  let totalFail = 0;
  for (const p of paths) {
    const L = JSON.parse(fs.readFileSync(p, 'utf8'));
    // "lang":"ts" opts the whole lesson into TypeScript; absent it, JS.
    const lang = L.lang || 'js';
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
        const r = await runCode(filled, lang);
        if (r.error) {
          console.log(`L2#${i} ERROR: ${r.error}`);
          totalFail++;
        } else if (!outputsMatch(r.output, ex.expectedOutput)) {
          console.log(`L2#${i} MISMATCH:\n  got: ${JSON.stringify(r.output)}\n  exp: ${JSON.stringify(ex.expectedOutput)}`);
          totalFail++;
        } else {
          console.log(`L2#${i} OK`);
        }
      }
    }
    if (L.L3?.canonical) {
      const r = await runCode(L.L3.canonical, lang);
      if (r.error) {
        console.log(`L3 ERROR: ${r.error}`);
        totalFail++;
      } else if (!outputsMatch(r.output, L.L3.expectedOutput)) {
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
