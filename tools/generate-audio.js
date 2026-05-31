#!/usr/bin/env node
// Generate two-voice audio episodes from audio-scripts/<lessonId>.md via
// saythetext.com's REST API.
//
// Flow per clip:
//   1. POST /auth/login {email, password}  →  JWT  (once per run, cached)
//   2. POST /tts/convert (multipart text/voice/speed, Bearer JWT)  →  job id
//   3. Poll GET /tts/jobs/{id} until status === 'completed'
//   4. GET /tts/download/{id}  →  audio bytes  →  write to audio/<lessonId>/s<N>-<say|why>.<ext>
//
// Existing output files are skipped (re-run is idempotent). Delete a file to
// regenerate.
//
// Usage:
//   node tools/generate-audio.js                  # default lesson: p-merge-k-lists
//   node tools/generate-audio.js <lessonId>
//
// Env (read from .env at repo root):
//   SAYTHETEXT_EMAIL       required
//   SAYTHETEXT_PASSWORD    required
//   SAYTHETEXT_VOICE_A     default am_michael  (the "say" voice)
//   SAYTHETEXT_VOICE_B     default af_sky      (the "why" voice)
//   SAYTHETEXT_SPEED       default 100         (1-200; 100 = natural)
//
// NOTE: saythetext.com publishes a WebSocket streaming endpoint
// (wss://api.saythetext.com/ws/tts/stream?key=sk_...) in their API reference,
// but as of 2026-05-29 that route is unrouted and returns 404. If/when they
// wire it up, switching the generator back to a streaming WS flow is one
// function-swap away — keep this file as the REST-flow reference until then.

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.saythetext.com';
const POLL_INTERVAL_MS = 1500;
const JOB_TIMEOUT_MS = 180000;          // 3 min/clip is generous

function readDotenv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

// Parse the audio-scripts/<lessonId>.md into one clip per ### Clip header.
// Header form: ### Clip <N><A|B> — Voice <A|B> → `<path>`. Body = everything
// until the next ### / --- / EOF. The doc's header is the single source of
// truth for the destination path.
function parseScriptDoc(md) {
  const chunks = [];
  const re = /### Clip (\d+)([AB])[^\n]*→\s*`([^`]+)`\s*\n([\s\S]*?)(?=\n### |\n---|$)/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    const [, section, voiceLetter, outputPath, body] = m;
    chunks.push({
      section: parseInt(section, 10),
      voice: voiceLetter === 'A' ? 'a' : 'b',
      // The script doc shows .mp3 in its headers for human readability; the
      // actual extension is whatever saythetext returns (likely .mp3). The
      // player tries .wav first then .mp3 so either works in production.
      outputPath,
      text: body.trim()
    });
  }
  return chunks;
}

async function login(email, password) {
  const res = await fetch(API_BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Login failed: ' + res.status + ' ' + txt.slice(0, 200));
  }
  const body = await res.json();
  const token = body.access_token || body.token || body.jwt;
  if (!token) throw new Error('Login response missing token: ' + JSON.stringify(body).slice(0, 200));
  return token;
}

async function submitJob(token, text, voice, speed) {
  // multipart/form-data per the OpenAPI spec. Node 20+ exposes FormData.
  const fd = new FormData();
  fd.set('text', text);
  fd.set('voice', voice);
  fd.set('speed', String(speed));
  const res = await fetch(API_BASE + '/tts/convert', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: fd
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Submit failed: ' + res.status + ' ' + txt.slice(0, 200));
  }
  const body = await res.json();
  if (body.id === undefined) throw new Error('Submit response missing id: ' + JSON.stringify(body).slice(0, 200));
  return body;
}

async function pollUntilDone(token, jobId) {
  const deadline = Date.now() + JOB_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(API_BASE + '/tts/jobs/' + jobId, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Poll failed: ' + res.status);
    const body = await res.json();
    const status = (body.status || '').toLowerCase();
    if (status === 'completed' || status === 'complete' || status === 'done' || status === 'success' || status === 'finished') {
      return body;
    }
    if (status === 'failed' || status === 'error') {
      throw new Error('Job failed server-side: ' + JSON.stringify(body).slice(0, 200));
    }
  }
  throw new Error('Job poll timed out after ' + (JOB_TIMEOUT_MS / 1000) + 's');
}

async function downloadAudio(token, jobId) {
  const res = await fetch(API_BASE + '/tts/download/' + jobId, {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Download failed: ' + res.status + ' ' + txt.slice(0, 200));
  }
  const contentType = res.headers.get('content-type') || '';
  const buf = Buffer.from(await res.arrayBuffer());
  // Derive a sane file extension from Content-Type — we want the on-disk
  // filename to match what the audio player probes for (.wav / .mp3).
  let ext = 'mp3';
  if (/wav/i.test(contentType)) ext = 'wav';
  else if (/ogg/i.test(contentType)) ext = 'ogg';
  return { buf, ext, contentType };
}

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const env = readDotenv(path.join(repoRoot, '.env'));
  if (!env.SAYTHETEXT_EMAIL || !env.SAYTHETEXT_PASSWORD) {
    console.error('Missing SAYTHETEXT_EMAIL / SAYTHETEXT_PASSWORD in .env');
    process.exit(1);
  }
  const lessonId = process.argv[2] || 'p-merge-k-lists';
  const scriptFile = path.join(repoRoot, 'audio-scripts', lessonId + '.md');
  if (!fs.existsSync(scriptFile)) {
    console.error('No script doc at', scriptFile);
    process.exit(1);
  }
  const chunks = parseScriptDoc(fs.readFileSync(scriptFile, 'utf8'));
  if (chunks.length === 0) {
    console.error('No ### Clip headers parsed from', scriptFile);
    process.exit(1);
  }

  const voiceA = env.SAYTHETEXT_VOICE_A || 'am_michael';
  const voiceB = env.SAYTHETEXT_VOICE_B || 'af_sky';
  const speed = parseInt(env.SAYTHETEXT_SPEED || '100', 10);
  console.log(`Logging in as ${env.SAYTHETEXT_EMAIL}…`);
  const token = await login(env.SAYTHETEXT_EMAIL, env.SAYTHETEXT_PASSWORD);
  console.log(`✓ logged in. Generating ${chunks.length} clips for ${lessonId}  (voice A=${voiceA}, voice B=${voiceB})`);

  let okCount = 0, skipCount = 0, failCount = 0;
  for (const c of chunks) {
    const voice = c.voice === 'a' ? voiceA : voiceB;
    const label = `s${c.section}-${c.voice === 'a' ? 'say' : 'why'}`;
    // Resolve the on-disk path: strip the extension shown in the script doc
    // and check both .wav and .mp3 before submitting — either counts as
    // "already done" so a partial run resumes cleanly.
    const baseRel = c.outputPath.replace(/\.(wav|mp3|ogg)$/i, '');
    const baseAbs = path.join(repoRoot, baseRel);
    fs.mkdirSync(path.dirname(baseAbs), { recursive: true });
    const existing = ['wav', 'mp3', 'ogg'].find(e => fs.existsSync(baseAbs + '.' + e));
    if (existing) {
      console.log(`[skip] ${label}  →  ${baseRel}.${existing}  (exists; delete to regenerate)`);
      skipCount++;
      continue;
    }
    process.stdout.write(`[gen]  ${label}  voice=${voice}  ${c.text.length}ch  →  `);
    try {
      const t0 = Date.now();
      const job = await submitJob(token, c.text, voice, speed);
      await pollUntilDone(token, job.id);
      const { buf, ext } = await downloadAudio(token, job.id);
      const outPath = baseAbs + '.' + ext;
      fs.writeFileSync(outPath, buf);
      const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`${(buf.length / 1024).toFixed(0)}KB ${ext}  ·  ${elapsedS}s total`);
      okCount++;
    } catch (e) {
      console.log('FAIL: ' + e.message);
      failCount++;
    }
  }
  console.log(`\nDone. ${okCount} generated · ${skipCount} skipped · ${failCount} failed.`);
  if (failCount > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
