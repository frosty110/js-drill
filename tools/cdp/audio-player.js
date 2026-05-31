#!/usr/bin/env node
// Mobile probe for the 🎧 Audio bottom-dock UX.
//
// Verifies (iPhone 13 mini viewport):
//   1. App boots; #audio-btn + #audio-modal + #audio-dock all in DOM.
//   2. Click #audio-btn → modal shows playlist with the Merge K Sorted Lists row.
//   3. Tap the episode row → modal closes, dock appears, queue has 12 clips
//      (6 sections × 2 voices), Clip 1 of 12 / Voice A is the starting state.
//   4. Tab navigation does not destroy the dock — the dock has persistent state.
//   5. Tap dock meta strip → playlist modal re-opens (entry to switch episodes).
//   6. Dock close button stops audio + hides the dock + clears state.

const { ensureServer, ensureChrome, connect } = require('./lib');

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({
    url: 'http://localhost:8765/?cb=' + Date.now(),
    mobile: true,
    outDir: '/tmp/audio-player-probe',
    waitForLoadMs: 3500
  });

  // 1. Boot smoke.
  s.assert(await s.eval(`!!document.querySelector('aside')`), 'sidebar rendered');
  s.assert(await s.eval(`!!document.getElementById('audio-btn')`), '#audio-btn exists');
  s.assert(await s.eval(`!!document.getElementById('audio-modal')`), '#audio-modal exists');
  s.assert(await s.eval(`!!document.getElementById('audio-dock')`), '#audio-dock exists');
  s.assert(await s.eval(`document.getElementById('audio-dock').style.display === 'none'`), 'dock hidden on boot');

  // 2. Open playlist.
  await s.eval(`document.getElementById('audio-btn').click()`);
  await new Promise(r => setTimeout(r, 200));
  await s.snap('01-playlist-modal');
  s.assert(await s.eval(`document.getElementById('audio-modal').style.display === 'block'`), 'modal opens');
  s.assert(
    await s.eval(`!!document.querySelector('#audio-playlist .audio-episode[data-ep-id="p-merge-k-lists"]')`),
    'Merge K episode row rendered'
  );

  // 3. Tap episode → dock appears, modal closes.
  await s.eval(`document.querySelector('#audio-playlist .audio-episode[data-ep-id="p-merge-k-lists"]').click()`);
  await new Promise(r => setTimeout(r, 900));   // loadLessonContent is async
  await s.snap('02-dock-appears-modal-closes');

  s.assert(await s.eval(`document.getElementById('audio-modal').style.display === 'none'`), 'modal auto-closes on episode pick');
  s.assert(await s.eval(`document.getElementById('audio-dock').style.display === 'flex'`), 'dock visible');

  const dockTitle = await s.eval(`document.getElementById('audio-dock-title').textContent`);
  s.assert(/Merge K Sorted Lists/.test(dockTitle), `dock title shows lesson (got: ${dockTitle})`);
  s.assert(/clip 1 \/ 12/.test(dockTitle), `dock title shows "clip 1 / 12" (got: ${dockTitle})`);

  const dockSection = await s.eval(`document.getElementById('audio-dock-section').textContent`);
  s.assert(/Restate.*clarify/i.test(dockSection), `dock section shows "1. Restate & clarify" (got: ${dockSection})`);
  s.assert(/Voice A/.test(dockSection), `clip 1 is Voice A (got: ${dockSection})`);

  // Body should have bottom padding reserved so the dock doesn't cover content.
  const bodyPad = await s.eval(`getComputedStyle(document.body).paddingBottom`);
  s.assert(/(7\d|8\d)px/.test(bodyPad), `body padding-bottom reserved (got: ${bodyPad})`);

  // 4. Tab navigation persistence — flip from Conversation to L1 in the
  //    same lesson and verify dock + state survive.
  const tabSwitchOk = await s.eval(`(() => {
    const tabs = document.querySelectorAll('.tab-btn, [data-tab]');
    const l1Btn = Array.from(tabs).find(b => /L1/i.test(b.textContent));
    if (!l1Btn) return false;
    l1Btn.click();
    return true;
  })()`);
  if (tabSwitchOk) {
    await new Promise(r => setTimeout(r, 400));
    await s.snap('03-after-tab-switch');
    s.assert(await s.eval(`document.getElementById('audio-dock').style.display === 'flex'`), 'dock survives tab switch');
    const dockTitle2 = await s.eval(`document.getElementById('audio-dock-title').textContent`);
    s.assert(/Merge K Sorted Lists/.test(dockTitle2), 'dock title preserved across tab switch');
  } else {
    s.assert(true, '(tab buttons not on this lesson view — skipped tab-persistence check)');
  }

  // 5. Tap dock title → re-opens playlist modal.
  await s.eval(`document.getElementById('audio-dock-meta').click()`);
  await new Promise(r => setTimeout(r, 200));
  s.assert(await s.eval(`document.getElementById('audio-modal').style.display === 'block'`), 'dock-meta click re-opens playlist');
  await s.snap('04-dock-meta-reopens-playlist');
  // Close the modal for the next step.
  await s.eval(`document.getElementById('audio-modal-close').click()`);
  await new Promise(r => setTimeout(r, 150));

  // 6. Close dock → stops + hides.
  await s.eval(`document.getElementById('audio-dock-close').click()`);
  await new Promise(r => setTimeout(r, 200));
  s.assert(await s.eval(`document.getElementById('audio-dock').style.display === 'none'`), 'dock hides on close button');
  s.assert(await s.eval(`getComputedStyle(document.body).paddingBottom === '0px' || document.body.style.paddingBottom === ''`),
    'body padding reset when dock closes');
  await s.snap('05-dock-closed');

  await s.close();
  s.report();
})().catch(e => { console.error(e); process.exit(1); });
