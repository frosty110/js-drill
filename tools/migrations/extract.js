#!/usr/bin/env node
// One-shot migration: pull CURRICULUM + CONTENT out of index.html and
// write data/<section-slug>/<lesson-id>.json + data/manifest.json.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');   // tools/migrations/ → project root
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Grab the last <script> block (the app code). The earlier ones are CDN tags.
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const appJs = scripts[scripts.length - 1][1];

// Strip the trailing init() call so the factory doesn't try to touch the DOM.
const safeJs = appJs.replace(/^\s*init\(\);\s*$/m, '');

// Stub out browser globals the script touches at declaration time so eval
// doesn't blow up. Anything that runs lazily (in functions) we never call.
const browserStubs = `
  const window = { addEventListener: () => {} };
  const document = {
    getElementById: () => ({ addEventListener: () => {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} }, appendChild: () => {}, querySelector: () => null, querySelectorAll: () => [], style: {} }),
    addEventListener: () => {},
    body: { appendChild: () => {}, removeChild: () => {} },
    documentElement: {}
  };
  const localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const CodeMirror = function() { return { setValue: () => {}, getValue: () => '', focus: () => {} }; };
  CodeMirror.fromTextArea = () => ({ setValue: () => {}, getValue: () => '', focus: () => {}, refresh: () => {}, setOption: () => {} });
  const URL = { createObjectURL: () => '', revokeObjectURL: () => {} };
  const Blob = function() {};
  const FileReader = function() {};
  const alert = () => {};
  const confirm = () => true;
  const setInterval = () => {};
  const setTimeout = () => {};
  const location = { reload: () => {} };
  const navigator = { clipboard: { writeText: () => Promise.resolve() } };
`;

const factory = eval('(function(){' + browserStubs + safeJs + ' return { CURRICULUM, CONTENT }; })');
const { CURRICULUM, CONTENT } = factory();

console.log(`Loaded ${CURRICULUM.length} curriculum entries, ${Object.keys(CONTENT).length} content entries.`);

// section-name → slug helper
function slugify(name) {
  return name.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Build manifest + write per-lesson files
const dataDir = path.join(ROOT, 'data');
// Wipe any prior generated content (preserve patterns-batch-1.json for now? no — superseded)
if (fs.existsSync(dataDir)) {
  for (const f of fs.readdirSync(dataDir)) {
    const p = path.join(dataDir, f);
    if (fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true });
  }
}
fs.mkdirSync(dataDir, { recursive: true });

const manifest = { generatedAt: new Date().toISOString(), sections: [] };
const sectionMap = new Map(); // section name → { slug, lessons[] }

let written = 0;
let stubs = 0;
for (const entry of CURRICULUM) {
  const slug = slugify(entry.section);
  const sectionDir = path.join(dataDir, slug);
  fs.mkdirSync(sectionDir, { recursive: true });

  const body = CONTENT[entry.id] || null;
  const lessonJson = {
    id: entry.id,
    title: entry.title,
    section: entry.section,
    track: entry.track,
    status: entry.status,
    ...(body || {})
  };

  fs.writeFileSync(
    path.join(sectionDir, `${entry.id}.json`),
    JSON.stringify(lessonJson, null, 2) + '\n'
  );
  written++;
  if (entry.status === 'stub') stubs++;

  if (!sectionMap.has(entry.section)) {
    sectionMap.set(entry.section, { name: entry.section, slug, lessons: [] });
  }
  sectionMap.get(entry.section).lessons.push({
    id: entry.id, title: entry.title, track: entry.track, status: entry.status
  });
}

// Preserve curriculum order — iterate CURRICULUM to keep section order stable
const seenSections = new Set();
for (const entry of CURRICULUM) {
  if (seenSections.has(entry.section)) continue;
  seenSections.add(entry.section);
  manifest.sections.push(sectionMap.get(entry.section));
}

fs.writeFileSync(
  path.join(dataDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n'
);

console.log(`Wrote ${written} lesson files (${stubs} stubs) across ${manifest.sections.length} sections.`);
console.log(`Manifest: data/manifest.json`);
