#!/usr/bin/env node
// Per-file verifier — runs the L2 + L3 of each JSON file passed as args.
// Same runner semantics as tools/validate-data.js. Sub-agents call this to
// self-check their authored lessons before reporting back.
//
//   node tools/verify-lesson.js data/<slug>/<id>.json [more files...]
//
// Exit code 0 on all-pass, 1 on any failure (with details printed).

const fs = require('fs');

// The app's own runner + matcher. This file used to carry a private copy that
// had drifted three ways at once: no Map/Set formatting, no `[error] ` prefix,
// a 1-macrotask drain, no strict-mode wrapper — and it ignored `lang:"ts"`
// entirely, so a sub-agent verifying a TypeScript lesson got a SyntaxError for
// correct content. It also compared with strict equality rather than the
// subsequence match the app grades with. Sub-agents certify lessons with this
// script, so its answer has to be the app's answer.
const { runCode, outputsMatch } = require('./lib/runner-node.js');

(async () => {
  let pass = 0, fail = 0;
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: verify-lesson.js <file.json> [...]'); process.exit(2); }
  for (const file of files) {
    const l = JSON.parse(fs.readFileSync(file, 'utf8'));
    // A lesson opts into TypeScript with "lang":"ts"; absent the field it's JS.
    // Every code string in the lesson is in that language.
    const lang = l.lang || 'js';
    if (l.L2 && l.L2.exercises) {
      for (let i = 0; i < l.L2.exercises.length; i++) {
        const ex = l.L2.exercises[i];
        const parts = ex.template.split('___');
        let filled = parts[0];
        for (let b = 0; b < ex.blanks.length; b++) filled += ex.blanks[b].answer + parts[b + 1];
        const r = await runCode(filled, lang);
        if (r.error)                                        { console.log('FAIL', file, 'L2#' + i, 'error:', r.error); fail++; }
        else if (!outputsMatch(r.output, ex.expectedOutput)) { console.log('FAIL', file, 'L2#' + i, 'got:', JSON.stringify(r.output), 'want:', JSON.stringify(ex.expectedOutput)); fail++; }
        else pass++;
      }
    }
    if (l.L3 && l.L3.canonical) {
      const r = await runCode(l.L3.canonical, lang);
      if (r.error)                                              { console.log('FAIL', file, 'L3 error:', r.error); fail++; }
      else if (!outputsMatch(r.output, l.L3.expectedOutput))     { console.log('FAIL', file, 'L3 got:', JSON.stringify(r.output), 'want:', JSON.stringify(l.L3.expectedOutput)); fail++; }
      else pass++;
    }
  }
  console.log(pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})();
