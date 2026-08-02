#!/usr/bin/env node
// Deterministically render legacy single-image lesson infographics as PNGs.
// Lessons registered in infographic-sets.json use authored multi-image raster
// sets instead, so this generator deliberately preserves and skips them.
// The output is intentionally diagram-first: reusable visual primitives, many
// lesson-specific compositions, very little prose, and no screenshot-like UI.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data/system-design');
const OUT = path.join(ROOT, 'assets/system-design/infographics');
const SPECS = JSON.parse(fs.readFileSync(path.join(DATA, 'infographic-specs.json'), 'utf8'));
const MULTI_SETS = JSON.parse(fs.readFileSync(path.join(DATA, 'infographic-sets.json'), 'utf8')).sets || {};
const WIDTH = 1600, HEIGHT = 2000;
// The design-problem whiteboard page has exactly four authored slots: one wide
// system map plus three focus columns, mirrored by the four "answer in four
// passes" checkpoints. Deriving the count from a constant keeps problemPage()
// and main() from drifting apart.
const MOMENTS_PER_PAGE = 4;

const C = {
  bg: '#101216', grid: '#1b2027', paper: '#171a20', line: '#3c434d',
  text: '#f4f1e8', muted: '#a9afb8', amber: '#f5b62b', amberDark: '#4a3710',
  cyan: '#62d5d0', cyanDark: '#123b3d', coral: '#f2765b', purple: '#a995e8',
  green: '#7bd88f'
};

const VISUAL_TYPES = new Set([
  'routing-map', 'cache-layers', 'edge-globe', 'queue-conveyor', 'token-bucket',
  'primitive-toolkit', 'protocol-branches', 'three-pillars', 'data-models',
  'storage-cutaway', 'compatibility-bridge', 'replication-topologies',
  'partition-map', 'transaction-timeline', 'partial-failure', 'consensus-overlap',
  'batch-pipeline', 'stream-windows', 'derived-ecosystem'
]);

function xml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[c]));
}

function wrap(value, maxChars, maxLines = Infinity) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || next.length <= maxChars) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = kept[maxLines - 1].replace(/[.,;:]?$/, '…');
  return kept;
}

function text(lines, x, y, size, lineHeight, attrs = '') {
  const safe = Array.isArray(lines) ? lines : [lines];
  return `<text x="${x}" y="${y}" font-size="${size}" ${attrs}>${safe.map((line, i) =>
    `<tspan x="${x}" dy="${i ? lineHeight : 0}">${xml(line)}</tspan>`).join('')}</text>`;
}

function defs() {
  return `<defs>
    <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="${C.grid}" stroke-width="1"/></pattern>
    <filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".42"/></filter>
    ${[['amber', C.amber], ['cyan', C.cyan], ['coral', C.coral], ['muted', C.muted]].map(([id, color]) =>
      `<marker id="arrow-${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker>`).join('')}
  </defs>`;
}

function marker(color) {
  if (color === C.cyan) return 'cyan';
  if (color === C.coral) return 'coral';
  if (color === C.muted) return 'muted';
  return 'amber';
}

function arrow(x1, y1, x2, y2, color = C.amber, label = '', options = {}) {
  const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
  const curved = options.curve ? `Q ${options.curve[0]} ${options.curve[1]} ${x2} ${y2}` : `L ${x2} ${y2}`;
  const labelSvg = label ? `<text x="${midX + (options.labelDx || 0)}" y="${midY - 13 + (options.labelDy || 0)}" text-anchor="middle" font-size="18" font-weight="750" fill="${color}">${xml(label)}</text>` : '';
  return `<g><path d="M ${x1} ${y1} ${curved}" fill="none" stroke="${color}" stroke-width="${options.width || 5}" ${options.dashed ? 'stroke-dasharray="12 10"' : ''} marker-end="url(#arrow-${marker(color)})"/>${labelSvg}</g>`;
}

function callout(x, y, number, title, body, color = C.amber, align = 'start', max = 30) {
  const anchor = align === 'end' ? 'end' : 'start';
  const tx = align === 'end' ? x - 46 : x + 46;
  const bodyLines = wrap(body, max, 2);
  return `<g>
    <circle cx="${x}" cy="${y}" r="25" fill="${C.bg}" stroke="${color}" stroke-width="3"/>
    <text x="${x}" y="${y + 8}" text-anchor="middle" font-size="22" font-weight="900" fill="${color}">${number}</text>
    <text x="${tx}" y="${y - 4}" text-anchor="${anchor}" font-size="22" font-weight="850" fill="${C.text}">${xml(title)}</text>
    ${text(bodyLines, tx, y + 27, 17, 23, `text-anchor="${anchor}" fill="${C.muted}"`)}
  </g>`;
}

function entity(kind, x, y, label, color = C.amber, scale = 1, sub = '') {
  const s = scale;
  let shape = '';
  if (kind === 'db') {
    shape = `<ellipse cx="${x}" cy="${y - 38*s}" rx="${70*s}" ry="${23*s}" fill="${C.paper}" stroke="${color}" stroke-width="4"/><path d="M${x-70*s} ${y-38*s}V${y+42*s}C${x-70*s} ${y+72*s},${x+70*s} ${y+72*s},${x+70*s} ${y+42*s}V${y-38*s}" fill="${C.paper}" stroke="${color}" stroke-width="4"/><ellipse cx="${x}" cy="${y+42*s}" rx="${70*s}" ry="${23*s}" fill="none" stroke="${color}" stroke-width="3"/>`;
  } else if (kind === 'cache') {
    shape = [-1,0,1].map((n,i) => `<path d="M${x-58*s+n*13*s} ${y-28*s-i*10*s}l${58*s} -30l${58*s} 30l-58 30Z" fill="${i===0?C.amberDark:C.paper}" stroke="${color}" stroke-width="3"/>`).join('');
  } else if (kind === 'queue') {
    shape = `<path d="M${x-78*s} ${y-45*s}H${x+78*s}V${y+45*s}H${x-78*s}Z" fill="${C.paper}" stroke="${color}" stroke-width="4"/>${[-48,-16,16,48].map(dx => `<circle cx="${x+dx*s}" cy="${y}" r="${11*s}" fill="${color}"/>`).join('')}`;
  } else if (kind === 'client') {
    shape = `<rect x="${x-74*s}" y="${y-54*s}" width="${148*s}" height="${96*s}" rx="${12*s}" fill="${C.paper}" stroke="${color}" stroke-width="4"/><path d="M${x-94*s} ${y+58*s}H${x+94*s}L${x+74*s} ${y+42*s}H${x-74*s}Z" fill="${C.paper}" stroke="${color}" stroke-width="4"/><circle cx="${x}" cy="${y-6*s}" r="${18*s}" fill="none" stroke="${color}" stroke-width="3"/>`;
  } else if (kind === 'globe') {
    shape = `<circle cx="${x}" cy="${y}" r="${73*s}" fill="${C.paper}" stroke="${color}" stroke-width="4"/><ellipse cx="${x}" cy="${y}" rx="${31*s}" ry="${73*s}" fill="none" stroke="${color}" stroke-width="3"/><path d="M${x-68*s} ${y-24*s}H${x+68*s}M${x-68*s} ${y+24*s}H${x+68*s}" stroke="${color}" stroke-width="3"/>`;
  } else if (kind === 'shield') {
    shape = `<path d="M${x} ${y-74*s}L${x+66*s} ${y-47*s}V${y+5*s}C${x+66*s} ${y+50*s},${x+30*s} ${y+72*s},${x} ${y+88*s}C${x-30*s} ${y+72*s},${x-66*s} ${y+50*s},${x-66*s} ${y+5*s}V${y-47*s}Z" fill="${C.paper}" stroke="${color}" stroke-width="4"/><path d="M${x-30*s} ${y+3*s}l${20*s} ${20*s}l${42*s} -50" fill="none" stroke="${color}" stroke-width="6"/>`;
  } else {
    shape = `<path d="M${x} ${y-72*s}L${x+66*s} ${y-35*s}V${y+42*s}L${x} ${y+78*s}L${x-66*s} ${y+42*s}V${y-35*s}Z" fill="${C.paper}" stroke="${color}" stroke-width="4"/><path d="M${x-66*s} ${y-35*s}L${x} ${y+2*s}L${x+66*s} ${y-35*s}M${x} ${y+2*s}V${y+78*s}" fill="none" stroke="${color}" stroke-width="3"/>`;
  }
  return `<g filter="url(#soft-shadow)">${shape}</g><text x="${x}" y="${y + 120*s}" text-anchor="middle" font-size="${22*s}" font-weight="850" fill="${C.text}">${xml(label)}</text>${sub ? `<text x="${x}" y="${y + 149*s}" text-anchor="middle" font-size="${16*s}" fill="${C.muted}">${xml(sub)}</text>` : ''}`;
}

function sectionLabel(label, x, y, color = C.amber) {
  return `<text x="${x}" y="${y}" font-size="16" font-weight="900" letter-spacing="4" fill="${color}">${xml(label.toUpperCase())}</text><path d="M${x} ${y+16}H${x+220}" stroke="${color}" stroke-width="4"/>`;
}

function page(chapter, topic, spec, scene) {
  const titleLines = wrap(chapter.title.replace(/^Design a /, ''), 36, 2);
  const core = wrap(spec.coreIdea, 88, 2);
  const tradeoff = wrap(spec.tradeoff, 102, 2);
  const family = topic === 'ddia' ? 'DESIGNING DATA-INTENSIVE APPLICATIONS' : 'SYSTEM DESIGN BUILDING BLOCK';
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs()}<rect width="1600" height="2000" fill="${C.bg}"/><rect width="1600" height="2000" fill="url(#grid)"/>
    <path d="M72 56H1528" stroke="${C.amber}" stroke-width="5"/>
    <circle cx="112" cy="118" r="42" fill="${C.amber}"/><text x="112" y="128" text-anchor="middle" font-size="25" font-weight="950" fill="${C.bg}">${xml(chapter.id.toUpperCase())}</text>
    <text x="178" y="95" font-size="16" font-weight="900" letter-spacing="3" fill="${C.amber}">${xml(family)}</text>
    ${text(titleLines, 178, 150, 48, 52, `font-weight="900" fill="${C.text}"`)}
    ${text(core, 80, titleLines.length > 1 ? 268 : 226, 22, 30, `font-weight="600" fill="${C.muted}"`)}
    ${scene}
    <path d="M80 1760H1520" stroke="${C.line}" stroke-width="2"/>
    <text x="80" y="1810" font-size="16" font-weight="900" letter-spacing="3" fill="${C.coral}">THE TRADEOFF</text>
    ${text(tradeoff, 80, 1855, 25, 34, `font-weight="700" fill="${C.text}"`)}
    <text x="80" y="1952" font-size="15" font-weight="850" letter-spacing="2" fill="${C.muted}">JS DRILL · ${topic === 'ddia' ? 'DDIA' : 'BUILDING BLOCKS'} · ${xml(chapter.id.toUpperCase())}</text>
    <text x="1520" y="1952" text-anchor="end" font-size="15" font-weight="800" fill="${C.cyan}">SEE IT · TRACE IT · EXPLAIN IT</text>
  </svg>`;
}

function routingMap(spec) {
  return `${sectionLabel('Route by the signal you need', 80, 330)}
    ${entity('client', 190, 580, 'Client', C.text, .72)}${entity('globe', 500, 580, 'DNS / Anycast', C.cyan, .8)}
    ${entity('service', 825, 500, 'L4 balancer', C.amber, .78, 'IP · port · connection')}${entity('service', 825, 850, 'L7 balancer', C.cyan, .78, 'path · header · cookie')}
    ${entity('service', 1210, 480, 'Backend A', C.green, .64)}${entity('service', 1410, 690, 'Backend B', C.green, .64)}${entity('service', 1190, 930, 'Backend C', C.green, .64)}
    ${arrow(285,580,420,580,C.cyan,'nearest region')}${arrow(580,545,735,510,C.amber,'fast path')}${arrow(580,620,735,820,C.cyan,'HTTP-aware')}
    ${arrow(920,490,1135,480,C.green,'healthy')}${arrow(920,525,1340,660,C.green)}${arrow(920,850,1125,910,C.green,'route')}
    ${arrow(1370,735,1250,925,C.coral,'eject', {dashed:true,curve:[1450,900]})}
    ${callout(150,1250,1,'L4 vs L7','Use the cheapest layer with enough context.',C.amber)}
    ${callout(585,1390,2,'Health before balance','Probe, drain, and retain failover capacity.',C.cyan)}
    ${callout(1030,1250,3,'Avoid sticky state','External sessions keep failover fluid.',C.green)}
    ${callout(1370,1390,4,'Watch skew','Heavy clients can overload one target.',C.coral,'end')}`;
}

function cacheLayers() {
  const rings = [[570,C.amber,'SOURCE OF TRUTH'],[430,C.cyan,'DISTRIBUTED CACHE'],[290,C.purple,'EDGE / CDN'],[155,C.green,'LOCAL CACHE']];
  return `${sectionLabel('A hit returns early · a miss falls inward', 80, 330)}
    <g transform="translate(800 910)">${rings.map(([r,color,label],i) => `<circle r="${r}" fill="none" stroke="${color}" stroke-width="${i===0?6:4}" ${i===1?'stroke-dasharray="16 10"':''}/><text x="0" y="${-r+34}" text-anchor="middle" font-size="18" font-weight="850" fill="${color}">${label}</text>`).join('')}
      <path d="M-78 -28l78 -42l78 42l-78 42Z" fill="${C.amberDark}" stroke="${C.amber}" stroke-width="4"/><path d="M-78 -28v78l78 42l78-42v-78M0 14v78" fill="none" stroke="${C.amber}" stroke-width="4"/>
      <text x="0" y="135" text-anchor="middle" font-size="22" font-weight="900" fill="${C.text}">DATABASE</text>
    </g>
    ${arrow(150,600,650,775,C.coral,'MISS',{curve:[400,610]})}${arrow(650,870,285,620,C.green,'HIT',{curve:[420,860]})}
    ${entity('client', 145, 560, 'Reader', C.text, .62)}
    ${callout(180,1380,1,'Cache-aside','App owns miss, fill, and fallback.',C.amber)}
    ${callout(590,1510,2,'Stampede control','Coalesce requests and jitter TTLs.',C.cyan)}
    ${callout(1030,1380,3,'Freshness contract','TTL, purge, version, or stale serving.',C.purple)}
    ${callout(1410,1510,4,'Measure pressure','Hit ratio plus origin load and item age.',C.coral,'end')}`;
}

function edgeGlobe() {
  const points = [[800,450],[1130,570],[1220,900],[1000,1160],[600,1160],[380,900],[470,570]];
  return `${sectionLabel('Move bytes toward demand',80,330)}
    <circle cx="800" cy="810" r="400" fill="none" stroke="${C.line}" stroke-width="3"/><ellipse cx="800" cy="810" rx="180" ry="400" fill="none" stroke="${C.line}" stroke-width="2"/><path d="M410 730H1190M420 920H1180" stroke="${C.line}" stroke-width="2"/>
    ${points.map(([x,y],i) => `<g><circle cx="${x}" cy="${y}" r="46" fill="${C.cyanDark}" stroke="${C.cyan}" stroke-width="4"/><circle cx="${x}" cy="${y}" r="10" fill="${C.cyan}"/><text x="${x}" y="${y+75}" text-anchor="middle" font-size="16" font-weight="800" fill="${C.text}">EDGE ${i+1}</text></g>`).join('')}
    ${entity('db',800,810,'Origin shield',C.amber,.72)}
    ${entity('client',170,470,'User',C.text,.55)}${arrow(245,500,435,565,C.cyan,'nearest PoP')}
    ${arrow(480,610,720,760,C.coral,'regional miss',{dashed:true})}${arrow(760,740,800,670,C.amber,'collapse')}
    <path d="M1320 420l-40 85h50l-58 120" fill="none" stroke="${C.coral}" stroke-width="9"/><text x="1345" y="660" text-anchor="middle" font-size="20" font-weight="900" fill="${C.coral}">PURGE / VERSION</text>
    ${callout(180,1420,1,'Pull or push','Fetch on miss or pre-position known assets.',C.amber)}
    ${callout(670,1530,2,'Protect origin','Shield collapses duplicate global misses.',C.cyan)}
    ${callout(1180,1420,3,'Compute at edge','TLS, resize, filter, and personalize nearby.',C.purple)}`;
}

function queueConveyor() {
  const events = [430,540,650,760,870].map((x,i)=>`<circle cx="${x}" cy="770" r="23" fill="${i%2?C.cyan:C.amber}"/><path d="M${x} 755v30M${x-15} 770h30" stroke="${C.bg}" stroke-width="4"/>`).join('');
  return `${sectionLabel('Persist work between independent speeds',80,330)}
    ${entity('service',180,720,'Producer',C.amber,.7)}
    <path d="M350 710H980V830H350Z" fill="${C.paper}" stroke="${C.line}" stroke-width="4"/><path d="M380 830H950" stroke="${C.muted}" stroke-width="8" stroke-dasharray="22 15"/>${events}
    <text x="665" y="690" text-anchor="middle" font-size="22" font-weight="900" fill="${C.text}">DURABLE BROKER LOG</text>
    ${arrow(270,720,350,760,C.amber,'publish')}
    ${entity('service',1190,530,'Worker 1',C.cyan,.62)}${entity('service',1390,760,'Worker 2',C.cyan,.62)}${entity('service',1190,1010,'Worker 3',C.cyan,.62)}
    ${arrow(980,750,1120,555,C.cyan,'claim')}${arrow(980,770,1315,760,C.cyan,'ack')}${arrow(980,795,1120,990,C.cyan,'replay')}
    <path d="M500 1090H760L720 1290H540Z" fill="${C.paper}" stroke="${C.coral}" stroke-width="5"/><text x="630" y="1195" text-anchor="middle" font-size="24" font-weight="900" fill="${C.coral}">DLQ</text>${arrow(700,830,650,1085,C.coral,'poison',{dashed:true})}
    ${callout(170,1420,1,'Assume duplicates','Stable IDs make effects idempotent.',C.amber)}
    ${callout(650,1540,2,'Bound failure','Retry, back off, then quarantine.',C.coral)}
    ${callout(1150,1420,3,'Backpressure','Limit in-flight work and watch message age.',C.cyan)}`;
}

function tokenBucket() {
  const tokens = [[690,470],[760,420],[830,480],[900,415],[735,560],[820,575],[875,535],[760,670],[845,690],[800,790],[875,810],[745,850]];
  return `${sectionLabel('Burst capacity above · sustained rate below',80,330)}
    ${tokens.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="24" fill="${i<4?C.amber:C.cyan}" stroke="${C.text}" stroke-width="2"/>`).join('')}
    <path d="M610 600Q800 690 990 600L930 1110Q800 1190 670 1110Z" fill="rgba(98,213,208,.10)" stroke="${C.cyan}" stroke-width="7"/>
    <path d="M690 1085H910V1170H690Z" fill="${C.paper}" stroke="${C.amber}" stroke-width="6"/><circle cx="800" cy="1128" r="30" fill="${C.amber}"/><path d="M800 1080V1010M770 1010H830" stroke="${C.amber}" stroke-width="8"/>
    ${arrow(800,350,800,520,C.amber,'refill rate')}${arrow(910,1130,1250,1130,C.green,'ALLOW')}${arrow(690,1130,350,1280,C.coral,'429 REJECT',{curve:[510,1130]})}
    <path d="M575 670V1040" stroke="${C.muted}" stroke-width="4"/><path d="M560 670H590M560 1040H590" stroke="${C.muted}" stroke-width="4"/><text x="535" y="860" transform="rotate(-90 535 860)" text-anchor="middle" font-size="20" font-weight="850" fill="${C.muted}">BURST CAPACITY</text>
    ${entity('client',220,720,'Caller',C.text,.58)}${arrow(300,750,590,750,C.amber,'request')}
    ${entity('service',1370,1085,'Service',C.green,.58)}
    ${callout(210,1490,1,'Tokens refill steadily','Rate controls sustained traffic.',C.amber)}
    ${callout(720,1580,2,'Bucket stores bursts','Capacity controls temporary spikes.',C.cyan)}
    ${callout(1220,1490,3,'Reject clearly','Return 429 plus Retry-After.',C.coral)}`;
}

function primitiveToolkit() {
  const ringNodes = [[410,560],[520,470],[635,560],[570,690],[430,700]];
  return `${sectionLabel('Four primitives · four different jobs',80,330)}
    <circle cx="520" cy="590" r="175" fill="none" stroke="${C.amber}" stroke-width="4"/>${ringNodes.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="24" fill="${i===1?C.coral:C.amber}"/><text x="${x}" y="${y+50}" text-anchor="middle" font-size="15" fill="${C.muted}">${i===1?'HOT':'VNODE'}</text>`).join('')}<text x="520" y="825" text-anchor="middle" font-size="24" font-weight="900" fill="${C.text}">CONSISTENT HASH RING</text>
    <g transform="translate(1110 580)">${Array.from({length:35},(_,i)=>`<circle cx="${(i%7)*55-165}" cy="${Math.floor(i/7)*55-110}" r="12" fill="${i%5===0?C.cyan:C.line}"/>`).join('')}<path d="M-205 -155L205 155" stroke="${C.coral}" stroke-width="6"/><text y="230" text-anchor="middle" font-size="24" font-weight="900" fill="${C.text}">BLOOM FILTER</text><text y="262" text-anchor="middle" font-size="17" fill="${C.muted}">definitely absent · maybe present</text></g>
    <g transform="translate(470 1210)"><circle cx="-70" r="115" fill="none" stroke="${C.cyan}" stroke-width="5"/><circle cx="70" r="115" fill="none" stroke="${C.amber}" stroke-width="5"/><circle r="26" fill="${C.green}"/><text y="185" text-anchor="middle" font-size="24" font-weight="900" fill="${C.text}">QUORUM OVERLAP</text><text y="218" text-anchor="middle" font-size="17" fill="${C.muted}">R + W &gt; N</text></g>
    <g transform="translate(1120 1200)"><path d="M-180 -70H20V70H-180Z" fill="${C.paper}" stroke="${C.purple}" stroke-width="5"/><circle cx="-120" r="26" fill="none" stroke="${C.purple}" stroke-width="5"/><path d="M-94 0H-40M-56 0V35" stroke="${C.purple}" stroke-width="6"/><path d="M20 -40H180M20 40H180" stroke="${C.green}" stroke-width="6"/><text y="185" text-anchor="middle" font-size="24" font-weight="900" fill="${C.text}">IDEMPOTENCY KEY</text><text y="218" text-anchor="middle" font-size="17" fill="${C.muted}">same operation · same result</text></g>`;
}

function protocolBranches() {
  return `${sectionLabel('Choose coupling before syntax',80,330)}
    ${entity('client',180,800,'Client',C.text,.68)}<circle cx="500" cy="800" r="70" fill="${C.paper}" stroke="${C.amber}" stroke-width="5"/><text x="500" y="792" text-anchor="middle" font-size="20" font-weight="900" fill="${C.text}">API</text><text x="500" y="822" text-anchor="middle" font-size="16" fill="${C.muted}">contract</text>${arrow(275,800,425,800,C.amber,'intent')}
    ${entity('service',850,500,'REST',C.amber,.62,'resource-shaped')}${entity('service',1120,800,'gRPC',C.cyan,.62,'typed internal calls')}${entity('service',850,1100,'GraphQL',C.purple,.62,'client-shaped reads')}
    ${arrow(565,760,790,525,C.amber,'HTTP')}${arrow(570,800,1050,800,C.cyan,'protobuf')}${arrow(565,840,790,1075,C.purple,'query')}
    <path d="M240 1400H1310" stroke="${C.line}" stroke-width="5"/><circle cx="420" cy="1400" r="18" fill="${C.amber}"/><circle cx="720" cy="1400" r="18" fill="${C.cyan}"/><circle cx="1040" cy="1400" r="18" fill="${C.purple}"/><path d="M420 1360v80M720 1360v80M1040 1360v80" stroke="${C.line}" stroke-width="3"/>
    <text x="420" y="1490" text-anchor="middle" font-size="20" font-weight="850" fill="${C.text}">WEBHOOK</text><text x="720" y="1490" text-anchor="middle" font-size="20" font-weight="850" fill="${C.text}">SSE</text><text x="1040" y="1490" text-anchor="middle" font-size="20" font-weight="850" fill="${C.text}">WEBSOCKET</text><text x="760" y="1560" text-anchor="middle" font-size="17" fill="${C.muted}">callback · one-way stream · bidirectional session</text>`;
}

function threePillars() {
  const vertices = [[800,470,'RELIABILITY',C.amber],[430,1130,'SCALABILITY',C.cyan],[1170,1130,'MAINTAINABILITY',C.purple]];
  return `${sectionLabel('A system succeeds only where all three overlap',80,330)}
    <path d="M800 520L470 1090H1130Z" fill="rgba(245,182,43,.06)" stroke="${C.line}" stroke-width="6"/>
    ${vertices.map(([x,y,label,color])=>`<circle cx="${x}" cy="${y}" r="145" fill="${C.paper}" stroke="${color}" stroke-width="6"/><text x="${x}" y="${y+8}" text-anchor="middle" font-size="23" font-weight="950" fill="${color}">${label}</text>`).join('')}
    <circle cx="800" cy="900" r="120" fill="${C.bg}" stroke="${C.green}" stroke-width="6" filter="url(#glow)"/><text x="800" y="890" text-anchor="middle" font-size="23" font-weight="900" fill="${C.text}">USER</text><text x="800" y="925" text-anchor="middle" font-size="18" fill="${C.green}">SERVICE SLO</text>
    ${arrow(800,620,800,780,C.coral,'fault ≠ failure')}${arrow(550,1070,700,955,C.cyan,'p50 · p95 · p99')}${arrow(1050,1070,900,955,C.purple,'operate · simplify · evolve')}
    ${callout(220,1450,1,'Name the load','Requests, data size, fan-out, or skew.',C.cyan)}${callout(810,1560,2,'Measure the tail','Averages hide the users who wait.',C.coral)}${callout(1370,1450,3,'Design for change','Operability is part of architecture.',C.purple,'end')}`;
}

function dataModels() {
  return `${sectionLabel('The model decides which relationships feel natural',80,330)}
    <g transform="translate(335 770)"><path d="M-180 -170H180V150H-180Z" fill="none" stroke="${C.amber}" stroke-width="5"/>${[-90,0,90].map(x=>`<path d="M${x} -170V150" stroke="${C.line}" stroke-width="3"/>`).join('')}${[-90,-10,70].map(y=>`<path d="M-180 ${y}H180" stroke="${C.line}" stroke-width="3"/>`).join('')}<text y="225" text-anchor="middle" font-size="28" font-weight="950" fill="${C.amber}">RELATIONAL</text><text y="263" text-anchor="middle" font-size="18" fill="${C.muted}">joins · normalized links</text></g>
    <g transform="translate(800 770)"><path d="M-180 -180H120L180 -120V170H-180Z" fill="${C.paper}" stroke="${C.cyan}" stroke-width="5"/><path d="M120 -180V-120H180" fill="none" stroke="${C.cyan}" stroke-width="4"/><path d="M-120 -90H100M-120 -30H40M-120 30H120M-120 90H60" stroke="${C.line}" stroke-width="12"/><text y="225" text-anchor="middle" font-size="28" font-weight="950" fill="${C.cyan}">DOCUMENT</text><text y="263" text-anchor="middle" font-size="18" fill="${C.muted}">aggregates · locality</text></g>
    <g transform="translate(1260 770)">${[[-130,-100],[40,-140],[140,-20],[-40,20],[-140,110],[80,130]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i===3?38:27}" fill="${C.paper}" stroke="${C.purple}" stroke-width="5"/>`).join('')}<path d="M-130 -100L40 -140L140 -20L-40 20L-140 110M-40 20L80 130M40 -140L-40 20" stroke="${C.purple}" stroke-width="4" fill="none"/><text y="225" text-anchor="middle" font-size="28" font-weight="950" fill="${C.purple}">GRAPH</text><text y="263" text-anchor="middle" font-size="18" fill="${C.muted}">traversal · many-to-many</text></g>
    <path d="M210 1230H1390" stroke="${C.line}" stroke-width="4"/><text x="800" y="1290" text-anchor="middle" font-size="21" font-weight="850" fill="${C.text}">DECLARATIVE QUERY</text>${arrow(800,1320,800,1510,C.green,'optimizer chooses execution')}
    <path d="M570 1540Q800 1430 1030 1540" fill="none" stroke="${C.green}" stroke-width="6"/><circle cx="570" cy="1540" r="20" fill="${C.green}"/><circle cx="1030" cy="1540" r="20" fill="${C.green}"/>`;
}

function storageCutaway() {
  return `${sectionLabel('Same durability goal · different physical shape',80,330)}
    <path d="M780 410V1570" stroke="${C.line}" stroke-width="3" stroke-dasharray="16 12"/>
    <text x="390" y="430" text-anchor="middle" font-size="30" font-weight="950" fill="${C.cyan}">LSM TREE</text><text x="1180" y="430" text-anchor="middle" font-size="30" font-weight="950" fill="${C.amber}">B-TREE</text>
    <g transform="translate(390 600)"><path d="M-180 -70H180V70H-180Z" fill="${C.paper}" stroke="${C.cyan}" stroke-width="5"/><text y="8" text-anchor="middle" font-size="23" font-weight="900" fill="${C.text}">MEMTABLE</text>${arrow(0,-180,0,-80,C.cyan,'WRITE + WAL')}</g>
    ${[0,1,2].map(i=>`<g transform="translate(390 ${820+i*190})"><path d="M${-230+i*45} 0H${230-i*45}" stroke="${C.cyan}" stroke-width="${22-i*3}"/><path d="M${-180+i*35} 52H${180-i*35}" stroke="${C.cyan}" stroke-width="${18-i*3}"/><text x="-260" y="20" text-anchor="end" font-size="18" font-weight="850" fill="${C.muted}">LEVEL ${i}</text></g>`).join('')}
    ${arrow(390,680,390,780,C.cyan,'flush')}${arrow(620,1030,620,1320,C.coral,'COMPACTION',{curve:[740,1170]})}
    <g transform="translate(1180 650)"><rect x="-90" y="-65" width="180" height="130" rx="18" fill="${C.paper}" stroke="${C.amber}" stroke-width="5"/><text y="8" text-anchor="middle" font-size="22" font-weight="900" fill="${C.text}">ROOT PAGE</text></g>
    ${[[-230,950],[-75,950],[75,950],[230,950]].map(([dx,y],i)=>`<g transform="translate(${1180+dx} ${y})"><rect x="-62" y="-48" width="124" height="96" rx="12" fill="${C.paper}" stroke="${C.amber}" stroke-width="4"/><text y="7" text-anchor="middle" font-size="18" font-weight="850" fill="${C.text}">PAGE ${i+1}</text></g>${arrow(1180+(i<2?-50:50),715,1180+dx,895,C.amber,'')}`).join('')}
    ${Array.from({length:6},(_,i)=>`<rect x="${900+i*95}" y="1170" width="74" height="145" rx="8" fill="${i%2?C.amberDark:C.paper}" stroke="${C.amber}" stroke-width="3"/>`).join('')}
    <text x="1180" y="1370" text-anchor="middle" font-size="20" font-weight="850" fill="${C.muted}">FIXED-SIZE DISK PAGES</text>
    ${callout(170,1580,1,'Writes flow sequentially','Fast ingest; compaction pays later.',C.cyan)}${callout(1420,1580,2,'Reads follow pointers','Predictable lookup; pages update in place.',C.amber,'end')}`;
}

function compatibilityBridge() {
  return `${sectionLabel('Mixed versions must coexist during rollout',80,330)}
    <g transform="translate(220 650)"><circle cy="-110" r="70" fill="${C.paper}" stroke="${C.muted}" stroke-width="5"/><text y="-102" text-anchor="middle" font-size="20" font-weight="900" fill="${C.text}">OLD</text><circle cy="150" r="70" fill="${C.paper}" stroke="${C.green}" stroke-width="5"/><text y="158" text-anchor="middle" font-size="20" font-weight="900" fill="${C.text}">NEW</text><text y="280" text-anchor="middle" font-size="23" font-weight="900" fill="${C.muted}">WRITERS</text></g>
    <g transform="translate(800 780)"><path d="M-260 -130H260L330 0L260 130H-260L-330 0Z" fill="${C.paper}" stroke="${C.amber}" stroke-width="6"/><text y="-35" text-anchor="middle" font-size="25" font-weight="950" fill="${C.amber}">VERSIONED ENCODING</text><circle cx="-150" cy="45" r="25" fill="${C.cyan}"/><circle cx="-70" cy="45" r="25" fill="${C.amber}"/><circle cx="10" cy="45" r="25" fill="${C.purple}"/><circle cx="90" cy="45" r="25" fill="${C.green}"/><path d="M140 45h70" stroke="${C.coral}" stroke-width="8" stroke-dasharray="12 8"/><text y="105" text-anchor="middle" font-size="17" fill="${C.muted}">preserve unknown fields</text></g>
    <g transform="translate(1380 650)"><circle cy="-110" r="70" fill="${C.paper}" stroke="${C.muted}" stroke-width="5"/><text y="-102" text-anchor="middle" font-size="20" font-weight="900" fill="${C.text}">OLD</text><circle cy="150" r="70" fill="${C.paper}" stroke="${C.green}" stroke-width="5"/><text y="158" text-anchor="middle" font-size="20" font-weight="900" fill="${C.text}">NEW</text><text y="280" text-anchor="middle" font-size="23" font-weight="900" fill="${C.muted}">READERS</text></g>
    ${arrow(300,540,475,700,C.muted,'old data')}${arrow(300,800,475,790,C.green,'new data')}${arrow(1125,700,1300,540,C.muted,'forward')}${arrow(1125,790,1300,800,C.green,'backward')}
    <path d="M320 1160H1280" stroke="${C.line}" stroke-width="5"/><circle cx="400" cy="1160" r="25" fill="${C.muted}"/><circle cx="800" cy="1160" r="25" fill="${C.amber}"/><circle cx="1200" cy="1160" r="25" fill="${C.green}"/><text x="400" y="1220" text-anchor="middle" font-size="19" fill="${C.text}">v1 only</text><text x="800" y="1220" text-anchor="middle" font-size="19" fill="${C.text}">rolling deploy</text><text x="1200" y="1220" text-anchor="middle" font-size="19" fill="${C.text}">v2 only</text>
    ${callout(240,1480,1,'Backward compatible','New code reads old bytes.',C.green)}${callout(940,1480,2,'Forward compatible','Old code tolerates new bytes.',C.amber)}`;
}

function replicationTopologies() {
  function node(x,y,label,color,r=42){return `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.paper}" stroke="${color}" stroke-width="5"/><text x="${x}" y="${y+7}" text-anchor="middle" font-size="16" font-weight="900" fill="${C.text}">${label}</text>`;}
  return `${sectionLabel('Three ways to order and copy writes',80,330)}
    <text x="300" y="470" text-anchor="middle" font-size="24" font-weight="950" fill="${C.amber}">SINGLE LEADER</text>${node(300,600,'L',C.amber,55)}${node(170,800,'R1',C.cyan)}${node(300,850,'R2',C.cyan)}${node(430,800,'R3',C.cyan)}${arrow(280,655,185,755,C.cyan)}${arrow(300,655,300,795,C.cyan)}${arrow(320,655,415,755,C.cyan)}
    <text x="800" y="470" text-anchor="middle" font-size="24" font-weight="950" fill="${C.purple}">MULTI-LEADER</text>${node(700,620,'L1',C.purple,52)}${node(900,620,'L2',C.purple,52)}${arrow(755,620,845,620,C.coral,'conflict',{dashed:true})}${node(650,830,'R',C.cyan)}${node(950,830,'R',C.cyan)}${arrow(690,675,660,780,C.cyan)}${arrow(910,675,940,780,C.cyan)}
    <text x="1300" y="470" text-anchor="middle" font-size="24" font-weight="950" fill="${C.cyan}">LEADERLESS</text>${[[1200,610],[1400,610],[1160,820],[1300,890],[1440,820]].map(([x,y],i)=>node(x,y,`N${i+1}`,C.cyan)).join('')}${arrow(1300,520,1200,565,C.amber,'W')}${arrow(1300,520,1400,565,C.amber)}
    <path d="M90 1040H1510" stroke="${C.line}" stroke-width="3"/>
    <g transform="translate(800 1280)"><circle cx="-100" r="155" fill="none" stroke="${C.cyan}" stroke-width="6"/><circle cx="100" r="155" fill="none" stroke="${C.amber}" stroke-width="6"/><text y="-10" text-anchor="middle" font-size="28" font-weight="950" fill="${C.green}">R + W &gt; N</text><text y="35" text-anchor="middle" font-size="19" fill="${C.muted}">overlapping quorums</text></g>
    ${callout(220,1580,1,'Lag is visible behavior','Design read-your-writes and monotonic reads.',C.coral)}${callout(1220,1580,2,'Repair is part of reads','Quorums still need reconciliation.',C.cyan)}`;
}

function partitionMap() {
  const keys = ['A','B','C','D','E','F','HOT'];
  return `${sectionLabel('Placement, routing, and movement are one design',80,330)}
    <g>${keys.map((k,i)=>`<circle cx="${150+i*80}" cy="570" r="30" fill="${k==='HOT'?C.coral:C.amber}"/><text x="${150+i*80}" y="578" text-anchor="middle" font-size="16" font-weight="900" fill="${C.bg}">${k}</text>`).join('')}</g>
    <path d="M680 475L850 570L680 665L510 570Z" fill="${C.paper}" stroke="${C.cyan}" stroke-width="6"/><text x="680" y="562" text-anchor="middle" font-size="22" font-weight="950" fill="${C.text}">PARTITION</text><text x="680" y="595" text-anchor="middle" font-size="18" fill="${C.cyan}">range or hash</text>${arrow(690,570,505,570,C.amber,'keys')}
    ${[[1060,480,'SHARD 1',C.cyan],[1320,660,'SHARD 2',C.amber],[1030,860,'SHARD 3',C.purple],[1360,1050,'SHARD 4',C.green]].map(([x,y,l,c])=>entity('db',x,y,l,c,.62)).join('')}
    ${arrow(850,550,985,490,C.cyan,'route')}${arrow(850,575,1245,650,C.amber)}${arrow(840,610,970,830,C.purple)}${arrow(810,635,1300,1020,C.green)}
    <path d="M630 730Q820 900 960 760" fill="none" stroke="${C.coral}" stroke-width="7" stroke-dasharray="14 10"/><text x="780" y="860" text-anchor="middle" font-size="20" font-weight="900" fill="${C.coral}">HOT KEY ≠ HOT PARTITION</text>
    <path d="M200 1310H1400" stroke="${C.line}" stroke-width="6"/><path d="M400 1270v80M800 1270v80M1200 1270v80" stroke="${C.line}" stroke-width="4"/><circle cx="780" cy="1310" r="28" fill="${C.amber}"/><path d="M780 1250l40 60l-40 60" fill="none" stroke="${C.amber}" stroke-width="6"/><text x="800" y="1420" text-anchor="middle" font-size="21" font-weight="850" fill="${C.text}">MOVE BOUNDED PARTITIONS · NOT MODULO-N CHAOS</text>`;
}

function transactionTimeline() {
  return `${sectionLabel('Two clients · one invariant · several possible races',80,330)}
    <text x="160" y="520" font-size="24" font-weight="950" fill="${C.cyan}">TX A</text><text x="160" y="920" font-size="24" font-weight="950" fill="${C.amber}">TX B</text>
    <path d="M260 500H1440M260 900H1440" stroke="${C.line}" stroke-width="6" marker-end="url(#arrow-muted)"/>
    ${[[400,'READ x=0',C.cyan],[720,'WRITE x=1',C.cyan],[1180,'COMMIT',C.green]].map(([x,l,c])=>`<circle cx="${x}" cy="500" r="24" fill="${c}"/><text x="${x}" y="455" text-anchor="middle" font-size="18" font-weight="850" fill="${c}">${l}</text>`).join('')}
    ${[[500,'READ x=0',C.amber],[820,'WRITE x=1',C.amber],[1080,'COMMIT',C.green]].map(([x,l,c])=>`<circle cx="${x}" cy="900" r="24" fill="${c}"/><text x="${x}" y="855" text-anchor="middle" font-size="18" font-weight="850" fill="${c}">${l}</text>`).join('')}
    <path d="M720 560Q800 700 820 840" fill="none" stroke="${C.coral}" stroke-width="7" stroke-dasharray="12 10"/><path d="M820 560Q740 700 720 840" fill="none" stroke="${C.coral}" stroke-width="7" stroke-dasharray="12 10"/><text x="770" y="720" text-anchor="middle" font-size="24" font-weight="950" fill="${C.coral}">LOST UPDATE</text>
    <path d="M300 1150H1370V1400H300Z" fill="none" stroke="${C.green}" stroke-width="6"/><path d="M440 1150V1400M1230 1150V1400" stroke="${C.green}" stroke-width="3"/><text x="835" y="1240" text-anchor="middle" font-size="28" font-weight="950" fill="${C.green}">SERIALIZABLE BOUNDARY</text><text x="835" y="1300" text-anchor="middle" font-size="20" fill="${C.text}">serial execution · 2PL · SSI</text>
    ${arrow(400,1450,400,1580,C.cyan,'A before B')}${arrow(1260,1450,1260,1580,C.amber,'or B before A')}`;
}

function partialFailure() {
  return `${sectionLabel('Silence does not reveal what failed',80,330)}
    ${entity('service',220,750,'Sender',C.amber,.72)}${entity('service',1380,750,'Receiver',C.cyan,.72)}
    <path d="M520 550C610 380 760 470 810 540C910 400 1110 470 1100 640C1250 650 1220 900 1070 900H570C400 900 380 650 520 550Z" fill="${C.paper}" stroke="${C.muted}" stroke-width="6"/><text x="800" y="650" text-anchor="middle" font-size="28" font-weight="950" fill="${C.text}">UNRELIABLE NETWORK</text>
    ${arrow(300,720,600,690,C.amber,'request')}${arrow(1000,820,1300,770,C.cyan,'response',{dashed:true})}
    <path d="M730 710l55 55l-55 55M870 710l-55 55l55 55" stroke="${C.coral}" stroke-width="9" fill="none"/><text x="800" y="870" text-anchor="middle" font-size="22" font-weight="950" fill="${C.coral}">DELAY · DROP · DUPLICATE</text>
    <g transform="translate(430 1190)"><circle r="115" fill="none" stroke="${C.purple}" stroke-width="6"/><path d="M0 0V-70M0 0L55 35" stroke="${C.purple}" stroke-width="7"/><text y="165" text-anchor="middle" font-size="22" font-weight="900" fill="${C.text}">CLOCKS DRIFT</text></g>
    <g transform="translate(800 1190)"><path d="M-110 -80H110V80H-110Z" fill="${C.paper}" stroke="${C.coral}" stroke-width="6"/><path d="M-70 -40H70M-70 0H30M-70 40H60" stroke="${C.line}" stroke-width="9"/><text y="165" text-anchor="middle" font-size="22" font-weight="900" fill="${C.text}">PROCESS PAUSE</text></g>
    <g transform="translate(1180 1190)"><path d="M-140 0H140" stroke="${C.green}" stroke-width="10"/><circle cx="-70" r="34" fill="${C.green}"/><circle cx="70" r="34" fill="${C.green}"/><text y="165" text-anchor="middle" font-size="22" font-weight="900" fill="${C.text}">FENCING TOKEN</text></g>
    ${callout(280,1560,1,'Timeouts are guesses','Tune recovery against false suspicion.',C.coral)}${callout(1110,1560,2,'Fence stale owners','Storage rejects an expired lease holder.',C.green)}`;
}

function consensusOverlap() {
  return `${sectionLabel('Agreement turns many clocks into one durable order',80,330)}
    <g transform="translate(520 760)"><circle cx="-110" r="210" fill="rgba(98,213,208,.08)" stroke="${C.cyan}" stroke-width="6"/><circle cx="110" r="210" fill="rgba(245,182,43,.08)" stroke="${C.amber}" stroke-width="6"/>${[[-180,-70],[-160,80],[0,-120],[0,30],[160,-70],[160,80]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="28" fill="${i===3?C.green:C.paper}" stroke="${i<3?C.cyan:C.amber}" stroke-width="4"/>`).join('')}<text y="285" text-anchor="middle" font-size="25" font-weight="950" fill="${C.green}">QUORUM INTERSECTION</text></g>
    <g transform="translate(1180 760)"><path d="M-250 0H250" stroke="${C.line}" stroke-width="10"/>${[-200,-100,0,100,200].map((x,i)=>`<rect x="${x-32}" y="-55" width="64" height="110" rx="12" fill="${i<3?C.amberDark:C.paper}" stroke="${i<3?C.amber:C.muted}" stroke-width="4"/><text x="${x}" y="10" text-anchor="middle" font-size="18" font-weight="900" fill="${C.text}">${i+1}</text>`).join('')}<text y="145" text-anchor="middle" font-size="25" font-weight="950" fill="${C.text}">ORDERED LOG</text><text y="180" text-anchor="middle" font-size="17" fill="${C.muted}">same entries · same order</text></g>
    <path d="M150 1180H1450" stroke="${C.line}" stroke-width="5"/><path d="M800 1090V1270" stroke="${C.coral}" stroke-width="10" stroke-dasharray="18 12"/><text x="800" y="1330" text-anchor="middle" font-size="24" font-weight="950" fill="${C.coral}">NETWORK PARTITION</text>
    ${callout(230,1510,1,'Linearizable','One recency order across operations.',C.cyan)}${callout(800,1600,2,'Serializable','One valid order for transactions.',C.amber)}${callout(1370,1510,3,'Consensus','Agreement, integrity, termination.',C.green,'end')}`;
}

function batchPipeline() {
  const inputs = [[150,570],[150,700],[150,830],[150,960]];
  return `${sectionLabel('Bounded immutable input · reproducible output',80,330)}
    ${inputs.map(([x,y],i)=>`<path d="M${x-60} ${y-35}H${x+60}V${y+35}H${x-60}Z" fill="${C.paper}" stroke="${C.muted}" stroke-width="4"/><text x="${x}" y="${y+7}" text-anchor="middle" font-size="18" font-weight="850" fill="${C.text}">PART ${i+1}</text>`).join('')}
    ${entity('service',480,760,'MAP',C.cyan,.72)}${arrow(220,650,400,720,C.cyan)}${arrow(220,900,400,800,C.cyan)}
    <g transform="translate(800 760)">${[-120,-40,40,120].map((x,i)=>`<path d="M${x-30} -150V150" stroke="${[C.amber,C.cyan,C.purple,C.green][i]}" stroke-width="38" stroke-dasharray="25 18"/>`).join('')}<text y="220" text-anchor="middle" font-size="26" font-weight="950" fill="${C.text}">SHUFFLE BY KEY</text></g>${arrow(560,760,650,760,C.amber,'emit')}
    ${entity('service',1120,760,'REDUCE',C.amber,.72)}${arrow(950,760,1040,760,C.amber,'group')}${entity('db',1400,760,'Output',C.green,.62)}${arrow(1200,760,1330,760,C.green,'write anew')}
    <path d="M300 1220H1310" stroke="${C.line}" stroke-width="5"/><circle cx="430" cy="1220" r="24" fill="${C.cyan}"/><circle cx="800" cy="1220" r="24" fill="${C.amber}"/><circle cx="1170" cy="1220" r="24" fill="${C.green}"/><text x="430" y="1290" text-anchor="middle" font-size="20" font-weight="850" fill="${C.text}">RESTARTABLE</text><text x="800" y="1290" text-anchor="middle" font-size="20" font-weight="850" fill="${C.text}">PARTITIONED</text><text x="1170" y="1290" text-anchor="middle" font-size="20" font-weight="850" fill="${C.text}">REPRODUCIBLE</text>
    ${callout(470,1530,1,'Materialize stages','Slower, durable, inspectable.',C.coral)}${callout(1100,1530,2,'Pipeline the DAG','Faster; recover from lineage.',C.cyan)}`;
}

function streamWindows() {
  const events = [[180,620,C.amber],[290,700,C.cyan],[420,590,C.purple],[560,780,C.amber],[720,650,C.cyan],[910,850,C.coral],[1080,670,C.green],[1280,760,C.amber]];
  return `${sectionLabel('Unbounded events · bounded windows',80,330)}
    <path d="M100 900C330 760 470 1010 700 850C900 710 1080 1000 1500 790" fill="none" stroke="${C.cyan}" stroke-width="9"/><path d="M100 980C330 840 470 1090 700 930C900 790 1080 1080 1500 870" fill="none" stroke="${C.cyanDark}" stroke-width="18" opacity=".8"/>
    ${events.map(([x,y,c],i)=>`<circle cx="${x}" cy="${y}" r="27" fill="${c}"/><text x="${x}" y="${y-45}" text-anchor="middle" font-size="15" fill="${C.muted}">t${i+1}</text>`).join('')}
    <path d="M480 470V1190M930 470V1190M1380 470V1190" stroke="${C.amber}" stroke-width="5" stroke-dasharray="15 10"/><text x="705" y="1205" text-anchor="middle" font-size="22" font-weight="950" fill="${C.amber}">WINDOW 1</text><text x="1155" y="1205" text-anchor="middle" font-size="22" font-weight="950" fill="${C.amber}">WINDOW 2</text>
    <path d="M260 1320H1320" stroke="${C.coral}" stroke-width="6"/><path d="M1050 1290l70 30l-70 30" fill="none" stroke="${C.coral}" stroke-width="6"/><text x="790" y="1390" text-anchor="middle" font-size="22" font-weight="950" fill="${C.coral}">WATERMARK: HOW LONG TO WAIT FOR LATE DATA</text>
    ${callout(250,1560,1,'Event time','When reality occurred.',C.cyan)}${callout(1110,1560,2,'Processing time','When the system observed it.',C.amber)}`;
}

function derivedEcosystem() {
  const derived = [[300,600,'CACHE','cache',C.cyan],[1300,600,'SEARCH','service',C.purple],[280,1200,'WAREHOUSE','db',C.amber],[1320,1200,'MODEL','service',C.green]];
  return `${sectionLabel('One source · many rebuildable views',80,330)}
    <g transform="translate(800 870)"><ellipse rx="210" ry="105" fill="${C.paper}" stroke="${C.amber}" stroke-width="6"/><path d="M-210 0V210C-210 300 210 300 210 210V0" fill="${C.paper}" stroke="${C.amber}" stroke-width="6"/><ellipse cy="210" rx="210" ry="105" fill="none" stroke="${C.amber}" stroke-width="4"/><text y="35" text-anchor="middle" font-size="28" font-weight="950" fill="${C.text}">SOURCE OF TRUTH</text><path d="M-130 125H130M-130 185H70" stroke="${C.line}" stroke-width="14"/><text y="355" text-anchor="middle" font-size="23" font-weight="900" fill="${C.amber}">ORDERED CHANGE LOG</text></g>
    ${derived.map(([x,y,l,k,c])=>entity(k,x,y,l,c,.65)).join('')}
    ${arrow(650,780,380,640,C.cyan,'project')}${arrow(950,780,1220,640,C.purple,'index')}${arrow(650,1040,370,1160,C.amber,'aggregate')}${arrow(950,1040,1230,1160,C.green,'train')}
    <path d="M250 1500Q800 1360 1350 1500" fill="none" stroke="${C.coral}" stroke-width="6" stroke-dasharray="16 10"/><text x="800" y="1570" text-anchor="middle" font-size="23" font-weight="950" fill="${C.coral}">END-TO-END CORRECTNESS SPANS EVERY BOUNDARY</text>`;
}

function sceneFor(spec) {
  const scenes = {
    'routing-map': routingMap,
    'cache-layers': cacheLayers,
    'edge-globe': edgeGlobe,
    'queue-conveyor': queueConveyor,
    'token-bucket': tokenBucket,
    'primitive-toolkit': primitiveToolkit,
    'protocol-branches': protocolBranches,
    'three-pillars': threePillars,
    'data-models': dataModels,
    'storage-cutaway': storageCutaway,
    'compatibility-bridge': compatibilityBridge,
    'replication-topologies': replicationTopologies,
    'partition-map': partitionMap,
    'transaction-timeline': transactionTimeline,
    'partial-failure': partialFailure,
    'consensus-overlap': consensusOverlap,
    'batch-pipeline': batchPipeline,
    'stream-windows': streamWindows,
    'derived-ecosystem': derivedEcosystem
  };
  const render = scenes[spec.visualType];
  if (!render) throw new Error(`Unknown visualType ${spec.visualType}`);
  return render(spec);
}

function cleanLabel(shape, fallback) {
  if (!shape) return fallback;
  let value = shape;
  for (const [pattern, replacement] of [[/^\[\[(.*)\]\]$/s,'$1'],[/^\[\((.*)\)\]$/s,'$1'],[/^\(\[(.*)\]\)$/s,'$1'],[/^\{\{(.*)\}\}$/s,'$1'],[/^\{(.*)\}$/s,'$1'],[/^\[(.*)\]$/s,'$1']]) {
    if (pattern.test(value)) { value = value.replace(pattern, replacement); break; }
  }
  return value.replace(/^\((.*)\)$/s,'$1').replace(/^"(.*)"$/s,'$1').replace(/<br\s*\/?\s*>/gi,'\n').replace(/\s+/g,' ').replace(/ ?\n ?/g,'\n').trim();
}

function nodeKind(shape = '') {
  if (/^\[\(/.test(shape)) return 'db';
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
  const nodes = new Map(), edges = [];
  function add(id, shape) {
    const old = nodes.get(id);
    if (!old || shape) nodes.set(id, {id, label:cleanLabel(shape, old ? old.label : id), kind:shape ? nodeKind(shape) : (old ? old.kind : 'service')});
  }
  for (const line of lines.slice(1)) {
    const edge = line.match(edgePattern);
    if (edge) { const [,from,fromShape,style,label,to,toShape] = edge; add(from,fromShape); add(to,toShape); edges.push({from,to,dashed:style==='-.->',label:(label||'').replace(/^"|"$/g,'')}); continue; }
    const node = line.match(nodePattern); if (node) add(node[1],node[2]);
  }
  if (nodes.size < 3 || edges.length < 2) throw new Error(`Could not parse graph (${nodes.size} nodes, ${edges.length} edges)`);
  return {direction,nodes:[...nodes.values()],edges};
}

function graphNode(node, layoutNode) {
  const {x,y,width,height,lines} = layoutNode, left=x-width/2, top=y-height/2;
  const color = node.kind === 'decision' ? C.coral : node.kind === 'db' ? C.cyan : node.kind === 'queue' ? C.purple : C.amber;
  let shape;
  if (node.kind === 'decision') shape = `<path d="M${x} ${top}L${left+width} ${y}L${x} ${top+height}L${left} ${y}Z" fill="${C.paper}" stroke="${color}" stroke-width="4"/>`;
  else if (node.kind === 'db') shape = `<ellipse cx="${x}" cy="${top+18}" rx="${width/2}" ry="18" fill="${C.paper}" stroke="${color}" stroke-width="4"/><path d="M${left} ${top+18}V${top+height-18}C${left} ${top+height+5},${left+width} ${top+height+5},${left+width} ${top+height-18}V${top+18}" fill="${C.paper}" stroke="${color}" stroke-width="4"/>`;
  else shape = `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${node.kind==='client'?35:18}" fill="${C.paper}" stroke="${color}" stroke-width="4"/>`;
  const start = y-((lines.length-1)*28)/2+8;
  // Keep graph nodes unfiltered: Inkscape can drop filtered groups nested inside
  // a fitted <svg>, leaving only their connecting edges in the exported PNG.
  return `<g>${shape}${text(lines,x,start,21,28,`text-anchor="middle" font-weight="850" fill="${C.text}"`)}</g>`;
}

async function architecture(code, graphlib, layout, frame) {
  const parsed = parseFlowchart(code);
  const graph = new graphlib.Graph({multigraph:true}).setGraph({rankdir:parsed.direction,ranksep:110,nodesep:65,edgesep:35,marginx:35,marginy:35}).setDefaultEdgeLabel(()=>({}));
  for (const node of parsed.nodes) {
    const lines = node.label.split('\n').flatMap(line=>wrap(line,19,2));
    const longest = Math.max(...lines.map(line=>line.length),6);
    graph.setNode(node.id,{lines,width:Math.min(300,Math.max(175,longest*12+48)),height:Math.max(92,lines.length*31+38)});
  }
  parsed.edges.forEach((edge,i)=>graph.setEdge(edge.from,edge.to,{...edge,width:edge.label?Math.max(80,edge.label.length*11):0,height:edge.label?26:0},`e${i}`));
  layout(graph);
  const meta=graph.graph();
  const edges=graph.edges().map(ref=>{const e=graph.edge(ref);const pts=e.points.map(p=>`${p.x},${p.y}`).join(' ');return `<g><polyline points="${pts}" fill="none" stroke="${e.dashed?C.coral:C.muted}" stroke-width="4" ${e.dashed?'stroke-dasharray="12 9"':''} marker-end="url(#arrow-${e.dashed?'coral':'muted'})"/>${e.label?`<rect x="${e.x-e.width/2-8}" y="${e.y-18}" width="${e.width+16}" height="30" rx="10" fill="${C.bg}"/><text x="${e.x}" y="${e.y+3}" text-anchor="middle" font-size="17" font-weight="850" fill="${e.dashed?C.coral:C.amber}">${xml(e.label)}</text>`:''}</g>`;}).join('');
  const nodes=parsed.nodes.map(node=>graphNode(node,graph.node(node.id))).join('');
  return `<svg x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" viewBox="0 0 ${meta.width} ${meta.height}" preserveAspectRatio="xMidYMid meet">${edges}${nodes}</svg>`;
}

function problemPage(problem, diagrams) {
  const title = wrap(problem.title.replace(/^Design a /,''),38,2);
  const invariant = wrap(problem.keyTakeaways[0],95,3);
  const moments = problem.diagrams.slice(0,MOMENTS_PER_PAGE);
  const tradeoff = wrap(problem.diagrams[problem.diagrams.length-1].takeaway,100,2);
  const focus = moments.slice(1).map((d,i)=>{
    const x=80+i*480, color=[C.cyan,C.purple,C.coral][i];
    return `<g><circle cx="${x+19}" cy="846" r="18" fill="${color}"/><text x="${x+19}" y="853" text-anchor="middle" font-size="15" font-weight="950" fill="${C.bg}">${i+2}</text><text x="${x+48}" y="852" font-size="19" font-weight="900" fill="${C.text}">${xml(wrap(d.title,31,1)[0])}</text>${text(wrap(d.takeaway,42,2),x+220,1240,15,21,`text-anchor="middle" fill="${C.muted}"`)}</g>`;
  }).join('');
  const checkpoints = moments.map((d,i)=>{
    const x=170+i*410;
    return `<g><circle cx="${x}" cy="1452" r="30" fill="${C.bg}" stroke="${[C.amber,C.cyan,C.purple,C.coral][i]}" stroke-width="5"/><text x="${x}" y="1462" text-anchor="middle" font-size="23" font-weight="950" fill="${[C.amber,C.cyan,C.purple,C.coral][i]}">${i+1}</text>${text(wrap(d.title,22,2),x,1512,17,21,`text-anchor="middle" font-weight="900" fill="${C.text}"`)}</g>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 1600 2000">${defs()}<rect width="1600" height="2000" fill="${C.bg}"/><rect width="1600" height="2000" fill="url(#grid)"/>
    <path d="M72 56H1528" stroke="${C.amber}" stroke-width="5"/><circle cx="112" cy="118" r="42" fill="${C.amber}"/><text x="112" y="128" text-anchor="middle" font-size="25" font-weight="950" fill="${C.bg}">${xml(problem.id.toUpperCase())}</text><text x="178" y="95" font-size="16" font-weight="900" letter-spacing="3" fill="${C.amber}">FINAL INTERVIEW WHITEBOARD</text>${text(title,178,150,48,52,`font-weight="900" fill="${C.text}"`)}
    <text x="80" y="278" font-size="16" font-weight="900" letter-spacing="3" fill="${C.coral}">CORE INVARIANT</text>${text(invariant,280,278,20,27,`font-weight="650" fill="${C.text}"`)}
    ${sectionLabel('System map · trace the hot path',80,385)}${diagrams[0]}
    <path d="M80 800H1520" stroke="${C.line}" stroke-width="2"/>${focus}${diagrams.slice(1).join('')}
    <path d="M80 1345H1520" stroke="${C.line}" stroke-width="2"/><text x="80" y="1390" font-size="15" font-weight="900" letter-spacing="3" fill="${C.amber}">ANSWER IN FOUR PASSES</text><path d="M170 1452H1400" stroke="${C.line}" stroke-width="5" marker-end="url(#arrow-muted)"/>${checkpoints}
    <path d="M80 1635H1520" stroke="${C.line}" stroke-width="2"/><text x="80" y="1685" font-size="16" font-weight="900" letter-spacing="3" fill="${C.coral}">PRESSURE TEST</text>${text(tradeoff,80,1730,24,33,`font-weight="700" fill="${C.text}"`)}
    <text x="80" y="1952" font-size="15" font-weight="850" letter-spacing="2" fill="${C.muted}">JS DRILL · CANONICAL DESIGN PROBLEM · ${xml(problem.id.toUpperCase())}</text><text x="1520" y="1952" text-anchor="end" font-size="15" font-weight="800" fill="${C.cyan}">REQUIREMENTS · FLOW · SCALE · FAILURE</text></svg>`;
}

function exportPng(source, raster, output, id) {
  let valid=false;
  for(let attempt=1;attempt<=4&&!valid;attempt++){
    fs.rmSync(raster,{force:true});
    execFileSync('inkscape',[source,'--export-type=png',`--export-filename=${raster}`,`--export-width=${WIDTH}`],{stdio:'pipe'});
    try{execFileSync('convert',[raster,'null:'],{stdio:'pipe'});valid=true;}catch(error){if(attempt===4)throw new Error(`${id} PNG failed decode after ${attempt} exports`);}
  }
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(raster,output);
}

async function main(){
  const {graphlib}=await import('dagre-d3-es');
  const {layout}=await import('dagre-d3-es/src/dagre/layout.js');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jsdrill-infographics-v2-'));
  for(const topic of ['components','ddia','design-problems'])fs.mkdirSync(path.join(OUT,topic),{recursive:true});
  let count=0;
  for(const topic of ['components','ddia']){
    const manifest=JSON.parse(fs.readFileSync(path.join(DATA,topic,'manifest.json'),'utf8'));
    for(const entry of manifest.chapters){
      if(MULTI_SETS[`${topic}/${entry.id}`])continue;
      const chapter=JSON.parse(fs.readFileSync(path.join(DATA,topic,`${entry.id}.json`),'utf8'));
      const spec=SPECS[`${topic}/${entry.id}`];
      if(!spec||!VISUAL_TYPES.has(spec.visualType))throw new Error(`Missing/invalid visualType for ${topic}/${entry.id}`);
      const source=path.join(tmp,`${topic}-${entry.id}.svg`),raster=path.join(tmp,`${topic}-${entry.id}.png`),output=path.join(OUT,topic,`${entry.id}.png`);
      fs.writeFileSync(source,page(chapter,topic,spec,sceneFor(spec)));exportPng(source,raster,output,`${topic}/${entry.id}`);count++;console.log(`  ✓ ${path.relative(ROOT,output)}`);
    }
  }
  // Iterate the design-problem manifest rather than a hard-coded p01..p17 range,
  // so adding, removing, or renaming a canonical problem regenerates exactly the
  // set the validator derives from that same manifest.
  const problemManifest=JSON.parse(fs.readFileSync(path.join(DATA,'design-problems','manifest.json'),'utf8'));
  for(const entry of problemManifest.chapters){
    const id=entry.id;
    if(MULTI_SETS[`design-problems/${id}`])continue;
    const problem=JSON.parse(fs.readFileSync(path.join(DATA,'design-problems',`${id}.json`),'utf8'));
    const authored=Array.isArray(problem.diagrams)?problem.diagrams:[];
    // The page layout has a fixed number of slots. Fail loudly on a short deck
    // instead of emitting a page with empty columns, and never drop extras
    // silently — say which visuals the whiteboard left out.
    if(authored.length<MOMENTS_PER_PAGE)throw new Error(`design-problems/${id}: whiteboard needs ${MOMENTS_PER_PAGE} authored diagrams, found ${authored.length}`);
    if(authored.length>MOMENTS_PER_PAGE)console.log(`  · ${id}: whiteboard renders the first ${MOMENTS_PER_PAGE} of ${authored.length} diagrams`);
    const moments=authored.slice(0,MOMENTS_PER_PAGE);
    const diagrams=[];
    diagrams.push(await architecture(moments[0].code,graphlib,layout,{x:80,y:420,w:1440,h:350}));
    for(let i=1;i<moments.length;i++){
      diagrams.push(await architecture(moments[i].code,graphlib,layout,{x:80+(i-1)*480,y:880,w:440,h:310}));
    }
    const source=path.join(tmp,`${id}.svg`),raster=path.join(tmp,`${id}.png`),output=path.join(OUT,'design-problems',`${id}.png`);
    fs.writeFileSync(source,problemPage(problem,diagrams));exportPng(source,raster,output,`design-problems/${id}`);count++;console.log(`  ✓ ${path.relative(ROOT,output)}`);
  }
  fs.rmSync(tmp,{recursive:true,force:true});console.log(`Generated ${count} legacy lesson infographics (${WIDTH}×${HEIGHT}); preserved authored multi-image sets.`);
}

main().catch(error=>{console.error(error);process.exit(1);});
