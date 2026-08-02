// Probe: shareable, crawlable URLs end to end.
//
// Covers the 2026-08 share work at both ends of the round trip:
//   · answering an L1 question records the AUTHORED option index (not the
//     shuffled display position) — the property every share code rests on
//   · the share sheet opens from the lesson header and shows a live URL built
//     at click time from state (no cache, no stored share record)
//   · the code encodes which distractor was picked, not merely right/wrong
//   · the static page at p/<id>/ is COMPLETE WITHOUT JAVASCRIPT — the reason
//     an agent or a crawler can read it at all
//   · opening that page WITH ?s= decodes the result set and marks the picked
//     option inline
//   · a lesson page's machine-readable #drill-data index lines up with the
//     code positions
//   · the system-design unit page carries its questions + model answers, and
//     an sd share URL round-trips through the registry
//   · deep anchors (#q3) resolve on the static pages
//
// Usage: node tools/cdp/share-urls.js [url] [outDir]

const { ensureServer, ensureChrome, connect } = require('./lib');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const S = require(path.join(ROOT, 'js', 'sharecode.js'));

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/share-urls-probe';
const base = URL.replace(/\/$/, '') + '/';

(async () => {
  await ensureServer({ port: 8765, dir: ROOT });
  await ensureChrome();

  // ── 1. The app: capture + share sheet ───────────────────────────────────
  const app = await connect({ url: `${base}#/two-sum/L1`, mobile: true, outDir: OUT });
  await app.waitFor(`typeof state !== 'undefined' && state.currentLessonId === 'two-sum' && !!CONTENT['two-sum']`, { timeoutMs: 10000 });
  await app.eval(`selectTab('L1')`);
  await app.waitFor(`!!document.querySelector('.mc-option')`, { timeoutMs: 6000 });

  app.assert(await app.eval(`typeof DrillShare === 'object' && typeof DrillRoutes === 'object'`),
    'the codec and the route registry are loaded in the app');

  // Answer question 1 by clicking a KNOWN-WRONG option, then check the record
  // stores the authored index. The display order is shuffled per session, so
  // this only passes if the capture translates through perQ.optOrder.
  const picked = await app.eval(`(() => {
    const ls = _cacheGet('two-sum', 'L1');
    const qi = ls.qOrder[0];                        // first card's authored question index
    const q = CONTENT['two-sum'].L1.questions[qi];
    const wrongAuthored = q.answer === 0 ? 1 : 0;   // an authored option we know is wrong
    const displayPos = ls.perQ[qi].optOrder.indexOf(wrongAuthored);
    const card = document.querySelectorAll('[data-qi]')[0];
    card.children[displayPos].click();
    return { qi, wrongAuthored, displayPos };
  })()`);
  app.assert(picked.displayPos >= 0, 'found the wrong option in the shuffled display order');

  const recorded = await app.eval(`state.answers['two-sum'].L1.picks[${picked.qi}]`);
  app.assert(recorded === picked.wrongAuthored,
    `capture stores the AUTHORED option index (want ${picked.wrongAuthored}, got ${recorded}; display pos was ${picked.displayPos})`);

  // The code must reflect the pick at the right POSITION, in lowercase.
  const code = await app.eval(`lessonShareCode('two-sum')`);
  const expectedChar = S.MC_LOWER[picked.wrongAuthored];
  app.assert(code[picked.qi] === expectedChar,
    `code position ${picked.qi} is '${expectedChar}' (the picked distractor), got '${code[picked.qi]}' in "${code}"`);
  app.assert(code.split('.').length === 3, `lesson code has 3 segments: "${code}"`);
  app.assert(S.isValidCode(code), `generated code passes validation: "${code}"`);

  // Persistence: the pick survives a reload (it is what a later share reads).
  await app.reload();
  await app.waitFor(`typeof state !== 'undefined' && state.answers && state.answers['two-sum']`, { timeoutMs: 10000 });
  app.assert(await app.eval(`state.answers['two-sum'].L1.picks[${picked.qi}] === ${picked.wrongAuthored}`),
    'the recorded pick survives a reload');

  // The share sheet builds its URL at click time.
  await app.eval(`selectLesson('two-sum')`);
  await app.waitFor(`!!document.querySelector('[data-action="share-lesson"]')`, { timeoutMs: 6000 });
  await app.click('[data-action="share-lesson"]');
  await app.waitFor(`!!document.querySelector('#share-sheet [data-share-url]')`, { timeoutMs: 4000 });
  await app.snap('share-sheet-mobile');

  const sheetUrl = await app.eval(`document.querySelector('#share-sheet [data-share-url]').value`);
  app.assert(/\/p\/two-sum\?s=/.test(sheetUrl), `share URL points at the static page with a code: ${sheetUrl}`);
  app.assert(sheetUrl.includes(code), 'the sheet URL carries the code built from live state');
  app.assert(!/#/.test(sheetUrl.split('?')[0]), 'the share URL is a path, not an app hash route');

  app.assert(await app.eval(`!!document.querySelector('#share-sheet [data-share-ai]')`),
    'the sheet offers Copy for AI alongside Copy link');
  const payload = await app.eval(`buildLessonAiPayload('two-sum')`);
  app.assert(payload.includes(sheetUrl.split('?')[0]), 'the AI payload contains the share URL');
  app.assert(/one character per question/i.test(payload), 'the AI payload explains the code');

  await app.close();
  const r1 = app.report();

  // ── 2. The static page WITHOUT JavaScript ───────────────────────────────
  // This is the property that makes the whole scheme work for agents. If the
  // content only appears with JS, a crawler or an AI fetch gets an empty shell.
  const noJs = await connect({ url: `${base}p/two-sum/`, outDir: OUT });
  await noJs.eval(`0`); // ensure the session is live
  await noJs.close();

  const raw = await fetchText(`${base}p/two-sum/`);
  const assertRaw = [];
  const rawAssert = (cond, label) => { assertRaw.push({ cond: !!cond, label }); };
  rawAssert(/Two Sum/.test(raw), 'raw HTML contains the lesson title');
  rawAssert(/twoSum/.test(raw), 'raw HTML contains the canonical solution');
  rawAssert(/id="q1"/.test(raw), 'raw HTML numbers the questions with anchors');
  rawAssert(/is-correct/.test(raw), 'raw HTML marks the correct option');
  rawAssert(/Reading the/.test(raw) && /one character per question/i.test(raw),
    'raw HTML prints the score-code legend an agent decodes with');
  rawAssert(/id="drill-data"/.test(raw), 'raw HTML embeds the machine-readable question index');
  rawAssert(/rel="canonical"/.test(raw), 'raw HTML declares a canonical URL');

  const sitemap = await fetchText(`${base}sitemap.xml`);
  rawAssert(/p\/two-sum/.test(sitemap) && /sd\/ddia\/ch01/.test(sitemap), 'sitemap lists lesson and sd pages');
  const robots = await fetchText(`${base}robots.txt`);
  rawAssert(/Sitemap:/.test(robots), 'robots.txt points at the sitemap');

  const sdRaw = await fetchText(`${base}sd/design-problems/p01/`);
  rawAssert(/URL Shortener/i.test(sdRaw), 'sd raw HTML contains the unit title');
  rawAssert(/Model answer|Points a strong answer/i.test(sdRaw), 'sd raw HTML contains the model answers');
  rawAssert(/one character per question/i.test(sdRaw), 'sd raw HTML prints the legend');

  let rawPass = 0, rawFail = 0;
  for (const a of assertRaw) {
    if (a.cond) { rawPass++; } else { rawFail++; console.error(`  ✗ ${a.label}`); }
  }
  console.log(`raw-fetch assertions: ${rawPass} passed, ${rawFail} failed`);

  // ── 3. The static page WITH ?s= ─────────────────────────────────────────
  // The human half: the page decodes the code and marks up what was picked.
  //
  // Build the code from the real lesson so it is INTERNALLY CONSISTENT with
  // the page (uppercase only where the picked index really is the answer).
  // A hand-written code would trip the page's own staleness detector, which is
  // exercised separately below.
  const lessonJson = require(path.join(ROOT, 'data', 'arrays-and-hashing', 'two-sum.json'));
  const l1 = lessonJson.L1.questions;
  const wrongFirst = l1[0].answer === 0 ? 1 : 0;
  const testCode = [
    // Q1 missed (a real distractor), every later question correct.
    S.MC_LOWER[wrongFirst] + l1.slice(1).map(q => S.MC_UPPER[q.answer]).join(''),
    'YY',
    'n'
  ].join('.');
  const page = await connect({ url: `${base}p/two-sum/?s=${testCode}`, mobile: true, outDir: OUT });
  await page.waitFor(`!document.getElementById('your-results').hidden`, { timeoutMs: 6000 });
  await page.snap('share-page-decoded');

  page.assert(await page.eval(`!!document.querySelector('#q1.is-wrong')`),
    'the missed question is marked on the page');
  page.assert(await page.eval(`!!document.querySelector('#q1 .is-picked')`),
    'the option the user picked is marked inline');
  const wantLetter = S.MC_UPPER[wrongFirst];
  page.assert(await page.eval(`document.querySelector('#q1 .is-picked .sharepage__key').textContent.trim() === ${JSON.stringify(wantLetter)}`),
    `the marked option is the one the code names (${wantLetter})`);
  page.assert(await page.eval(`!document.querySelector('.sharepage__stale')`),
    'a code consistent with the page raises no staleness warning');
  page.assert(await page.eval(`/8\\/11|correct/.test(document.querySelector('#your-results').textContent)`),
    'the results panel summarises the score');

  // The embedded index must line up with the code positions — that alignment
  // IS the contract an agent relies on.
  const dataOk = await page.eval(`(() => {
    const d = JSON.parse(document.getElementById('drill-data').textContent);
    const dec = DrillShare.decodeLesson(${JSON.stringify(testCode)});
    return d.L1.length === dec.L1.length
      && d.L1[0].n === 1
      && d.L1[0].answerLetter === String.fromCharCode(65 + d.L1[0].answer);
  })()`);
  page.assert(dataOk, '#drill-data question count and lettering align with the decoded code');

  // Anchors resolve.
  await page.eval(`location.hash = '#q3'`);
  page.assert(await page.eval(`!!document.getElementById('q3')`), 'the #q3 deep anchor exists on the page');

  await page.close();

  // A code that contradicts the page (content edited since it was made) must
  // be called out, not reported as a verdict — otherwise an AI would be told
  // something false with full confidence.
  const answer0 = S.MC_UPPER[l1[0].answer];
  const liar = S.MC_LOWER[l1[0].answer] + '-'.repeat(l1.length - 1) + '..';   // claims a MISS on the right answer
  const drift = await connect({ url: `${base}p/two-sum/?s=${liar}`, outDir: OUT });
  await drift.waitFor(`!document.getElementById('your-results').hidden`, { timeoutMs: 6000 });
  drift.assert(await drift.eval(`!!document.querySelector('.sharepage__stale')`),
    `a code contradicting the page (claims a miss on ${answer0}, the correct option) is flagged as out of date`);
  drift.assert(await drift.eval(`/code out of date/.test(document.querySelector('#your-results').textContent)`),
    'the contradicting row is labelled rather than given a verdict');
  // A stale row must not ALSO carry a confident verdict — neither inline nor in
  // the headline. Both were bugs: the inline note read "you picked this —
  // correct" beside a row the table called out of date, and the stale entry
  // still counted toward the headline score (Codex review, PR #16).
  drift.assert(!(await drift.eval(`/you picked this — correct/.test(document.body.textContent)`)),
    'a stale row never claims the pick was correct');
  drift.assert(await drift.eval(`!/\\b1\\/1 correct\\b/.test(document.querySelector('.sharepage__score').textContent)`),
    'a stale answer is excluded from the headline score rather than counted');
  drift.assert(await drift.eval(`/not scored|cannot be scored|No answer in this code/.test(document.querySelector('#your-results').textContent)`),
    'the summary says the stale answer was left unscored');
  await drift.close();
  const rDrift = drift.report();

  // ── 4. The system-design app ────────────────────────────────────────────
  // Same round trip on the other page: an outcome recorded on a Leitner box
  // becomes a share code, and the unit's share URL points at its static page.
  const sd = await connect({ url: `${base}system-design.html#/ddia/ch01`, outDir: OUT });
  await sd.waitFor(`typeof CH !== 'undefined' && CH.ddia && CH.ddia.ch01`, { timeoutMs: 10000 });
  sd.assert(await sd.eval(`typeof DrillShare === 'object' && typeof unitShareCode === 'function'`),
    'the codec and the unit share helpers are loaded in system-design.html');

  // Seed one MC answer and one self-graded outcome through the real grade path.
  await sd.eval(`grade('ddia/ch01/0', 'again', 2); grade('ddia/ch01/1', 'partial');`);
  const sdCode = await sd.eval(`unitShareCode('ddia', CH.ddia.ch01)`);
  sd.assert(sdCode[0] === S.MC_LOWER[2] || sdCode[0] === S.MC_UPPER[2],
    `an MC miss records the picked option at position 0 (got '${sdCode[0]}' in "${sdCode}")`);
  sd.assert(sdCode[1] === S.PARTIAL, `a self-graded partial encodes as 'p' (got '${sdCode[1]}')`);
  sd.assert(S.isValidCode(sdCode), `sd code passes validation: "${sdCode}"`);

  const sdUrl = await sd.eval(`unitShareUrl('ddia', CH.ddia.ch01)`);
  sd.assert(/\/sd\/ddia\/ch01\?s=/.test(sdUrl), `sd share URL points at the static unit page: ${sdUrl}`);

  await sd.eval(`openShareSheet('ddia', CH.ddia.ch01)`);
  await sd.waitFor(`!!document.querySelector('#share-sheet [data-share-url]')`, { timeoutMs: 4000 });
  await sd.snap('sd-share-sheet');
  sd.assert(await sd.eval(`document.querySelector('#share-sheet [data-share-url]').value === ${JSON.stringify(sdUrl)}`),
    'the sd share sheet shows the live URL');

  // The AI payload must reflect the unit's ACTUAL question-type mix. ddia/ch01
  // is multiple-choice heavy, so the payload must lead with the picked
  // distractor and must NOT claim every question was spoken (Codex review,
  // PR #16 — a leftover from an earlier miscount of the MC/open split).
  const sdPayload = await sd.eval(`buildUnitAiPayload('ddia', CH.ddia.ch01)`);
  sd.assert(/which option I picked/.test(sdPayload),
    'an MC-heavy unit payload tells the AI the code carries the picked option');
  sd.assert(!/These are spoken-answer questions/.test(sdPayload),
    'an MC-heavy unit payload does not claim every question was spoken');
  sd.assert(/multiple-choice questions/.test(sdPayload),
    'the payload scores multiple choice separately from the open questions');
  sd.assert(sd.consoleMsgs.filter(m => m.type === 'error').length === 0,
    'the system-design page raises no console errors');
  await sd.close();
  const rSd = sd.report();

  // A junk code must not throw or render anything misleading.
  const junk = await connect({ url: `${base}p/two-sum/?s=%3Cscript%3E`, outDir: OUT });
  junk.assert(await junk.eval(`document.getElementById('your-results').hidden`),
    'a malformed code is rejected rather than rendered');
  junk.assert(junk.consoleMsgs.filter(m => m.type === 'error').length === 0,
    'a malformed code throws nothing');
  await junk.close();
  const r3 = junk.report();

  const r2 = page.report();
  const failed = (r1.failed || r1.errors || 0) + (r2.failed || r2.errors || 0)
    + (r3.failed || r3.errors || 0) + (rDrift.failed || rDrift.errors || 0)
    + (rSd.failed || rSd.errors || 0) + rawFail;
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error('Probe error:', err.message); process.exit(1); });

function fetchText(url) {
  const http = require('http');
  return new Promise((res, rej) => {
    http.get(url, r => {
      let b = '';
      r.on('data', d => b += d);
      r.on('end', () => res(b));
    }).on('error', rej);
  });
}
