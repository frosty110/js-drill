#!/usr/bin/env node
// Refactor index.html in-place:
//   1. Replace the CURRICULUM + CONTENT inline data blocks with a lazy-loader
//      module that fetches from data/manifest.json + data/<slug>/<id>.json.
//   2. Patch loadProgress() so its garbage-collect step doesn't wipe progress
//      before the manifest loads.
//   3. Make init() async; ensure the manifest is loaded before first render.
//   4. Add a self-healing branch to renderLesson() so it fetches on cache miss.
//   5. Make generateCheatsheet() async and preload all lessons.
//   6. Patch the review-btn click handler to await the lesson load.

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');

// ── 1. Replace data blocks ────────────────────────────────────────────────
// Find the start of the CURRICULUM block (header comment above it).
const dataHeaderRe = /  \/\/ ─{74}\n  \/\/  CURRICULUM DATA\n[\s\S]*?const CURRICULUM = \[/;
const dataHeaderMatch = src.match(dataHeaderRe);
if (!dataHeaderMatch) throw new Error('CURRICULUM header not found');
const dataStart = dataHeaderMatch.index;

// Find the end of CONTENT block — look for the `};` that closes the CONTENT
// object literal, then anchor at the next `// ──` divider.
const contentEndAnchor = '\n  // ──────────────────────────────────────────────────────────────────────────\n  //  STATE + LOCALSTORAGE';
const contentEndIdx = src.indexOf(contentEndAnchor, dataStart);
if (contentEndIdx === -1) throw new Error('CONTENT end anchor not found');

const newLoader = `  // ──────────────────────────────────────────────────────────────────────────
  //  CONTENT LOADER (replaces the inline CURRICULUM + CONTENT data blocks)
  //  CURRICULUM is loaded once from data/manifest.json on boot.
  //  Per-lesson bodies live in data/<section-slug>/<lesson-id>.json and are
  //  fetched lazily on first click, then cached in CONTENT keyed by id.
  //  Source of truth for content lives in those JSON files; index.html ships
  //  only the app shell + runtime.
  // ──────────────────────────────────────────────────────────────────────────
  let CURRICULUM = [];                  // populated from manifest on boot
  const SECTION_SLUGS = {};             // section display name → URL slug
  const CONTENT = {};                   // id → lesson body (lazy cache)
  const _lessonInflight = {};           // id → Promise (dedupe concurrent loads)

  async function loadManifest() {
    const res = await fetch('data/manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Manifest fetch failed: ' + res.status);
    const manifest = await res.json();
    const flat = [];
    for (const section of manifest.sections) {
      SECTION_SLUGS[section.name] = section.slug;
      for (const l of section.lessons) {
        flat.push({
          id: l.id, title: l.title, track: l.track,
          section: section.name, status: l.status
        });
      }
    }
    CURRICULUM = flat;
  }

  async function loadLessonContent(lessonId) {
    if (CONTENT[lessonId]) return CONTENT[lessonId];
    if (_lessonInflight[lessonId]) return _lessonInflight[lessonId];
    const lesson = findLesson(lessonId);
    if (!lesson) return null;
    const slug = SECTION_SLUGS[lesson.section];
    if (!slug) return null;
    _lessonInflight[lessonId] = (async () => {
      try {
        const res = await fetch('data/' + slug + '/' + lessonId + '.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error('Lesson fetch failed: ' + res.status);
        const body = await res.json();
        CONTENT[lessonId] = body;
        return body;
      } finally {
        delete _lessonInflight[lessonId];
      }
    })();
    return _lessonInflight[lessonId];
  }

  // Preload every full lesson — used by cheatsheet export, which iterates all.
  async function ensureAllContentLoaded() {
    const ids = CURRICULUM.filter(l => l.status === 'full').map(l => l.id);
    await Promise.all(ids.map(loadLessonContent));
  }
`;

src = src.slice(0, dataStart) + newLoader + src.slice(contentEndIdx + 1);

// ── 2. loadProgress GC step — guard against empty CURRICULUM ──────────────
src = src.replace(
  /        \/\/ Garbage-collect stale lesson ids\n        let mutated = false;\n        for \(const id of Object\.keys\(state\.progress\)\) \{\n          if \(!findLesson\(id\)\) \{ delete state\.progress\[id\]; mutated = true; \}\n        \}\n        if \(mutated\) saveProgress\(\);/,
  `        // Garbage-collect stale lesson ids — skip until manifest is loaded
        // (CURRICULUM may be empty during the first boot-time loadProgress call).
        if (CURRICULUM.length) {
          let mutated = false;
          for (const id of Object.keys(state.progress)) {
            if (!findLesson(id)) { delete state.progress[id]; mutated = true; }
          }
          if (mutated) saveProgress();
        }`
);

// ── 3. init() — make async, load manifest, then run GC pass ───────────────
src = src.replace(
  /  function init\(\) \{\n    loadProgress\(\);\n    \/\/ Resume the last lesson \+ tab if they still resolve to a valid full lesson/,
  `  async function init() {
    loadProgress();
    try { await loadManifest(); } catch (e) {
      document.getElementById('lesson-shell').innerHTML = '<div class="p-6 text-red-300">Failed to load lesson data: ' + (e && e.message ? e.message : e) + '</div>';
      return;
    }
    // Re-run GC now that CURRICULUM is populated.
    {
      let mutated = false;
      for (const id of Object.keys(state.progress)) {
        if (!findLesson(id)) { delete state.progress[id]; mutated = true; }
      }
      if (mutated) saveProgress();
    }
    // Resume the last lesson + tab if they still resolve to a valid full lesson`
);

// init() is called bare — let it run async; surface errors.
src = src.replace(/^  init\(\);$/m, '  init().catch(err => console.error(err));');

// ── 4. renderLesson — self-healing cache-miss branch ──────────────────────
src = src.replace(
  /    const content = CONTENT\[lesson\.id\];\n    if \(!content\) \{ renderEmpty\(shell\); return; \}/,
  `    const content = CONTENT[lesson.id];
    if (!content) {
      // Cache miss — kick off fetch and re-render when it lands. Race-safe:
      // if the user navigates away before this resolves, we drop the result.
      shell.innerHTML = '<div class="text-slate-500 text-sm p-8 text-center">Loading…</div>';
      loadLessonContent(lesson.id).then(() => {
        if (state.currentLessonId === lesson.id) renderLesson();
      }).catch(err => {
        shell.innerHTML = '<div class="p-6 text-red-300 text-sm">Could not load lesson: ' + (err && err.message ? err.message : err) + '</div>';
      });
      return;
    }`
);

// ── 5. generateCheatsheet — make async, await preload ─────────────────────
src = src.replace(
  /  function generateCheatsheet\(\) \{\n    const fullLessons = CURRICULUM\.filter/,
  `  async function generateCheatsheet() {
    await ensureAllContentLoaded();
    const fullLessons = CURRICULUM.filter`
);

// The export-btn click handler awaits the new async generator.
src = src.replace(
  /    document\.getElementById\('export-btn'\)\.addEventListener\('click', \(\) => \{\n      const md = generateCheatsheet\(\);/,
  `    document.getElementById('export-btn').addEventListener('click', async () => {
      const md = await generateCheatsheet();`
);

// ── 6. review-btn handler — await lesson load before rendering ────────────
src = src.replace(
  /    document\.getElementById\('review-btn'\)\.addEventListener\('click', \(\) => \{\n      const due = dueReviewIds\(\);\n      if \(!due\.length\) return;\n      state\.currentLessonId = due\[0\];\n      state\.currentTab = 'L3';\n      saveProgress\(\);\n      renderSidebar\(\);\n      renderLesson\(\);\n    \}\);/,
  `    document.getElementById('review-btn').addEventListener('click', async () => {
      const due = dueReviewIds();
      if (!due.length) return;
      state.currentLessonId = due[0];
      state.currentTab = 'L3';
      saveProgress();
      renderSidebar();
      await loadLessonContent(due[0]);
      if (state.currentLessonId === due[0]) renderLesson();
    });`
);

fs.writeFileSync(FILE, src);
const lines = src.split('\n').length;
console.log('Refactor complete. New index.html line count: ' + lines);
