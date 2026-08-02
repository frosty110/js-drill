// ── 17: Today home — RETIRED as a page; shared "next rep" vocabulary ───────
// This slice used to render a second landing surface (design-loop P2): the
// bottom nav's "Today" destination — greeting + streak chip → hero next-up
// card → 3 ambient stat tiles → a short "THEN" queue.
//
// It is retired (audit F5). Home (js/app/22-home.js) rendered the same
// greeting, the same clock, the same streak chip and a hero for the same
// lesson, and 16-ds-nav.js mapped BOTH pages to the nav key `home` — so the
// Today page highlighted "Home", and tools/cdp/ds-page-frame.js failed on
// exactly that, on both viewports. Two front doors is the costly option; Home
// is the front door. Today-home's one genuinely unique part, the ambient
// due/weak/today stat row, moved into Home. The "THEN" queue did NOT move:
// the Today's Plan MODAL (#today-btn) is the one full-queue surface, so the
// label "Today's plan" now resolves to exactly one thing everywhere (F6).
//
// What survives here:
//   · the shared next-rep vocabulary — _todayNextLevel / _TODAY_LEVEL_META /
//     _todayStreak — which Home (22), Progress (20) and the scoped review
//     session (23) all read;
//   · openTodayHome(), now a thin delegation to openHome(), so the
//     #today-home-btn launcher contract and the #/m/today-home deep-link route
//     keep resolving. They just land on Home.

function _todayNextLevel(lessonId) {
  for (const lvl of ['L1', 'L2', 'L3']) {
    if (levelStatus(lessonId, lvl) !== 'passed') return lvl;
  }
  return 'L3'; // fully mastered — a review rep lands on the recall tier
}

const _TODAY_LEVEL_META = {
  L1: { label: 'L1 · concept', mins: 1 },
  L2: { label: 'L2 · fill-in', mins: 2 },
  L3: { label: 'L3 · from memory', mins: 5 },
};

function _todayStreak() {
  const buckets = _streakMapBuckets(60);
  const passesToday = buckets[buckets.length - 1]?.passes || 0;
  // Grace rule (same as the Dashboard, 14-init-core): a not-yet-drilled-today
  // user KEEPS their streak — start counting from yesterday when today is
  // inactive. Without this, the pre-drill "Good morning" moment (the reason
  // the front door shows a streak at all) would tell a mid-streak user they
  // have no streak.
  let streak = 0;
  for (let i = buckets.length - (passesToday > 0 ? 1 : 2); i >= 0; i--) {
    if (buckets[i].passes > 0) streak++; else break;
  }
  return { streak, todayActive: passesToday > 0, passesToday };
}

// Kept as a named function, not an alias, so the delegation is greppable and
// so it degrades honestly if the slices ever load out of order.
function openTodayHome() {
  if (typeof openHome === 'function') openHome();
}

(() => {
  const btn = document.getElementById('today-home-btn');
  if (btn) btn.addEventListener('click', openTodayHome);
})();
