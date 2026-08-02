#!/usr/bin/env node
// Render text-first multi-sheet guides into deterministic, downloadable PNG
// infographics. The renderer uses reusable architecture primitives and exact
// source text; it does not capture lesson-page screenshots.

const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data/system-design');
const OUT = path.join(ROOT, 'assets/system-design/infographics');
const SETS = JSON.parse(fs.readFileSync(path.join(DATA, 'infographic-sets.json'), 'utf8')).sets;
const WIDTH = 1440, HEIGHT = 2400;

const C = {
  bg:'#101216', grid:'#1b2027', panel:'#171b21', line:'#39414c', text:'#f4f1e8',
  muted:'#a9b0ba', amber:'#f5b62b', cyan:'#62d5d0', coral:'#f2765b',
  purple:'#a995e8', green:'#7bd88f', ink:'#0e1014'
};
const COLORS = [C.amber, C.cyan, C.purple, C.green, C.coral, C.cyan];

function xml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
}

function wrap(value, maxChars, maxLines = Infinity) {
  const words = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = []; let line = '';
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

function text(lines, x, y, size, lineHeight, attributes = '') {
  const values = Array.isArray(lines) ? lines : [lines];
  return `<text x="${x}" y="${y}" font-size="${size}" ${attributes}>${values.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${xml(line)}</tspan>`).join('')}</text>`;
}

function defs() {
  return `<defs>
    <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="${C.grid}" stroke-width="1"/></pattern>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="9" stdDeviation="9" flood-color="#000" flood-opacity=".45"/></filter>
    ${COLORS.map((color,index)=>`<marker id="arrow-${index}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker>`).join('')}
  </defs>`;
}

function section(label, y, color = C.amber) {
  return `<text x="72" y="${y}" font-size="15" font-weight="900" letter-spacing="3.2" fill="${color}">${xml(label.toUpperCase())}</text><path d="M72 ${y+18}H1368" stroke="${C.line}" stroke-width="2"/>`;
}

function iconKind(step) {
  const value = `${step.title} ${step.detail}`.toLowerCase();
  if (/database|store|ledger|warehouse|index|table|state|replica/.test(value)) return 'db';
  if (/queue|broker|log|stream|event|outbox|kafka/.test(value)) return 'queue';
  if (/cache|cdn|edge|memo/.test(value)) return 'cache';
  if (/client|user|caller|reader|writer|request/.test(value)) return 'client';
  if (/policy|auth|limit|validate|fence|security|permission/.test(value)) return 'shield';
  return 'service';
}

function icon(kind, x, y, color) {
  if (kind === 'db') return `<g><ellipse cx="${x}" cy="${y-23}" rx="42" ry="14" fill="${C.panel}" stroke="${color}" stroke-width="4"/><path d="M${x-42} ${y-23}V${y+25}C${x-42} ${y+43},${x+42} ${y+43},${x+42} ${y+25}V${y-23}" fill="${C.panel}" stroke="${color}" stroke-width="4"/><ellipse cx="${x}" cy="${y+25}" rx="42" ry="14" fill="none" stroke="${color}" stroke-width="3"/></g>`;
  if (kind === 'queue') return `<g><rect x="${x-48}" y="${y-32}" width="96" height="64" rx="12" fill="${C.panel}" stroke="${color}" stroke-width="4"/>${[-27,0,27].map(dx=>`<circle cx="${x+dx}" cy="${y}" r="8" fill="${color}"/>`).join('')}</g>`;
  if (kind === 'cache') return `<g>${[0,1,2].map(i=>`<path d="M${x-44+i*7} ${y-14-i*9}l40 -22l40 22l-40 22Z" fill="${C.panel}" stroke="${color}" stroke-width="3"/>`).join('')}</g>`;
  if (kind === 'client') return `<g><rect x="${x-43}" y="${y-35}" width="86" height="60" rx="9" fill="${C.panel}" stroke="${color}" stroke-width="4"/><path d="M${x-55} ${y+36}H${x+55}L${x+43} ${y+25}H${x-43}Z" fill="${C.panel}" stroke="${color}" stroke-width="3"/></g>`;
  if (kind === 'shield') return `<g><path d="M${x} ${y-46}l39 16v31c0 28-18 43-39 55c-21-12-39-27-39-55v-31Z" fill="${C.panel}" stroke="${color}" stroke-width="4"/><path d="M${x-17} ${y+1}l12 12l24-29" fill="none" stroke="${color}" stroke-width="5"/></g>`;
  return `<g><path d="M${x} ${y-43}l40 22v45l-40 23l-40-23v-45Z" fill="${C.panel}" stroke="${color}" stroke-width="4"/><path d="M${x-40} ${y-21}l40 23l40-23M${x} ${y+2}v45" fill="none" stroke="${color}" stroke-width="3"/></g>`;
}

function flowRows(item) {
  const rows = item.flow.slice(0, 6);
  const start = 470;
  const available = 770;
  const gap = rows.length > 1 ? available / (rows.length - 1) : 0;
  return rows.map((step,index) => {
    const y = start + index * gap;
    const color = COLORS[index % COLORS.length];
    const titleLines = wrap(step.title, 31, 2);
    const detailLines = wrap(step.detail, 74, 2);
    const connector = index < rows.length - 1
      ? `<path d="M164 ${y+48}C125 ${y+80},125 ${y+gap-80},164 ${y+gap-50}" fill="none" stroke="${color}" stroke-width="5" stroke-dasharray="10 8" marker-end="url(#arrow-${index % COLORS.length})"/>`
      : '';
    return `<g>
      ${connector}<circle cx="164" cy="${y}" r="54" fill="${C.ink}" stroke="${color}" stroke-width="5"/>
      ${icon(iconKind(step),164,y,color)}
      <circle cx="102" cy="${y-45}" r="22" fill="${color}"/><text x="102" y="${y-37}" text-anchor="middle" font-size="18" font-weight="950" fill="${C.ink}">${step.step}</text>
      <rect x="260" y="${y-62}" width="1108" height="124" rx="18" fill="${C.panel}" stroke="${color}" stroke-width="3" filter="url(#shadow)"/>
      ${text(titleLines,294,y-(titleLines.length>1?22:8),24,28,`font-weight="900" fill="${C.text}"`)}
      ${text(detailLines,690,y-(detailLines.length>1?12:0),17,23,`font-weight="550" fill="${C.muted}"`)}
    </g>`;
  }).join('');
}

function metrics(item) {
  return item.numbers.slice(0,3).map((metric,index) => {
    const x = 72 + index * 444;
    const color = COLORS[index];
    return `<g><rect x="${x}" y="1438" width="408" height="218" rx="18" fill="${C.panel}" stroke="${color}" stroke-width="3"/>
      <text x="${x+22}" y="1480" font-size="14" font-weight="900" letter-spacing="1.4" fill="${C.muted}">${xml(wrap(metric.label,31,1)[0].toUpperCase())}</text>
      ${text(wrap(metric.value,18,2),x+22,1538,29,34,`font-weight="950" fill="${color}"`)}
      ${text(wrap(metric.detail,42,3),x+22,1600,15,20,`fill="${C.muted}"`)}</g>`;
  }).join('');
}

function bulletList(items, x, y, width, color, limit = 4) {
  return items.slice(0,limit).map((item,index) => {
    const lines = wrap(item, Math.floor(width / 10), 2);
    const offset = index * 72;
    return `<circle cx="${x}" cy="${y+offset-6}" r="7" fill="${color}"/>${text(lines,x+22,y+offset,16,21,`font-weight="650" fill="${C.text}"`)}`;
  }).join('');
}

function tradeoffCards(item) {
  return item.tradeoffs.slice(0,2).map((tradeoff,index) => {
    const x = 72 + index * 666;
    const color = index ? C.cyan : C.coral;
    return `<g><rect x="${x}" y="2032" width="630" height="260" rx="18" fill="${C.panel}" stroke="${color}" stroke-width="3"/>
      <text x="${x+24}" y="2075" font-size="14" font-weight="900" letter-spacing="2" fill="${color}">${index ? 'ALTERNATIVE / COST' : 'PRIMARY TRADE-OFF'}</text>
      ${text(wrap(tradeoff,58,7),x+24,2122,17,24,`font-weight="600" fill="${C.text}"`)}</g>`;
  }).join('');
}

function renderSvg(key, set, item, index) {
  const [topic, lesson] = key.split('/');
  const titleLines = wrap(item.title, 38, 2);
  const purpose = wrap(item.description, 92, 2);
  const family = topic === 'ddia' ? 'DDIA' : topic === 'components' ? 'BUILDING BLOCK' : 'CANONICAL DESIGN PROBLEM';
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${defs()}
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${C.bg}"/><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>
    <path d="M72 52H1368" stroke="${C.amber}" stroke-width="5"/>
    <circle cx="116" cy="126" r="42" fill="${C.amber}"/><text x="116" y="136" text-anchor="middle" font-size="23" font-weight="950" fill="${C.ink}">${index+1}/${set.items.length}</text>
    <text x="180" y="102" font-size="15" font-weight="900" letter-spacing="3" fill="${C.amber}">${xml(family)} · ${xml(lesson.toUpperCase())}</text>
    ${text(titleLines,180,158,46,50,`font-weight="950" fill="${C.text}"`)}
    ${text(purpose,72,titleLines.length>1?286:244,20,28,`font-weight="600" fill="${C.muted}"`)}
    ${section('Trace the flow',354,C.cyan)}${flowRows(item)}
    ${section('Numbers and operating assumptions',1392,C.amber)}${metrics(item)}
    ${section('Priorities and focus',1712,C.green)}
    <rect x="72" y="1750" width="1296" height="224" rx="18" fill="${C.panel}" stroke="${C.green}" stroke-width="3"/>
    ${bulletList(item.priorities.slice(0,2),110,1792,570,C.green,2)}
    ${bulletList(item.priorities.slice(2),750,1792,570,C.amber,2)}
    ${section('Decision-driving trade-offs',1995,C.coral)}${tradeoffCards(item)}
    <text x="72" y="2360" font-size="14" font-weight="850" letter-spacing="2" fill="${C.muted}">JS DRILL · ${xml(key.toUpperCase())} · ${xml(item.id.toUpperCase())}</text>
    <text x="1368" y="2360" text-anchor="end" font-size="14" font-weight="850" fill="${C.cyan}">MAP · FLOW · SCALE · FAILURE · TRADE-OFF</text>
  </svg>`;
}

function exportPng(svgFile, rawFile, optimizedFile, output, id) {
  for (let attempt=1; attempt<=3; attempt++) {
    fs.rmSync(rawFile,{force:true}); fs.rmSync(optimizedFile,{force:true});
    execFileSync('inkscape',[svgFile,'--export-type=png',`--export-filename=${rawFile}`,`--export-width=${WIDTH}`],{stdio:'pipe'});
    execFileSync('convert',[rawFile,'-strip','-colors','256',`PNG8:${optimizedFile}`],{stdio:'pipe'});
    try {
      execFileSync('identify',[optimizedFile],{stdio:'pipe'});
      fs.mkdirSync(path.dirname(output),{recursive:true}); fs.copyFileSync(optimizedFile,output); return;
    } catch (error) {
      if (attempt === 3) throw new Error(`${id} failed PNG decode after ${attempt} exports`);
    }
  }
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'jsdrill-multi-infographics-'));
  let rendered = 0, preserved = 0;
  for (const [key,set] of Object.entries(SETS)) {
    const [topic,lesson] = key.split('/');
    let setRendered = false;
    set.items.forEach((item,index) => {
      if (item.renderer !== 'diagram-v1') { preserved++; return; }
      const stem = `${topic}-${lesson}-${item.id}`;
      const svgFile = path.join(tmp,`${stem}.svg`);
      const rawFile = path.join(tmp,`${stem}-raw.png`);
      const optimizedFile = path.join(tmp,`${stem}-optimized.png`);
      const output = path.join(OUT,topic,lesson,`${item.id}.png`);
      fs.writeFileSync(svgFile,renderSvg(key,set,item,index));
      exportPng(svgFile,rawFile,optimizedFile,output,`${key}/${item.id}`);
      rendered++; setRendered = true;
      console.log(`  ✓ ${path.relative(ROOT,output)}`);
    });
    if (setRendered) fs.rmSync(path.join(OUT,topic,`${lesson}.png`),{force:true});
  }
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log(`Rendered ${rendered} focused PNGs (${WIDTH}×${HEIGHT}); preserved ${preserved} hand-drawn pilot PNGs.`);
}

main();
