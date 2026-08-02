#!/usr/bin/env node
// Install built-in image-generation outputs into their registered asset paths,
// preserving aspect ratio and marking the source sheet as final artwork.

const fs = require('fs');
const path = require('path');
const os = require('os');
const {execFileSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SETS_FILE = path.join(ROOT, 'data/system-design/infographic-sets.json');
const OUT = path.join(ROOT, 'assets/system-design/infographics');
const document = JSON.parse(fs.readFileSync(SETS_FILE, 'utf8'));
const records = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

for (const record of records) {
  const set = document.sets[record.key];
  const item = set && set.items.find(candidate => candidate.id === record.id);
  if (!item) throw new Error(`Unknown infographic ${record.key}/${record.id}`);
  if (!fs.existsSync(record.source)) throw new Error(`Missing generated source ${record.source}`);
  const dimensions = execFileSync('identify',['-format','%w %h',record.source],{encoding:'utf8'}).trim().split(/\s+/).map(Number);
  const width = 1440;
  const height = Math.round(width * dimensions[1] / dimensions[0]);
  if (height < 2000 || height > 3600) throw new Error(`Unexpected generated ratio for ${record.key}/${record.id}: ${dimensions.join('×')}`);
  const tmp = path.join(os.tmpdir(),`jsdrill-${record.id}-${process.pid}.png`);
  const output = path.join(OUT,record.key,`${record.id}.png`);
  execFileSync('convert',[record.source,'-resize',`${width}x${height}!`,'-strip','-colors','256',`PNG8:${tmp}`],{stdio:'pipe'});
  execFileSync('identify',[tmp],{stdio:'pipe'});
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.copyFileSync(tmp,output); fs.rmSync(tmp,{force:true});
  item.width = width; item.height = height;
  delete item.renderer;
  item.artwork = 'chalkboard-architecture-v1';
  console.log(`  ✓ ${path.relative(ROOT,output)} (${width}×${height})`);
}

fs.writeFileSync(SETS_FILE,`${JSON.stringify(document,null,2)}\n`);
