// Smoke test for the 🎯 Glossary Quiz (iter-ad-hoc, 2026-05-27):
// Seed a cram path so the 🅰 Glossary button is visible, open the modal,
// verify the "Quiz me" CTA, start a session, answer one card, advance.
// Assertions cover queue length, alternating direction, lifetime stats
// persistence, and back-to-glossary flow.

const { ensureServer, ensureChrome, connect } = require('./lib');

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({
    url: 'http://localhost:8765/',
    mobile: true,
    outDir: '/tmp/glossary-quiz-probe'
  });

  // Seed: subscribe to the prep-4day cram path so 🅰 Glossary unhides.
  // Reuses jsdrill.progress.v1's existing subscribedPathId field.
  await s.seedLocalStorage('jsdrill.progress.v1', {
    __v: 6,
    subscribedPathId: 'prep-4day',
    welcomed: true  // skip the first-run path picker so the glossary modal isn't occluded
  });
  await s.snap('00-home-cram');

  // Open Glossary modal via the topbar Practice menu (the sidebar button is
  // hidden but the topbar surfaces it). The button id stays consistent
  // either way — synthetic click works.
  const opened = await s.eval(`(() => {
    const btn = document.getElementById('cram-glossary-btn');
    if (!btn) return 'no-btn';
    btn.click();
    return 'clicked';
  })()`);
  s.assert(opened === 'clicked', 'cram-glossary-btn click dispatches');
  await s.sleep(300);
  await s.snap('01-glossary-open');

  // The Quiz CTA should render at the top of the body.
  const ctaPresent = await s.eval(`!!document.querySelector('[data-glossquiz-start]')`);
  s.assert(ctaPresent, 'Quiz CTA is rendered in glossary modal');

  // Click it — quiz session starts.
  await s.click('[data-glossquiz-start]');
  await s.sleep(200);
  await s.snap('02-quiz-q1');

  const qInfo = await s.eval(`(() => {
    const st = window.__jsdrillState;
    const sess = st && st.glossaryQuiz && st.glossaryQuiz.session;
    if (!sess) return null;
    return {
      len: sess.queue.length,
      kinds: sess.queue.map(c => c.kind),
      firstHasCorrect: typeof sess.queue[0].correctIdx === 'number' && sess.queue[0].correctIdx >= 0 && sess.queue[0].correctIdx <= 3,
      sessions: st.glossaryQuiz.sessions
    };
  })()`);
  s.assert(qInfo && qInfo.len === 10, `queue length is 10 (got ${qInfo && qInfo.len})`);
  s.assert(qInfo && qInfo.kinds[0] === 'term2def' && qInfo.kinds[1] === 'def2term', 'alternates direction (term→def then def→term)');
  s.assert(qInfo && qInfo.firstHasCorrect, 'first card has a valid correctIdx');
  s.assert(qInfo && qInfo.sessions >= 1, 'sessions counter incremented');

  // Verify all 4 option buttons present + a back button + progress bar.
  const uiCheck = await s.eval(`(() => {
    const opts = document.querySelectorAll('[data-glossquiz-pick]');
    const back = document.querySelector('[data-glossquiz-back]');
    return { optCount: opts.length, hasBack: !!back };
  })()`);
  s.assert(uiCheck.optCount === 4, `4 MC option buttons render (got ${uiCheck.optCount})`);
  s.assert(uiCheck.hasBack, 'back button present');

  // Tap the CORRECT answer on card 1.
  await s.eval(`(() => {
    const sess = window.__jsdrillState.glossaryQuiz.session;
    const correctI = sess.queue[0].correctIdx;
    document.querySelector('[data-glossquiz-pick="' + correctI + '"]').click();
  })()`);
  await s.sleep(150);
  await s.snap('03-quiz-q1-revealed');

  const after1 = await s.eval(`(() => {
    const st = window.__jsdrillState;
    const sess = st.glossaryQuiz.session;
    return {
      picked: sess.picked,
      correctCount: sess.correctCount,
      attempts: st.glossaryQuiz.attempts,
      correct: st.glossaryQuiz.correct,
      hasNext: !!document.querySelector('[data-glossquiz-next]')
    };
  })()`);
  s.assert(after1.picked !== null, 'picked is recorded');
  s.assert(after1.correctCount === 1, 'correctCount incremented on right answer');
  s.assert(after1.attempts === 1 && after1.correct === 1, 'lifetime attempts/correct incremented');
  s.assert(after1.hasNext, 'Next button surfaces after answer');

  // Tap Next.
  await s.click('[data-glossquiz-next]');
  await s.sleep(150);
  await s.snap('04-quiz-q2');

  const card2 = await s.eval(`(() => {
    const sess = window.__jsdrillState.glossaryQuiz.session;
    return { index: sess.index, picked: sess.picked, kind: sess.queue[sess.index].kind };
  })()`);
  s.assert(card2.index === 1, 'index advanced to 1');
  s.assert(card2.picked === null, 'picked cleared on advance');
  s.assert(card2.kind === 'def2term', 'card 2 is def→term direction');

  // Answer card 2 INCORRECTLY (pick something other than correctIdx).
  await s.eval(`(() => {
    const sess = window.__jsdrillState.glossaryQuiz.session;
    const wrong = (sess.queue[1].correctIdx + 1) % 4;
    document.querySelector('[data-glossquiz-pick="' + wrong + '"]').click();
  })()`);
  await s.sleep(150);
  await s.snap('05-quiz-q2-wrong');

  const after2 = await s.eval(`(() => {
    const st = window.__jsdrillState;
    return {
      correctCount: st.glossaryQuiz.session.correctCount,
      attempts: st.glossaryQuiz.attempts,
      correct: st.glossaryQuiz.correct
    };
  })()`);
  s.assert(after2.correctCount === 1, 'correctCount stays 1 on wrong answer');
  s.assert(after2.attempts === 2, 'attempts increments to 2');
  s.assert(after2.correct === 1, 'correct stays 1');

  // Verify persistence: localStorage blob should reflect new state.
  const persisted = await s.eval(`(() => {
    const raw = localStorage.getItem('jsdrill.progress.v1');
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p.glossaryQuiz ? { attempts: p.glossaryQuiz.attempts, sessions: p.glossaryQuiz.sessions, perTermKeys: Object.keys(p.glossaryQuiz.perTerm).length } : null;
  })()`);
  s.assert(persisted && persisted.attempts === 2, 'glossaryQuiz.attempts persisted to localStorage');
  s.assert(persisted && persisted.sessions === 1, 'glossaryQuiz.sessions persisted');
  s.assert(persisted && persisted.perTermKeys === 2, 'perTerm has 2 entries after 2 answered cards');

  // Tap back arrow — should go to glossary browse, session preserved (since
  // we are mid-session, index > 0).
  await s.click('[data-glossquiz-next]');
  await s.sleep(100);
  await s.click('[data-glossquiz-back]');
  await s.sleep(200);
  await s.snap('06-back-to-glossary');

  const resumeUi = await s.eval(`(() => {
    return {
      hasResume: !!document.querySelector('[data-glossquiz-resume]'),
      hasStart: !!document.querySelector('[data-glossquiz-start]'),
      hasRestart: !!document.querySelector('[data-glossquiz-restart]'),
      sessionIndex: window.__jsdrillState.glossaryQuiz.session.index
    };
  })()`);
  s.assert(resumeUi.hasResume, 'Resume CTA shown when session is in progress');
  s.assert(!resumeUi.hasStart, 'Start CTA hidden when session in progress');
  s.assert(resumeUi.hasRestart, 'Restart button (↻) shown alongside Resume');
  s.assert(resumeUi.sessionIndex === 2, 'session.index is preserved across back-to-browse');

  await s.close();
  const r = s.report();
  process.exit(r.failed > 0 || r.errors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
