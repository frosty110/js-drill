#!/usr/bin/env node
// iter 148 — verifies 🚧 Constraint-Shift Drill (Cat 9 §9C + Cat 4 sidecar
// hybrid; iter-146 roadmap entry #2 SHIPPED; **first §9C ship ever**;
// 5th sidecar registry breaking iter-136's "4-of-4 exhausted" framing).
//
// Load-bearing dual-grade (the probe asserts both halves):
//   - Output match: user submission's runCode output === card.expectedOutput.
//   - Structural-fingerprint regex DOES NOT match the user's submission
//     (the regex catches the canonical's antipattern; if user wrote in
//     the same antipattern, they didn't actually shift).
//
// Phases:
//   1. Sidebar #constraint-shift-btn mounted with §9C tooltip.
//   2. Sidecar data/constraint-shifts.json fetchable + has ≥2 entries +
//      every entry has the 5 required fields (lessonId, originalClaim,
//      shiftedClaim, structuralCheck, hint).
//   3. Canonical-regex-FAIL invariant: for each entry, the regex MUST
//      match the lesson's canonical (otherwise the drill is broken — the
//      canonical wouldn't be rejected as the original-constraint approach).
//   4. Tap → deck builds, first card renders with claims block + canonical
//      + CodeMirror editor + Run button.
//   5. Submit the CANONICAL → grade rejects with "still used original-
//      constraint technique" message (regex catches it).
//   6. Submit a VALID SHIFTED solution → grade passes (output matches +
//      regex doesn't catch).
//   7. state.constraintShift.attempts/.correct counters update correctly.

const fs = require('fs');
const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-constraint-shift';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);

  // Phase 1: sidebar button mounted with §9C-naming tooltip.
  const phase1 = await s.evalAwait(`(() => {
    const btn = document.getElementById('constraint-shift-btn');
    return {
      present: !!btn,
      label: btn ? btn.textContent.trim() : '',
      tooltipNamesShift: btn ? /constraint|shift|rewrite|pivot/i.test(btn.title) : false,
      attemptsZero: state.constraintShift?.attempts === 0,
    };
  })()`);
  s.assert(phase1.present, '#constraint-shift-btn mounted in sidebar');
  s.assert(/Shift/.test(phase1.label), `Label contains Shift; got "${phase1.label}"`);
  s.assert(phase1.tooltipNamesShift, 'Tooltip names the constraint-shift mechanic (senior-interview pivot)');
  s.assert(phase1.attemptsZero, 'Clean state: state.constraintShift.attempts === 0');
  await s.snap('01-init');

  // Phase 2: sidecar JSON well-formed (Node-side; doesn't need browser).
  const sidecarPath = path.join(__dirname, '..', '..', 'data', 'constraint-shifts.json');
  const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
  s.assert(Array.isArray(sidecar.shifts), 'sidecar.shifts is an array');
  s.assert(sidecar.shifts.length >= 2, `sidecar has ≥2 entries (v1 ships 2); got ${sidecar.shifts.length}`);
  for (const e of sidecar.shifts) {
    s.assert(typeof e.lessonId === 'string' && e.lessonId.length > 0, `entry has lessonId; got "${e.lessonId}"`);
    s.assert(typeof e.originalClaim === 'string', `entry "${e.lessonId}" has originalClaim`);
    s.assert(typeof e.shiftedClaim === 'string', `entry "${e.lessonId}" has shiftedClaim`);
    s.assert(typeof e.structuralCheck === 'string', `entry "${e.lessonId}" has structuralCheck regex`);
    s.assert(typeof e.hint === 'string', `entry "${e.lessonId}" has hint`);
  }

  // Phase 3: load-bearing canonical-regex-FAIL invariant. For every entry,
  // its regex MUST match the lesson's canonical. If this fails, the drill
  // is broken (canonical wouldn't be rejected as the original-constraint
  // approach when submitted).
  for (const e of sidecar.shifts) {
    const canonObj = await s.evalAwait(`(async () => {
      if (!CONTENT['${e.lessonId}']) {
        try { await loadLessonContent('${e.lessonId}'); } catch (_) { return null; }
      }
      const c = CONTENT['${e.lessonId}'];
      return c && c.L3 ? c.L3.canonical : null;
    })()`);
    s.assert(canonObj && canonObj.length > 0, `canonical for "${e.lessonId}" is loadable`);
    const re = new RegExp(e.structuralCheck);
    s.assert(re.test(canonObj), `LOAD-BEARING: regex /${e.structuralCheck}/ matches canonical of "${e.lessonId}" (drill would correctly reject canonical-as-is)`);
  }

  // Phase 4: tap → first card renders.
  await s.evalAwait(`document.getElementById('constraint-shift-btn').click()`);
  let cardReady = false;
  for (let i = 0; i < 60; i++) {
    await s.sleep(500);
    const ready = await s.evalAwait(`!!document.querySelector('.shift-shell [data-shift-editor]')`);
    if (ready) { cardReady = true; break; }
  }
  s.assert(cardReady, 'Deck built within 30s + first card rendered');
  await s.snap('02-card-1');

  const phase4 = await s.evalAwait(`(() => {
    const shell = document.querySelector('.shift-shell');
    const origLabel = document.querySelector('.shift-claim-orig');
    const shiftLabel = document.querySelector('.shift-claim-shift');
    const canon = document.querySelector('[data-shift-canonical]');
    const hint = document.querySelector('.shift-hint');
    const editor = document.querySelector('[data-shift-editor]');
    const runBtn = document.querySelector('[data-action="shift-run"]');
    const skipBtn = document.querySelector('[data-action="shift-skip"]');
    return {
      shellPresent: !!shell,
      origLabelPresent: !!origLabel && /original/i.test(origLabel.textContent),
      shiftLabelPresent: !!shiftLabel && /shift/i.test(shiftLabel.textContent),
      canonHasText: !!canon && canon.textContent.length > 10,
      hintPresent: !!hint && hint.textContent.length > 5,
      editorPresent: !!editor,
      runPresent: !!runBtn,
      skipPresent: !!skipBtn,
    };
  })()`);
  s.assert(phase4.shellPresent, '.shift-shell rendered');
  s.assert(phase4.origLabelPresent, '.shift-claim-orig label present with "Original" text');
  s.assert(phase4.shiftLabelPresent, '.shift-claim-shift label present with "Shift" text');
  s.assert(phase4.canonHasText, '[data-shift-canonical] has the canonical code');
  s.assert(phase4.hintPresent, '.shift-hint rendered with strategy hint');
  s.assert(phase4.editorPresent, 'CodeMirror editor mounted');
  s.assert(phase4.runPresent, '[data-action="shift-run"] button present');
  s.assert(phase4.skipPresent, '[data-action="shift-skip"] button present');

  // Phase 5: load the first card's canonical INTO the editor + tap Run.
  // Expected: grade rejects because regex catches the canonical's
  // antipattern (output matches but structural check fails).
  await s.evalAwait(`(() => {
    const code = document.querySelector('[data-shift-canonical]').textContent;
    const cm = document.querySelector('.shift-shell .CodeMirror').CodeMirror;
    cm.setValue(code);
  })()`);
  await s.sleep(150);
  await s.evalAwait(`document.querySelector('[data-action="shift-run"]').click()`);
  await s.sleep(800);
  const phase5 = await s.evalAwait(`(() => {
    const fb = document.querySelector('[data-shift-feedback]');
    return {
      text: fb ? fb.textContent.trim() : '',
      isWarn: fb ? fb.classList.contains('shift-feedback-warn') : false,
      attempts: state.constraintShift.attempts,
    };
  })()`);
  s.assert(phase5.isWarn, `Canonical submission gets shift-feedback-warn class (output matched but regex caught antipattern); got class via "${phase5.text}"`);
  s.assert(/still used|original-constraint|technique/i.test(phase5.text), `Feedback text names the antipattern catch; got "${phase5.text}"`);
  s.assert(phase5.attempts === 1, `state.constraintShift.attempts incremented to 1; got ${phase5.attempts}`);
  await s.snap('03-canonical-rejected');

  // Phase 6: load a known-good SHIFTED solution into the editor + Re-run.
  // Pick the entry matching the currently-rendered card by reading the
  // canonical text and matching it back to a sidecar entry. Then inject
  // the corresponding shifted solution from a probe-known lookup.
  const cardLessonId = await s.evalAwait(`(() => {
    const canon = document.querySelector('[data-shift-canonical]').textContent;
    for (const lid of Object.keys(CONTENT)) {
      if (CONTENT[lid]?.L3?.canonical === canon) return lid;
    }
    return null;
  })()`);
  s.assert(!!cardLessonId, `Identified current card's lessonId; got "${cardLessonId}"`);

  // Probe-known shifted solutions per the iter-148 sidecar entries.
  // These were hand-validated in the iter-148 ship body — see
  // data/constraint-shifts.json _meta for the contract.
  const shiftedSolutions = {
    'two-sum': `function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [i, j];
    }
  }
  return [];
}
console.log(JSON.stringify(twoSum([2, 7, 11, 15], 9)));`,
    'valid-palindrome': `function isPalindrome(s) {
  function isAN(c) { return /[a-z0-9]/i.test(c); }
  let l = 0, r = s.length - 1;
  while (l < r) {
    while (l < r && !isAN(s[l])) l++;
    while (l < r && !isAN(s[r])) r--;
    if (s[l].toLowerCase() !== s[r].toLowerCase()) return false;
    l++; r--;
  }
  return true;
}
console.log(isPalindrome('A man, a plan, a canal: Panama'));`,
    'p-valid-anagram': `function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const a = s.split('').sort().join('');
  const b = t.split('').sort().join('');
  return a === b;
}
console.log(isAnagram('anagram', 'nagaram'));
console.log(isAnagram('rat', 'car'));`,
    'p-anagrams': `function groupAnagrams(strs) {
  const groups = {};
  for (const s of strs) {
    const key = s.split('').sort().join('');
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return Object.values(groups);
}
console.log(JSON.stringify(groupAnagrams(["eat","tea","tan","ate","nat","bat"])));`
  };
  const goodShifted = shiftedSolutions[cardLessonId];
  if (!goodShifted) {
    s.assert(false, `No known-good shifted solution for "${cardLessonId}" in probe — add one to shiftedSolutions{} above`);
  } else {
    await s.evalAwait(`(() => {
      const cm = document.querySelector('.shift-shell .CodeMirror').CodeMirror;
      cm.setValue(${JSON.stringify(goodShifted)});
    })()`);
    await s.sleep(150);
    await s.evalAwait(`document.querySelector('[data-action="shift-run"]').click()`);
    await s.sleep(800);
    const phase6 = await s.evalAwait(`(() => {
      const fb = document.querySelector('[data-shift-feedback]');
      return {
        text: fb ? fb.textContent.trim() : '',
        isPass: fb ? fb.classList.contains('shift-feedback-pass') : false,
        attempts: state.constraintShift.attempts,
        correct: state.constraintShift.correct,
        nextButton: !!document.querySelector('[data-action="shift-next"]'),
      };
    })()`);
    s.assert(phase6.isPass, `LOAD-BEARING: valid shifted solution gets shift-feedback-pass (output matches AND regex doesn't catch); got class via "${phase6.text}"`);
    s.assert(/Output matches|constraint shift complete|✓/i.test(phase6.text), `Pass feedback text reads correctly; got "${phase6.text}"`);
    s.assert(phase6.attempts === 2, `state.constraintShift.attempts now 2 (1 wrong + 1 right); got ${phase6.attempts}`);
    s.assert(phase6.correct === 1, `state.constraintShift.correct now 1; got ${phase6.correct}`);
    s.assert(phase6.nextButton, '"Next card →" button appears after pass');
  }
  await s.snap('04-shifted-passes');

  await s.close();
  const r = s.report();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
