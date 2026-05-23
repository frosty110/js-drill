#!/usr/bin/env node
// Re-derives data/manifest.json from the JSON files actually on disk under
// data/<slug>/<id>.json. Useful when sub-agents have authored new lessons
// but the manifest hasn't caught up yet. Preserves the existing section
// ORDER and inserts new sections at curated positions (see SECTION_ORDER).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DATA = path.join(ROOT, 'data');
const MANIFEST = path.join(DATA, 'manifest.json');

// Canonical section order. New sections inserted here. Slugs are looked up
// from the JSON files themselves.
const SECTION_ORDER = [
  // Track A — Syntax
  'Basics',
  'Arrays',
  'Hash Structures',
  'Modern Syntax',
  'Iterators & Generators',
  'JS Toolbox',          // NEW
  'Algorithms',
  'Classes',
  'Async',
  'Advanced JS',
  // Track B — Patterns
  'Arrays & Hashing',
  'Two Pointers',
  'Sliding Window',
  'Stack',
  'Binary Search',
  'Linked List',
  'Trees',
  'Tries',
  'Heap',
  'Graphs',
  'Greedy',              // NEW — between graph algos and DP
  'Dynamic Programming',
  'Backtracking',
  'Intervals',           // NEW
  'Matrix',              // NEW
  'Bit Manipulation',
  'System Design',
  // Track C — Applied
  'Applied Problems'     // NEW
];

// Walk every JSON file, group by section name.
const bySection = new Map();      // name → { slug, lessons[] }
for (const dir of fs.readdirSync(DATA)) {
  const full = path.join(DATA, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  for (const f of fs.readdirSync(full)) {
    if (!f.endsWith('.json')) continue;
    const lesson = JSON.parse(fs.readFileSync(path.join(full, f), 'utf8'));
    if (!lesson.section) {
      console.warn(`SKIP: ${dir}/${f} has no .section`);
      continue;
    }
    if (!bySection.has(lesson.section)) {
      bySection.set(lesson.section, { name: lesson.section, slug: dir, lessons: [] });
    }
    const sec = bySection.get(lesson.section);
    // Sanity: lessons in the same section should share the same slug.
    if (sec.slug !== dir) {
      console.warn(`SLUG MISMATCH: section "${lesson.section}" appears under "${sec.slug}" and "${dir}"`);
    }
    sec.lessons.push({
      id: lesson.id,
      title: lesson.title,
      track: lesson.track,
      status: lesson.status,
      _filename: f
    });
  }
}

// Within each section, preserve a stable order. Read the existing manifest
// to learn intra-section ordering; new files appended after existing in
// alphabetical-by-filename order. New sections: alphabetical-by-filename.
let prevManifest = null;
try { prevManifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch {}
const prevOrder = new Map(); // section name → list of ids in order
if (prevManifest && prevManifest.sections) {
  for (const sec of prevManifest.sections) {
    prevOrder.set(sec.name, sec.lessons.map(l => l.id));
  }
}
for (const sec of bySection.values()) {
  const known = prevOrder.get(sec.name) || [];
  const indexOf = (id) => {
    const i = known.indexOf(id);
    return i < 0 ? Infinity : i;
  };
  sec.lessons.sort((a, b) => {
    const ai = indexOf(a.id), bi = indexOf(b.id);
    if (ai !== bi) return ai - bi;
    return a._filename.localeCompare(b._filename);
  });
  // Drop the internal _filename helper
  for (const l of sec.lessons) delete l._filename;
}

// Final section order: SECTION_ORDER first, then anything not listed.
const orderedSections = [];
const seen = new Set();
for (const name of SECTION_ORDER) {
  if (bySection.has(name)) { orderedSections.push(bySection.get(name)); seen.add(name); }
}
for (const [name, sec] of bySection) {
  if (!seen.has(name)) orderedSections.push(sec);
}

const manifest = { generatedAt: new Date().toISOString(), sections: orderedSections };
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

const totalLessons = orderedSections.reduce((acc, s) => acc + s.lessons.length, 0);
console.log(`Manifest written. ${orderedSections.length} sections, ${totalLessons} lessons.`);
for (const s of orderedSections) console.log(`  ${s.name.padEnd(28)} (${s.slug.padEnd(28)}) ${s.lessons.length}`);
