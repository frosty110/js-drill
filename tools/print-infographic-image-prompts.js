#!/usr/bin/env node
// Print content-specific image-generation briefs for the remaining templated
// infographic assets. One output record corresponds to exactly one PNG.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sets = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/system-design/infographic-sets.json'), 'utf8')).sets;
const offset = Number(process.argv[2] || 0);
const limit = Number(process.argv[3] || 4);

const archetypes = {
  'System map': 'Draw a true component topology. Make clients, gateways, services, data stores, caches, queues, workers, regions, and external systems recognizable. Use arrows to show the primary data and control paths.',
  'Read flow': 'Draw the read path through real components. Show success, cache hit/miss or lookup branches, fallbacks, returned data, and any asynchronous side effects.',
  'Write flow': 'Draw the write path through real components. Show validation, durable state changes, event publication, downstream work, acknowledgement boundaries, and retry/idempotency points.',
  'Comparison': 'Use a side-by-side or stacked architecture comparison. Each alternative needs its own topology, labeled differences, and a short decision guide.',
  'Correctness flow': 'Make the correctness mechanism visual through state transitions, transaction or concurrency timelines, version relationships, or invariant boundaries—not a generic process list.',
  'Failure and recovery': 'Show the normal architecture plus the concrete failure, retry, repair, failover, or compensation path. Use warning color only where failure actually occurs.',
  'Scale and trade-offs': 'Show how the system partitions, replicates, fans out, handles hot spots, or coordinates globally. Attach numbers to the constrained nodes and links.',
  'Focused mechanism': 'Choose the most explanatory system-design composition for this mechanism: topology, sequence, state transition, data path, or comparison. Do not fall back to a generic vertical timeline.'
};

function compact(value, max = 260) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

function promptFor(key, set, item) {
  const flow = item.flow.map(step => `${step.step}. ${step.title}: ${compact(step.detail, 180)}`).join('\n');
  const numbers = item.numbers.map(number => `- ${number.label}: ${number.value} — ${compact(number.detail, 130)}`).join('\n');
  const priorities = item.priorities.map(value => `• ${value}`).join('\n');
  const tradeoffs = item.tradeoffs.slice(0, 3).map(value => `• ${compact(value, 170)}`).join('\n');
  const archetype = archetypes[item.kind] || archetypes['Focused mechanism'];
  return `Use case: infographic-diagram
Asset type: downloadable system-design interview quick-review PNG
Input image: style reference only. Match its hand-drawn blackboard visual language, chalk lettering, colored outline icons, dashed and solid arrows, architecture-first density, and educational hierarchy. Do not copy its replication content.

Primary request: Create a portrait architecture infographic titled exactly "${item.title.toUpperCase()}". Lesson context: "${set.title}". ${archetype}

Core idea: ${compact(item.description, 320)}

Architecture or reasoning content to visualize:
${flow}

Scale and operating annotations to attach to the relevant components or links:
${numbers}

Supporting priorities:
${priorities}

Decision-driving trade-offs:
${tradeoffs}

Style/medium: polished hand-drawn chalkboard system-design infographic on a near-black textured background. White chalk title; cyan for data/replication paths; amber for writes or primary flow; green for reads/success; purple for asynchronous events or alternatives; coral only for failures, conflicts, or warnings. Draw system-specific outlined components and concise handwritten callouts.

Composition: the system drawing, comparison, state mechanism, or flow topology must occupy roughly 70% of the canvas and be understandable before reading the notes. Integrate numbers next to what they constrain. Put only short priorities, decision guidance, optimizations, and trade-offs in a subordinate bottom or side strip. Use 2–5 purposeful visual regions only when the mechanism truly has distinct branches.

Constraints: preserve technical meaning and spell the title and major component labels correctly. No browser chrome, app interface, dashboard, UI component cards, repeated generic timeline, metric-card grid, screenshot appearance, prose-heavy slide, photorealism, gradients, 3D rendering, or watermark. Do not simply typeset the supplied text; interpret it as a system-design drawing.`;
}

const pending = [];
for (const [key, set] of Object.entries(sets)) {
  for (const item of set.items) {
    if (item.renderer !== 'diagram-v1') continue;
    pending.push({key, id:item.id, prompt:promptFor(key, set, item)});
  }
}

console.log(JSON.stringify({total:pending.length, offset, items:pending.slice(offset, offset + limit)}));
