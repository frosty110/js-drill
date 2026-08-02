// Cross-device sync for the four localStorage blobs:
//   - jsdrill.progress.v1     (main drill app)
//   - jsdrill.prep.v1         (prep dashboard — FROZEN legacy blob, no live writer)
//   - jsdrill.diagnostic.v1   (4-day diagnostic)
//   - jsdrill.systemdesign.v1 (System Design drill — Leitner boxes)
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
//   - One Postgres row per user, holding all four blobs bundled into a
//     single JSONB column shaped as { progress, prep, diagnostic, systemdesign }
//     plus an optional top-level `resetAt` (see "Authoritative writes" below).
//     See supabase/migrations/001_user_progress.sql — no migration was needed
//     for systemdesign/resetAt; the envelope is a client convention.
//   - On sign-in:    ownership check first (see "Cross-account guard"), then
//                    pull cloud → merge per-field per-blob with local →
//                    save each merged blob locally → push merged bundle to cloud.
//   - On local save (any of the four blobs): debounced 500ms push of the
//                    whole bundle. A pending debounce is flushed immediately on
//                    visibilitychange→hidden so the phone user's last rep isn't
//                    lost when they swipe the PWA away.
//   - On focus / every 30s: pull cloud → if cloud.updated_at advanced since
//                    last pull, merge with local and save locally.
//
// Cross-account guard (owner marker):
//   The auth user id of the account the local blobs belong to is stored in the
//   UNSYNCED key jsdrill.sync.owner.v1 (DrillStorage.load/saveSyncOwner). On
//   sign-in, if the marker exists and differs from the new session's user id
//   AND there is local data, we do NOT merge — the user is asked whether to
//   replace local with the new account's cloud data (OK → replace-local pull,
//   no push of the old user's data; Cancel → sign out, local data untouched).
//   This prevents user A's history from being absorbed into user B's row on a
//   shared device. Sign-out keeps both local data and the marker, so the same
//   user re-signing-in stays frictionless.
//
// Authoritative writes (resetAt channel):
//   Reset-all and Restore-from-backup must REPLACE the cloud row and every
//   other device's local copy — the normal union/OR/MAX merge would resurrect
//   everything. DrillSync.resetCloud() cancels any pending debounce, stamps
//   data.resetAt = now (persisted device-locally in jsdrill.sync.reset.v1 so
//   later routine pushes keep carrying it), and pushes immediately (plain
//   upsert, bypassing CAS). Every doPull compares cloud resetAt against the
//   device's lastResetSeenAt: newer → adopt cloud wholesale (no merge, push
//   suppressed) and fire drill:sync-pulled with detail.replaced = true.
//
// Concurrency (CAS push):
//   doPush is compare-and-swap when we know the row: UPDATE … WHERE user_id
//   AND updated_at = lastSeenUpdatedAt. Zero rows affected → someone else
//   pushed since our last pull → pull-merge-push instead (max 2 retries).
//   Plain upsert remains only for the no-row bootstrap and resetCloud paths.
//   doPush also refuses (warn + skip) to push a progress blob whose __v is
//   LOWER than the last-pulled cloud __v — a stale service-worker-pinned
//   client must not downgrade the row's schema.
//
// Backward-compat read: an earlier shipped version stored the main blob
// directly in `data`. doPull() detects that (top-level __v) and wraps it
// as { progress: oldData } so the user's first row keeps working.
//
// Conflict policy (per-field merge per blob, no last-write-wins on the whole row):
//
// Base rule: each merge starts from { ...cloud, ...local } so any field WITHOUT
// an explicit policy below survives (prefer local) instead of being dropped.
// The explicit policies then override for fields that need a smarter merge.
//
//   progress (jsdrill.progress.v1):
//     progress[id][L1|L2|L3]: OR of 'passed'      (any pass on any device wins)
//     bestTimes[id]:           MIN                 (faster time wins)
//     mockHistory[id]:         concat + sort desc + cap to last 5
//     revealed[id][level]:     OR of set flags, EXCEPT a timestamped clear wins
//                              when newer. Reveal Replay's clean-pass invariant
//                              deletes the flag and stamps
//                              revealedClearedAt[id][level]; reveals stamp
//                              revealedAt[id][level]. Merge keeps the flag only
//                              if the newest event across both devices is a SET
//                              (legacy untimestamped flags count as set-at-0, so
//                              any clear beats them; a re-reveal after a clear
//                              wins again). revealedAt / revealedClearedAt
//                              themselves merge per-key MAX.
//     reviews[id]:             greater lastPassedAt wins
//     weakness[id]:            OR                  (flagged on any device → flagged)
//     partialL1[id]:           OR                  (L1 passed <100% on any device → amber ✓)
//                              ACCEPTED LIMITATION: the app clears weakness /
//                              partialL1 on a clean pass, and OR-merge can
//                              resurrect a stale flag from another device. This
//                              pair self-heals on the next clean pass, so the
//                              timestamped-clear machinery is deliberately
//                              scoped to `revealed` only (the user-visible
//                              ringed-dot invariant).
//     history[id] / misses[id]: UNION events + dedupe + sort + cap 50
//                              (consistency map / activity / streak / mistake
//                               tagging aggregate BOTH devices — mergeEventLog)
//     recognize, rapidFire, warmup, speedrun, gauntlet, bugHunt, crystal,
//     claim, gotcha, swapBench, convDrill, traceHop, notesDrill,
//     mechConstellation, reverseWalk, notesLocate, match, whatif, mutate,
//     phoneScreen, constraintShift, flash, walkthrough, glossaryQuiz,
//     cramReview, commandUsage, clarify, hotseat, timeCalibration:
//                              ADDITIVE (mergeAdditive) — MAX counters (NOT
//                              SUM: the merge must be idempotent, or every
//                              cross-device round-trip re-adds the other
//                              side's totals and counters inflate without any
//                              drilling; MAX stably undercounts instead — the
//                              exact-total fix would be a per-device G-counter,
//                              recorded as a follow-up), MAX timestamps/records,
//                              MIN best-times, OR booleans, prefer-local
//                              active sessions
//     cramTaskChecks[taskId]:  OR                  (4-Day Cram checkboxes — a
//                              check on any device counts, like prep.completed)
//     welcomed:                OR
//     lastLessonId / lastTab / starterPath / hideMastered / sidebarTrack
//     + all other settings/device scalars (adhdMode, fontScale, subscribedPathId,
//       surface, tagFilter, …):
//                              prefer LOCAL        (active device wins device-state)
//     (The full explicit-vs-prefer-local key registry lives in
//      EXPLICIT_MERGE_KEYS / PREFER_LOCAL_KEYS below and is parity-checked
//      against saveProgress by tools/check-sync-coverage.js.)
//
//   prep (jsdrill.prep.v1) — FROZEN legacy blob (prep.html was dissolved; no
//   live page writes it). Kept so historical data still syncs; do not extend:
//     completed[taskId]:       OR
//     expanded[blockId]:       OR
//     reviewed[itemId]:        greater lastReviewedAt wins (and max familiarity)
//     currentTab / currentDayId / glossSearch / review:
//                              prefer LOCAL        (UI/session state)
//
//   diagnostic (jsdrill.diagnostic.v1):
//     answers[qid]:            greater lastAnsweredAt wins
//     pre[k] / post[k]:        prefer non-empty; if both, prefer LOCAL
//     timeOnStep[step]:        MAX                 (cumulative time)
//     startedAt:               MIN                 (earliest start wins)
//     currentStep:             prefer LOCAL
//
//   systemdesign (jsdrill.systemdesign.v1):
//     boxes["topic/unit/qIdx"]: UNION of keys. When both sides hold a key, the
//                              entry with the GREATER `last` wins box + due as
//                              a unit (most-recent grade is the scheduling
//                              truth — a miss that reset the box IS the truth,
//                              exact analogue of reviews[id] / prep.reviewed),
//                              then seen / good / again each take MAX of the
//                              two sides (lifetime counters; MAX not SUM for
//                              idempotence — see the additive rule above).
//     lastTopic / lastChapter: prefer LOCAL        (device/session state)
//
//   __v on every blob: max
//
// This merge is order-independent for set-additive fields and intentionally
// asymmetric for device-state scalars — opening prep on the phone after a
// laptop session shouldn't snap the phone back to the laptop's tab.

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
  let lastPulledProgressV = 0;        // cloud progress.__v at last pull (downgrade guard)
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

  Sync.signInWithPassword = async function (email, password) {
    if (!supa) throw new Error('Sync not configured');
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  Sync.signUpWithPassword = async function (email, password) {
    if (!supa) throw new Error('Sync not configured');
    const { data, error } = await supa.auth.signUp({
      email,
      password,
      // If the project requires email confirmation, the link lands back here.
      options: { emailRedirectTo: root.location.origin + root.location.pathname }
    });
    if (error) throw error;
    return data;
  };

  // Set/change the password on the CURRENTLY signed-in account. This is how an
  // OTP-only (passwordless) account gets a password: sign in via code once,
  // then call this. Future sign-ins can use the password.
  Sync.setPassword = async function (password) {
    if (!supa) throw new Error('Sync not configured');
    const { error } = await supa.auth.updateUser({ password });
    if (error) throw error;
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

  // Authoritative write: replace the cloud row with the CURRENT local bundle
  // and stamp resetAt so every other device adopts it wholesale (replace, not
  // merge) on its next pull. Used by Reset-all and Restore-from-backup — the
  // two flows where union-merge semantics would silently undo the user's
  // intent. See the "Authoritative writes" header section.
  Sync.resetCloud = async function () {
    if (!session || !supa) return;
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
    const now = Date.now();
    if (root.DrillStorage && root.DrillStorage.saveSyncResetMarkers) {
      root.DrillStorage.saveSyncResetMarkers({ resetAt: now, lastResetSeenAt: now });
    }
    await doPush({ force: true });
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

    // Push debounced on every local DrillStorage write (progress, prep, or diagnostic).
    // Suppressed during a pull's own writes — see suppressNextPush below.
    root.addEventListener('drill:storage-written', () => {
      if (suppressNextPush) return;
      if (session) schedulePush();
    });

    // Pull on window focus + on a slow interval, so an edit on the laptop
    // shows up on the phone within ~30s even if the laptop never refreshes.
    root.addEventListener('focus', () => { if (session) doPull({ silent: true }); });

    // P2 flush: the mobile-primary user's classic gesture — answer the last
    // L1, swipe the PWA away — would otherwise lose the 500ms-debounced push.
    // visibilitychange→hidden is the only reliable mobile signal; the push
    // rides a plain fetch (allowed while hidden, best-effort).
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && pushTimer) {
          clearTimeout(pushTimer);
          pushTimer = null;
          doPush().catch(() => {});
        }
      });
    }
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

  // Pure decision for what a fresh sign-in should do with the local blobs.
  // Exposed via _testInternals so the cross-account guard is unit-testable.
  //   'merge'           → safe to pull-merge-push (same owner, first-ever
  //                       sign-in bootstrap, or nothing local to bleed).
  //   'confirm-replace' → local data belongs to a DIFFERENT account; ask the
  //                       user before touching anything, never auto-merge.
  function decideSignInAction(owner, uid, localHasData) {
    if (owner === uid) return 'merge';
    if (!localHasData) return 'merge';   // nothing to bleed either way
    if (owner == null) return 'merge';   // first-ever sign-in on this device
    return 'confirm-replace';
  }

  async function onSignedIn() {
    try {
      const uid = session.user.id;
      const St = root.DrillStorage;
      const owner = St && St.loadSyncOwner ? St.loadSyncOwner() : null;
      const local = loadLocalBundle();
      const localHasData = !!(local.progress || local.prep || local.diagnostic || local.systemdesign);

      if (decideSignInAction(owner, uid, localHasData) === 'confirm-replace') {
        // Cross-account guard (P0-2): this device's blobs belong to another
        // account. Merging would upload user A's history into user B's row.
        const email = (session.user && session.user.email) || 'this account';
        const ok = root.confirm(
          'This device has local progress from a different account. Replace it with ' +
          email + "'s cloud progress? (Cancel keeps local data and signs out.)"
        );
        if (!ok) {
          console.info('[sync] sign-in cancelled: local data belongs to another account.');
          await Sync.signOut();
          return;
        }
        await doPull({ silent: true, replaceLocal: true });
        if (St && St.saveSyncOwner) St.saveSyncOwner(uid);
        // Reload so no page's in-memory state can clobber the replaced blobs.
        root.location.reload();
        return;
      }

      // First pull-and-merge, then push the merged blob so cloud reflects
      // anything the just-signed-in device had locally that the cloud didn't.
      await doPull({ silent: true, mergeAndPush: true });
      if (St && St.saveSyncOwner) St.saveSyncOwner(uid);
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

  function loadLocalBundle() {
    return {
      progress:     root.DrillStorage.loadAppProgress(),
      prep:         root.DrillStorage.loadPrepState(),
      diagnostic:   root.DrillStorage.loadDiagnostic(),
      systemdesign: root.DrillStorage.loadSystemDesign()
    };
  }

  // Forward-compat reader: an earlier release stored just the main blob
  // directly in `data` (top-level __v + progress, bestTimes, etc.). Detect
  // that legacy shape and wrap it into the new bundle envelope.
  function normalizeCloudBundle(raw) {
    if (!raw || typeof raw !== 'object') {
      return { progress: null, prep: null, diagnostic: null, systemdesign: null };
    }
    if (typeof raw.__v === 'number') {
      // Legacy shape — the whole row IS the main-app blob.
      return { progress: raw, prep: null, diagnostic: null, systemdesign: null };
    }
    return {
      progress:     raw.progress     || null,
      prep:         raw.prep         || null,
      diagnostic:   raw.diagnostic   || null,
      systemdesign: raw.systemdesign || null
    };
  }

  // Write the cloud bundle OVER the local blobs — no merge. Used by the
  // cross-account replace path and the resetAt channel. Cloud-null blobs are
  // written as empty versioned shells so stale local data can't linger.
  function replaceLocalWithCloud(cloud) {
    const St = root.DrillStorage;
    suppressNextPush = true;
    try {
      St.saveAppProgress(cloud.progress || { __v: 6 });
      St.savePrepState(stripVersion(cloud.prep) || {});
      St.saveDiagnostic(stripVersion(cloud.diagnostic) || {});
      St.saveSystemDesign(stripVersion(cloud.systemdesign) || { boxes: {} });
    } finally {
      suppressNextPush = false;
    }
  }

  async function doPush(opts) {
    opts = opts || {};
    const depth = opts.depth || 0;
    if (!session || !supa) return;
    const bundle = loadLocalBundle();
    // Nothing to push at all? Skip.
    if (!bundle.progress && !bundle.prep && !bundle.diagnostic && !bundle.systemdesign) return;

    // Schema-downgrade guard: a stale (service-worker-pinned) client must not
    // replace a newer-schema row with its older shape.
    if (!opts.force && bundle.progress && lastPulledProgressV &&
        (bundle.progress.__v || 0) < lastPulledProgressV) {
      console.warn('[sync] push skipped: local progress __v=' + bundle.progress.__v +
        ' is older than cloud __v=' + lastPulledProgressV);
      return;
    }

    // Carry the authoritative-reset marker forward on every push so a routine
    // upsert can't strip it from the row (other devices key off it).
    const payload = Object.assign({}, bundle);
    const markers = (root.DrillStorage.loadSyncResetMarkers && root.DrillStorage.loadSyncResetMarkers()) || {};
    if (markers.resetAt) payload.resetAt = markers.resetAt;

    // CAS path: only replace the row we last saw. Zero rows affected means a
    // concurrent device pushed since our pull → pull-merge-push instead.
    if (!opts.force && lastSeenUpdatedAt) {
      const { data, error } = await supa
        .from(TABLE)
        .update({ data: payload })
        .eq('user_id', session.user.id)
        .eq('updated_at', lastSeenUpdatedAt)
        .select('updated_at');
      if (error) throw error;
      if (data && data.length) {
        lastSeenUpdatedAt = data[0].updated_at;
        return;
      }
      if (depth < 2) {
        await doPull({ silent: true, mergeAndPush: true, pushDepth: depth + 1 });
      } else {
        console.warn('[sync] push conflict retries exhausted; next local write re-arms.');
      }
      return;
    }

    // Bootstrap (no known row) or forced authoritative write → plain upsert.
    const { data, error } = await supa
      .from(TABLE)
      .upsert({ user_id: session.user.id, data: payload }, { onConflict: 'user_id' })
      .select('updated_at')
      .single();
    if (error) throw error;
    if (data && data.updated_at) lastSeenUpdatedAt = data.updated_at;
  }

  async function doPull({ silent, mergeAndPush, replaceLocal, pushDepth } = {}) {
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

    // No row yet → first time signing in on any device.
    if (!data) {
      lastSeenUpdatedAt = null;
      if (replaceLocal) {
        // Cross-account adopt with no cloud row: the new account has nothing —
        // clearing local is the whole point (keep nothing of the old owner's).
        replaceLocalWithCloud({ progress: null, prep: null, diagnostic: null, systemdesign: null });
        return null;
      }
      if (session) await doPush({ depth: pushDepth || 0 });
      return null;
    }

    if (!mergeAndPush && !replaceLocal && lastSeenUpdatedAt && data.updated_at === lastSeenUpdatedAt) {
      return null;
    }

    const cloud = normalizeCloudBundle(data.data);
    if (cloud.progress && typeof cloud.progress.__v === 'number') {
      lastPulledProgressV = Math.max(lastPulledProgressV, cloud.progress.__v);
    }

    // Authoritative-reset channel: if the cloud row carries a resetAt newer
    // than anything this device has adopted, the row is the result of a Reset
    // or Restore — adopt it wholesale. Merging would union the cleared data
    // right back (the "reset never sticks" bug).
    const St = root.DrillStorage;
    const cloudResetAt = (data.data && typeof data.data === 'object' && typeof data.data.resetAt === 'number')
      ? data.data.resetAt : 0;
    const markers = (St.loadSyncResetMarkers && St.loadSyncResetMarkers()) || {};
    const mustReplace = replaceLocal || (cloudResetAt && cloudResetAt > (markers.lastResetSeenAt || 0));

    if (mustReplace) {
      replaceLocalWithCloud(cloud);
      if (St.saveSyncResetMarkers && cloudResetAt) {
        // Adopt the marker: future pushes from this device keep carrying it,
        // and this device never re-replaces on the same generation.
        St.saveSyncResetMarkers({ resetAt: cloudResetAt, lastResetSeenAt: cloudResetAt });
      }
      lastSeenUpdatedAt = data.updated_at;
      root.dispatchEvent(new CustomEvent('drill:sync-pulled', { detail: { merged: cloud, replaced: true } }));
      return cloud;
    }

    const local = loadLocalBundle();
    const merged = {
      progress:     mergeProgress(local.progress, cloud.progress),
      prep:         mergePrep(local.prep, cloud.prep),
      diagnostic:   mergeDiagnostic(local.diagnostic, cloud.diagnostic),
      systemdesign: mergeSystemDesign(local.systemdesign, cloud.systemdesign)
    };

    // Save each merged sub-blob locally. Event dispatch is synchronous, so
    // wrapping the saves with the suppress flag short-circuits the push
    // listener for exactly these writes and nothing else.
    suppressNextPush = true;
    try {
      if (merged.progress)     root.DrillStorage.saveAppProgress(merged.progress);
      if (merged.prep)         root.DrillStorage.savePrepState(stripVersion(merged.prep));
      if (merged.diagnostic)   root.DrillStorage.saveDiagnostic(stripVersion(merged.diagnostic));
      if (merged.systemdesign) root.DrillStorage.saveSystemDesign(stripVersion(merged.systemdesign));
    } finally {
      suppressNextPush = false;
    }
    lastSeenUpdatedAt = data.updated_at;

    root.dispatchEvent(new CustomEvent('drill:sync-pulled', { detail: { merged } }));

    if (mergeAndPush) await doPush({ depth: pushDepth || 0 });
    return merged;
  }

  // savePrepState / saveDiagnostic re-stamp __v on the way in, so strip it
  // from merged input to avoid double-versioning.
  function stripVersion(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const { __v, ...rest } = obj;
    return rest;
  }

  // Race guard: when doPull writes to local, the push listener above
  // would otherwise immediately echo what we just pulled. We toggle this
  // flag synchronously around the saves in doPull.
  let suppressNextPush = false;

  // ============================================================================
  // INTERNAL — merge
  // ============================================================================

  // Caps mirror the app's own truncation (HISTORY_MAX / misses .slice(-50) in
  // js/app). Keep in sync if those change.
  const EVENT_LOG_CAP = 50;

  // Per-lesson event logs (state.history, state.misses): { id: [{at, ...}] }.
  // UNION the two devices' arrays per lesson, dedupe identical events, sort by
  // timestamp, and cap to the most-recent N (matching the app's own cap). This
  // is what makes the 60-day consistency map / activity / streak reflect TOTAL
  // progress across mobile + desktop instead of one device's slice.
  function mergeEventLog(local, cloud, cap) {
    const out = {};
    for (const id of unionKeys(local, cloud)) {
      const seen = new Set();
      const arr = [];
      for (const e of [].concat((local && local[id]) || [], (cloud && cloud[id]) || [])) {
        const k = JSON.stringify(e);
        if (seen.has(k)) continue;
        seen.add(k);
        arr.push(e);
      }
      arr.sort((x, y) => (x.at || 0) - (y.at || 0));
      out[id] = cap ? arr.slice(-cap) : arr;
    }
    return out;
  }

  // Per-lesson LAST-ATTEMPT records (state.answers): { id: { L1: {…, at},
  // L2: {…, at}, L3: {…, at} } }. Each level's entry is one coherent snapshot
  // of one sitting — the picks and the timestamp belong together — so this
  // resolves per LEVEL by newest `at` instead of unioning or summing. Blending
  // two devices' picks would fabricate an attempt neither device recorded.
  function mergeLatestAttempt(local, cloud) {
    const out = {};
    for (const id of unionKeys(local, cloud)) {
      const l = (local && local[id]) || {};
      const c = (cloud && cloud[id]) || {};
      const entry = {};
      for (const level of unionKeys(l, c)) {
        const lv = l[level];
        const cv = c[level];
        if (!lv) { if (cv) entry[level] = cv; continue; }
        if (!cv) { entry[level] = lv; continue; }
        entry[level] = (cv.at || 0) > (lv.at || 0) ? cv : lv;
      }
      if (Object.keys(entry).length) out[id] = entry;
    }
    return out;
  }

  // Generic ADDITIVE merge for lifetime-stat objects (recognize, bugHunt, …)
  // and per-lesson counter maps (flash, walkthrough, commandUsage). Rules,
  // applied recursively by key name:
  //   number + key ~ /At$|lastRunAt/        → MAX   (timestamps: keep latest)
  //   number + key ~ /best|streak|familiar/ → MAX   (records: keep best)
  //   number + key === 'interval'           → MAX   (SR interval: never sum)
  //   number (any other)                    → MAX   (attempts/correct/sessions…
  //                                                  MAX not SUM: the merge must
  //                                                  be IDEMPOTENT — SUM re-added
  //                                                  the other side's totals on
  //                                                  every cross-device round-trip
  //                                                  and counters inflated without
  //                                                  drilling. MAX undercounts
  //                                                  stably; exact totals would
  //                                                  need a per-device G-counter.)
  //   boolean                               → OR
  //   array                                 → union by identity
  //   object, key === 'session'             → prefer LOCAL (active session snapshot)
  //   object, key === 'bests'               → per-key MIN (best = fastest time)
  //   object (any other)                    → recurse
  //   mixed / string                        → prefer LOCAL
  function mergeAdditive(a, b, key) {
    if (a === undefined || a === null) return b;
    if (b === undefined || b === null) return a;
    const ta = typeof a, tb = typeof b;
    if (ta === 'number' && tb === 'number') {
      return Math.max(a, b);
    }
    if (ta === 'boolean' || tb === 'boolean') return !!(a || b);
    if (Array.isArray(a) || Array.isArray(b)) {
      const seen = new Set();
      const out = [];
      for (const x of [].concat(a || [], b || [])) {
        const k = JSON.stringify(x);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(x);
      }
      return out;
    }
    if (ta === 'object' && tb === 'object') {
      if (key === 'session') return a;            // active session — prefer local
      if (key === 'bests') {                       // speedrun per-section best TIME → MIN
        const out = {};
        for (const k of unionKeys(a, b)) {
          const av = a[k], bv = b[k];
          out[k] = (av == null) ? bv : (bv == null) ? av : Math.min(av, bv);
        }
        return out;
      }
      const out = {};
      for (const k of unionKeys(a, b)) out[k] = mergeAdditive(a[k], b[k], k);
      return out;
    }
    return a; // mixed types / strings → prefer local (active device)
  }

  // Lifetime drill stats + per-lesson counter maps that accumulate across
  // devices. Each is run through mergeAdditive (MAX counters / MAX records /
  // OR booleans — see above) so the consistency/activity surfaces reflect
  // both devices. Previously every one of these fell through mergeProgress
  // and was DROPPED on each sync.
  const ADDITIVE_STAT_KEYS = [
    'recognize', 'rapidFire', 'warmup', 'speedrun', 'gauntlet', 'bugHunt',
    'crystal', 'claim', 'gotcha', 'swapBench', 'convDrill', 'traceHop',
    'notesDrill', 'mechConstellation', 'reverseWalk', 'notesLocate', 'match',
    'whatif', 'mutate', 'phoneScreen', 'constraintShift', 'flash', 'walkthrough',
    'glossaryQuiz', 'cramReview', 'commandUsage', 'clarify', 'hotseat',
    'timeCalibration'
  ];

  // Fields handled by a NAMED merge block inside mergeProgress. Kept as data
  // (not just code) so tools/check-sync-coverage.js can parity-check every
  // saveProgress key against { EXPLICIT_MERGE_KEYS ∪ ADDITIVE_STAT_KEYS ∪
  // PREFER_LOCAL_KEYS } — a new state field that lands in saveProgress without
  // a conscious merge decision fails the guard instead of silently riding the
  // carry-over base forever.
  const EXPLICIT_MERGE_KEYS = [
    '__v', 'progress', 'bestTimes', 'mockHistory', 'revealed', 'revealedAt',
    'revealedClearedAt', 'partialL1', 'reviews', 'weakness', 'welcomed',
    'history', 'misses', 'cramTaskChecks', 'answers'
  ];

  // Device-state / settings scalars that DELIBERATELY ride the carry-over
  // base ({ ...cloud, ...local } = prefer LOCAL). Listing a key here is the
  // documented "this never converges across devices, by design" decision.
  const PREFER_LOCAL_KEYS = [
    'lastLessonId', 'lastTab', 'starterPath', 'starterPathTrack',
    'offlinePack', 'syncHintShown', 'clarifyRitualOn', 'hotseatOn',
    'calibrateOn', 'paceBarOn', 'hapticOn', 'adhdMode', 'fontScale',
    'subscribedPathId', 'cramView', 'hideMastered', 'repairFilter',
    'tagFilter', 'tagFilterOpen', 'homeOpen', 'sidebarTrack', 'surface', 'surfaceCtx'
  ];

  function mergeProgress(local, cloud) {
    if (!local && !cloud) return null;
    if (!local) return cloud;
    if (!cloud) return local;

    // Carry-over base: start from cloud, overlay local. Any field WITHOUT an
    // explicit policy below survives (prefer the active/local device) instead
    // of being silently dropped. This is the structural fix for the class of
    // bug where a new field added to saveProgress() — but not mirrored here —
    // got wiped on every sync (e.g. state.history → the consistency map).
    const merged = { ...cloud, ...local };
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

    // revealed[id][level]: OR of set flags, EXCEPT a newer timestamped clear
    // wins. Reveal Replay's clean-pass invariant deletes the flag and stamps
    // revealedClearedAt[id][level]; reveals stamp revealedAt[id][level]. A
    // legacy flag with no set-timestamp counts as set-at-0, so any recorded
    // clear beats it; a re-reveal AFTER a clear (newer revealedAt) wins again.
    merged.revealedAt        = mergeNestedMax(local.revealedAt, cloud.revealedAt);
    merged.revealedClearedAt = mergeNestedMax(local.revealedClearedAt, cloud.revealedClearedAt);
    merged.revealed = {};
    for (const id of unionKeys(local.revealed, cloud.revealed)) {
      const a = (local.revealed && local.revealed[id]) || {};
      const b = (cloud.revealed && cloud.revealed[id]) || {};
      const m = {};
      for (const level of unionKeys(a, b)) {
        if (!(a[level] || b[level])) continue;
        const setAt = Math.max(
          a[level] ? nestedTs(local.revealedAt, id, level) : -1,
          b[level] ? nestedTs(cloud.revealedAt, id, level) : -1
        );
        const clearedAt = Math.max(
          nestedTs(local.revealedClearedAt, id, level),
          nestedTs(cloud.revealedClearedAt, id, level)
        );
        if (clearedAt > setAt) continue; // newest event is a clear → stays cleared
        m[level] = true;
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

    // partialL1[id]: OR. Sibling of weakness — both are set on an imperfect L1
    // pass and cleared on a later clean (100%) pass, so they merge identically.
    merged.partialL1 = {};
    for (const id of unionKeys(local.partialL1, cloud.partialL1)) {
      const v = (local.partialL1 && local.partialL1[id]) || (cloud.partialL1 && cloud.partialL1[id]);
      if (v) merged.partialL1[id] = true;
    }

    // cramTaskChecks[taskId]: OR — 4-Day Cram checkboxes are completions, not
    // device state; a check made on the laptop must appear on the phone
    // (same semantics as prep.completed).
    merged.cramTaskChecks = {};
    for (const id of unionKeys(local.cramTaskChecks, cloud.cramTaskChecks)) {
      if ((local.cramTaskChecks && local.cramTaskChecks[id]) ||
          (cloud.cramTaskChecks && cloud.cramTaskChecks[id])) {
        merged.cramTaskChecks[id] = true;
      }
    }

    // welcomed: OR
    merged.welcomed = !!(local.welcomed || cloud.welcomed);

    // history / misses: per-lesson event logs → UNION (see mergeEventLog).
    // These drive the 60-day consistency map, the activity bars/streak, and the
    // mistake-tagging postmortem — so they MUST aggregate both devices.
    merged.history = mergeEventLog(local.history, cloud.history, EVENT_LOG_CAP);
    merged.misses  = mergeEventLog(local.misses,  cloud.misses,  EVENT_LOG_CAP);

    // answers: the most recent ATTEMPT per lesson per level (share codes).
    // Not additive and not unionable — a level's record is one coherent
    // snapshot of one sitting, so blending two devices' picks would invent an
    // attempt that never happened. Newest `at` wins, per lesson per level.
    merged.answers = mergeLatestAttempt(local.answers, cloud.answers);

    // Lifetime drill stats + per-lesson counter maps → additive merge (SUM
    // counters, MAX timestamps/records, etc. — see mergeAdditive).
    for (const key of ADDITIVE_STAT_KEYS) {
      if (local[key] === undefined && cloud[key] === undefined) continue;
      merged[key] = mergeAdditive(local[key], cloud[key], key);
    }

    // Device-state scalars: prefer LOCAL (active device shouldn't get
    // yanked to another device's last-lesson / tab / track / filters). The
    // carry-over base already prefers local for these, but keep the explicit
    // list as documentation of intent.
    const scalarPreferLocal = ['lastLessonId', 'lastTab', 'starterPath',
                               'hideMastered', 'sidebarTrack'];
    for (const key of scalarPreferLocal) {
      const v = local[key] !== undefined ? local[key] : cloud[key];
      if (v !== undefined) merged[key] = v;
    }

    return merged;
  }

  function mergePrep(local, cloud) {
    if (!local && !cloud) return null;
    if (!local) return cloud;
    if (!cloud) return local;

    // Carry-over base (see mergeProgress) — unlisted fields prefer local
    // instead of being dropped.
    const merged = { ...cloud, ...local };
    merged.__v = Math.max(local.__v || 0, cloud.__v || 0, 1);

    // completed[taskId]: OR
    merged.completed = {};
    for (const id of unionKeys(local.completed, cloud.completed)) {
      if ((local.completed && local.completed[id]) || (cloud.completed && cloud.completed[id])) {
        merged.completed[id] = true;
      }
    }

    // expanded[blockId]: OR
    merged.expanded = {};
    for (const id of unionKeys(local.expanded, cloud.expanded)) {
      if ((local.expanded && local.expanded[id]) || (cloud.expanded && cloud.expanded[id])) {
        merged.expanded[id] = true;
      }
    }

    // reviewed[itemId]: greater lastReviewedAt wins (mirrors main app's reviews merge).
    // A more recent review reflects the user's current confidence — even if it's a miss
    // that knocked familiarity back to 0, that's the truth right now.
    merged.reviewed = {};
    for (const id of unionKeys(local.reviewed, cloud.reviewed)) {
      const a = local.reviewed && local.reviewed[id];
      const b = cloud.reviewed && cloud.reviewed[id];
      if (!a) merged.reviewed[id] = b;
      else if (!b) merged.reviewed[id] = a;
      else merged.reviewed[id] = (a.lastReviewedAt || 0) >= (b.lastReviewedAt || 0) ? a : b;
    }

    // Device/UI state: prefer LOCAL
    for (const key of ['currentTab', 'currentDayId', 'glossSearch', 'review']) {
      const v = local[key] !== undefined ? local[key] : cloud[key];
      if (v !== undefined) merged[key] = v;
    }

    return merged;
  }

  function mergeDiagnostic(local, cloud) {
    if (!local && !cloud) return null;
    if (!local) return cloud;
    if (!cloud) return local;

    // Carry-over base (see mergeProgress) — unlisted fields prefer local
    // instead of being dropped.
    const merged = { ...cloud, ...local };
    merged.__v = Math.max(local.__v || 0, cloud.__v || 0, 1);

    // startedAt: MIN (earliest start across devices)
    if (local.startedAt && cloud.startedAt) {
      merged.startedAt = local.startedAt < cloud.startedAt ? local.startedAt : cloud.startedAt;
    } else {
      merged.startedAt = local.startedAt || cloud.startedAt;
    }

    // answers[qid]: greater lastAnsweredAt wins (most recent answer is the truth)
    merged.answers = {};
    for (const qid of unionKeys(local.answers, cloud.answers)) {
      const a = local.answers && local.answers[qid];
      const b = cloud.answers && cloud.answers[qid];
      if (!a) merged.answers[qid] = b;
      else if (!b) merged.answers[qid] = a;
      else merged.answers[qid] = (a.lastAnsweredAt || 0) >= (b.lastAnsweredAt || 0) ? a : b;
    }

    // pre / post: per-key, prefer non-empty; if both have a value, prefer LOCAL
    for (const block of ['pre', 'post']) {
      merged[block] = {};
      const lblock = local[block] || {};
      const cblock = cloud[block] || {};
      for (const k of unionKeys(lblock, cblock)) {
        const lv = lblock[k];
        const cv = cblock[k];
        const v = (lv !== undefined && lv !== '') ? lv : cv;
        if (v !== undefined && v !== '') merged[block][k] = v;
      }
    }

    // timeOnStep[step]: MAX (cumulative time across devices is undefined; pick the larger)
    merged.timeOnStep = {};
    for (const step of unionKeys(local.timeOnStep, cloud.timeOnStep)) {
      const a = (local.timeOnStep && local.timeOnStep[step]) || 0;
      const b = (cloud.timeOnStep && cloud.timeOnStep[step]) || 0;
      merged.timeOnStep[step] = Math.max(a, b);
    }

    // currentStep: prefer LOCAL (active device's position)
    if (local.currentStep !== undefined) merged.currentStep = local.currentStep;
    else if (cloud.currentStep !== undefined) merged.currentStep = cloud.currentStep;

    return merged;
  }

  function mergeSystemDesign(local, cloud) {
    if (!local && !cloud) return null;
    if (!local) return cloud;
    if (!cloud) return local;

    // Carry-over base (see mergeProgress) — unlisted fields prefer local
    // instead of being dropped.
    const merged = { ...cloud, ...local };
    merged.__v = Math.max(local.__v || 0, cloud.__v || 0, 1);

    // boxes["topic/unit/qIdx"]: UNION of keys; per shared key the entry with
    // the GREATER `last` wins { box, due } as a unit (the most recent grade is
    // the scheduling truth — even a miss that reset the box), then the
    // lifetime counters seen/good/again each take MAX (idempotent, not SUM).
    merged.boxes = {};
    for (const key of unionKeys(local.boxes, cloud.boxes)) {
      const l = local.boxes && local.boxes[key];
      const c = cloud.boxes && cloud.boxes[key];
      if (!l) { merged.boxes[key] = c; continue; }
      if (!c) { merged.boxes[key] = l; continue; }
      const winner = (l.last || 0) >= (c.last || 0) ? l : c;
      merged.boxes[key] = Object.assign({}, winner, {
        seen:  Math.max(l.seen  || 0, c.seen  || 0),
        good:  Math.max(l.good  || 0, c.good  || 0),
        again: Math.max(l.again || 0, c.again || 0)
      });
    }

    // lastTopic / lastChapter: device/session state → prefer LOCAL (fall back
    // to cloud when local never visited a topic, i.e. holds null).
    for (const key of ['lastTopic', 'lastChapter']) {
      merged[key] = (local[key] != null) ? local[key]
                  : (cloud[key] != null) ? cloud[key]
                  : (local[key] !== undefined ? local[key] : cloud[key]);
    }

    return merged;
  }

  // Per-key MAX over a two-level timestamp map { id: { level: epochMs } }.
  function mergeNestedMax(a, b) {
    const out = {};
    for (const id of unionKeys(a, b)) {
      const ai = (a && a[id]) || {};
      const bi = (b && b[id]) || {};
      const m = {};
      for (const k of unionKeys(ai, bi)) m[k] = Math.max(ai[k] || 0, bi[k] || 0);
      if (Object.keys(m).length) out[id] = m;
    }
    return out;
  }

  function nestedTs(map, id, key) {
    return (map && map[id] && typeof map[id][key] === 'number') ? map[id][key] : 0;
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
        background: rgba(23,24,28,0.85); border: 1px solid #262930;
        color: #c4c9cf; font: 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        padding: 6px 10px; border-radius: 999px; cursor: pointer;
        backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        transition: border-color .15s, color .15s;
      }
      #sync-chip:hover { border-color: #4a4f58; color: #eef0f2; }
      #sync-chip .sync-dot {
        width: 6px; height: 6px; border-radius: 50%; background: #6b7079;
      }
      #sync-chip.is-on .sync-dot { background: #22c55e; }
      #sync-chip.is-syncing .sync-dot { background: #facc15; animation: syncPulse 1s infinite; }
      @keyframes syncPulse { 50% { opacity: .35; } }
      /* nav-audit P2-7: drill sessions own the top-right corner (Exit button
         + progress bar) — measured @390px the chip intersected Rapid-Fire's
         Exit and overlaid its timer track. Hide the ambient chip while any
         session shell is rendered; it returns the moment the session ends. */
      body:has(#lesson-shell .recognize-shell) #sync-chip,
      body:has(#lesson-shell .rapid-shell) #sync-chip,
      body:has(#lesson-shell .bug-shell) #sync-chip,
      body:has(#lesson-shell .warmup-shell) #sync-chip,
      body:has(#lesson-shell .speedrun-shell) #sync-chip,
      body:has(#lesson-shell .gauntlet-shell) #sync-chip { display: none; }

      #sync-modal {
        position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,0.6);
        display: none; align-items: center; justify-content: center;
      }
      #sync-modal.is-open { display: flex; }
      #sync-modal .panel {
        background: #17181c; border: 1px solid #262930; border-radius: 12px;
        padding: 22px; max-width: 380px; width: 92vw;
        color: #eef0f2; font: 14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      }
      #sync-modal h2 { margin: 0 0 6px 0; font-size: 17px; font-weight: 700; color: #ffffff; }
      #sync-modal p { margin: 0 0 14px 0; font-size: 12.5px; color: #9aa0aa; }
      #sync-modal label { display: block; font-size: 12px; color: #9aa0aa; margin: 10px 0 4px; }
      #sync-modal input {
        width: 100%; background: #0a0b0d; border: 1px solid #262930; border-radius: 6px;
        padding: 8px 10px; color: #eef0f2; font: 14px ui-monospace,Menlo,monospace;
      }
      #sync-modal input:focus { outline: none; border-color: #f5b62b; }
      #sync-modal .row { display: flex; gap: 8px; margin-top: 14px; }
      #sync-modal button.primary {
        flex: 1; background: #e0a41e; border: 0; border-radius: 6px; padding: 9px 12px;
        color: white; font-weight: 600; font-size: 13px; cursor: pointer;
      }
      #sync-modal button.primary:disabled { opacity: .5; cursor: not-allowed; }
      #sync-modal button.ghost {
        background: transparent; border: 1px solid #363a43; color: #c4c9cf;
        border-radius: 6px; padding: 9px 12px; font-size: 13px; cursor: pointer;
      }
      #sync-modal .err { color: #fca5a5; font-size: 12px; margin-top: 8px; min-height: 16px; }
      #sync-modal .ok  { color: #86efac; font-size: 12px; margin-top: 8px; min-height: 16px; }
      #sync-modal .user-row {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        background: #0a0b0d; border: 1px solid #262930; border-radius: 6px;
        padding: 10px 12px; font-size: 13px;
      }
      #sync-modal .user-row .email { color: #eef0f2; word-break: break-all; }
      #sync-modal .linkbtn {
        display: block; margin: 14px auto 0; background: none; border: 0; padding: 4px;
        color: #ffce5a; font-size: 12px; cursor: pointer; text-decoration: underline;
      }
      #sync-modal .linkbtn:hover { color: #ffce5a; }
      #sync-modal .hr { height: 1px; background: #262930; margin: 16px 0 6px; border: 0; }
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
          <p>Sign in with your email and password to keep your laptop and phone in sync — local-only otherwise.</p>
          <label for="sync-email">Email</label>
          <input id="sync-email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" />
          <label for="sync-password">Password</label>
          <input id="sync-password" type="password" autocomplete="current-password" placeholder="••••••••" />
          <div class="row">
            <button type="button" class="ghost" data-act="signup">Create account</button>
            <button type="button" class="primary" data-act="signin">Sign in</button>
          </div>
          <div class="err" data-err></div>
          <div class="ok" data-ok></div>
          <button type="button" class="linkbtn" data-act="use-code">Email me a 6-digit code instead</button>
        </div>
        <div data-view="awaiting-code" style="display:none">
          <h2>Check your email</h2>
          <p>Enter the 6-digit code we sent to <span data-email-echo style="color:#eef0f2"></span>. (You can also click the link in the email.)</p>
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
          <label for="sync-newpw">Set / change password</label>
          <input id="sync-newpw" type="password" autocomplete="new-password" placeholder="New password (min 6 chars)" />
          <div class="row">
            <button type="button" class="primary" data-act="setpw">Save password</button>
          </div>
          <div class="err" data-err></div>
          <div class="ok" data-ok></div>
          <hr class="hr" />
          <div class="row">
            <button type="button" class="ghost" data-act="close">Close</button>
            <button type="button" class="ghost" data-act="signout">Sign out</button>
          </div>
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

    // Enter-to-submit so the password fast-path is one-handed on mobile.
    const onEnter = (el, fn) => { if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fn(); } }); };
    onEnter(modal.querySelector('#sync-email'), () => { const p = document.getElementById('sync-password'); if (p) p.focus(); });
    onEnter(modal.querySelector('#sync-password'), () => handleAction('signin'));
    onEnter(modal.querySelector('#sync-code'), () => handleAction('verify'));
    onEnter(modal.querySelector('#sync-newpw'), () => handleAction('setpw'));

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
      if (!user) { const e = document.getElementById('sync-email'); if (e) e.focus(); }
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

      if (act === 'signin' || act === 'signup') {
        const email = (document.getElementById('sync-email').value || '').trim();
        const password = document.getElementById('sync-password').value || '';
        if (!email || !/.+@.+\..+/.test(email)) return setErr('Enter a valid email.');
        if (password.length < 6) return setErr('Password must be at least 6 characters.');
        const btn = document.querySelector(`#sync-modal [data-act="${act}"]`);
        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = act === 'signin' ? 'Signing in…' : 'Creating…';
        try {
          if (act === 'signin') {
            await Sync.signInWithPassword(email, password);
            // onAuthStateChange → renderAuthState → signed-in view.
            showView('signed-in');
            setOk('Signed in. Merging progress…');
          } else {
            const data = await Sync.signUpWithPassword(email, password);
            if (data && data.session) {
              showView('signed-in');
              setOk('Account created. Syncing…');
            } else {
              setOk('Account created — check your email to confirm, then sign in.');
            }
          }
        } catch (e) {
          const msg = (e && e.message) || '';
          if (act === 'signin' && /invalid login credentials/i.test(msg)) {
            setErr('Wrong email/password — or this account has no password yet. Tap "Email me a code instead", sign in, then set a password.');
          } else {
            setErr(msg || 'Something went wrong. Try again.');
          }
        } finally {
          btn.disabled = false; btn.textContent = orig;
        }
        return;
      }

      if (act === 'setpw') {
        const password = document.getElementById('sync-newpw').value || '';
        if (password.length < 6) return setErr('Password must be at least 6 characters.');
        const btn = document.querySelector('#sync-modal [data-act="setpw"]');
        btn.disabled = true; btn.textContent = 'Saving…';
        try {
          await Sync.setPassword(password);
          document.getElementById('sync-newpw').value = '';
          setOk('Password saved. Use it to sign in next time.');
        } finally {
          btn.disabled = false; btn.textContent = 'Save password';
        }
        return;
      }

      if (act === 'use-code') {
        const email = (document.getElementById('sync-email').value || '').trim();
        if (!email || !/.+@.+\..+/.test(email)) return setErr('Enter your email above first, then tap this.');
        const btn = document.querySelector('#sync-modal [data-act="use-code"]');
        btn.disabled = true; btn.textContent = 'Sending…';
        try {
          await Sync.signInWithOtp(email);
          pendingEmail = email;
          document.querySelectorAll('#sync-modal [data-email-echo]').forEach(el => { el.textContent = email; });
          showView('awaiting-code');
          setOk('Code sent. Check your inbox.');
          setTimeout(() => document.getElementById('sync-code').focus(), 50);
        } finally {
          btn.disabled = false; btn.textContent = 'Email me a 6-digit code instead';
        }
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
  // Internal pure functions exposed for unit testing only. Not part of the
  // public API; treat as private. See tools/cdp/sync-merge.js.
  Sync._testInternals = {
    mergeProgress, mergePrep, mergeDiagnostic, mergeSystemDesign,
    normalizeCloudBundle, decideSignInAction,
    EXPLICIT_MERGE_KEYS, PREFER_LOCAL_KEYS, ADDITIVE_STAT_KEYS
  };

  root.DrillSync = Sync;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Sync.init);
  } else {
    Sync.init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
