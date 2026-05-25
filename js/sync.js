// Cross-device sync for jsdrill.progress.v1.
//
// Architecture (per CLAUDE.md "shared UI + storage contract"):
//   - js/storage.js  → single source of truth for localStorage I/O
//   - js/sync.js     → optional cloud mirror on top of DrillStorage
//
// The app keeps working without sync. If config is missing, the user is
// signed out, or the network is down, every read/write still goes through
// DrillStorage. Sync is purely additive.
//
// Sync model:
//   - One Postgres row per user, holding the WHOLE jsdrill.progress.v1
//     blob as a single JSONB column (see supabase/migrations/001_user_progress.sql).
//   - On sign-in:    pull cloud → merge per-field with local → save merged
//                    locally → push merged to cloud.
//   - On local save: debounced 500ms push of the latest local blob.
//   - On focus / every 30s: pull cloud → if cloud.updated_at advanced since
//                    last pull, merge with local and save locally.
//
// Conflict policy (per-field merge, no last-write-wins on the whole blob):
//   - progress[id][L1|L2|L3]:        OR of 'passed'      (any pass on any device wins)
//   - bestTimes[id]:                  MIN                 (faster time wins)
//   - mockHistory[id]:                concat + sort desc + cap to last 5
//   - revealed[id][level]:            OR                  (once revealed, always revealed)
//   - reviews[id]:                    one with greater lastPassedAt wins
//   - weakness[id]:                   OR                  (flagged on any device → flagged)
//   - welcomed:                       OR                  (welcomed once → welcomed forever)
//   - lastLessonId / lastTab / starterPath / hideMastered / sidebarTrack:
//                                     prefer LOCAL        (active device wins device-state)
//   - __v:                            max
//
// This merge is order-independent for set-additive fields and intentionally
// asymmetric for device-state scalars — opening the app on the phone after
// a laptop session shouldn't snap the phone back to the laptop's last lesson.

(function (root) {
  'use strict';

  const TABLE = 'user_progress';
  const PUSH_DEBOUNCE_MS = 500;
  const POLL_INTERVAL_MS = 30000;

  // ============================================================================
  // STATE
  // ============================================================================
  let supa = null;                    // Supabase client (null until init succeeds)
  let session = null;                 // current auth session (null when signed out)
  let lastSeenUpdatedAt = null;       // server timestamp of last pull/push
  let pushTimer = null;
  let pollTimer = null;
  let authCallbacks = [];

  // ============================================================================
  // PUBLIC API → window.DrillSync
  // ============================================================================
  const Sync = {};

  Sync.isAvailable = function () {
    return !!supa;
  };

  Sync.getCurrentUser = function () {
    return session && session.user ? session.user : null;
  };

  Sync.onAuthStateChange = function (cb) {
    authCallbacks.push(cb);
    // Fire once immediately with current state so subscribers can render.
    try { cb(Sync.getCurrentUser()); } catch (e) { /* ignore */ }
  };

  Sync.signInWithOtp = async function (email) {
    if (!supa) throw new Error('Sync not configured');
    const { error } = await supa.auth.signInWithOtp({
      email,
      options: {
        // Send a 6-digit code AND a magic link. The user can use whichever.
        shouldCreateUser: true,
        emailRedirectTo: root.location.origin + root.location.pathname
      }
    });
    if (error) throw error;
  };

  Sync.verifyOtp = async function (email, token) {
    if (!supa) throw new Error('Sync not configured');
    const { data, error } = await supa.auth.verifyOtp({
      email,
      token: token.trim(),
      type: 'email'
    });
    if (error) throw error;
    return data;
  };

  Sync.signOut = async function () {
    if (!supa) return;
    await supa.auth.signOut();
    // Leave local progress intact — sign-out should never delete drill history.
  };

  Sync.pushLocal = function () {
    schedulePush();
  };

  Sync.pullCloud = async function () {
    return doPull({ silent: false });
  };

  // ============================================================================
  // INIT
  // ============================================================================
  Sync.init = function () {
    supa = root.SupabaseClient;
    if (!supa) return; // No config → local-only mode, no UI

    mountUi();

    supa.auth.getSession().then(({ data }) => {
      session = data.session || null;
      fireAuthChange();
      if (session) onSignedIn();
    });

    supa.auth.onAuthStateChange((event, sess) => {
      const wasSignedIn = !!session;
      session = sess || null;
      fireAuthChange();
      if (!wasSignedIn && session) onSignedIn();
      if (wasSignedIn && !session) onSignedOut();
    });

    // Push debounced on every local DrillStorage write.
    root.addEventListener('drill:progress-written', () => {
      if (session) schedulePush();
    });

    // Pull on window focus + on a slow interval, so an edit on the laptop
    // shows up on the phone within ~30s even if the laptop never refreshes.
    root.addEventListener('focus', () => { if (session) doPull({ silent: true }); });
  };

  // ============================================================================
  // INTERNAL — sync lifecycle
  // ============================================================================
  function fireAuthChange() {
    const user = Sync.getCurrentUser();
    authCallbacks.forEach(cb => {
      try { cb(user); } catch (e) { console.warn('[sync] auth callback failed:', e); }
    });
  }

  async function onSignedIn() {
    try {
      // First pull-and-merge, then push the merged blob so cloud reflects
      // anything the just-signed-in device had locally that the cloud didn't.
      const merged = await doPull({ silent: true, mergeAndPush: true });
      startPolling();
      console.info('[sync] signed in; merged + pushed.');
    } catch (e) {
      console.warn('[sync] sign-in sync failed:', e);
    }
  }

  function onSignedOut() {
    stopPolling();
    lastSeenUpdatedAt = null;
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => { doPull({ silent: true }); }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function schedulePush() {
    if (!session) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      doPush().catch(e => console.warn('[sync] push failed:', e));
    }, PUSH_DEBOUNCE_MS);
  }

  async function doPush() {
    if (!session || !supa) return;
    const local = root.DrillStorage.loadAppProgress();
    if (!local) return; // Nothing to push yet.
    const { data, error } = await supa
      .from(TABLE)
      .upsert({ user_id: session.user.id, data: local }, { onConflict: 'user_id' })
      .select('updated_at')
      .single();
    if (error) throw error;
    if (data && data.updated_at) lastSeenUpdatedAt = data.updated_at;
  }

  async function doPull({ silent, mergeAndPush } = {}) {
    if (!session || !supa) return null;
    const { data, error } = await supa
      .from(TABLE)
      .select('data, updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) {
      if (!silent) console.warn('[sync] pull error:', error);
      return null;
    }

    // No row yet → first time signing in on any device. Push local up.
    if (!data) {
      lastSeenUpdatedAt = null;
      if (session) await doPush();
      return null;
    }

    // If we've already seen this row version and no merge requested, skip.
    if (!mergeAndPush && lastSeenUpdatedAt && data.updated_at === lastSeenUpdatedAt) {
      return null;
    }

    const local = root.DrillStorage.loadAppProgress();
    const cloud = data.data || null;
    const merged = mergeProgress(local, cloud);

    if (merged) {
      // Save merged locally. This will fire the write event → push.
      // To avoid an immediate ping-pong, suppress the next push briefly.
      suppressNextPush = true;
      root.DrillStorage.saveAppProgress(merged);
      lastSeenUpdatedAt = data.updated_at;

      // Notify the app to re-render from the new local state.
      root.dispatchEvent(new CustomEvent('drill:sync-pulled', { detail: { merged } }));
    }

    if (mergeAndPush) await doPush();
    return merged;
  }

  // Tiny race-condition guard: when a pull writes to local, we'll get a
  // write event. We don't want to immediately push that back (it's just
  // what we already pulled). One-shot suppression flag, cleared on next save.
  let suppressNextPush = false;
  root.addEventListener('drill:progress-written', () => {
    if (suppressNextPush) { suppressNextPush = false; return; }
    // Otherwise normal push path runs (already wired in init()).
  }, true); // capture phase so this runs before the user-facing handler

  // ============================================================================
  // INTERNAL — merge
  // ============================================================================
  function mergeProgress(local, cloud) {
    if (!local && !cloud) return null;
    if (!local) return cloud;
    if (!cloud) return local;

    const merged = {};
    merged.__v = Math.max(local.__v || 0, cloud.__v || 0, 6);

    // progress[id][L1|L2|L3]: OR of 'passed'
    merged.progress = {};
    const progressIds = unionKeys(local.progress, cloud.progress);
    for (const id of progressIds) {
      const l = (local.progress && local.progress[id]) || {};
      const c = (cloud.progress && cloud.progress[id]) || {};
      const m = {};
      if (l.L1 === 'passed' || c.L1 === 'passed') m.L1 = 'passed';
      if (l.L2 === 'passed' || c.L2 === 'passed') m.L2 = 'passed';
      if (l.L3 === 'passed' || c.L3 === 'passed') m.L3 = 'passed';
      if (Object.keys(m).length) merged.progress[id] = m;
    }

    // bestTimes[id]: MIN
    merged.bestTimes = {};
    for (const id of unionKeys(local.bestTimes, cloud.bestTimes)) {
      const a = local.bestTimes && local.bestTimes[id];
      const b = cloud.bestTimes && cloud.bestTimes[id];
      if (a == null) merged.bestTimes[id] = b;
      else if (b == null) merged.bestTimes[id] = a;
      else merged.bestTimes[id] = Math.min(a, b);
    }

    // mockHistory[id]: concat + dedupe + sort desc + cap 5
    merged.mockHistory = {};
    for (const id of unionKeys(local.mockHistory, cloud.mockHistory)) {
      const a = (local.mockHistory && local.mockHistory[id]) || [];
      const b = (cloud.mockHistory && cloud.mockHistory[id]) || [];
      const seen = new Set();
      const all = [].concat(a, b).filter(x => {
        if (typeof x !== 'number' || seen.has(x)) return false;
        seen.add(x);
        return true;
      });
      all.sort((x, y) => y - x);
      merged.mockHistory[id] = all.slice(0, 5);
    }

    // revealed[id][level]: OR of true
    merged.revealed = {};
    for (const id of unionKeys(local.revealed, cloud.revealed)) {
      const a = (local.revealed && local.revealed[id]) || {};
      const b = (cloud.revealed && cloud.revealed[id]) || {};
      const m = {};
      for (const level of unionKeys(a, b)) {
        if (a[level] || b[level]) m[level] = true;
      }
      if (Object.keys(m).length) merged.revealed[id] = m;
    }

    // reviews[id]: greater lastPassedAt wins
    merged.reviews = {};
    for (const id of unionKeys(local.reviews, cloud.reviews)) {
      const a = local.reviews && local.reviews[id];
      const b = cloud.reviews && cloud.reviews[id];
      if (!a) merged.reviews[id] = b;
      else if (!b) merged.reviews[id] = a;
      else merged.reviews[id] = (a.lastPassedAt || 0) >= (b.lastPassedAt || 0) ? a : b;
    }

    // weakness[id]: OR
    merged.weakness = {};
    for (const id of unionKeys(local.weakness, cloud.weakness)) {
      const v = (local.weakness && local.weakness[id]) || (cloud.weakness && cloud.weakness[id]);
      if (v) merged.weakness[id] = true;
    }

    // welcomed: OR
    merged.welcomed = !!(local.welcomed || cloud.welcomed);

    // Device-state scalars: prefer LOCAL (active device shouldn't get
    // yanked to another device's last-lesson / tab / track / filters).
    const scalarPreferLocal = ['lastLessonId', 'lastTab', 'starterPath',
                               'hideMastered', 'sidebarTrack'];
    for (const key of scalarPreferLocal) {
      const v = local[key] !== undefined ? local[key] : cloud[key];
      if (v !== undefined) merged[key] = v;
    }

    return merged;
  }

  function unionKeys(a, b) {
    const out = new Set();
    if (a) for (const k of Object.keys(a)) out.add(k);
    if (b) for (const k of Object.keys(b)) out.add(k);
    return out;
  }

  // ============================================================================
  // UI — fixed top-right Sync chip + sign-in modal
  // ============================================================================
  function mountUi() {
    if (document.getElementById('sync-chip')) return; // Already mounted

    const style = document.createElement('style');
    style.textContent = `
      #sync-chip {
        position: fixed; top: 10px; right: 12px; z-index: 70;
        display: inline-flex; align-items: center; gap: 6px;
        background: rgba(15,23,42,0.85); border: 1px solid #1e293b;
        color: #cbd5e1; font: 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        padding: 6px 10px; border-radius: 999px; cursor: pointer;
        backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        transition: border-color .15s, color .15s;
      }
      #sync-chip:hover { border-color: #475569; color: #e2e8f0; }
      #sync-chip .sync-dot {
        width: 6px; height: 6px; border-radius: 50%; background: #64748b;
      }
      #sync-chip.is-on .sync-dot { background: #22c55e; }
      #sync-chip.is-syncing .sync-dot { background: #facc15; animation: syncPulse 1s infinite; }
      @keyframes syncPulse { 50% { opacity: .35; } }

      #sync-modal {
        position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,0.6);
        display: none; align-items: center; justify-content: center;
      }
      #sync-modal.is-open { display: flex; }
      #sync-modal .panel {
        background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;
        padding: 22px; max-width: 380px; width: 92vw;
        color: #e2e8f0; font: 14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      }
      #sync-modal h2 { margin: 0 0 6px 0; font-size: 17px; font-weight: 700; color: #f8fafc; }
      #sync-modal p { margin: 0 0 14px 0; font-size: 12.5px; color: #94a3b8; }
      #sync-modal label { display: block; font-size: 12px; color: #94a3b8; margin: 10px 0 4px; }
      #sync-modal input {
        width: 100%; background: #020617; border: 1px solid #1e293b; border-radius: 6px;
        padding: 8px 10px; color: #e2e8f0; font: 14px ui-monospace,Menlo,monospace;
      }
      #sync-modal input:focus { outline: none; border-color: #38bdf8; }
      #sync-modal .row { display: flex; gap: 8px; margin-top: 14px; }
      #sync-modal button.primary {
        flex: 1; background: #2563eb; border: 0; border-radius: 6px; padding: 9px 12px;
        color: white; font-weight: 600; font-size: 13px; cursor: pointer;
      }
      #sync-modal button.primary:disabled { opacity: .5; cursor: not-allowed; }
      #sync-modal button.ghost {
        background: transparent; border: 1px solid #334155; color: #cbd5e1;
        border-radius: 6px; padding: 9px 12px; font-size: 13px; cursor: pointer;
      }
      #sync-modal .err { color: #fca5a5; font-size: 12px; margin-top: 8px; min-height: 16px; }
      #sync-modal .ok  { color: #86efac; font-size: 12px; margin-top: 8px; min-height: 16px; }
      #sync-modal .user-row {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        background: #020617; border: 1px solid #1e293b; border-radius: 6px;
        padding: 10px 12px; font-size: 13px;
      }
      #sync-modal .user-row .email { color: #e2e8f0; word-break: break-all; }
    `;
    document.head.appendChild(style);

    const chip = document.createElement('button');
    chip.id = 'sync-chip';
    chip.type = 'button';
    chip.title = 'Cross-device sync';
    chip.innerHTML = '<span class="sync-dot"></span><span class="label">Sync</span>';
    chip.addEventListener('click', openModal);
    document.body.appendChild(chip);

    const modal = document.createElement('div');
    modal.id = 'sync-modal';
    modal.innerHTML = `
      <div class="panel" role="dialog" aria-labelledby="sync-title">
        <div data-view="signed-out">
          <h2 id="sync-title">Sync your progress</h2>
          <p>Enter your email to get a 6-digit code. Your laptop and phone will then stay in sync — local-only otherwise.</p>
          <label for="sync-email">Email</label>
          <input id="sync-email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" />
          <div class="row">
            <button type="button" class="ghost" data-act="cancel">Cancel</button>
            <button type="button" class="primary" data-act="send">Send code</button>
          </div>
          <div class="err" data-err></div>
        </div>
        <div data-view="awaiting-code" style="display:none">
          <h2>Check your email</h2>
          <p>Enter the 6-digit code we sent to <span data-email-echo style="color:#e2e8f0"></span>. (You can also click the link in the email.)</p>
          <label for="sync-code">Code</label>
          <input id="sync-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" />
          <div class="row">
            <button type="button" class="ghost" data-act="back">Back</button>
            <button type="button" class="primary" data-act="verify">Verify</button>
          </div>
          <div class="err" data-err></div>
          <div class="ok" data-ok></div>
        </div>
        <div data-view="signed-in" style="display:none">
          <h2>Signed in</h2>
          <p>Your progress syncs automatically across every device signed in with this email.</p>
          <div class="user-row">
            <span class="email" data-user-email></span>
            <span class="sync-dot" style="width:8px;height:8px;border-radius:50%;background:#22c55e"></span>
          </div>
          <div class="row">
            <button type="button" class="ghost" data-act="close">Close</button>
            <button type="button" class="primary" data-act="signout">Sign out</button>
          </div>
          <div class="err" data-err></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Wire up modal interactions
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.getAttribute('data-act')));
    });

    // Update chip + modal whenever auth state changes
    Sync.onAuthStateChange((user) => {
      renderAuthState(user);
    });
  }

  let pendingEmail = '';

  function openModal() {
    const user = Sync.getCurrentUser();
    showView(user ? 'signed-in' : 'signed-out');
    document.getElementById('sync-modal').classList.add('is-open');
    setTimeout(() => {
      const focusEl = document.getElementById(user ? 'sync-code' : 'sync-email');
      if (focusEl) focusEl.focus();
    }, 50);
  }

  function closeModal() {
    document.getElementById('sync-modal').classList.remove('is-open');
    setErr(''); setOk('');
  }

  function showView(name) {
    const panel = document.querySelector('#sync-modal .panel');
    panel.querySelectorAll('[data-view]').forEach(v => {
      v.style.display = v.getAttribute('data-view') === name ? '' : 'none';
    });
    setErr(''); setOk('');
  }

  function setErr(msg) {
    document.querySelectorAll('#sync-modal [data-err]').forEach(el => { el.textContent = msg || ''; });
  }
  function setOk(msg) {
    document.querySelectorAll('#sync-modal [data-ok]').forEach(el => { el.textContent = msg || ''; });
  }

  async function handleAction(act) {
    setErr(''); setOk('');
    try {
      if (act === 'cancel' || act === 'close') return closeModal();
      if (act === 'back') return showView('signed-out');

      if (act === 'send') {
        const email = (document.getElementById('sync-email').value || '').trim();
        if (!email || !/.+@.+\..+/.test(email)) {
          return setErr('Enter a valid email.');
        }
        const btn = document.querySelector('#sync-modal [data-act="send"]');
        btn.disabled = true; btn.textContent = 'Sending…';
        await Sync.signInWithOtp(email);
        btn.disabled = false; btn.textContent = 'Send code';
        pendingEmail = email;
        document.querySelectorAll('#sync-modal [data-email-echo]').forEach(el => { el.textContent = email; });
        showView('awaiting-code');
        setOk('Code sent. Check your inbox.');
        setTimeout(() => document.getElementById('sync-code').focus(), 50);
        return;
      }

      if (act === 'verify') {
        const code = (document.getElementById('sync-code').value || '').trim();
        if (!/^\d{6}$/.test(code)) {
          return setErr('Enter the 6-digit code from the email.');
        }
        const btn = document.querySelector('#sync-modal [data-act="verify"]');
        btn.disabled = true; btn.textContent = 'Verifying…';
        await Sync.verifyOtp(pendingEmail, code);
        btn.disabled = false; btn.textContent = 'Verify';
        // onAuthStateChange will fire → renderAuthState → showView('signed-in')
        showView('signed-in');
        setOk('Signed in. Merging progress…');
        return;
      }

      if (act === 'signout') {
        await Sync.signOut();
        showView('signed-out');
        setOk('Signed out. Local progress preserved.');
        return;
      }
    } catch (e) {
      console.warn('[sync] action error:', e);
      setErr(e && e.message ? e.message : 'Something went wrong. Try again.');
      document.querySelectorAll('#sync-modal button').forEach(b => b.disabled = false);
    }
  }

  function renderAuthState(user) {
    const chip = document.getElementById('sync-chip');
    if (!chip) return;
    const label = chip.querySelector('.label');
    if (user) {
      chip.classList.add('is-on');
      label.textContent = 'Synced';
      chip.title = 'Signed in as ' + user.email;
      document.querySelectorAll('#sync-modal [data-user-email]').forEach(el => { el.textContent = user.email || ''; });
    } else {
      chip.classList.remove('is-on');
      label.textContent = 'Sync';
      chip.title = 'Cross-device sync — click to sign in';
    }
  }

  // ============================================================================
  // EXPOSURE + AUTO-INIT
  // ============================================================================
  root.DrillSync = Sync;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Sync.init);
  } else {
    Sync.init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
