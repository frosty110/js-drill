#!/usr/bin/env node
// Compile the existing reviewed lesson material into explicit multi-sheet study
// guides. This is intentionally separate from raster rendering: copy is built
// and reviewed first, then the registered guides become downloadable PNGs.
// Sets whose reviewed static artwork is already registered are preserved.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data/system-design');
const PLAN_FILE = path.join(DATA, 'infographic-plan.json');
const SETS_FILE = path.join(DATA, 'infographic-sets.json');
const SPECS_FILE = path.join(DATA, 'infographic-specs.json');

const PLAN = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8')).lessons;
const SPECS = JSON.parse(fs.readFileSync(SPECS_FILE, 'utf8'));
const document = JSON.parse(fs.readFileSync(SETS_FILE, 'utf8'));
const existing = document.sets || {};

const STOP = new Set('a an and are as at be by for from how in into is it of on or the this through to vs with'.split(' '));
const GENERIC_NUMBERS = {
  components: [
    {label: 'Tail objective', value: 'p99 SLO', detail: 'Design and alert on the slow-user experience, not the mean.'},
    {label: 'Traffic model', value: 'peak QPS', detail: 'Size for bursts, retries, fan-out, and failure headroom.'},
    {label: 'Availability', value: 'error budget', detail: 'State the tolerated failure rate before choosing coordination.'}
  ],
  ddia: [
    {label: 'User experience', value: 'p50 / p95 / p99', detail: 'Percentiles expose queues and tail amplification.'},
    {label: 'Durability', value: 'RPO / RTO', detail: 'Quantify acceptable loss and recovery time.'},
    {label: 'Correctness', value: 'invariant first', detail: 'Name the guarantee before selecting a mechanism.'}
  ],
  'design-problems': [
    {label: 'Demand', value: 'peak QPS', detail: 'Separate reads, writes, fan-out, and retry amplification.'},
    {label: 'Data', value: 'items/day × bytes', detail: 'Estimate retention, replication, indexes, and cache footprint.'},
    {label: 'Reliability', value: 'SLO + RPO/RTO', detail: 'Turn availability, loss, and recovery into explicit targets.'}
  ]
};

const KIND_BY_ID = [
  [/overview|map|ecosystem|hierarchy|models|topologies|selection|strategies/, 'System map'],
  [/compare|vs-|comparison|style|protocol|primitive/, 'Comparison'],
  [/failure|recovery|repair|failover|retry|dlq|backpressure|rebalancing/, 'Failure and recovery'],
  [/read|query|search|download|playback|feed/, 'Read flow'],
  [/write|create|upload|publish|send|update|purchase|payment|refill/, 'Write flow'],
  [/consistency|ordering|isolation|serial|conflict|quorum|transaction|correctness/, 'Correctness flow'],
  [/scale|capacity|hot|partition|distributed|latency/, 'Scale and trade-offs']
];

function words(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').split(/\s+/).filter(word => word && !STOP.has(word));
}

function titleCase(id) {
  const keep = new Map([['acid','ACID'],['api','API'],['cdn','CDN'],['cdc','CDC'],['crdt','CRDT'],['dlq','DLQ'],['l4','L4'],['l7','L7'],['oltp','OLTP'],['olap','OLAP'],['rpc','RPC'],['slo','SLO'],['ttl','TTL'],['2pc','2PC']]);
  return id.split('-').map(word => keep.get(word) || word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function sentences(value) {
  return String(value || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 28);
}

function allStrings(value, output = []) {
  if (typeof value === 'string') output.push(...sentences(value));
  else if (Array.isArray(value)) value.forEach(item => allStrings(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => allStrings(item, output));
  return output;
}

function unique(values) {
  const seen = new Set();
  return values.filter(value => {
    const key = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function score(sentence, queryWords) {
  const haystack = new Set(words(sentence));
  return queryWords.reduce((total, word) => total + (haystack.has(word) ? 4 : 0), 0)
    + (/\b(but|while|trade-?off|cost|however|versus|instead)\b/i.test(sentence) ? 1 : 0)
    + (/\b\d|p\d\d|qps|rpo|rto|ttl|slo|r\s*\+\s*w/i.test(sentence) ? 1 : 0);
}

function best(sentencesList, id, count = 6) {
  const query = words(id);
  return unique(sentencesList).map((sentence, index) => ({sentence, index, score: score(sentence, query)}))
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, count).map(item => item.sentence);
}

function shortTitle(sentence, fallback) {
  const clean = sentence.replace(/^[-•\d.\s]+/, '').split(/[:;—–]/)[0].replace(/\([^)]{30,}\)/g, '').trim();
  const selected = clean.split(/\s+/).slice(0, 5).join(' ').replace(/[,.]$/, '');
  return selected.length >= 5 ? selected : fallback;
}

function clip(sentence, max = 220) {
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max - 1).replace(/\s+\S*$/, '');
  return `${cut}.`;
}

function flowFromSpec(spec) {
  return spec.flow.map((node, index) => ({
    step: index + 1,
    title: node,
    detail: index < spec.flowLabels.length
      ? `${spec.flowLabels[index]}; then continue to ${spec.flow[index + 1]}.`
      : `Observe the result, enforce the contract, and feed failures back into the design.`
  }));
}

function flowFromSources(sources, fallbackFlow) {
  const selected = unique(sources).slice(0, 5);
  if (selected.length < 3) return fallbackFlow;
  return selected.map((sentence, index) => ({step: index + 1, title: shortTitle(sentence, `Stage ${index + 1}`), detail: clip(sentence)}));
}

function extractNumberValue(sentence) {
  const patterns = [
    /\b(?:p50|p95|p99|p999|HTTP\s+\d{3}|\d+(?:\.\d+)?\s*(?:ms|s|sec|seconds?|minutes?|hours?|days?|%|×|x|QPS|RPS|TPS|GB|TB|PB|MB|KB|nodes?|replicas?|regions?|writes?|reads?))\b/i,
    /\b(?:R\s*\+\s*W\s*>\s*N|W\s*\+\s*R\s*>\s*N|n\s*=\s*\d+|w\s*=\s*\d+|r\s*=\s*\d+|RPO|RTO|SLO|TTL|429|301|302|2PC|ACID)\b/i
  ];
  for (const pattern of patterns) { const match = sentence.match(pattern); if (match) return match[0]; }
  return null;
}

function numbersFor(chapter, id, topic, sourcePool) {
  const ranked = best(sourcePool.filter(sentence => extractNumberValue(sentence)), id, 6);
  const found = [];
  for (const sentence of ranked) {
    const value = extractNumberValue(sentence);
    if (!value || found.some(item => item.value.toLowerCase() === value.toLowerCase())) continue;
    found.push({label: shortTitle(sentence, 'Operating assumption'), value, detail: clip(sentence, 150)});
    if (found.length === 3) break;
  }
  return [...found, ...GENERIC_NUMBERS[topic]].slice(0, 3);
}

function prioritiesFor(sources, spec) {
  const candidates = unique([
    ...(spec && spec.cards ? spec.cards.map(card => card.title) : []),
    ...sources.map(sentence => shortTitle(sentence, 'Correctness')),
    'Observable failure behavior', 'Bounded operational complexity'
  ]);
  return candidates.slice(0, 4);
}

function tradeoffsFor(sources, spec) {
  const candidates = unique([
    ...(spec && spec.tradeoff ? [spec.tradeoff] : []),
    ...sources.filter(sentence => /\b(but|while|cost|trade-?off|instead|versus|sacrifice|risk)\b/i.test(sentence)),
    'More coordination improves correctness but adds latency and reduces availability during partial failure.',
    'More precomputation lowers read latency but increases write amplification, storage, and invalidation work.'
  ]);
  return candidates.slice(0, 3).map(sentence => clip(sentence, 230));
}

function kindFor(id, index) {
  if (index === 0 || id === 'overview') return 'System map';
  const match = KIND_BY_ID.find(([pattern]) => pattern.test(id));
  return match ? match[1] : 'Focused mechanism';
}

function problemDiagramSources(chapter, index) {
  if (!Array.isArray(chapter.diagrams) || !chapter.diagrams.length) return [];
  const diagram = chapter.diagrams[Math.min(index, chapter.diagrams.length - 1)];
  return unique([diagram.title, diagram.takeaway]);
}

function questionFacts(questions) {
  return (questions || []).flatMap(question => question.type === 'open'
    ? [...(question.points || []), question.answer]
    : [question.explain]
  ).filter(Boolean).flatMap(sentences);
}

function mermaidFlow(diagram) {
  if (!diagram || diagram.kind !== 'mermaid' || !diagram.code) return [];
  const labels = [];
  const shapePattern = /\b[A-Za-z][\w-]*(?:\[\[([^\]]+)\]\]|\[\(([^\)]+)\)\]|\(\[([^\]]+)\]\)|\{\{([^}]+)\}\}|\{([^}]+)\}|\[([^\]]+)\])/g;
  for (const line of diagram.code.split('\n')) {
    let match;
    while ((match = shapePattern.exec(line))) {
      const label = match.slice(1).find(Boolean);
      if (label && !labels.includes(label)) labels.push(label.replace(/<br\s*\/?>/gi, ' / ').replace(/^"|"$/g, '').trim());
    }
  }
  return labels.slice(0, 6).map((label, index) => ({
    step: index + 1,
    title: shortTitle(label, `Stage ${index + 1}`),
    detail: `${label}${index < labels.length - 1 ? `; then continue to ${labels[index + 1]}.` : '; verify the result and expose the outcome.'}`
  }));
}

function buildSet(key, plan) {
  const [topic, id] = key.split('/');
  const chapter = JSON.parse(fs.readFileSync(path.join(DATA, topic, `${id}.json`), 'utf8'));
  const spec = SPECS[key];
  const pool = unique([
    chapter.summary,
    ...(chapter.keyTakeaways || []),
    ...questionFacts(chapter.questions),
    ...(chapter.diagrams || []).flatMap(diagram => [diagram.title, diagram.takeaway]).filter(Boolean),
    ...(spec ? [spec.coreIdea, spec.tradeoff, ...spec.cards.flatMap(card => [card.title, card.body])] : [])
  ]);
  const fallbackFlow = spec ? flowFromSpec(spec) : (chapter.diagrams || []).slice(0, 5).map((diagram, index) => ({
    step: index + 1, title: diagram.title, detail: diagram.takeaway
  }));

  const items = plan.graphics.map((graphicId, index) => {
    const title = graphicId === 'overview' ? `${chapter.title.replace(/^Design a /, '')} system map` : titleCase(graphicId);
    const diagramSources = topic === 'design-problems' ? problemDiagramSources(chapter, index) : [];
    const focused = best([...diagramSources, ...pool], graphicId, 7);
    const problemDiagram = topic === 'design-problems' && chapter.diagrams ? chapter.diagrams[Math.min(index, chapter.diagrams.length - 1)] : null;
    const diagramFlow = mermaidFlow(problemDiagram);
    const flow = index === 0
      ? (spec ? flowFromSpec(spec) : fallbackFlow)
      : (diagramFlow.length >= 3 ? diagramFlow : flowFromSources(focused, fallbackFlow));
    const descriptionSource = focused.find(sentence => sentence.length >= 60) || chapter.summary;
    const description = clip(descriptionSource, 300);
    return {
      id: graphicId,
      kind: kindFor(graphicId, index),
      title,
      purpose: `Give ${title.toLowerCase()} enough room to trace independently, including scale, failure behavior, and the decision-driving trade-offs.`,
      description,
      width: 1440,
      height: 2400,
      renderer: 'diagram-v1',
      flow,
      numbers: numbersFor(chapter, graphicId, topic, [...focused, ...pool]),
      priorities: prioritiesFor(focused, spec),
      tradeoffs: tradeoffsFor([...focused, ...pool], spec)
    };
  });

  return {
    title: `${chapter.title} visual study set`,
    summary: `${items.length} focused sheets separate the system map from the mechanisms, hot paths, scale limits, and failure decisions that need their own reading space.`,
    items
  };
}

for (const [key, plan] of Object.entries(PLAN)) {
  const reviewedArtwork = existing[key] && existing[key].items && existing[key].items.every(item => !item.renderer);
  if (reviewedArtwork) continue;
  existing[key] = buildSet(key, plan);
}

const ordered = {};
for (const key of Object.keys(PLAN)) ordered[key] = existing[key];
fs.writeFileSync(SETS_FILE, `${JSON.stringify({...document, sets: ordered}, null, 2)}\n`);

const lessonCount = Object.keys(ordered).length;
const graphicCount = Object.values(ordered).reduce((sum, set) => sum + set.items.length, 0);
console.log(`Authored ${lessonCount} multi-infographic study sets with ${graphicCount} registered sheets.`);
