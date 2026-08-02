#!/usr/bin/env node
// Render registered study sheets as hand-drawn, architecture-first PNGs.
// The reusable web component owns viewing/zoom/download behavior; this tool is
// only responsible for the static infographic artwork.

const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data/system-design/infographic-sets.json');
const OUT = path.join(ROOT, 'assets/system-design/infographics');
const FONT = path.join(ROOT, 'tools/fonts/caveat-latin-700-normal.ttf');
const WIDTH = 1440;
const HEIGHT = 2280;
const C = {
  bg: '#071012', chalk: '#f5f0df', muted: '#b9b7aa', cyan: '#52d7df',
  amber: '#f2b43d', green: '#8fd16f', purple: '#b68be8', coral: '#f06f51',
  dim: '#426168', faint: '#173139'
};
const PALETTE = [C.amber, C.cyan, C.green, C.purple, C.coral];
const document = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const SETS = document.sets;

function xml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
}

function wrap(value, maxChars, maxLines = Infinity) {
  const words = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
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
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:]?$/, '')}…`;
  return kept;
}

function text(lines, x, y, size, color = C.chalk, anchor = 'start', lineHeight = Math.round(size * 1.08), extra = '') {
  const values = Array.isArray(lines) ? lines : [lines];
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" ${extra}>${values.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${xml(line)}</tspan>`).join('')}</text>`;
}

function slugColor(index) { return PALETTE[index % PALETTE.length]; }

function defs() {
  return `<defs>
    <style>text{font-family:Caveat,'URW Bookman',sans-serif;font-weight:700}</style>
    <filter id="paper" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="19" result="noise"/><feColorMatrix in="noise" values="0 0 0 0 0.12 0 0 0 0 0.16 0 0 0 0 0.17 0 0 0 .22 0"/><feBlend in="SourceGraphic" mode="screen"/></filter>
    <filter id="rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".025" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G"/></filter>
    ${PALETTE.map((color, index) => `<marker id="arrow-${index}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10" fill="none" stroke="${color}" stroke-width="1.8"/></marker>`).join('')}
  </defs>`;
}

function chalkPath(d, color, width = 4, dash = '', marker = '') {
  return `<g filter="url(#rough)"><path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${dash ? `stroke-dasharray="${dash}"` : ''} ${marker ? `marker-end="url(#arrow-${marker})"` : ''}/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.2" opacity=".35" transform="translate(2 -1)"/></g>`;
}

function divider(y, label, color = C.cyan) {
  return `${text(label.toUpperCase(), 72, y, 23, color, 'start', 25, 'letter-spacing="3"')}${chalkPath(`M72 ${y + 18}H1368`, C.dim, 2)}`;
}

function iconType(step) {
  const value = `${step.title || ''} ${step.detail || ''}`.toLowerCase();
  if (/database|store|ledger|warehouse|index|table|state|replica|storage|db\b/.test(value)) return 'db';
  if (/queue|broker|log|stream|event|outbox|kafka|topic|dlq/.test(value)) return 'queue';
  if (/cache|cdn|edge|buffer|bloom/.test(value)) return 'cache';
  if (/client|user|caller|reader|writer|request|producer|consumer/.test(value)) return 'client';
  if (/gateway|policy|auth|limit|validate|fence|security|permission|router/.test(value)) return 'shield';
  if (/worker|processor|job|compute|consumer/.test(value)) return 'worker';
  return 'service';
}

function componentShape(kind, x, y, color, scale = 1) {
  const s = scale;
  if (kind === 'db') return `<g filter="url(#rough)" stroke="${color}" fill="none" stroke-width="${4*s}"><ellipse cx="${x}" cy="${y-35*s}" rx="${52*s}" ry="${18*s}"/><path d="M${x-52*s} ${y-35*s}v${70*s}c0 ${24*s} ${104*s} ${24*s} ${104*s} 0v${-70*s}"/><ellipse cx="${x}" cy="${y+35*s}" rx="${52*s}" ry="${18*s}"/><path d="M${x-52*s} ${y}c0 ${22*s} ${104*s} ${22*s} ${104*s} 0" opacity=".65"/></g>`;
  if (kind === 'queue') return `<g filter="url(#rough)" stroke="${color}" fill="none" stroke-width="${4*s}"><rect x="${x-62*s}" y="${y-42*s}" width="${124*s}" height="${84*s}" rx="${16*s}"/>${[-36,0,36].map(dx => `<circle cx="${x+dx*s}" cy="${y}" r="${11*s}"/>`).join('')}<path d="M${x-48*s} ${y-55*s}h${96*s}" stroke-dasharray="8 7"/></g>`;
  if (kind === 'cache') return `<g filter="url(#rough)" stroke="${color}" fill="none" stroke-width="${4*s}">${[0,1,2].map(i => `<path d="M${x-56*s+i*7*s} ${y-14*s-i*16*s}l${48*s} ${-27*s}l${48*s} ${27*s}l${-48*s} ${27*s}Z"/>`).join('')}</g>`;
  if (kind === 'client') return `<g filter="url(#rough)" stroke="${color}" fill="none" stroke-width="${4*s}"><rect x="${x-55*s}" y="${y-48*s}" width="${110*s}" height="${76*s}" rx="${9*s}"/><path d="M${x-72*s} ${y+46*s}H${x+72*s}L${x+55*s} ${y+28*s}H${x-55*s}Z"/><rect x="${x+28*s}" y="${y-30*s}" width="${31*s}" height="${56*s}" rx="${5*s}"/></g>`;
  if (kind === 'shield') return `<g filter="url(#rough)" stroke="${color}" fill="none" stroke-width="${4*s}"><path d="M${x} ${y-65*s}l${54*s} ${21*s}v${42*s}c0 ${41*s}-${25*s} ${63*s}-${54*s} ${80*s}c-${29*s}-${54*s}-${54*s}-${80*s}v${-42*s}Z"/><path d="M${x-22*s} ${y}l${15*s} ${15*s}l${32*s}-${39*s}"/></g>`;
  if (kind === 'worker') return `<g filter="url(#rough)" stroke="${color}" fill="none" stroke-width="${4*s}"><circle cx="${x}" cy="${y}" r="${42*s}"/><circle cx="${x}" cy="${y}" r="${15*s}"/>${[0,60,120,180,240,300].map(a => { const r=a*Math.PI/180; return `<path d="M${x+42*s*Math.cos(r)} ${y+42*s*Math.sin(r)}l${18*s*Math.cos(r)} ${18*s*Math.sin(r)}"/>`; }).join('')}</g>`;
  return `<g filter="url(#rough)" stroke="${color}" fill="none" stroke-width="${4*s}"><path d="M${x} ${y-62*s}l${56*s} ${31*s}v${62*s}l${-56*s} ${31*s}l${-56*s}-${31*s}v${-62*s}Z"/><path d="M${x-56*s} ${y-31*s}l${56*s} ${32*s}l${56*s}-${32*s}M${x} ${y+1*s}v${61*s}"/></g>`;
}

function node(step, x, y, index, options = {}) {
  const color = options.color || slugColor(index);
  const scale = options.scale || 1;
  const titleLines = wrap(step.title || `Stage ${index + 1}`, options.titleWidth || 20, 2);
  const detailLines = wrap(step.detail || '', options.detailWidth || 35, options.detailLines ?? 2);
  const labelY = y + 102 * scale;
  return `<g>${componentShape(iconType(step), x, y, color, scale)}
    <circle cx="${x-74*scale}" cy="${y-62*scale}" r="${24*scale}" fill="${C.bg}" stroke="${color}" stroke-width="3" filter="url(#rough)"/>
    ${text(step.step || index + 1, x-74*scale, y-53*scale, 24*scale, color, 'middle')}
    ${text(titleLines, x, labelY, 27*scale, color, 'middle', 27*scale)}
    ${options.hideDetail ? '' : text(detailLines, x, labelY + titleLines.length*29*scale + 10, 18*scale, C.muted, 'middle', 20*scale)}
  </g>`;
}

function arrow(x1, y1, x2, y2, index, label = '', options = {}) {
  const color = options.color || slugColor(index);
  const bend = options.bend || 0;
  const d = bend ? `M${x1} ${y1}C${x1+bend} ${y1},${x2-bend} ${y2},${x2} ${y2}` : `M${x1} ${y1}L${x2} ${y2}`;
  const labelX = (x1+x2)/2;
  const labelY = (y1+y2)/2 - 16;
  return `${chalkPath(d, color, options.width || 4, options.dash || '', PALETTE.indexOf(color))}${label ? text(wrap(label, 24, 2), labelX, labelY, 19, color, 'middle', 20) : ''}`;
}

function description(item, y = 250) {
  return text(wrap(item.description, 102, 2), 720, y, 22, C.muted, 'middle', 27);
}

function header(key, set, item, index) {
  const [topic, lesson] = key.split('/');
  const family = topic === 'ddia' ? 'DESIGNING DATA-INTENSIVE APPLICATIONS' : topic === 'components' ? 'SYSTEM DESIGN BUILDING BLOCK' : 'CANONICAL DESIGN PROBLEM';
  const titleLines=wrap(item.title.toUpperCase(),27,3);
  const titleSize=titleLines.length===3?44:56;
  const titleLineHeight=titleLines.length===3?42:52;
  const titleY=titleLines.length===3?132:158;
  const descriptionY=titleY+(titleLines.length-1)*titleLineHeight+62;
  return `${chalkPath('M70 56H1370', C.amber, 4)}
    ${text(family, 72, 104, 20, C.amber, 'start', 22, 'letter-spacing="2.5"')}
    ${text(titleLines, 720, titleY, titleSize, C.chalk, 'middle', titleLineHeight)}
    ${text(`${index + 1} / ${set.items.length}  ·  ${lesson.toUpperCase()}`, 1368, 108, 21, C.muted, 'end')}
    ${description(item,descriptionY)}`;
}

function metricNotes(item, y = 1465) {
  const metrics = (item.numbers || []).slice(0, 3);
  if (!metrics.length) return '';
  return `<g>${metrics.map((metric, index) => {
    const x = 180 + index * 540;
    const color = slugColor(index);
    return `${chalkPath(`M${x-75} ${y+28}h150`, color, 3)}
      ${text(wrap(metric.label, 24, 1), x, y, 21, color, 'middle')}
      ${text(wrap(metric.value, 16, 2), x, y+65, 34, C.chalk, 'middle', 34)}
      ${text(wrap(metric.detail, 38, 2), x, y+128, 17, C.muted, 'middle', 19)}`;
  }).join('')}</g>`;
}

function mapLayout(item) {
  const steps = item.flow.slice(0, 6);
  const positionsByLength = {
    3: [[180,560],[720,930],[1260,560]],
    4: [[150,560],[500,890],[875,520],[1275,890]],
    5: [[145,560],[430,940],[720,520],[1010,940],[1295,560]],
    6: [[145,560],[400,930],[660,520],[920,930],[1175,520],[1295,1040]]
  };
  const positions = positionsByLength[steps.length] || positionsByLength[5];
  let svg = divider(330, 'Architecture and primary paths', C.cyan);
  svg += steps.map((step, index) => node(step, positions[index][0], positions[index][1], index, {scale:.82, detailWidth:29})).join('');
  for (let index=0; index<steps.length-1; index++) {
    const [x1,y1] = positions[index], [x2,y2] = positions[index+1];
    svg += arrow(x1 + (x2>x1?75:-75), y1, x2 - (x2>x1?75:-75), y2, index, index % 2 ? 'control / async' : 'request / data', {bend: (y1===y2?0:80)});
  }
  if (steps.length >= 4) svg += arrow(positions.at(-1)[0], positions.at(-1)[1]+100, positions[0][0], positions[0][1]+100, 2, 'feedback · observe · evolve', {color:C.green,bend:-310,dash:'11 10'});
  return svg;
}

function sequenceLayout(item) {
  const steps = item.flow.slice(0, 5);
  const xs = steps.map((_, index) => 130 + index * (1180 / Math.max(1, steps.length - 1)));
  let svg = divider(330, `${item.kind} · trace the interaction`, C.cyan);
  steps.forEach((step, index) => {
    svg += componentShape(iconType(step), xs[index], 440, slugColor(index), .63);
    svg += text(wrap(step.title, 16, 2), xs[index], 545, 24, slugColor(index), 'middle', 23);
    svg += chalkPath(`M${xs[index]} 585V1335`, C.dim, 2, '9 12');
  });
  steps.forEach((step, index) => {
    const from = index % 2 === 0 ? Math.min(index, steps.length-2) : Math.max(0, steps.length-1-index);
    const to = Math.min(from + 1, steps.length - 1);
    const y = 665 + index * 135;
    const color = slugColor(index);
    svg += arrow(xs[from], y, xs[to], y, index, step.title, {color, dash:index===steps.length-1?'10 9':''});
    svg += text(wrap(step.detail, 48, 2), (xs[from]+xs[to])/2, y+38, 17, C.muted, 'middle', 18);
  });
  if (steps.length > 2) svg += arrow(xs.at(-1), 1290, xs[0], 1290, 2, 'result / acknowledgement', {color:C.green,dash:'12 9'});
  return svg;
}

function comparisonLayout(item) {
  const options = item.flow.slice(0, 3);
  let svg = divider(330, 'Compare the architectures', C.purple);
  options.forEach((step, index) => {
    const left = 80 + index * 455;
    const x = left + 220;
    const color = slugColor(index);
    if (index) svg += chalkPath(`M${left-8} 390V1350`, C.dim, 2, '12 12');
    svg += text(`${index+1}`, left+35, 425, 34, color, 'middle');
    svg += text(wrap(step.title.toUpperCase(), 20, 2), x, 435, 33, color, 'middle', 31);
    const client = {title:'Caller',detail:'request'};
    const option = step;
    const store = {title:index===0?'Source of truth':index===1?'Replicas / peers':'Workers / streams',detail:'result'};
    svg += node(client, x, 610, 0, {scale:.58, hideDetail:true, color:C.green});
    svg += node(option, x, 870, index, {scale:.68, detailWidth:30, detailLines:3, color});
    svg += node(store, x, 1170, 2, {scale:.58, hideDetail:true, color:C.cyan});
    svg += arrow(x, 675, x, 792, index, 'request', {color:C.amber});
    svg += arrow(x, 950, x, 1095, index, 'data / decision', {color:C.cyan,dash:index?'10 8':''});
  });
  return svg;
}

function failureLayout(item) {
  const steps = item.flow.slice(0, 5);
  const xs = steps.slice(0,4).map((_, index) => 170 + index*360);
  let svg = divider(330, 'Normal path and bounded failure loop', C.coral);
  steps.slice(0,4).forEach((step,index) => { svg += node(step,xs[index],545,index,{scale:.65,detailWidth:25,detailLines:2}); if(index<3) svg += arrow(xs[index]+65,545,xs[index+1]-65,545,index,'normal'); });
  const failed = steps[3] || steps.at(-1);
  const retry = steps[4] || {step:5,title:'Retry / repair',detail:'Back off, cap attempts, isolate poison work, and recover safely.'};
  svg += chalkPath(`M${xs[2]} 650C${xs[2]} 760 1120 770 1120 880`, C.coral, 5, '11 8', 4);
  svg += text('timeout · crash · conflict', 1040, 750, 23, C.coral, 'middle');
  svg += node(failed,1120,940,3,{scale:.67,color:C.coral,detailWidth:28});
  svg += node(retry,650,1120,4,{scale:.72,color:C.purple,detailWidth:34,detailLines:3});
  svg += arrow(1040,1010,730,1090,3,'retry with backoff',{color:C.purple,dash:'11 8'});
  svg += arrow(585,1060,460,650,2,'replay / compensate',{color:C.green,bend:-120,dash:'12 9'});
  svg += text(wrap('Bound retries. Preserve idempotency. Keep the healthy path moving while failed work is isolated and observable.', 80, 2),720,1330,24,C.chalk,'middle',27);
  return svg;
}

function scaleLayout(item) {
  const steps = item.flow.slice(0, 6);
  let svg = divider(330, 'Partition · replicate · coordinate', C.amber);
  svg += node(steps[0] || {title:'Clients'},145,760,0,{scale:.68,detailWidth:25});
  svg += node(steps[1] || {title:'Router'},430,760,1,{scale:.7,detailWidth:25});
  svg += arrow(215,760,355,760,0,'key / request',{color:C.amber});
  const cx=760, cy=740, radius=235;
  svg += chalkPath(`M${cx} ${cy-radius}A${radius} ${radius} 0 1 1 ${cx-1} ${cy-radius}`,C.purple,4,'12 9');
  const ringNodes = [0,1,2,3].map(index => {
    const angle=(-90+index*90)*Math.PI/180; return [cx+radius*Math.cos(angle),cy+radius*Math.sin(angle)];
  });
  ringNodes.forEach((pos,index)=>{ svg += componentShape('db',pos[0],pos[1],slugColor(index+1),.45); svg += text(`N${index+1}`,pos[0],pos[1]+70,22,slugColor(index+1),'middle'); });
  svg += arrow(500,720,560,700,1,'hash / shard',{color:C.purple});
  svg += text('only a fraction remaps',760,1040,25,C.purple,'middle');
  const replicaStep = steps[2] || {title:'Replica set',detail:'Leader/quorum applies the chosen consistency contract.'};
  svg += node(replicaStep,1240,625,2,{scale:.62,detailWidth:25});
  svg += componentShape('db',1165,980,C.cyan,.45)+componentShape('db',1260,980,C.green,.45)+componentShape('db',1350,980,C.purple,.45);
  svg += text('replicas / regions',1260,1065,25,C.cyan,'middle');
  svg += arrow(990,700,1165,650,2,'replicate',{color:C.cyan,dash:'11 9'});
  svg += arrow(1160,920,920,875,3,'quorum / read repair',{color:C.green,dash:'11 9'});
  svg += text(wrap((steps[3] || steps.at(-1) || {detail:''}).detail,70,3),720,1275,22,C.muted,'middle',25);
  return svg;
}

function mechanismLayout(item) {
  const steps = item.flow.slice(0, 6);
  const center = steps[0] || {title:item.title,detail:item.description};
  const satellites = steps.slice(1);
  const cx=720, cy=760;
  let svg = divider(330, 'Mechanism and feedback paths', C.green);
  svg += node(center,cx,cy,0,{scale:1.02,detailWidth:40,detailLines:3,color:C.amber});
  satellites.forEach((step,index)=>{
    const angle=(-120+index*(240/Math.max(1,satellites.length-1)))*Math.PI/180;
    const x=cx+520*Math.cos(angle), y=cy+430*Math.sin(angle);
    const color=slugColor(index+1);
    svg += node(step,x,y,index+1,{scale:.61,detailWidth:25,detailLines:2,color});
    svg += arrow(cx+90*Math.cos(angle),cy+80*Math.sin(angle),x-70*Math.cos(angle),y-65*Math.sin(angle),index+1,index%2?'feedback':'data / control',{color,dash:index%2?'10 8':''});
  });
  return svg;
}

function mapPressureLenses(item) {
  if (!String(item.kind || '').toLowerCase().includes('map')) return '';
  const labels=(item.priorities || []).slice(0,3);
  return `<g>${labels.map((label,index)=>{
    const x=240+index*480;
    const color=slugColor(index+2);
    const supporting=(item.tradeoffs || [])[index] || (item.numbers || [])[index]?.detail || item.description;
    return `${chalkPath(`M${x} 1135v65`,color,3,'8 8')}
      <circle cx="${x}" cy="1245" r="48" fill="none" stroke="${color}" stroke-width="4" filter="url(#rough)"/>
      ${text(index===0?'!':index===1?'↗':'✓',x,1260,40,color,'middle')}
      ${text(wrap(label.toUpperCase(),20,2),x,1325,24,color,'middle',24)}
      ${text(wrap(supporting,42,2),x,1380,16,C.muted,'middle',18)}`;
  }).join('')}</g>`;
}

function architecture(item) {
  const kind = String(item.kind || '').toLowerCase();
  const subject = `${item.id || ''} ${item.title || ''}`.toLowerCase();
  if (kind.includes('comparison')) return comparisonLayout(item);
  if (kind.includes('failure')) return failureLayout(item);
  if (kind.includes('scale')) return scaleLayout(item);
  if (/consistent.hash.ring|quorum.overlap|geohash|replication.isr/.test(subject)) return scaleLayout(item);
  if (/threshold.bands|chunking.strategy|density.skew|latency.fork/.test(subject)) return comparisonLayout(item);
  if (kind.includes('lifecycle') || kind.includes('request')) return sequenceLayout(item);
  if (/window|segmented.log|hot.key|paged.kv|point.in.time|tsdb|trace.sampling|exclusive.claim|signing|inverted.index|latency.budget|two.stage|refresh.rotation|key.rotation/.test(subject)) return sequenceLayout(item);
  if (kind.includes('read') || kind.includes('write') || kind.includes('correctness')) return sequenceLayout(item);
  if (kind.includes('map')) return mapLayout(item);
  return mechanismLayout(item);
}

function bullets(items, x, y, width, color, limit = 4) {
  return (items || []).slice(0,limit).map((value,index)=>{
    const lines=wrap(value,Math.floor(width/11),2); const yy=y+index*62;
    return `<circle cx="${x}" cy="${yy-7}" r="6" fill="none" stroke="${color}" stroke-width="3" filter="url(#rough)"/>${text(lines,x+20,yy,18,C.chalk,'start',20)}`;
  }).join('');
}

function footer(item) {
  const firstTradeoff=(item.tradeoffs || [])[0] || 'State the invariant, then choose the mechanism and its operational cost.';
  const secondTradeoff=(item.tradeoffs || [])[1] || 'Optimize the dominant path without hiding failure or freshness costs.';
  return `${divider(1640,'Interview decision notes',C.green)}
    ${text('PRIORITIES',82,1705,25,C.green)}${bullets(item.priorities,90,1745,340,C.green,4)}
    ${chalkPath('M462 1690V2130',C.dim,2,'10 12')}
    ${text('DECISION GUIDE',505,1705,25,C.cyan)}
    ${text(wrap(item.description,42,6),505,1750,19,C.chalk,'start',23)}
    ${text('OPTIMIZE',505,1925,23,C.purple)}
    ${bullets((item.numbers || []).map(metric=>`${metric.value}: ${metric.label}`),512,1965,365,C.purple,3)}
    ${chalkPath('M930 1690V2130',C.dim,2,'10 12')}
    ${text('TRADE-OFFS',972,1705,25,C.coral)}
    ${text(wrap(firstTradeoff,36,7),972,1750,19,C.chalk,'start',23)}
    ${text(wrap(secondTradeoff,36,6),972,1950,18,C.muted,'start',22)}
    ${chalkPath('M72 2155H1368',C.dim,2)}
    ${text('JS DRILL · ARCHITECTURE FIRST · NUMBERS BESIDE CONSTRAINTS · FAILURE PATHS · TRADE-OFFS',720,2205,19,C.muted,'middle',20,'letter-spacing="1.2"')}`;
}

function renderSvg(key,set,item,index) {
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${defs()}
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${C.bg}"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${C.bg}" filter="url(#paper)" opacity=".48"/>
    ${header(key,set,item,index)}${architecture(item)}${mapPressureLenses(item)}${metricNotes(item)}${footer(item)}
  </svg>`;
}

function exportPng(svgFile,rawFile,optimizedFile,output) {
  execFileSync('inkscape',[svgFile,'--export-type=png',`--export-filename=${rawFile}`,`--export-width=${WIDTH}`],{stdio:'pipe'});
  execFileSync('convert',[rawFile,'-strip','-colors','256',`PNG8:${optimizedFile}`],{stdio:'pipe'});
  execFileSync('identify',[optimizedFile],{stdio:'pipe'});
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.copyFileSync(optimizedFile,output);
}

function arg(name) {
  const prefix=`--${name}=`;
  const value=process.argv.find(entry=>entry.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function main() {
  const preview=process.argv.includes('--preview');
  const missing=process.argv.includes('--missing');
  const rerenderV2=process.argv.includes('--rerender-v2');
  const keyFilter=arg('key');
  const idFilter=arg('id');
  const offset=Number(arg('offset') || 0);
  const limit=Number(arg('limit') || Number.MAX_SAFE_INTEGER);
  const candidates=[];
  for (const [key,set] of Object.entries(SETS)) {
    set.items.forEach((item,index)=>{
      const [topic,lesson]=key.split('/');
      const output=path.join(OUT,topic,lesson,`${item.id}.png`);
      const shouldRenderMissing=missing && !fs.existsSync(output);
      if (!shouldRenderMissing && item.renderer !== 'diagram-v1' && !(rerenderV2 && item.artwork === 'chalkboard-architecture-v2')) return;
      if (keyFilter && key !== keyFilter) return;
      if (idFilter && item.id !== idFilter) return;
      candidates.push({key,set,item,index});
    });
  }
  const selected=candidates.slice(offset,offset+limit);
  if (!selected.length) {
    if (preview || missing || keyFilter || idFilter) throw new Error('No pending infographic matched the requested filters.');
    console.log('No pending diagram-v1 infographics; reviewed static artwork is already registered.');
    return;
  }
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jsdrill-chalkboard-'));
  const fontCache=path.join(tmp,'font-cache');
  const fontConfig=path.join(tmp,'fonts.conf');
  fs.mkdirSync(fontCache,{recursive:true});
  fs.writeFileSync(fontConfig,`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><include ignore_missing="yes">/etc/fonts/fonts.conf</include><dir>${xml(path.dirname(FONT))}</dir><cachedir>${xml(fontCache)}</cachedir></fontconfig>`);
  process.env.FONTCONFIG_FILE=fontConfig;
  selected.forEach(({key,set,item,index},selectedIndex)=>{
    const [topic,lesson]=key.split('/');
    const stem=`${topic}-${lesson}-${item.id}`;
    const svgFile=path.join(tmp,`${stem}.svg`);
    const rawFile=path.join(tmp,`${stem}-raw.png`);
    const optimizedFile=path.join(tmp,`${stem}-optimized.png`);
    const output=preview
      ? path.join('/tmp',`jsdrill-preview-${topic}-${lesson}-${item.id}.png`)
      : path.join(OUT,topic,lesson,`${item.id}.png`);
    fs.writeFileSync(svgFile,renderSvg(key,set,item,index));
    exportPng(svgFile,rawFile,optimizedFile,output);
    if (!preview) {
      item.width=WIDTH; item.height=HEIGHT; delete item.renderer;
      item.artwork='chalkboard-architecture-v2';
    }
    console.log(`  ✓ ${output} (${key}/${item.id})`);
  });
  if (!preview) fs.writeFileSync(DATA_FILE,`${JSON.stringify(document,null,2)}\n`);
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log(`${preview?'Previewed':'Rendered'} ${selected.length} architecture-first PNG${selected.length===1?'':'s'}.`);
}

main();
