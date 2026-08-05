// ──────────────────────────────────────────────────────────────────────────
//  AUDIO EPISODES — two-voice podcast playback over Conversation-tab content.
//
//  Two surfaces, one persistent playback state:
// (1) #audio-modal — playlist entry point. Pick an episode → modal closes.
//    (2) #audio-dock — fixed bottom bar. Renders while audio is queued, even
//        across tab and lesson navigation. Closing it stops + clears state.
//
//  State lives at module scope (not inside initAudioPlayer) so it survives
//  any re-renders triggered by tab/lesson navigation. initAudioPlayer is
//  called once on boot and is purely event wiring.
//
//  Prefers pre-generated audio at audio/<lessonId>/s<N>-<say|why>.{wav,mp3}.
//  Falls back to SpeechSynthesis with two distinct voices (immediate
//  experience; on-screen only — both iOS Safari and Android Chrome pause
//  SpeechSynthesis when the screen locks).
//
//  Prototype scope: one curated episode (Merge K Sorted Lists). EPISODES is
//  the only thing to extend to add more — paths follow a fixed convention.
// ──────────────────────────────────────────────────────────────────────────

// Module-scope playback state. queue is null when nothing is loaded; the
// dock auto-hides off the empty queue (renderDock).
let _audioQueue = null;            // null | [{ section, title, voice, text, audioPaths }]
let _audioClipIdx = 0;
let _audioPlaying = false;
let _audioMode = '';               // '' | 'file' | 'tts'
let _audioLessonId = null;
let _audioLessonTitle = null;
let _audioCurrentEl = null;        // active HTMLAudioElement, if any
let _audioVoicesCache = null;
const _audioFileExistsCache = {};

// All Patterns + Applied lessons carry a `conversation` block (per CLAUDE.md
// OOB-2026-05-24, 99/99 coverage). Syntax-track lessons don't, so they're
// not surfaced here. Derived live from CURRICULUM rather than hardcoded so
// new lessons are picked up automatically.
function getAudioEpisodes() {
  if (typeof CURRICULUM === 'undefined') return [];
  return CURRICULUM
    .filter(l => l.status === 'full' && (l.track === 'patterns' || l.track === 'applied'))
    .map(l => ({ lessonId: l.id, title: l.title, section: l.section }));
}

function initAudioPlayer() {
  const modal = document.getElementById('audio-modal');
  const dock = document.getElementById('audio-dock');
  if (!modal || !dock) return;
  const playlistEl = document.getElementById('audio-playlist');
  const modalClose = document.getElementById('audio-modal-close');
  const dockMeta = document.getElementById('audio-dock-meta');
  const dockPrev = document.getElementById('audio-dock-prev');
  const dockNext = document.getElementById('audio-dock-next');
  const dockPlaypause = document.getElementById('audio-dock-playpause');
  const dockCloseBtn = document.getElementById('audio-dock-close');

  // SpeechSynthesis voice list arrives async on some browsers. Bust the
  // cache when voices change so the next clip picks a real voice pair.
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => { _audioVoicesCache = null; };
  }

  // ── Playlist (modal) ──────────────────────────────────────────────────
  function openPlaylist() {
    const episodes = getAudioEpisodes();
    // Group lessons by section, preserving CURRICULUM order so the playlist
    // reads top-to-bottom in the same order as the sidebar (Arrays & Hashing
    // → Two Pointers → … → Applied Problems).
    const sectionOrder = [];
    const bySection = new Map();
    for (const ep of episodes) {
      if (!bySection.has(ep.section)) { bySection.set(ep.section, []); sectionOrder.push(ep.section); }
      bySection.get(ep.section).push(ep);
    }
    const blocks = sectionOrder.map(section => {
      const rows = bySection.get(section).map(ep => {
        const isPlaying = _audioLessonId === ep.lessonId && _audioQueue;
        const marker = isPlaying
          ? '<span style="color:#f5b62b;">●</span>'
          : `<span style="color:#6b7079;">${dsIcon('play', 13)}</span>`;
        return `<button class="audio-episode" data-ep-id="${escapeHtml(ep.lessonId)}" style="text-align:left; background:#262930; border-radius:6px; padding:8px 12px; color:#eef0f2; display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:13px; border:1px solid ${isPlaying ? '#f5b62b' : 'transparent'};">
          <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(ep.title)}</span>
          ${marker}
        </button>`;
      }).join('');
      return `<div style="display:flex; flex-direction:column; gap:4px; margin-top:14px;">
        <div style="font-size:10px; color:#6b7079; text-transform:uppercase; letter-spacing:0.5px; padding:0 4px;">${escapeHtml(section)}  ·  ${bySection.get(section).length}</div>
        ${rows}
      </div>`;
    }).join('');
    playlistEl.innerHTML = blocks || '<div style="color:#6b7079; font-size:13px; padding:12px;">No episodes yet.</div>';
    playlistEl.querySelectorAll('.audio-episode').forEach(btn => {
      btn.addEventListener('click', () => startEpisode(btn.dataset.epId));
    });
    modal.style.display = 'block';
  }
  function closePlaylist() { modal.style.display = 'none'; }

  // Picking an episode replaces any in-flight playback (like switching
  // podcast episodes) and immediately auto-plays clip 1.
  async function startEpisode(lessonId) {
    const lesson = findLesson(lessonId);
    if (!lesson) return;
    const body = await loadLessonContent(lessonId);
    if (!body || !body.conversation || !Array.isArray(body.conversation.sections)) {
      playlistEl.insertAdjacentHTML('beforeend', '<div style="color:#f87171; font-size:12px; padding:8px;">No conversation content on this lesson.</div>');
      return;
    }
    stopAll();
    _audioQueue = [];
    body.conversation.sections.forEach((sec, idx) => {
      const sectionNum = idx + 1;
      const title = sec.title || ('Section ' + sectionNum);
      // Sections that walk through examples (typical "Trace" section) carry
      // `intro` instead of `say`. Treat either as Voice A content.
      const voiceAText = sec.say || sec.intro;
      if (voiceAText) _audioQueue.push({
        section: sectionNum, title, voice: 'a', text: cleanForTts(voiceAText),
        audioPaths: ['audio/' + lessonId + '/s' + sectionNum + '-say.wav', 'audio/' + lessonId + '/s' + sectionNum + '-say.mp3']
      });
      if (sec.why) _audioQueue.push({
        section: sectionNum, title, voice: 'b', text: cleanForTts(sec.why),
        audioPaths: ['audio/' + lessonId + '/s' + sectionNum + '-why.wav', 'audio/' + lessonId + '/s' + sectionNum + '-why.mp3']
      });
    });
    _audioClipIdx = 0;
    _audioLessonId = lessonId;
    _audioLessonTitle = lesson.title;
    _audioMode = '';
    closePlaylist();
    setupMediaSession(lesson.title);
    // Auto-play on episode selection — the click satisfies iOS Safari's
    // user-gesture requirement, so we don't need a second tap.
    _audioPlaying = true;
    renderDock();
    playCurrentClip();
  }

  // ── Dock (persistent bottom bar) ──────────────────────────────────────
  function renderDock() {
    if (!_audioQueue || !_audioQueue.length) {
      dock.style.display = 'none';
      document.body.style.paddingBottom = '';
      return;
    }
    const c = _audioQueue[_audioClipIdx];
    if (!c) { dock.style.display = 'none'; document.body.style.paddingBottom = ''; return; }
    dock.style.display = 'flex';
    // Reserve 70px at the page bottom so the dock doesn't cover sticky
    // content like the L3 action bar. Cleared when the dock hides.
    document.body.style.paddingBottom = '70px';
    document.getElementById('audio-dock-title').textContent =
      dsIcon('headphones', 15) + '' + (_audioLessonTitle || '') + '  ·  clip ' + (_audioClipIdx + 1) + ' / ' + _audioQueue.length;
    const voiceTag = c.voice === 'a' ? 'Voice A · what you would say' : 'Voice B · why it matters';
    document.getElementById('audio-dock-section').textContent = c.title + '  —  ' + voiceTag;
    dockPlaypause.innerHTML = dsIcon(_audioPlaying ? 'pause' : 'play', 16);
    dockPrev.disabled = _audioClipIdx <= 0;
    dockNext.disabled = _audioClipIdx >= _audioQueue.length - 1;
    dockPrev.style.opacity = dockPrev.disabled ? '0.4' : '1';
    dockNext.style.opacity = dockNext.disabled ? '0.4' : '1';
  }

  function closeDock() {
    stopAll();
    _audioQueue = null;
    _audioClipIdx = 0;
    _audioPlaying = false;
    _audioMode = '';
    _audioLessonId = null;
    _audioLessonTitle = null;
    renderDock();
  }

  // ── Playback engine ───────────────────────────────────────────────────
  function stopAll() {
    if (_audioCurrentEl) {
      try { _audioCurrentEl.pause(); } catch (_) {}
      _audioCurrentEl.onended = null;
      _audioCurrentEl.onerror = null;
      _audioCurrentEl = null;
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
  }

  async function playCurrentClip() {
    stopAll();
    if (!_audioQueue) return;
    const c = _audioQueue[_audioClipIdx];
    if (!c) { _audioPlaying = false; renderDock(); return; }
    let foundPath = null;
    for (const p of c.audioPaths || []) {
      if (await audioFileExists(p)) { foundPath = p; break; }
    }
    if (foundPath) {
      _audioMode = 'file';
      const a = new Audio(foundPath);
      _audioCurrentEl = a;
      a.onended = onClipEnded;
      a.onerror = () => { _audioMode = 'tts'; playWithTts(c); };
      renderDock();
      try { await a.play(); }
      catch (_) { _audioPlaying = false; renderDock(); }
      return;
    }
    _audioMode = 'tts';
    renderDock();
    playWithTts(c);
  }

  function onClipEnded() {
    if (!_audioPlaying) return;
    if (_audioClipIdx >= _audioQueue.length - 1) { _audioPlaying = false; renderDock(); return; }
    _audioClipIdx++;
    renderDock();
    playCurrentClip();
  }

  function playWithTts(clip) {
    if (!('speechSynthesis' in window)) {
      _audioPlaying = false;
      renderDock();
      return;
    }
    const voices = getVoicesPair();
    const utter = new SpeechSynthesisUtterance(clip.text);
    if (clip.voice === 'a' && voices.a) utter.voice = voices.a;
    if (clip.voice === 'b' && voices.b) utter.voice = voices.b;
    utter.rate = 1.0;
    utter.pitch = clip.voice === 'a' ? 1.0 : 1.05;
    utter.onend = onClipEnded;
    window.speechSynthesis.speak(utter);
  }

  function togglePlayPause() {
    if (!_audioQueue) return;
    if (_audioPlaying) {
      _audioPlaying = false;
      if (_audioCurrentEl) { try { _audioCurrentEl.pause(); } catch (_) {} }
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        try { window.speechSynthesis.pause(); } catch (_) {}
      }
      renderDock();
    } else {
      _audioPlaying = true;
      renderDock();
      if (_audioCurrentEl && _audioCurrentEl.src && _audioCurrentEl.paused) {
        _audioCurrentEl.play().catch(() => {});
      } else if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        try { window.speechSynthesis.resume(); } catch (_) {}
      } else {
        playCurrentClip();
      }
    }
  }

  function goPrev() {
    if (!_audioQueue || _audioClipIdx <= 0) return;
    _audioClipIdx--;
    renderDock();
    if (_audioPlaying) playCurrentClip();
    else stopAll();
  }
  function goNext() {
    if (!_audioQueue || _audioClipIdx >= _audioQueue.length - 1) return;
    _audioClipIdx++;
    renderDock();
    if (_audioPlaying) playCurrentClip();
    else stopAll();
  }

  function getVoicesPair() {
    if (_audioVoicesCache) return _audioVoicesCache;
    const all = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
    if (!all.length) return { a: null, b: null };
    const eng = all.filter(v => /^en/i.test(v.lang));
    const pool = eng.length >= 2 ? eng : all;
    const maleNames = ['daniel', 'matthew', 'mark', 'alex', 'fred', 'tom', 'aaron', 'arthur', 'oliver', 'rishi'];
    const femaleNames = ['samantha', 'karen', 'joanna', 'salli', 'kate', 'serena', 'allison', 'fiona', 'tessa', 'moira', 'victoria', 'susan'];
    const findBy = (names) => pool.find(v => names.some(n => v.name.toLowerCase().includes(n)));
    let a = findBy(maleNames);
    let b = findBy(femaleNames);
    if (!a) a = pool[0];
    if (!b) b = pool.find(v => v !== a) || pool[0];
    _audioVoicesCache = { a, b };
    return _audioVoicesCache;
  }

  async function audioFileExists(path) {
    if (path in _audioFileExistsCache) return _audioFileExistsCache[path];
    try {
      const res = await fetch(path, { method: 'HEAD' });
      _audioFileExistsCache[path] = res.ok;
      return res.ok;
    } catch (_) {
      _audioFileExistsCache[path] = false;
      return false;
    }
  }

  // Strip code-formatting noise so TTS reads cleanly. Lesson `say`/`why`
  // bodies use markdown-ish backticks, smart quotes, bullets, and embedded
  // newlines — convert those to spoken-friendly prose.
  function cleanForTts(text) {
    return text
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/“|”/g, '')
      .replace(/["]/g, '')
      .replace(/[•]/g, ',')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function setupMediaSession(title) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: 'JS Drill — Conversation',
        album: 'Interview narration'
      });
      navigator.mediaSession.setActionHandler('play', () => { if (!_audioPlaying) togglePlayPause(); });
      navigator.mediaSession.setActionHandler('pause', () => { if (_audioPlaying) togglePlayPause(); });
      navigator.mediaSession.setActionHandler('previoustrack', goPrev);
      navigator.mediaSession.setActionHandler('nexttrack', goNext);
    } catch (_) {}
  }

  // Expose a programmatic start so the Conversation tab can mount an inline
  // Listen button without going through the playlist surface. Any lesson
  // with a conversation.sections block is a valid target — the EPISODES list
  // only gates what the playlist surfaces, not what can play.
  window.startAudioEpisode = startEpisode;

  // ── Wire events ───────────────────────────────────────────────────────
  document.getElementById('audio-btn').addEventListener('click', openPlaylist);
  modalClose.addEventListener('click', closePlaylist);
  modal.addEventListener('click', (e) => { if (e.target === modal) closePlaylist(); });
  dockMeta.addEventListener('click', openPlaylist);
  dockPlaypause.addEventListener('click', togglePlayPause);
  dockPrev.addEventListener('click', goPrev);
  dockNext.addEventListener('click', goNext);
  dockCloseBtn.addEventListener('click', closeDock);
}

