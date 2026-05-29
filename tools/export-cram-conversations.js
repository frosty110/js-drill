// Capture all problem conversations from the 4-day cram into a single
// Markdown doc. Walks data/paths.json (path id `prep-4day`) preserving
// day/block order, dedupes lessons (first-appearance wins; later-day
// repeats are noted at the lesson header), reads each lesson JSON, and
// renders the conversation block as readable Markdown.
//
//   node tools/export-cram-conversations.js [out-path]
//
// Default out-path: iter-artifacts/cram-conversations.md
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'iter-artifacts/cram-conversations.md';

const pathsJson = JSON.parse(fs.readFileSync('data/paths.json', 'utf8'));
const manifest  = JSON.parse(fs.readFileSync('data/manifest.json', 'utf8'));
const cram = pathsJson.paths.find(p => p.id === 'prep-4day');
if (!cram) { console.error('prep-4day path not found in data/paths.json'); process.exit(1); }

const slug = n => n.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sectionOf = {};
for (const s of manifest.sections) for (const l of s.lessons) sectionOf[l.id] = s.name;

// schedule[lessonId] = [{day, blockTitle}…] across all days the lesson appears
const schedule = {};
for (const day of cram.days) {
  for (const block of day.blocks || []) {
    for (const task of block.tasks || []) {
      if (!task.lessonId) continue;
      (schedule[task.lessonId] ||= []).push({ day: day.day, blockTitle: block.title });
    }
  }
}

// Markdown renderers — keep prose readable, render backtick code spans as-is
// (Markdown handles them natively), preserve paragraph breaks (\n\n).
function blockquote(text) {
  return text.split('\n').map(line => '> ' + line).join('\n');
}
function renderExamples(examples) {
  let out = '';
  for (const ex of examples) {
    const inp = ex.input != null ? String(ex.input) : '';
    const out_ = ex.output != null ? String(ex.output) : null;
    out += `- **Input:** \`${inp}\``;
    if (out_) out += ` → **Output:** \`${out_}\``;
    out += '\n';
    if (ex.note)  out += `  *Note:* ${ex.note}\n`;
    if (ex.trace) out += '\n  ```\n' + String(ex.trace).split('\n').map(l => '  ' + l).join('\n') + '\n  ```\n';
  }
  return out + '\n';
}
function renderConversation(j) {
  if (!j.conversation) return '*(no conversation block on this lesson)*\n\n';
  const conv = j.conversation;
  let out = '';
  if (conv.intro) out += blockquote(conv.intro) + '\n\n';
  for (const sec of conv.sections || []) {
    out += `##### ${sec.title}\n\n`;
    if (sec.prompt) out += blockquote(sec.prompt) + '\n\n';
    if (sec.intro)  out += sec.intro + '\n\n';
    if (sec.say)    out += `**What I'd say** — ${sec.say}\n\n`;
    if (Array.isArray(sec.examples) && sec.examples.length) {
      out += `**Worked examples**\n\n` + renderExamples(sec.examples);
    }
    if (sec.why)    out += `**Why this matters** — *${sec.why}*\n\n`;
    if (!sec.say && !sec.why && !sec.examples && sec.reveal) {
      out += sec.reveal + '\n\n';
    }
  }
  return out;
}

// Assemble. ## Day → ### Block → #### Lesson → ##### Sections.
const today = new Date().toISOString().slice(0, 10);
let md =
`# 4-Day Interview Cram — Problem Conversations

> *Captured ${today} from \`data/paths.json\` (path id: \`prep-4day\`).*
> Each lesson's interview-narration conversation, in the order it first appears in the cram. Lessons that recur across days are noted at the lesson header.
> Regenerate anytime: \`node tools/export-cram-conversations.js\`

---

`;

const seen = new Set();
let totalLessons = 0;
let totalSections = 0;

for (const day of cram.days) {
  let dayMd = `## Day ${day.day}${day.title ? ' — ' + day.title : ''}${day.iso ? ` *(${day.iso})*` : ''}\n\n`;
  let dayHasNew = false;
  for (const block of day.blocks || []) {
    let blockMd = '';
    for (const task of block.tasks || []) {
      const id = task.lessonId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const section = sectionOf[id];
      if (!section) { blockMd += `#### ⚠️ ${id} *(not in manifest — skipped)*\n\n`; continue; }
      let j;
      try { j = JSON.parse(fs.readFileSync(path.join('data', slug(section), id + '.json'), 'utf8')); }
      catch (e) { blockMd += `#### ⚠️ ${id} *(read failed: ${e.message})*\n\n`; continue; }
      const sched = schedule[id];
      const recur = sched.length > 1
        ? ` <sub>*also scheduled: ${sched.slice(1).map(s => `Day ${s.day}`).join(', ')}*</sub>`
        : '';
      blockMd += `#### ${j.title}${recur}\n\n`;
      blockMd += `*${j.section}* · \`${id}\`${j.description ? ' — ' + j.description : ''}\n\n`;
      blockMd += renderConversation(j);
      blockMd += '---\n\n';
      totalLessons++;
      if (j.conversation && j.conversation.sections) totalSections += j.conversation.sections.length;
    }
    if (blockMd) {
      dayMd += `### ${block.title}${block.duration ? ` *(${block.duration})*` : ''}\n\n` + blockMd;
      dayHasNew = true;
    }
  }
  if (dayHasNew) md += dayMd;
}

// Footer: any lessons missing conversation
const missingConv = [...seen].filter(id => {
  try {
    const j = JSON.parse(fs.readFileSync(path.join('data', slug(sectionOf[id]), id + '.json'), 'utf8'));
    return !j.conversation;
  } catch (_) { return false; }
});
if (missingConv.length) {
  md += `## Coverage gaps\n\nLessons in cram without an authored conversation block (${missingConv.length}):\n\n`;
  for (const id of missingConv) md += `- \`${id}\`\n`;
  md += '\n';
}

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} — ${md.length.toLocaleString()} bytes`);
console.log(`Lessons captured: ${totalLessons}, conversation sections: ${totalSections}`);
if (missingConv.length) console.log(`Coverage gaps: ${missingConv.length} (${missingConv.join(', ')})`);
