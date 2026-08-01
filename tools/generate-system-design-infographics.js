#!/usr/bin/env node
// Generate one deterministic, downloadable PNG infographic for every lesson in
// Building Blocks, DDIA, and Canonical Design Problems. Technical copy stays in
// source control; this script composes it into a consistent review sheet and
// rasterizes the result. No image-model text is used in production assets.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data/system-design');
const OUT = path.join(ROOT, 'assets/system-design/infographics');
const SPECS = JSON.parse(fs.readFileSync(path.join(DATA, 'infographic-specs.json'), 'utf8'));
const WIDTH = 1600;
const HEIGHT = 2000;

const C = {
  bg: '#111318', grid: '#1b2028', surface: '#1b1e24', panel: '#22262d',
  line: '#39404a', accent: '#f5b62b', accentSoft: '#342a12',
  text: '#f4f5f7', muted: '#a7adb7', cool: '#70d6cf'
};

const ROLE = {
  overview: 'SYSTEM MAP',
  'request-flow': 'CORE REQUEST PATH',
  mechanism: 'SIGNATURE MECHANISM',
  comparison: 'KEY DESIGN CHOICE',
  failure: 'FAILURE & RECOVERY',
  lifecycle: 'STATE LIFECYCLE'
};

function xml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[c]));
}

function wrap(value, maxChars, maxLines = Infinity) {
  const words = String(value).trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = kept[maxLines - 1].replace(/[.,;:]?$/, '…');
  return kept;
}

function svgText(lines, x, y, size, lineHeight, attrs = '') {
  return `<text x="${x}" y="${y}" font-size="${size}" ${attrs}>${lines.map((line, i) =>
    `<tspan x="${x}" dy="${i ? lineHeight : 0}">${xml(line)}</tspan>`).join('')}</text>`;
}

function cleanLabel(shape, fallback) {
  if (!shape) return fallback;
  let value = shape;
  const wrappers = [
    [/^\[\[(.*)\]\]$/s, '$1'], [/^\[\((.*)\)\]$/s, '$1'],
    [/^\(\[(.*)\]\)$/s, '$1'], [/^\{\{(.*)\}\}$/s, '$1'],
    [/^\{(.*)\}$/s, '$1'], [/^\[(.*)\]$/s, '$1']
  ];
  for (const [pattern, replacement] of wrappers) {
    if (pattern.test(value)) { value = value.replace(pattern, replacement); break; }
  }
  value = value.replace(/^\((.*)\)$/s, '$1').replace(/^"(.*)"$/s, '$1');
  return value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/\s+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
}

function nodeKind(shape = '') {
  if (/^\[\(/.test(shape)) return 'database';
  if (/^\[\[/.test(shape)) return 'queue';
  if (/^\{/.test(shape)) return 'decision';
  if (/^\(\[/.test(shape)) return 'client';
  return 'service';
}

function parseFlowchart(code) {
  const lines = code.trim().split('\n');
  const direction = /flowchart\s+TD/.test(lines[0]) ? 'TB' : 'LR';
  const token = '([A-Za-z][\\w-]*)(\\{\\{.*?\\}\\}|\\[\\[.*?\\]\\]|\\[\\(.*?\\)\\]|\\(\\[.*?\\]\\)|\\{.*?\\}|\\[.*?\\])?';
  const edgePattern = new RegExp(`^\\s*${token}\\s+(-\\.->|-->)\\s*(?:\\|([^|]+)\\|\\s*)?${token}\\s*$`);
  const nodePattern = new RegExp(`^\\s*${token}\\s*$`);
  const nodes = new Map();
  const edges = [];

  function addNode(id, shape) {
    const existing = nodes.get(id);
    if (!existing || shape) nodes.set(id, {
      id, label: cleanLabel(shape, existing ? existing.label : id),
      kind: shape ? nodeKind(shape) : (existing ? existing.kind : 'service')
    });
  }

  for (const line of lines.slice(1)) {
    const edge = line.match(edgePattern);
    if (edge) {
      const [, from, fromShape, style, labelRaw, to, toShape] = edge;
      addNode(from, fromShape); addNode(to, toShape);
      edges.push({ from, to, dashed: style === '-.->', label: (labelRaw || '').replace(/^"|"$/g, '') });
      continue;
    }
    const node = line.match(nodePattern);
    if (node) addNode(node[1], node[2]);
  }
  if (nodes.size < 3 || edges.length < 2) throw new Error(`Could not parse architecture graph (${nodes.size} nodes, ${edges.length} edges)`);
  return { direction, nodes: [...nodes.values()], edges };
}

function nodeSize(node) {
  const lines = node.label.split('\n').flatMap(line => wrap(line, 20, 2));
  const longest = Math.max(...lines.map(line => line.length), 6);
  return { lines, width: Math.min(300, Math.max(170, longest * 13 + 54)), height: Math.max(88, lines.length * 31 + 40) };
}

function nodeShape(node, layoutNode) {
  const { x, y, width, height, lines } = layoutNode;
  const left = x - width / 2, top = y - height / 2;
  let shape;
  if (node.kind === 'decision') {
    const points = `${x},${top} ${left + width},${y} ${x},${top + height} ${left},${y}`;
    shape = `<polygon points="${points}" fill="${C.panel}" stroke="${C.accent}" stroke-width="3"/>`;
  } else {
    const radius = node.kind === 'client' ? 40 : 18;
    shape = `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${radius}" fill="${C.panel}" stroke="${C.accent}" stroke-width="3"/>`;
    if (node.kind === 'queue') {
      shape += `<line x1="${left + 13}" y1="${top + 12}" x2="${left + 13}" y2="${top + height - 12}" stroke="${C.muted}" stroke-width="2"/>
        <line x1="${left + width - 13}" y1="${top + 12}" x2="${left + width - 13}" y2="${top + height - 12}" stroke="${C.muted}" stroke-width="2"/>`;
    }
    if (node.kind === 'database') {
      shape += `<path d="M ${left + 18} ${top + 19} Q ${x} ${top + 4} ${left + width - 18} ${top + 19}" fill="none" stroke="${C.muted}" stroke-width="2"/>
        <path d="M ${left + 18} ${top + height - 19} Q ${x} ${top + height - 4} ${left + width - 18} ${top + height - 19}" fill="none" stroke="${C.muted}" stroke-width="2"/>`;
    }
  }
  const startY = y - ((lines.length - 1) * 29) / 2 + 8;
  return `<g>${shape}${svgText(lines, x, startY, 22, 29, `text-anchor="middle" font-weight="700" fill="${C.text}"`)}</g>`;
}

async function renderArchitecture(code, graphlib, layout) {
  const parsed = parseFlowchart(code);
  const graph = new graphlib.Graph({ multigraph: true })
    .setGraph({ rankdir: parsed.direction, ranksep: 95, nodesep: 54, edgesep: 30, marginx: 30, marginy: 30 })
    .setDefaultEdgeLabel(() => ({}));
  const byId = new Map(parsed.nodes.map(node => [node.id, node]));
  for (const node of parsed.nodes) {
    const size = nodeSize(node);
    graph.setNode(node.id, { ...size, width: size.width, height: size.height });
  }
  parsed.edges.forEach((edge, index) => graph.setEdge(
    edge.from, edge.to,
    { ...edge, width: edge.label ? Math.max(80, edge.label.length * 12) : 0, height: edge.label ? 28 : 0 },
    `edge-${index}`
  ));
  layout(graph);
  const meta = graph.graph();
  const edgeSvg = graph.edges().map(ref => {
    const edge = graph.edge(ref);
    const points = edge.points.map(p => `${p.x},${p.y}`).join(' ');
    const label = edge.label ? `<g><rect x="${edge.x - edge.width / 2 - 7}" y="${edge.y - 18}" width="${edge.width + 14}" height="30" rx="8" fill="${C.bg}"/>
      <text x="${edge.x}" y="${edge.y + 3}" text-anchor="middle" font-size="17" font-weight="700" fill="${C.accent}">${xml(edge.label)}</text></g>` : '';
    return `<g><polyline points="${points}" fill="none" stroke="${C.muted}" stroke-width="3" ${edge.dashed ? 'stroke-dasharray="10 8"' : ''} marker-end="url(#arch-arrow)"/>${label}</g>`;
  }).join('');
  const nodeSvg = parsed.nodes.map(node => nodeShape(node, graph.node(node.id))).join('');
  return `<svg x="112" y="392" width="1376" height="660" viewBox="0 0 ${meta.width} ${meta.height}" preserveAspectRatio="xMidYMid meet">
    <defs><marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${C.muted}"/></marker></defs>
    ${edgeSvg}${nodeSvg}
  </svg>`;
}

function decisionCard(diagram, index, x, y) {
  const title = wrap(diagram.title, 34, 2);
  const takeaway = wrap(diagram.takeaway, 51, 4);
  const titleY = y + 54;
  const takeawayY = titleY + (title.length - 1) * 34 + 48;
  return `
    <g>
      <rect x="${x}" y="${y}" width="680" height="230" rx="24" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
      <circle cx="${x + 48}" cy="${y + 48}" r="25" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="2"/>
      <text x="${x + 48}" y="${y + 57}" text-anchor="middle" font-size="24" font-weight="800" fill="${C.accent}">${index + 1}</text>
      <text x="${x + 88}" y="${y + 31}" font-size="16" font-weight="800" letter-spacing="2" fill="${C.accent}">${xml(diagram.roleLabel || ROLE[diagram.role] || 'DESIGN DECISION')}</text>
      ${svgText(title, x + 88, titleY, 27, 34, `font-weight="700" fill="${C.text}"`)}
      ${svgText(takeaway, x + 34, takeawayY, 21, 30, `fill="${C.muted}"`)}
    </g>`;
}

function compose(problem, diagramSvg, options = {}) {
  const title = problem.title.replace(/^Design a /, '');
  const titleLines = wrap(title, 34, 2);
  const constraint = wrap(problem.keyTakeaways[0], 82, 3);
  const overview = problem.diagrams.find(d => d.role === 'overview') || problem.diagrams[0];
  const cards = problem.diagrams.map((d, i) => decisionCard(
    d, i, i % 2 === 0 ? 80 : 840, i < 2 ? 1245 : 1490
  )).join('');
  const tradeoff = wrap(options.tradeoff || problem.diagrams[problem.diagrams.length - 1].takeaway, 92, 2);
  const eyebrow = options.eyebrow || 'FINAL INTERVIEW WHITEBOARD';
  const mapTitle = options.mapTitle || overview.title;
  const footer = options.footer || `JS DRILL · SYSTEM DESIGN · ${problem.id.toUpperCase()}`;
  const studyLens = options.studyLens || 'ARCHITECTURE · MECHANISM · SCALE · FAILURE';
  const sectionRole = options.sectionRole || ROLE[overview.role] || 'SYSTEM MAP';
  const timePrompt = options.timePrompt || 'EXPLAIN IN 2 MINUTES';
  const coreLabel = options.coreLabel || 'CORE INVARIANT';

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <path d="M 32 0 L 0 0 0 32" fill="none" stroke="${C.grid}" stroke-width="1"/>
      </pattern>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.28"/>
      </filter>
    </defs>
    <rect width="1600" height="2000" fill="${C.bg}"/>
    <rect width="1600" height="2000" fill="url(#grid)"/>

    <rect x="52" y="48" width="1496" height="226" rx="30" fill="${C.surface}" stroke="${C.accent}" stroke-width="2" filter="url(#shadow)"/>
    <rect x="86" y="83" width="72" height="72" rx="18" fill="${C.accent}"/>
    <text x="122" y="132" text-anchor="middle" font-size="28" font-weight="900" fill="${C.bg}">${xml(problem.id.toUpperCase())}</text>
    <text x="190" y="104" font-size="17" font-weight="800" letter-spacing="3" fill="${C.accent}">${xml(eyebrow)}</text>
    ${svgText(titleLines, 190, 156, 48, 54, `font-weight="800" fill="${C.text}"`)}
    <text x="1495" y="104" text-anchor="end" font-size="18" font-weight="700" fill="${C.muted}">${xml(timePrompt)}</text>

    <rect x="80" y="304" width="1440" height="790" rx="30" fill="${C.surface}" stroke="${C.line}" stroke-width="2" filter="url(#shadow)"/>
    <text x="116" y="356" font-size="17" font-weight="800" letter-spacing="3" fill="${C.accent}">${xml(sectionRole)}</text>
    <text x="1484" y="356" text-anchor="end" font-size="17" font-weight="700" fill="${C.muted}">${xml(mapTitle.toUpperCase())}</text>
    <line x1="116" y1="378" x2="1484" y2="378" stroke="${C.line}" stroke-width="2"/>
    ${diagramSvg}

    <rect x="80" y="1122" width="1440" height="105" rx="18" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="2"/>
    <text x="112" y="1153" font-size="15" font-weight="800" letter-spacing="2" fill="${C.accent}">${xml(coreLabel)}</text>
    ${svgText(constraint, 300, 1155, 21, 28, `font-weight="600" fill="${C.text}"`)}

    ${cards}

    <rect x="80" y="1740" width="1440" height="160" rx="24" fill="${C.surface}" stroke="${C.line}" stroke-width="2"/>
    <rect x="80" y="1740" width="12" height="160" rx="6" fill="${C.accent}"/>
    <text x="122" y="1782" font-size="16" font-weight="800" letter-spacing="3" fill="${C.accent}">CORE TRADEOFF</text>
    ${svgText(tradeoff, 122, 1827, 25, 35, `font-weight="650" fill="${C.text}"`)}

    <text x="80" y="1960" font-size="16" font-weight="800" letter-spacing="2" fill="${C.muted}">${xml(footer)}</text>
    <text x="1520" y="1960" text-anchor="end" font-size="16" font-weight="700" fill="${C.cool}">${xml(studyLens)}</text>
  </svg>`;
}

function renderConceptArchitecture(spec) {
  const xs = [150, 505, 860, 1215];
  const ys = [170, 430, 170, 430];
  const width = 275, height = 142;
  const edges = spec.flowLabels.map((label, index) => {
    const fromX = xs[index] + width / 2;
    const fromY = ys[index];
    const toX = xs[index + 1] - width / 2;
    const toY = ys[index + 1];
    const bendX = (fromX + toX) / 2;
    const bendY = (fromY + toY) / 2;
    const labelLines = wrap(label, 22, 2);
    return `<g>
      <path d="M ${fromX} ${fromY} C ${bendX} ${fromY}, ${bendX} ${toY}, ${toX} ${toY}" fill="none" stroke="${C.muted}" stroke-width="4" marker-end="url(#concept-arrow)"/>
      <rect x="${bendX - 102}" y="${bendY - 31}" width="204" height="62" rx="15" fill="${C.bg}" stroke="${C.line}" stroke-width="2"/>
      ${svgText(labelLines, bendX, bendY - (labelLines.length - 1) * 12 + 6, 17, 25, `text-anchor="middle" font-weight="700" fill="${C.accent}"`)}
    </g>`;
  }).join('');
  const nodes = spec.flow.map((label, index) => {
    const lines = wrap(label, 18, 3);
    const x = xs[index], y = ys[index], left = x - width / 2, top = y - height / 2;
    const stroke = index % 2 ? C.cool : C.accent;
    return `<g>
      <rect x="${left}" y="${top}" width="${width}" height="${height}" rx="25" fill="${C.panel}" stroke="${stroke}" stroke-width="4"/>
      <circle cx="${left + 36}" cy="${top + 36}" r="23" fill="${index % 2 ? '#12302f' : C.accentSoft}" stroke="${stroke}" stroke-width="2"/>
      <text x="${left + 36}" y="${top + 44}" text-anchor="middle" font-size="22" font-weight="900" fill="${stroke}">${index + 1}</text>
      <text x="${left + 73}" y="${top + 33}" font-size="14" font-weight="800" letter-spacing="2" fill="${C.muted}">STEP ${index + 1}</text>
      ${svgText(lines, x, y + 18 - (lines.length - 1) * 15, 24, 31, `text-anchor="middle" font-weight="750" fill="${C.text}"`)}
    </g>`;
  }).join('');
  return `<svg x="112" y="392" width="1376" height="660" viewBox="0 0 1376 600" preserveAspectRatio="xMidYMid meet">
    <defs><marker id="concept-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="${C.muted}"/></marker></defs>
    <path d="M 35 62 H 1341" stroke="${C.line}" stroke-width="2" stroke-dasharray="8 10"/>
    <text x="35" y="43" font-size="15" font-weight="800" letter-spacing="3" fill="${C.muted}">TRACE THE IDEA LEFT TO RIGHT</text>
    ${edges}${nodes}
  </svg>`;
}

function conceptLesson(chapter, topic, spec) {
  const topicName = topic === 'ddia' ? 'DESIGNING DATA-INTENSIVE APPLICATIONS' : 'SYSTEM DESIGN BUILDING BLOCK';
  const diagrams = spec.cards.map((card, index) => ({
    role: ['mechanism', 'comparison', 'failure', 'lifecycle'][index],
    title: card.title,
    takeaway: card.body,
    roleLabel: 'REVIEW POINT'
  }));
  return {
    problem: { ...chapter, diagrams, keyTakeaways: [spec.coreIdea] },
    options: {
      eyebrow: `${topicName} · QUICK REVIEW`,
      mapTitle: 'Core mental model',
      sectionRole: 'MENTAL MODEL',
      timePrompt: 'RECALL IN 2 MINUTES',
      coreLabel: 'CORE IDEA',
      tradeoff: spec.tradeoff,
      footer: `JS DRILL · ${topic === 'ddia' ? 'DDIA' : 'BUILDING BLOCKS'} · ${chapter.id.toUpperCase()}`,
      studyLens: topic === 'ddia'
        ? 'MODEL · GUARANTEE · FAILURE · TRADEOFF'
        : 'ROLE · MECHANISM · FAILURE · OPERATIONS'
    }
  };
}

function exportPng(source, raster, output, id) {
  let valid = false;
  for (let attempt = 1; attempt <= 4 && !valid; attempt++) {
    fs.rmSync(raster, { force: true });
    execFileSync('inkscape', [source, '--export-type=png', `--export-filename=${raster}`, `--export-width=${WIDTH}`], { stdio: 'pipe' });
    try { execFileSync('convert', [raster, 'null:'], { stdio: 'pipe' }); valid = true; }
    catch (error) { if (attempt === 4) throw new Error(`${id} PNG failed decode after ${attempt} exports`); }
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(raster, output);
}

async function main() {
  const { graphlib } = await import('dagre-d3-es');
  const { layout } = await import('dagre-d3-es/src/dagre/layout.js');

  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jsdrill-infographics-'));
  let count = 0;

  // These topic directories are generated output. Rebuilding them prevents
  // stale lesson images from silently surviving a manifest change.
  for (const topic of ['components', 'ddia', 'design-problems']) {
    fs.rmSync(path.join(OUT, topic), { recursive: true, force: true });
  }
  // Migrate the first release's flat design-problem files into topic folders.
  for (let n = 1; n <= 17; n++) fs.rmSync(path.join(OUT, `p${String(n).padStart(2, '0')}.png`), { force: true });

  for (const topic of ['components', 'ddia']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(DATA, topic, 'manifest.json'), 'utf8'));
    for (const entry of manifest.chapters) {
      const chapter = JSON.parse(fs.readFileSync(path.join(DATA, topic, `${entry.id}.json`), 'utf8'));
      const spec = SPECS[`${topic}/${entry.id}`];
      if (!spec) throw new Error(`Missing infographic spec for ${topic}/${entry.id}`);
      const diagramSvg = renderConceptArchitecture(spec);
      const { problem, options } = conceptLesson(chapter, topic, spec);
      const source = path.join(tmp, `${topic}-${entry.id}.svg`);
      const raster = path.join(tmp, `${topic}-${entry.id}.png`);
      const output = path.join(OUT, topic, `${entry.id}.png`);
      fs.writeFileSync(source, compose(problem, diagramSvg, options));
      exportPng(source, raster, output, `${topic}/${entry.id}`);
      count++;
      console.log(`  ✓ ${path.relative(ROOT, output)}`);
    }
  }

  for (let n = 1; n <= 17; n++) {
    const id = `p${String(n).padStart(2, '0')}`;
    const problem = JSON.parse(fs.readFileSync(path.join(DATA, 'design-problems', `${id}.json`), 'utf8'));
    const overview = problem.diagrams.find(d => d.role === 'overview') || problem.diagrams[0];
    const svg = await renderArchitecture(overview.code, graphlib, layout);
    const source = path.join(tmp, `${id}.svg`);
    const raster = path.join(tmp, `${id}.png`);
    const output = path.join(OUT, 'design-problems', `${id}.png`);
    fs.writeFileSync(source, compose(problem, svg));
    exportPng(source, raster, output, `design-problems/${id}`);
    count++;
    console.log(`  ✓ ${path.relative(ROOT, output)}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Generated ${count} system-design infographic PNGs (${WIDTH}×${HEIGHT}).`);
}

main().catch(error => { console.error(error); process.exit(1); });
