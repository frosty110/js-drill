#!/usr/bin/env node
// ============================================================================
//  tools/build-share-pages.js — the crawlable half of the share system
// ============================================================================
// Renders one static HTML page per drillable unit:
//
//   p/<lesson-id>/index.html          171 coding lessons
//   sd/<topic>/<unit>/index.html       43 system-design units
//   p/index.html, sd/index.html, sd/<topic>/index.html    indexes
//   sitemap.xml, robots.txt
//
// WHY THIS EXISTS. The drill app is client-rendered behind hash routes, and a
// hash fragment never reaches a server — so an agent handed an app URL fetches
// an empty shell. These pages are the fetchable form: complete without
// JavaScript, so `curl` (or an AI's browser tool, or a crawler) gets the real
// content.
//
// THE DECODING TRICK. A share URL carries the user's result set in `?s=`, which
// no static host can decode server-side. It doesn't need to: the page prints
// the legend and numbers every question, the agent already holds the URL, and
// zipping the two is trivial. That is the whole reason this works with no
// backend, no share records and no cache.
//
// Output is COMMITTED (GitHub Pages serves from the repo), so `--check` gates
// staleness in CI/pre-commit the way a generated-file check should.
//
// Usage:
//   node tools/build-share-pages.js            # write
//   node tools/build-share-pages.js --check    # exit 1 if output is stale
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SD = path.join(DATA, 'system-design');
const ORIGIN = 'https://frosty110.github.io/js-drill';

const DrillShare = require(path.join(ROOT, 'js', 'sharecode.js'));
const DrillRoutes = require(path.join(ROOT, 'js', 'routes.js'));

const CHECK = process.argv.includes('--check');

// ── Small helpers ───────────────────────────────────────────────────────────
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Inline `code` spans in authored prose. Everything is escaped first, so this
// can only ever introduce the <code> tags it adds itself.
const md = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

const letter = i => String.fromCharCode(65 + i);
const up = depth => '../'.repeat(depth);

// Authored infographic sets, keyed '<topic>/<unit>'. Loaded once; absent file
// simply means no unit gets a sheet.
const INFOGRAPHIC_SETS = (() => {
  const f = path.join(SD, 'infographic-sets.json');
  if (!fs.existsSync(f)) return {};
  const doc = readJson(f);
  return (doc && doc.sets) || {};
})();
const INFOGRAPHIC_TOPICS = new Set(['components', 'ddia', 'design-problems']);

// Relative path from sd/<topic>/<unit>/ to a committed sheet PNG.
const sheetSrc = (topic, unit, id) =>
  `${up(3)}assets/system-design/infographics/${topic}/${unit}/${id}.png`;

// A page's <head>. `depth` is how far below the deploy root the file sits, so
// asset links resolve from p/<id>/ and sd/<t>/<u>/ alike.
function head(depth, { title, description, canonical }) {
  const u = up(depth);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<link rel="stylesheet" href="${u}ds/tokens.css">
<link rel="stylesheet" href="${u}ds/components.css">
<link rel="stylesheet" href="${u}css/13-share-page.css">
<script src="${u}js/sharecode.js"></script>
</head>
<body class="ds-root sharepage">
<div class="ds-page">`;
}

function foot(depth, appUrl) {
  const u = up(depth);
  return `
</div>
<footer class="sharepage__foot">
  <a class="ds-btn ds-btn--primary" href="${esc(appUrl)}">Drill this in the app →</a>
  <a class="ds-btn ds-btn--ghost" href="${u}p/">All lessons</a>
  <a class="ds-btn ds-btn--ghost" href="${u}sd/">System design</a>
</footer>
<script src="${u}js/share-page.js"></script>
</body>
</html>
`;
}

// The legend, printed on every page that can carry a score code. This is the
// decoder an agent needs, and it is deliberately plain prose + a table rather
// than a spec reference — the page has to be self-sufficient.
function legendSection(kind) {
  const rows = DrillShare.LEGEND
    .map(l => `<tr><td><code>${esc(l.chars)}</code></td><td>${esc(l.meaning)}</td></tr>`)
    .join('\n      ');
  const shape = kind === 'lesson'
    ? 'Three segments separated by <code>.</code> — always <code>L1.L2.L3</code>, in that order. An empty segment means the lesson has no questions at that level.'
    : 'One segment: every question on this page, in order.';
  return `
  <section class="ds-section" id="score-code">
    <h2>Reading the <code>s=</code> code</h2>
    <p>If the URL you opened has an <code>s=</code> parameter, it is a result set: <strong>one character per question, in the order the questions appear on this page</strong>. Uppercase means credit, lowercase means no credit. The letter is the option index shown here — <code>A</code> is the first option listed.</p>
    <table class="legend">
      <thead><tr><th>Character</th><th>Meaning</th></tr></thead>
      <tbody>
      ${rows}
      </tbody>
    </table>
    <p>${shape}</p>
    <p class="sharepage__note">The order of questions and options on this page is fixed and never changes, which is what makes position alone enough to identify a question. Nothing about the code is stored anywhere — it lives only in the URL its owner chose to share.</p>
  </section>`;
}

// Rendered empty and filled in by js/share-page.js when a code is present.
// Static readers ignore it; they decode from the legend instead.
const resultsMount = `
  <section class="ds-section" id="your-results" hidden>
    <h2>Results carried by this link</h2>
    <div data-results></div>
  </section>`;

function codeBlock(code, lang) {
  return `<pre class="sharepage__code"><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(code)}</code></pre>`;
}

// ── Lesson pages ────────────────────────────────────────────────────────────

function lessonPage(lesson, content, sectionName) {
  const lang = content.lang === 'ts' ? 'ts' : 'js';
  const canonical = `${ORIGIN}/${DrillRoutes.sharePath('lesson', { id: lesson.id })}`;
  const appUrl = `${ORIGIN}/${DrillRoutes.surface('lesson').appHash({ id: lesson.id })}`;
  const questions = (content.L1 && content.L1.questions) || [];
  const exercises = (content.L2 && content.L2.exercises) || [];
  const ref = content.reference || {};
  const drill = content.L3 || {};

  const out = [];
  out.push(head(2, {
    title: `${lesson.title} — JS Drill`,
    description: content.description || `${lesson.title} — ${sectionName} drill: canonical solution, concept questions and answer key.`,
    canonical
  }));

  out.push(`
  <header class="ds-page__head">
    <p class="sharepage__crumb"><a href="${up(2)}p/">Lessons</a> › ${esc(sectionName)}</p>
    <h1>${esc(lesson.title)}</h1>
    <p class="sharepage__lede">${esc(content.description || '')}</p>
    <p class="sharepage__meta"><span class="ds-chip">${esc(lesson.track)}</span> <span class="ds-chip">${esc(sectionName)}</span> <span class="ds-chip">${questions.length} concept · ${exercises.length} fill-in · ${drill.canonical ? '1' : '0'} drill</span></p>
  </header>`);

  out.push(resultsMount);

  if (drill.prompt) {
    out.push(`
  <section class="ds-section" id="problem">
    <h2>Problem</h2>
    <p>${md(drill.prompt)}</p>
    ${drill.expectedOutput ? `<p class="sharepage__note">Expected output: <code>${esc(drill.expectedOutput)}</code></p>` : ''}
  </section>`);
  }

  if (ref.code) {
    out.push(`
  <section class="ds-section" id="canonical">
    <h2>Canonical solution</h2>
    ${ref.approach ? `<p><strong>${esc(ref.approach)}</strong>${ref.complexity ? ` · <code>${esc(ref.complexity)}</code> (time / space)` : ''}</p>` : ''}
    ${codeBlock(ref.code, lang)}
    ${Array.isArray(ref.notes) && ref.notes.length ? `<ul class="sharepage__notes">${ref.notes.map(n => `<li>${md(n)}</li>`).join('')}</ul>` : ''}
  </section>`);
  }

  if (Array.isArray(ref.alternates) && ref.alternates.length) {
    out.push(`
  <section class="ds-section" id="alternates">
    <h2>Alternate approaches</h2>
    ${ref.alternates.map((a, i) => `
    <article class="sharepage__alt" id="alt${i + 1}">
      <h3>${esc(a.label)}${a.complexity ? ` <code>${esc(a.complexity)}</code>` : ''}</h3>
      ${a.when ? `<p>${md(a.when)}</p>` : ''}
      ${codeBlock(a.code, lang)}
      ${Array.isArray(a.notes) && a.notes.length ? `<ul class="sharepage__notes">${a.notes.map(n => `<li>${md(n)}</li>`).join('')}</ul>` : ''}
    </article>`).join('')}
  </section>`);
  }

  if (questions.length) {
    out.push(`
  <section class="ds-section" id="L1">
    <h2>L1 — Concept questions <span class="sharepage__count">${questions.length}</span></h2>
    <p class="sharepage__note">Positions 1–${questions.length} of the code's first segment. The correct option is marked; in the app the options are shuffled, but the lettering here is the authored order the code refers to.</p>
    ${questions.map((q, i) => `
    <article class="sharepage__q" id="q${i + 1}">
      <h3><a href="#q${i + 1}" class="sharepage__anchor">Q${i + 1}</a> ${md(q.q)}</h3>
      <ol class="sharepage__opts">
        ${q.options.map((o, oi) => `<li${oi === q.answer ? ' class="is-correct"' : ''}><span class="sharepage__key">${letter(oi)}</span> ${md(o)}${oi === q.answer ? ' <span class="sharepage__tick">correct</span>' : ''}</li>`).join('\n        ')}
      </ol>
      ${q.explain ? `<p class="sharepage__why"><strong>Why:</strong> ${md(q.explain)}</p>` : ''}
    </article>`).join('')}
  </section>`);
  }

  if (exercises.length) {
    out.push(`
  <section class="ds-section" id="L2">
    <h2>L2 — Fill in the blanks <span class="sharepage__count">${exercises.length}</span></h2>
    <p class="sharepage__note">Positions 1–${exercises.length} of the code's second segment. <code>___</code> marks a blank.</p>
    ${exercises.map((ex, i) => `
    <article class="sharepage__q" id="l2-${i + 1}">
      <h3><a href="#l2-${i + 1}" class="sharepage__anchor">Exercise ${i + 1}</a></h3>
      <p>${md(ex.prompt || '')}</p>
      ${codeBlock(ex.template, lang)}
      <p><strong>Answers:</strong> ${ex.blanks.map(b => `<code>${esc(b.answer)}</code>`).join(', ')}</p>
      <p class="sharepage__note">Expected output: <code>${esc(ex.expectedOutput)}</code></p>
    </article>`).join('')}
  </section>`);
  }

  if (drill.canonical) {
    out.push(`
  <section class="ds-section" id="L3">
    <h2>L3 — Write it from memory</h2>
    <p class="sharepage__note">One position, the code's third segment.</p>
    <p>${md(drill.prompt || '')}</p>
    ${Array.isArray(drill.hints) && drill.hints.length ? `<details><summary>Hints</summary><ul class="sharepage__notes">${drill.hints.map(h => `<li>${md(h)}</li>`).join('')}</ul></details>` : ''}
    ${codeBlock(drill.canonical, lang)}
  </section>`);
  }

  out.push(legendSection('lesson'));

  // A machine-readable index of the same content, so an agent can align the
  // code to the questions without parsing HTML at all.
  out.push(`
  <script type="application/json" id="drill-data">${JSON.stringify({
    id: lesson.id,
    title: lesson.title,
    section: sectionName,
    track: lesson.track,
    codeShape: ['L1', 'L2', 'L3'],
    L1: questions.map((q, i) => ({ n: i + 1, q: q.q, options: q.options, answer: q.answer, answerLetter: letter(q.answer) })),
    L2: exercises.map((ex, i) => ({ n: i + 1, prompt: ex.prompt, answers: ex.blanks.map(b => b.answer) })),
    L3: drill.canonical ? [{ n: 1, prompt: drill.prompt, expectedOutput: drill.expectedOutput }] : [],
    legend: DrillShare.LEGEND
  }, null, 0).replace(/</g, '\\u003c')}</script>`);

  out.push(foot(2, appUrl));
  return out.join('\n');
}

// ── System-design pages ─────────────────────────────────────────────────────

// The unit's visuals, rendered so a fetcher can actually get at them: every
// committed infographic sheet as a real <img> with an absolute-resolvable src,
// and every authored diagram's source as text. Without this the static page
// carried the questions but no picture at all, so an agent handed the URL
// could read the rubric and then truthfully report it could not see a diagram.
function sdDiagramsSection(topic, meta, unit) {
  const set = INFOGRAPHIC_TOPICS.has(topic.id) ? INFOGRAPHIC_SETS[`${topic.id}/${unit.id}`] : null;
  // A registered sheet may still be awaiting artwork — only link what exists.
  const sheets = (set && Array.isArray(set.items) ? set.items : []).filter(it =>
    fs.existsSync(path.join(ROOT, 'assets', 'system-design', 'infographics', topic.id, unit.id, `${it.id}.png`)));
  const diagrams = Array.isArray(unit.diagrams) ? unit.diagrams
    : (unit.diagram ? [unit.diagram] : []);
  if (!sheets.length && !diagrams.length) return '';

  const sheetHtml = sheets.map(it => `
    <figure class="sharepage__sheet" id="sheet-${esc(it.id)}">
      <img src="${esc(sheetSrc(topic.id, unit.id, it.id))}" alt="${esc(`${unit.title}: ${it.title}`)}"${it.width ? ` width="${esc(it.width)}"` : ''}${it.height ? ` height="${esc(it.height)}"` : ''} loading="lazy">
      <figcaption>
        <strong>${esc(it.title)}</strong>${it.kind ? ` <span class="ds-chip">${esc(it.kind)}</span>` : ''}
        <a href="${esc(up(3))}${esc(DrillRoutes.sharePath('sdSheet', { topic: topic.id, unit: unit.id, sheet: it.id }))}">Open this sheet on its own page</a>
        · <a href="${esc(sheetSrc(topic.id, unit.id, it.id))}">the full-size image</a>
      </figcaption>
    </figure>`).join('');

  const diagramHtml = diagrams.map(d => `
    <article class="sharepage__diagram" id="diagram-${esc(d.id || '')}">
      <h3>${esc(d.title || 'Diagram')}${d.kind ? ` <span class="ds-chip">${esc(d.kind)}</span>` : ''}${d.role ? ` <span class="ds-chip">${esc(d.role)}</span>` : ''}</h3>
      ${d.takeaway ? `<p>${md(d.takeaway)}</p>` : ''}
      ${d.code ? `<pre class="sharepage__code"><code>${esc(d.code)}</code></pre>` : ''}
    </article>`).join('');

  return `
  <section class="ds-section" id="diagrams">
    <h2>Diagrams</h2>
    <p class="sharepage__note">${sheets.length ? `${sheets.length} study sheet${sheets.length === 1 ? '' : 's'}` : 'No study sheets yet'}${diagrams.length ? ` · ${diagrams.length} authored diagram${diagrams.length === 1 ? '' : 's'} (source below, rendered in the app)` : ''}.</p>
    ${sheetHtml}
    ${diagramHtml}
  </section>`;
}

function sdUnitPage(topic, meta, unit) {
  const canonical = `${ORIGIN}/${DrillRoutes.sharePath('sdUnit', { topic: topic.id, unit: unit.id })}`;
  const appUrl = `${ORIGIN}/${DrillRoutes.surface('sdUnit').appHash({ topic: topic.id, unit: unit.id })}`;
  const questions = unit.questions || [];
  const out = [];

  out.push(head(3, {
    title: `${unit.title} — ${meta.title}`,
    description: unit.summary || `${unit.title} — system design drill: questions, model answers and rubric points.`,
    canonical
  }));

  out.push(`
  <header class="ds-page__head">
    <p class="sharepage__crumb"><a href="${up(3)}sd/">System design</a> › <a href="${up(3)}sd/${esc(topic.id)}/">${esc(meta.title)}</a></p>
    <h1>${esc(unit.title)}</h1>
    ${unit.summary ? `<p class="sharepage__lede">${md(unit.summary)}</p>` : ''}
    <p class="sharepage__meta"><span class="ds-chip">${esc(meta.title)}</span> <span class="ds-chip">${questions.length} question${questions.length === 1 ? '' : 's'}</span></p>
  </header>`);

  out.push(resultsMount);

  if (Array.isArray(unit.keyTakeaways) && unit.keyTakeaways.length) {
    out.push(`
  <section class="ds-section" id="key-ideas">
    <h2>Key ideas</h2>
    <ul class="sharepage__notes">${unit.keyTakeaways.map(k => `<li>${md(k)}</li>`).join('')}</ul>
  </section>`);
  }

  out.push(sdDiagramsSection(topic, meta, unit));

  out.push(`
  <section class="ds-section" id="questions">
    <h2>Questions <span class="sharepage__count">${questions.length}</span></h2>
    <p class="sharepage__note">Positions 1–${questions.length} of the code. Open questions are answered out loud and self-graded, so their characters are <code>Y</code> / <code>p</code> / <code>n</code> rather than option letters.</p>
    ${questions.map((q, i) => {
      const isMc = (q.type || 'mc') === 'mc';
      const stem = isMc ? q.q : q.prompt;
      return `
    <article class="sharepage__q" id="q${i + 1}">
      <h3><a href="#q${i + 1}" class="sharepage__anchor">Q${i + 1}</a> <span class="ds-chip">${isMc ? 'multiple choice' : 'explain &amp; apply'}</span>${q.crux ? ' <span class="ds-chip">crux</span>' : ''}</h3>
      <p>${md(stem || '')}</p>
      ${isMc ? `
      <ol class="sharepage__opts">
        ${(q.options || []).map((o, oi) => `<li${oi === q.answer ? ' class="is-correct"' : ''}><span class="sharepage__key">${letter(oi)}</span> ${md(o)}${oi === q.answer ? ' <span class="sharepage__tick">correct</span>' : ''}</li>`).join('\n        ')}
      </ol>
      ${q.explain ? `<p class="sharepage__why"><strong>Why:</strong> ${md(q.explain)}</p>` : ''}` : `
      ${Array.isArray(q.points) && q.points.length ? `<p><strong>Points a strong answer hits:</strong></p><ul class="sharepage__notes">${q.points.map(p => `<li>${md(p)}</li>`).join('')}</ul>` : ''}
      ${q.answer ? `<div class="sharepage__model"><strong>Model answer:</strong> ${md(q.answer)}</div>` : ''}`}
    </article>`;
    }).join('')}
  </section>`);

  out.push(legendSection('unit'));

  out.push(`
  <script type="application/json" id="drill-data">${JSON.stringify({
    topic: topic.id,
    unit: unit.id,
    title: unit.title,
    codeShape: ['Q'],
    // Machine-readable index of the visuals, so an agent can fetch a sheet
    // directly instead of scraping <img> tags.
    sheets: (INFOGRAPHIC_TOPICS.has(topic.id) && INFOGRAPHIC_SETS[`${topic.id}/${unit.id}`]
      ? (INFOGRAPHIC_SETS[`${topic.id}/${unit.id}`].items || [])
      : [])
      .filter(it => fs.existsSync(path.join(ROOT, 'assets', 'system-design', 'infographics', topic.id, unit.id, `${it.id}.png`)))
      .map(it => ({
        id: it.id,
        title: it.title,
        kind: it.kind,
        url: `${ORIGIN}/assets/system-design/infographics/${topic.id}/${unit.id}/${it.id}.png`,
        appUrl: `${ORIGIN}/system-design.html#/${topic.id}/${unit.id}/graphic/${it.id}`
      })),
    diagrams: (Array.isArray(unit.diagrams) ? unit.diagrams : (unit.diagram ? [unit.diagram] : []))
      .map(d => ({ id: d.id, title: d.title, kind: d.kind, role: d.role, takeaway: d.takeaway })),
    questions: questions.map((q, i) => ({
      n: i + 1,
      type: q.type || 'mc',
      prompt: q.q || q.prompt,
      options: q.options || undefined,
      answer: typeof q.answer === 'number' ? q.answer : undefined,
      answerLetter: typeof q.answer === 'number' ? letter(q.answer) : undefined,
      points: q.points || undefined
    })),
    legend: DrillShare.LEGEND
  }, null, 0).replace(/</g, '\\u003c')}</script>`);

  out.push(foot(3, appUrl));
  return out.join('\n');
}

// ── One sheet, one page ─────────────────────────────────────────────────────
// The JS-free twin of the app's #/…/graphic/<id> route. A full-screen study
// sheet is the longest-dwell surface in the app, so it is exactly what a user
// pastes when they ask "explain this diagram" — and until this existed, that
// paste resolved to a hash no server could read. Deliberately small: the image
// first, the context on the next line, the way back after that.
function sdSheetPage(topic, meta, unit, item, siblings) {
  const canonical = `${ORIGIN}/${DrillRoutes.sharePath('sdSheet', { topic: topic.id, unit: unit.id, sheet: item.id })}`;
  const appUrl = `${ORIGIN}/${DrillRoutes.surface('sdSheet').appHash({ topic: topic.id, unit: unit.id, sheet: item.id })}`;
  const u = up(4);
  const rel = `assets/system-design/infographics/${topic.id}/${unit.id}/${item.id}.png`;
  const out = [];

  out.push(head(4, {
    title: `${item.title} — ${unit.title}`,
    description: `${item.title}: a system-design study sheet for ${unit.title}${item.kind ? ` (${item.kind})` : ''}.`,
    canonical
  }));

  out.push(`
  <header class="ds-page__head">
    <p class="sharepage__crumb"><a href="${u}sd/">System design</a> › <a href="${u}sd/${esc(topic.id)}/">${esc(meta.title)}</a> › <a href="${u}${esc(DrillRoutes.sharePath('sdUnit', { topic: topic.id, unit: unit.id }))}">${esc(unit.title)}</a></p>
    <h1>${esc(item.title)}</h1>
    <p class="sharepage__meta">${item.kind ? `<span class="ds-chip">${esc(item.kind)}</span> ` : ''}<span class="ds-chip">study sheet</span></p>
  </header>
  <section class="ds-section" id="sheet">
    <figure class="sharepage__sheet">
      <img src="${u}${esc(rel)}" alt="${esc(`${unit.title}: ${item.title}`)}"${item.width ? ` width="${esc(item.width)}"` : ''}${item.height ? ` height="${esc(item.height)}"` : ''}>
      <figcaption class="sharepage__note"><code>${esc(ORIGIN)}/${esc(rel)}</code></figcaption>
    </figure>
  </section>`);

  if (unit.summary) {
    out.push(`
  <section class="ds-section" id="context">
    <h2>What this belongs to</h2>
    <p>${md(unit.summary)}</p>
    <p><a href="${u}${esc(DrillRoutes.sharePath('sdUnit', { topic: topic.id, unit: unit.id }))}">All questions, model answers and diagrams for ${esc(unit.title)} →</a></p>
  </section>`);
  }

  if (siblings.length > 1) {
    out.push(`
  <section class="ds-section" id="siblings">
    <h2>Other sheets in this set</h2>
    <ul class="sharepage__list">
      ${siblings.filter(s => s.id !== item.id).map(s => `<li><a href="${u}${esc(DrillRoutes.sharePath('sdSheet', { topic: topic.id, unit: unit.id, sheet: s.id }))}">${esc(s.title)}</a>${s.kind ? ` <span class="ds-chip">${esc(s.kind)}</span>` : ''}</li>`).join('\n      ')}
    </ul>
  </section>`);
  }

  out.push(`
  <script type="application/json" id="drill-data">${JSON.stringify({
    topic: topic.id, unit: unit.id, sheet: item.id,
    title: item.title, kind: item.kind || undefined,
    image: `${ORIGIN}/${rel}`,
    unitPage: `${ORIGIN}/${DrillRoutes.sharePath('sdUnit', { topic: topic.id, unit: unit.id })}`,
    appUrl
  }, null, 0).replace(/</g, '\\u003c')}</script>`);

  out.push(foot(4, appUrl));
  return out.join('\n');
}

// The sheets a unit actually has artwork for. A registered sheet may still be
// awaiting its PNG, and nothing should link a missing image.
function committedSheets(topic, unit) {
  const set = INFOGRAPHIC_TOPICS.has(topic.id) ? INFOGRAPHIC_SETS[`${topic.id}/${unit.id}`] : null;
  return (set && Array.isArray(set.items) ? set.items : []).filter(it =>
    fs.existsSync(path.join(ROOT, 'assets', 'system-design', 'infographics', topic.id, unit.id, `${it.id}.png`)));
}

// ── Index pages ─────────────────────────────────────────────────────────────

function lessonIndexPage(sections) {
  const canonical = `${ORIGIN}/${DrillRoutes.sharePath('lessonIndex', {})}`;
  const total = sections.reduce((n, s) => n + s.lessons.length, 0);
  const out = [];
  out.push(head(1, {
    title: 'All coding lessons — JS Drill',
    description: `${total} JavaScript syntax and interview-pattern lessons, each with concept questions, fill-in exercises and a canonical solution.`,
    canonical
  }));
  out.push(`
  <header class="ds-page__head">
    <h1>Coding lessons</h1>
    <p class="sharepage__lede">${total} lessons across ${sections.length} sections. Each page carries the canonical solution, every question and the answer key — and accepts a <code>?s=</code> result set.</p>
  </header>`);
  for (const s of sections) {
    out.push(`
  <section class="ds-section" id="${esc(s.slug)}">
    <h2><a href="#${esc(s.slug)}" class="sharepage__anchor">${esc(s.name)}</a> <span class="sharepage__count">${s.lessons.length}</span></h2>
    <ul class="sharepage__list">
      ${s.lessons.map(l => `<li><a href="${up(1)}p/${encodeURIComponent(l.id)}/">${esc(l.title)}</a> <span class="ds-chip">${esc(l.track)}</span></li>`).join('\n      ')}
    </ul>
  </section>`);
  }
  out.push(foot(1, `${ORIGIN}/index.html`));
  return out.join('\n');
}

function sdIndexPage(topics, metas) {
  const canonical = `${ORIGIN}/${DrillRoutes.sharePath('sdIndex', {})}`;
  const out = [];
  out.push(head(1, {
    title: 'System design — JS Drill',
    description: 'System design drill topics: DDIA, the interview framework, building blocks and 17 canonical design problems.',
    canonical
  }));
  out.push(`
  <header class="ds-page__head">
    <h1>System design</h1>
    <p class="sharepage__lede">${topics.length} topics. Every unit page carries its questions, model answers and rubric points — and accepts a <code>?s=</code> result set.</p>
  </header>`);
  for (const t of topics) {
    const meta = metas[t.id];
    out.push(`
  <section class="ds-section" id="${esc(t.id)}">
    <h2><a href="${up(1)}sd/${esc(t.id)}/">${esc(meta.title)}</a> <span class="sharepage__count">${meta.chapters.length}</span></h2>
    <p>${esc(t.blurb || '')}</p>
  </section>`);
  }
  out.push(foot(1, `${ORIGIN}/system-design.html`));
  return out.join('\n');
}

function sdTopicPage(topic, meta) {
  const canonical = `${ORIGIN}/${DrillRoutes.sharePath('sdTopic', { topic: topic.id })}`;
  const appUrl = `${ORIGIN}/${DrillRoutes.surface('sdTopic').appHash({ topic: topic.id })}`;
  const out = [];
  out.push(head(2, {
    title: `${meta.title} — System design`,
    description: meta.description || meta.subtitle || meta.title,
    canonical
  }));
  out.push(`
  <header class="ds-page__head">
    <p class="sharepage__crumb"><a href="${up(2)}sd/">System design</a></p>
    <h1>${esc(meta.title)}</h1>
    ${meta.subtitle ? `<p class="sharepage__lede">${esc(meta.subtitle)}</p>` : ''}
  </header>
  <section class="ds-section" id="units">
    <h2>${esc(meta.unitLabel || 'Chapter')}s <span class="sharepage__count">${meta.chapters.length}</span></h2>
    <ul class="sharepage__list">
      ${meta.chapters.map(c => `<li><a href="${up(2)}sd/${esc(topic.id)}/${esc(c.id)}/">${esc(c.title)}</a> <span class="ds-chip">${c.questions} question${c.questions === 1 ? '' : 's'}</span></li>`).join('\n      ')}
    </ul>
  </section>`);
  out.push(foot(2, appUrl));
  return out.join('\n');
}

// ── The agent bridge ────────────────────────────────────────────────────────
// The pages above only help someone who already knows they exist, and the URL
// people actually paste is the app one. A hash fragment never reaches a server,
// so `system-design.html#/design-problems/p03` and the bare shell are the same
// bytes: an agent fetching either got "Loading…" and had nowhere to go.
//
// So each shell carries its own directions. This markup sits inside the render
// mount, which every render path overwrites, and an inline script blanks it the
// moment JS runs — a browser never shows it, a fetcher always does. It states
// the hash → path rule so a reader gets there in one hop, and links the indexes
// for one who would rather follow a link than derive one.
//
// Generated rather than hand-written so it cannot drift from js/routes.js, and
// gated by --check like every other output here.
const BRIDGE_START = '<!-- agent-bridge:start -->';
const BRIDGE_END = '<!-- agent-bridge:end -->';

function bridgeShell(title, rules, intro, body) {
  return `${BRIDGE_START}
  <noscript><p><strong>This page renders with JavaScript.</strong></p></noscript>
  <div class="agent-bridge">
    <h1>${title}</h1>
    <p>You are reading the un-rendered shell of a client-side app. The content is
       <strong>not</strong> in this file, and the <code>#/…</code> fragment you may have
       been given never reaches the server, so every hash returns these same bytes.</p>
    <p><strong>Everything here has a complete, JavaScript-free page. Swap the hash for a path:</strong></p>
    <pre><code>${rules}</code></pre>
    <p>${intro}</p>
${body}
    <p>Indexes: <a href="sd/">sd/</a> (system design) · <a href="p/">p/</a> (coding lessons) ·
       machine-readable: <a href="sitemap.xml">sitemap.xml</a>. Every generated page also
       embeds its content as JSON in <code>&lt;script id="drill-data"&gt;</code>.</p>
  </div>
  ${BRIDGE_END}`;
}

function sdAgentBridge(topics, metas) {
  const rows = topics.map(t => {
    const meta = metas[t.id];
    const unit = (meta.chapters[0] || {}).id;
    return `      <li><a href="sd/${esc(t.id)}/">${esc(meta.title)}</a> — ${meta.chapters.length} ${esc((meta.unitLabel || 'chapter').toLowerCase())}s, e.g. <code>${esc(DrillRoutes.sharePath('sdUnit', { topic: t.id, unit }))}</code></li>`;
  }).join('\n');
  return bridgeShell(
    'System design — static text version',
    `system-design.html#/design-problems/p03              →   sd/design-problems/p03/
system-design.html#/&lt;topic&gt;/&lt;unit&gt;                       →   sd/&lt;topic&gt;/&lt;unit&gt;/
system-design.html#/&lt;topic&gt;/&lt;unit&gt;/graphic/&lt;sheet&gt;        →   sd/&lt;topic&gt;/&lt;unit&gt;/&lt;sheet&gt;/
system-design.html#/&lt;topic&gt;                              →   sd/&lt;topic&gt;/`,
    'Those pages carry the full question list, every model answer and rubric point, the mermaid source of each architecture diagram, and the study-sheet images — and each sheet has a page of its own.',
    `    <ul>\n${rows}\n    </ul>`
  );
}

function lessonAgentBridge(sections) {
  const total = sections.reduce((n, s) => n + s.lessons.length, 0);
  const rows = sections.slice(0, 8).map(s =>
    `      <li>${esc(s.name)} — ${s.lessons.length} lesson${s.lessons.length === 1 ? '' : 's'}, e.g. <code>${esc(DrillRoutes.sharePath('lesson', { id: s.lessons[0].id }))}</code></li>`
  ).join('\n');
  return bridgeShell(
    'JS Drill — static text version',
    `index.html#/two-sum          →   p/two-sum/
index.html#/&lt;lesson-id&gt;      →   p/&lt;lesson-id&gt;/
index.html#/&lt;lesson-id&gt;/L2   →   p/&lt;lesson-id&gt;/  (every level is on the one page)`,
    `Those pages carry the problem, the canonical solution, every concept question with its answer key, and the fill-in exercises. ${total} lessons across ${sections.length} sections.`,
    `    <ul>\n${rows}\n      <li>…and the rest: <a href="p/">p/</a></li>\n    </ul>`
  );
}

// Marker-delimited replacement, so the app page owns its own markup and this
// only ever rewrites the region it created.
function emitBridge(relPath, markup) {
  const abs = path.join(ROOT, relPath);
  const current = fs.readFileSync(abs, 'utf8');
  const a = current.indexOf(BRIDGE_START);
  const b = current.indexOf(BRIDGE_END);
  if (a < 0 || b < 0) {
    throw new Error(`${relPath}: missing ${BRIDGE_START} / ${BRIDGE_END} markers — the agent bridge has nowhere to go`);
  }
  const next = current.slice(0, a) + markup + current.slice(b + BRIDGE_END.length);
  written.push(relPath);
  if (CHECK) {
    if (next !== current) { stale++; console.error(`  stale: ${relPath} (agent bridge)`); }
    return;
  }
  if (next !== current) fs.writeFileSync(abs, next);
}

// ── Write / check ───────────────────────────────────────────────────────────

const written = [];
let stale = 0;

function emit(relPath, contents) {
  const abs = path.join(ROOT, relPath);
  written.push(relPath);
  if (CHECK) {
    const current = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    if (current !== contents) { stale++; console.error(`  stale: ${relPath}`); }
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

function main() {
  const manifest = readJson(path.join(DATA, 'manifest.json'));
  const entries = [];
  let lessons = 0;

  // Coding lessons.
  for (const section of manifest.sections) {
    for (const l of section.lessons) {
      const file = path.join(DATA, section.slug, `${l.id}.json`);
      if (!fs.existsSync(file)) { console.error(`  missing: ${file}`); continue; }
      const content = readJson(file);
      if (l.status !== 'full') continue;   // stubs have nothing to crawl
      // Guard the codec's ceiling: more than 8 options would fall off the
      // alphabet and silently encode as unattempted.
      for (const q of (content.L1 && content.L1.questions) || []) {
        if (q.options.length > DrillShare.MC_MAX_OPTIONS) {
          throw new Error(`${l.id}: ${q.options.length} options exceeds the share alphabet (max ${DrillShare.MC_MAX_OPTIONS})`);
        }
      }
      emit(path.join('p', l.id, 'index.html'), lessonPage(l, content, section.name));
      entries.push({ kind: 'lesson', params: { id: l.id } });
      lessons++;
    }
  }
  emit(path.join('p', 'index.html'), lessonIndexPage(manifest.sections.filter(s => s.lessons.some(l => l.status === 'full'))));
  entries.push({ kind: 'lessonIndex', params: {} });

  // System design.
  const topics = readJson(path.join(SD, 'topics.json')).topics;
  const metas = {};
  let units = 0;
  let sheets = 0;
  for (const t of topics) {
    const meta = readJson(path.join(SD, t.id, 'manifest.json'));
    metas[t.id] = meta;
    for (const c of meta.chapters) {
      const file = path.join(SD, t.id, `${c.id}.json`);
      if (!fs.existsSync(file)) { console.error(`  missing: ${file}`); continue; }
      const unit = readJson(file);
      for (const q of unit.questions || []) {
        if (Array.isArray(q.options) && q.options.length > DrillShare.MC_MAX_OPTIONS) {
          throw new Error(`${t.id}/${c.id}: ${q.options.length} options exceeds the share alphabet`);
        }
      }
      emit(path.join('sd', t.id, c.id, 'index.html'), sdUnitPage(t, meta, unit));
      entries.push({ kind: 'sdUnit', params: { topic: t.id, unit: c.id } });
      units++;

      // …and the JS-free twin of each #/…/graphic/<id> route.
      const items = committedSheets(t, unit);
      for (const item of items) {
        emit(path.join('sd', t.id, c.id, item.id, 'index.html'), sdSheetPage(t, meta, unit, item, items));
        entries.push({ kind: 'sdSheet', params: { topic: t.id, unit: c.id, sheet: item.id } });
        sheets++;
      }
    }
    emit(path.join('sd', t.id, 'index.html'), sdTopicPage(t, meta));
    entries.push({ kind: 'sdTopic', params: { topic: t.id } });
  }
  emit(path.join('sd', 'index.html'), sdIndexPage(topics, metas));
  entries.push({ kind: 'sdIndex', params: {} });

  // Point both app shells at everything above.
  emitBridge('system-design.html', sdAgentBridge(topics, metas));
  emitBridge('index.html', lessonAgentBridge(
    manifest.sections.filter(s => s.lessons.some(l => l.status === 'full'))));

  // Crawl metadata.
  emit('sitemap.xml', DrillRoutes.sitemapXml(entries, ORIGIN));
  emit('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);

  if (CHECK) {
    if (stale) {
      console.error(`\n✗ ${stale} generated file(s) out of date — run: node tools/build-share-pages.js`);
      process.exit(1);
    }
    console.log(`✓ share pages up to date (${lessons} lessons, ${units} units, ${sheets} sheets, ${written.length} files)`);
    return;
  }
  console.log(`✓ wrote ${written.length} files — ${lessons} lessons, ${units} system-design units, ${sheets} study sheets, ${topics.length} topics, sitemap, robots`);
}

main();
