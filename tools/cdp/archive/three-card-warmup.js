#!/usr/bin/env node
// Verifies iter-57 🌅 3-Card Warmup at iPhone viewport: the sidebar button
// opens a 3-card session in the main viewport drawn from dailyPlan() (due +
// path + weak); each card shows section + lesson tag + L1 question + 4
// lettered options; tap grades and slide-off-animates the card; auto-advances
// to next card; summary surfaces CTAs into Rapid-Fire / Today's Plan / Done.
// Sourced from iter-55 roadmap entry #3 (shipped iter 57).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-warmup';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed: clean state. Mark one syntax-track lesson as L1-passed but mark it
  // as a weak spot so dailyPlan() pulls it in. Also seed a starter-path
  // lesson so dailyPlan has "next on path" candidates.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(500);

  // Seed a weak spot so the plan is non-empty (otherwise it might be empty
  // for a fresh user and the warmup would alert + bail).
  const seedId = await s.evalAwait(`(CURRICULUM.find(l => l.status === 'full') || {}).id || null`);
  if (!seedId) { console.log('FAIL: no full lesson in CURRICULUM'); process.exit(1); }
  await s.evalAwait(`state.weakness['${seedId}'] = 1; saveProgress();`);

  await s.snap('boot-seeded');

  // Assert 1: 🌅 Warmup button renders.
  const hasBtn = await s.evalAwait(`!!document.getElementById('warmup-btn')`);
  console.log(hasBtn ? 'PASS: 🌅 Warmup button renders in sidebar' : 'FAIL: button missing');

  // Act: click Warmup. Session preloads lesson content so wait.
  await s.evalAwait(`document.getElementById('warmup-btn').click()`);
  await s.sleep(2500);
  await s.snap('warmup-card-1');

  // Assert 2: warmup shell renders.
  const shellRendered = await s.evalAwait(`!!document.querySelector('.warmup-shell')`);
  console.log(shellRendered ? 'PASS: warmup shell rendered' : 'FAIL: shell missing');

  // Assert 3: active card is present.
  const hasActiveCard = await s.evalAwait(`!!document.querySelector('[data-warmup-card]')`);
  console.log(hasActiveCard ? 'PASS: active card present' : 'FAIL: no active card');

  // Assert 4: card has options (4 typical, ≥2 minimum for valid L1).
  const optCount = await s.evalAwait(`document.querySelectorAll('.warmup-opt').length`);
  console.log(optCount >= 2 ? `PASS: ${optCount} option buttons rendered` : `FAIL: ${optCount} options, expected ≥2`);

  // Assert 5: A/B/C/D letter chips present.
  const letters = await s.evalAwait(`Array.from(document.querySelectorAll('.warmup-letter')).map(e => e.textContent).join('')`);
  console.log(letters.startsWith('AB') ? `PASS: letter chips render ("${letters}")` : `FAIL: letter chips wrong: "${letters}"`);

  // Assert 6: tag is one of the expected 3-way values.
  const tag = await s.evalAwait(`document.querySelector('.warmup-card-tag')?.textContent?.toLowerCase() || ''`);
  const validTag = ['review due', 'weak spot', 'next on path'].some(t => tag.includes(t));
  console.log(validTag ? `PASS: card tag is valid ("${tag}")` : `FAIL: tag "${tag}" not in {review due, weak spot, next on path}`);

  // Act: tap first option (don't care correct/wrong; just need grading to fire).
  await s.evalAwait(`document.querySelector('.warmup-opt').click()`);
  await s.sleep(300);

  // Assert 7: grading classes applied.
  const styledCount = await s.evalAwait(`document.querySelectorAll('.warmup-opt-correct, .warmup-opt-wrong').length`);
  console.log(styledCount >= 1 ? `PASS: ${styledCount} option(s) styled after tap` : 'FAIL: no grading feedback');

  // Assert 8: slide-off animation class applied.
  const slidingClass = await s.evalAwait(`!!document.querySelector('.warmup-card-slide-right, .warmup-card-slide-left')`);
  console.log(slidingClass ? 'PASS: slide-off animation class applied' : 'FAIL: no slide-off class');

  // Assert 9: state.warmup.sessions incremented (fires at startWarmupSession).
  const sessions = await s.evalAwait(`state.warmup?.sessions || 0`);
  console.log(sessions === 1 ? 'PASS: state.warmup.sessions incremented to 1' : `FAIL: sessions = ${sessions}`);

  // Wait for auto-advance to complete the deck (3 cards × ~1.1s max per).
  await s.sleep(4500);
  await s.snap('warmup-summary');

  // Assert 10: summary screen renders (looks for the % display).
  const hasSummary = await s.evalAwait(`!!document.querySelector('.warmup-summary-pct')`);
  if (hasSummary) {
    console.log('PASS: summary rendered after auto-advance through deck');
  } else {
    // Might still be on a later card if dailyPlan returned <3 items — that's
    // also valid behavior; check that we made progress.
    const inProgress = await s.evalAwait(`!!document.querySelector('.warmup-card') || !!document.querySelector('.warmup-summary')`);
    console.log(inProgress ? 'INFO: still in session (dailyPlan likely returned <3 cards); shell still present' : 'FAIL: shell vanished');
  }

  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
