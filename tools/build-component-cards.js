#!/usr/bin/env node
// ============================================================================
//  tools/build-component-cards.js — flash cards derived from the catalog
// ============================================================================
// The component catalog already holds every answer: what a block is, the signal
// that says reach for it, what it costs, how it breaks, which sibling to rule
// out, and what it is doing in each canonical problem. What it did NOT have was
// a way to be *tested* on any of that — the pages could only be read, and
// PROFILE.md is explicit that reading is the weakest form of study.
//
// So the cards are DERIVED, never authored. Five templates over the catalog,
// emitted as ordinary `open` questions (prompt → reveal → self-grade), which is
// the flash-card shape the drill already runs. They can never drift from the
// catalog, because they are a projection of it.
//
//   node tools/build-component-cards.js          regenerate the decks
//   node tools/build-component-cards.js --check  fail if committed output is stale
//
// ── Why there is an order ledger ────────────────────────────────────────────
// A card's spaced-repetition key is POSITIONAL — `${topic}/${unit}/${index}` —
// and so is its share code. Generated content whose order shifts would silently
// repoint every user's Leitner state and every link ever shared, which is
// invariant 1's failure mode arriving through the back door.
//
// Sorting by anything derived from the source data is not enough: adding one
// edge from `caching` to an earlier problem would insert a card mid-deck and
// move every card after it. So `order.lock.json` assigns each card a permanent
// slot on first sight and never moves it; new cards always append. Regenerating
// after any content change is therefore safe by construction rather than by
// convention.
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SD = path.join(ROOT, 'data', 'system-design');
const OUT = path.join(SD, 'component-cards');
const LOCK = path.join(OUT, 'order.lock.json');
const CHECK = process.argv.includes('--check');

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const CATALOG = readJson(path.join(SD, 'components', 'catalog.json'));
const EDGES = readJson(path.join(SD, 'mechanism-map.json')).edges;
const DP = readJson(path.join(SD, 'design-problems', 'manifest.json'));

const MIN_POINTS = 3;              // mirrors MIN_OPEN_POINTS in the validator
const MIN_QUESTIONS = 8;           // mirrors MIN_QUESTIONS
const dpTitle = Object.fromEntries(DP.chapters.map(c => [c.id, c.title]));
// Problems in manifest order, so a component's transfer points read in the same
// sequence the design-problem list does.
const dpOrder = Object.fromEntries(DP.chapters.map((c, i) => [c.id, i]));

const byId = Object.fromEntries(CATALOG.components.map(c => [c.id, c]));
const edgesOf = id => Object.keys(EDGES[id] || {})
  .sort((a, b) => (dpOrder[a] ?? 999) - (dpOrder[b] ?? 999));

// ── The five templates ──────────────────────────────────────────────────────
// Each returns null when the source material cannot supply MIN_POINTS honestly.
// Padding a rubric to clear a threshold is how filler gets manufactured, and the
// project has been burnt by exactly that before (see the FILLER guard in
// validate-system-design.js). A skipped card is reported, not invented.
const TEMPLATES = [
  {
    id: 'selection',
    build(c) {
      // The prompt quotes the signals and asks which block answers them, so a
      // signal that says the block's own name answers the card for you. Prefer
      // the ones that don't ("read:write 100:1" over "the prompt is metrics…"),
      // and fall back only when a component has fewer than two clean signals.
      const own = c.title.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3);
      const clean = c.reachFor.filter(s => !own.some(w => s.toLowerCase().includes(w)));
      if (clean.length < 2) selfNaming.push(c.id);
      const chosen = (clean.length >= 2 ? clean : c.reachFor).slice(0, 2);
      const sig = chosen.join('; ');
      return {
        prompt: `A design prompt says: ${sig}. Which building block answers that, and why is it the right reach?`,
        points: [`${c.title} — ${c.what}`, ...c.reachFor],
        answer: `${c.title}. ${c.what} You reach for it when: ${c.reachFor.join('; ')}.`
      };
    }
  },
  {
    id: 'rejection',
    build(c) {
      const pts = [...c.avoid, ...c.costs];
      if (pts.length < MIN_POINTS) return null;
      return {
        prompt: `You put ${c.title} in a design. Name the signals that should have stopped you — and what it costs even when it is the right call.`,
        points: pts,
        answer: `Don't reach for it when: ${c.avoid.join('; ')}. And it is never free: ${c.costs.join('; ')}.`
      };
    }
  },
  {
    id: 'failure',
    build(c) {
      if (c.failureModes.length < MIN_POINTS) return null;
      return {
        prompt: `${c.title} is in your design and load goes up ten times. How does it break?`,
        points: c.failureModes,
        answer: c.failureModes.join(' ')
      };
    }
  },
  {
    id: 'discrimination',
    build(c) {
      const alts = (c.alternatives || []).filter(a => byId[a.id]);
      const pts = alts.map(a => `${byId[a.id].title} — ${a.note}`);
      if (pts.length + 1 < MIN_POINTS) return null;
      return {
        prompt: `${c.title} vs ${alts.map(a => byId[a.id].title).join(' vs ')} — what decides between them?`,
        points: [...pts, `${c.title} — ${c.what}`],
        answer: alts.map(a => `${byId[a.id].title}: ${a.note}`).join(' ')
      };
    }
  },
  {
    id: 'transfer',
    build(c) {
      const eds = edgesOf(c.id);
      // Fewer than three problems cannot make a recall exercise worth the card —
      // "name the one place this appears" is a lookup, not retrieval practice.
      if (eds.length < MIN_POINTS) return null;
      return {
        prompt: `${c.title} appears in ${eds.length} of the canonical design problems. Name as many as you can, and say what it is doing in each.`,
        points: eds.map(p => `${dpTitle[p] || p} — ${EDGES[c.id][p]}`),
        answer: `${c.title} carries different work in each: ` +
          eds.map(p => `in ${dpTitle[p] || p}, ${EDGES[c.id][p][0].toLowerCase()}${EDGES[c.id][p].slice(1)}`).join(' ')
      };
    }
  }
];

// ── Slot assignment ─────────────────────────────────────────────────────────
const lock = fs.existsSync(LOCK) ? readJson(LOCK) : { _note: '', slots: {} };
lock._note = 'Permanent slot per card. SR keys and share codes are POSITIONAL, so a card must never move once issued — new cards append. Generated by tools/build-component-cards.js; do not hand-edit.';
lock.slots = lock.slots || {};

const decks = [];
const skipped = [];
// Components whose domain noun IS their name ("Work Queue", "Tenant Isolation")
// cannot have a selection signal that avoids saying so. Reported rather than
// hidden: the card is still worth drilling, it is just easier than the others,
// and knowing which ones those are is what would drive a catalog rewrite later.
const selfNaming = [];

for (const cat of CATALOG.categories) {
  const comps = CATALOG.components.filter(c => c.category === cat.id);
  const built = [];
  for (const c of comps) {
    for (const t of TEMPLATES) {
      const q = t.build(c);
      if (!q) { skipped.push(`${c.id}#${t.id}`); continue; }
      if (q.points.length < MIN_POINTS) { skipped.push(`${c.id}#${t.id}`); continue; }
      built.push({ cardId: `${c.id}#${t.id}`, q: { type: 'open', ...q } });
    }
  }
  decks.push({ cat, built });
}

// Assign slots deck by deck: existing cards keep theirs, new ones append.
for (const d of decks) {
  const slots = lock.slots[d.cat.id] || (lock.slots[d.cat.id] = {});
  let next = Object.values(slots).reduce((m, n) => Math.max(m, n + 1), 0);
  for (const item of d.built) if (!(item.cardId in slots)) slots[item.cardId] = next++;
  d.built.sort((a, b) => slots[a.cardId] - slots[b.cardId]);
  // A card whose source material disappeared leaves a hole rather than pulling
  // everything after it forward — same reason the slots exist at all.
  const live = new Set(d.built.map(i => i.cardId));
  d.retired = Object.keys(slots).filter(id => !live.has(id));
}

// ── Emit ────────────────────────────────────────────────────────────────────
const written = [];
let stale = 0;
function emit(rel, contents) {
  const abs = path.join(OUT, rel);
  const prev = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (prev !== contents) {
    stale++;
    if (!CHECK) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, contents); }
  }
  written.push(rel);
}

const unitId = i => `c${String(i + 1).padStart(2, '0')}`;
const chapters = [];
let totalCards = 0;

decks.forEach((d, i) => {
  const id = unitId(i);
  const comps = CATALOG.components.filter(c => c.category === d.cat.id);
  const unit = {
    id,
    num: i + 1,
    part: 'Component decks',
    title: d.cat.title,
    summary: `${d.cat.blurb} ${comps.length} building blocks drilled by recall: the signal that says reach for one, ` +
      `what it costs, how it breaks, which sibling rules it out, and what it is doing across the canonical problems.`,
    keyTakeaways: comps.slice(0, Math.max(3, Math.min(7, comps.length))).map(c => `${c.title} — ${c.what}`),
    questions: d.built.map(x => x.q)
  };
  if (unit.questions.length < MIN_QUESTIONS) {
    console.error(`  ✗ ${id} (${d.cat.title}) has ${unit.questions.length} cards, below the ${MIN_QUESTIONS} minimum`);
    process.exitCode = 1;
  }
  totalCards += unit.questions.length;
  chapters.push({ id, num: i + 1, title: d.cat.title, questions: unit.questions.length });
  emit(`${id}.json`, JSON.stringify(unit, null, 2) + '\n');
});

const manifest = {
  topic: 'component-cards',
  title: 'Component Flash Cards',
  subtitle: 'Recall drill over the component catalog',
  author: '',
  unitLabel: 'Deck',
  unitAbbrev: 'Deck',
  description: 'The catalog, tested rather than read. Every card is derived from a component you can already ' +
    'browse — the signal that says reach for it, what it costs, how it breaks, which sibling to rule out, and ' +
    'what it is doing in each canonical design problem.',
  parts: [{ name: 'Component decks', chapters: chapters.map(c => c.id) }],
  chapters
};
emit('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
emit('order.lock.json', JSON.stringify(lock, null, 2) + '\n');

// Stale files from a category that was removed.
if (fs.existsSync(OUT)) {
  for (const f of fs.readdirSync(OUT)) {
    if (!written.includes(f)) {
      console.error(`  ✗ stale file ${f} — a category was removed; delete it deliberately`);
      process.exitCode = 1;
    }
  }
}

const retired = decks.flatMap(d => d.retired || []);
if (CHECK) {
  if (stale) {
    console.error(`\n✗ ${stale} component-card file(s) out of date — run: node tools/build-component-cards.js`);
    process.exit(1);
  }
  console.log(`✓ component cards up to date (${chapters.length} decks, ${totalCards} cards)`);
} else {
  console.log(`✓ wrote ${chapters.length} decks, ${totalCards} cards from ${CATALOG.components.length} components`);
  if (skipped.length) {
    console.log(`  note: ${skipped.length} card(s) not emitted — source material below the ${MIN_POINTS}-point bar, ` +
      `padding a rubric to clear it is how filler gets made (${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? ', …' : ''})`);
  }
  if (retired.length) console.log(`  note: ${retired.length} slot(s) retired, held open so later cards keep their positions`);
  if (selfNaming.length) {
    console.log(`  note: ${selfNaming.length} selection card(s) name their own answer in the prompt — their domain noun IS ` +
      `the component name (${selfNaming.join(', ')}); an easier card, not a broken one`);
  }
}
