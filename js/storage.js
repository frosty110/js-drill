// Shared localStorage layer for the JS-Drill family.
//
// Why this exists: prep.html and diagnostic.html were reading/writing the
// main app's localStorage directly with hand-rolled JSON.parse + version
// checks. Three files, three different opinions about what to do when the
// data is missing/corrupt/an older schema. This file is the single source
// of truth for storage I/O across:
//
//   - the main drill app (key: jsdrill.progress.v1)   ── lesson progress + SR + history
//   - the prep dashboard  (key: jsdrill.prep.v1)      ── task checks + per-item review
//   - the diagnostic      (key: jsdrill.diagnostic.v1) ── 4-day-prep diagnostic answers
//
// Design rules:
//   1. Domain logic stays in the app code. This file only handles
//      I/O + schema versioning. It does NOT seed defaults, fan out to
//      app state, or fire UI updates.
//   2. load*() functions return either a parsed object or null. They
//      never throw. Corrupt/missing data → null.
//   3. save*() functions never throw. They warn on quota/serialization
//      errors but return cleanly.
//   4. Version is on the object itself (`__v`). To bump a schema, add
//      the new version to ACCEPTED_VERSIONS, write a migration in the
//      caller, increment CURRENT_VERSION when saving.
//
// To consume: include this script before any code that uses Storage.
//   <script src="js/storage.js"></script>

(function (root) {
  'use strict';

  // Namespaced to avoid clashing with the browser's built-in `Storage`
  // interface (the prototype of localStorage/sessionStorage objects).
  const Storage = {};

  // ============================================================================
  // MAIN APP — lesson progress, mastery, SR schedule, history
  // ============================================================================
  Storage.MAIN_APP_KEY = 'jsdrill.progress.v1';
  Storage.MAIN_APP_VERSION = 6;
  // Older snapshots that loadAppProgress still accepts. App-side migration
  // (in app.js loadProgress) backfills the missing fields after the load.
  Storage.MAIN_APP_ACCEPTED_VERSIONS = [2, 3, 4, 5, 6];

  Storage.loadAppProgress = function () {
    return _safeLoad(Storage.MAIN_APP_KEY, Storage.MAIN_APP_ACCEPTED_VERSIONS);
  };

  Storage.saveAppProgress = function (state) {
    _safeSave(Storage.MAIN_APP_KEY, state);
    _fireWriteEvent('progress');
  };

  // ============================================================================
  // PREP DASHBOARD — task checks, per-item review state, SR queue
  // ============================================================================
  Storage.PREP_KEY = 'jsdrill.prep.v1';
  Storage.PREP_VERSION = 1;
  Storage.PREP_ACCEPTED_VERSIONS = [1];

  Storage.loadPrepState = function () {
    // Prep was written before this module existed, so historical writes
    // may be missing __v. Treat missing version as v1.
    const raw = _readRaw(Storage.PREP_KEY);
    if (!raw) return null;
    if (raw.__v == null) return raw; // unversioned legacy snapshot
    if (Storage.PREP_ACCEPTED_VERSIONS.includes(raw.__v)) return raw;
    return null;
  };

  Storage.savePrepState = function (state) {
    // Stamp the version on the way out so future migrations have something to switch on.
    const stamped = Object.assign({ __v: Storage.PREP_VERSION }, state);
    _safeSave(Storage.PREP_KEY, stamped);
    _fireWriteEvent('prep');
  };

  // ============================================================================
  // DIAGNOSTIC — 4-day-prep self-test responses
  // ============================================================================
  Storage.DIAGNOSTIC_KEY = 'jsdrill.diagnostic.v1';
  Storage.DIAGNOSTIC_VERSION = 1;
  Storage.DIAGNOSTIC_ACCEPTED_VERSIONS = [1];

  Storage.loadDiagnostic = function () {
    const raw = _readRaw(Storage.DIAGNOSTIC_KEY);
    if (!raw) return null;
    if (raw.__v == null) return raw; // unversioned legacy
    if (Storage.DIAGNOSTIC_ACCEPTED_VERSIONS.includes(raw.__v)) return raw;
    return null;
  };

  Storage.saveDiagnostic = function (state) {
    const stamped = Object.assign({ __v: Storage.DIAGNOSTIC_VERSION }, state);
    _safeSave(Storage.DIAGNOSTIC_KEY, stamped);
    _fireWriteEvent('diagnostic');
  };

  // "Start over" on diagnostic.html. Exists so that page doesn't have to reach
  // for localStorage.removeItem directly — a raw remove skips the write event,
  // so sync would keep the cleared blob alive and push it back on the next
  // merge, silently un-restarting the user.
  Storage.clearDiagnostic = function () {
    try { localStorage.removeItem(Storage.DIAGNOSTIC_KEY); }
    catch (e) { /* private mode / quota — nothing to clear anyway */ }
    _fireWriteEvent('diagnostic');
  };

  // ============================================================================
  // SYSTEM DESIGN — DDIA (and future topics) multiple-choice memorization
  // ============================================================================
  // A standalone conceptual-recall surface (system-design.html). Unlike the
  // JS-drill blobs above, there's no code execution — just per-question mastery
  // and a lightweight spaced-repetition-style box, keyed by "<topic>/<chapterId>/<qIdx>".
  Storage.SYSDESIGN_KEY = 'jsdrill.systemdesign.v1';
  Storage.SYSDESIGN_VERSION = 1;
  Storage.SYSDESIGN_ACCEPTED_VERSIONS = [1];

  Storage.loadSystemDesign = function () {
    return _safeLoad(Storage.SYSDESIGN_KEY, Storage.SYSDESIGN_ACCEPTED_VERSIONS);
  };

  Storage.saveSystemDesign = function (state) {
    const stamped = Object.assign({}, state, { __v: Storage.SYSDESIGN_VERSION });
    _safeSave(Storage.SYSDESIGN_KEY, stamped);
    _fireWriteEvent('systemdesign');
  };

  // ============================================================================
  // SYNC MARKERS — device-local, NEVER part of any synced bundle
  // ============================================================================
  // Small unsynced scalars that js/sync.js needs to make cloud writes safe:
  //   - owner:   which auth user id the local blobs belong to. Written after a
  //              successful signed-in merge+push. Lets sync.js detect a sign-in
  //              by a DIFFERENT account on the same device (cross-account bleed
  //              guard) instead of silently merging user A's history into
  //              user B's row.
  //   - reset:   { resetAt, lastResetSeenAt } — the cloud-authoritative reset/
  //              restore channel. resetAt is stamped into the pushed bundle so
  //              other devices REPLACE local with cloud instead of union-merging
  //              the cleared data back; lastResetSeenAt records the newest
  //              cloud resetAt this device has already adopted.
  // These fire NO write event (they must never trigger a push themselves).
  Storage.SYNC_OWNER_KEY = 'jsdrill.sync.owner.v1';

  Storage.loadSyncOwner = function () {
    try { return localStorage.getItem(Storage.SYNC_OWNER_KEY) || null; }
    catch (e) { return null; }
  };

  Storage.saveSyncOwner = function (uid) {
    try { localStorage.setItem(Storage.SYNC_OWNER_KEY, String(uid)); }
    catch (e) { console.warn('storage write failed for', Storage.SYNC_OWNER_KEY, e); }
  };

  Storage.SYNC_RESET_KEY = 'jsdrill.sync.reset.v1';

  /** Returns { resetAt?, lastResetSeenAt? } — empty object when unset. */
  Storage.loadSyncResetMarkers = function () {
    return _readRaw(Storage.SYNC_RESET_KEY) || {};
  };

  Storage.saveSyncResetMarkers = function (markers) {
    _safeSave(Storage.SYNC_RESET_KEY, markers || {});
  };

  // ============================================================================
  // CROSS-APP BRIDGE
  // ============================================================================
  // Prep + diagnostic need to (a) READ main-app progress to auto-check
  // lesson tasks and (b) WRITE main-app's lastLessonId to deep-link into
  // a lesson on tap. Both are defensive — main app's schema is allowed to
  // evolve. If anything is off, prep falls back to "nothing completed yet"
  // instead of crashing.

  /** Returns the per-lesson progress map from main app, or {} on any failure. */
  Storage.readMainProgressMap = function () {
    const parsed = Storage.loadAppProgress();
    return (parsed && parsed.progress) || {};
  };

  /** Returns true iff a lesson has L1+L2+L3 = 'passed' in main-app progress. */
  Storage.isLessonFullyDone = function (lessonId) {
    const m = Storage.readMainProgressMap();
    const l = m[lessonId];
    return !!(l && l.L1 === 'passed' && l.L2 === 'passed' && l.L3 === 'passed');
  };

  /** Returns true iff a lesson has ≥1 of L1/L2/L3 passed in main-app progress. */
  Storage.isLessonPartiallyDone = function (lessonId) {
    const m = Storage.readMainProgressMap();
    const l = m[lessonId];
    return !!(l && (l.L1 === 'passed' || l.L2 === 'passed' || l.L3 === 'passed'));
  };

  /**
   * Stamp `lastLessonId` into main-app storage so navigating to index.html
   * boots into that lesson. Preserves the rest of main-app state; if the
   * file isn't there yet, seeds a minimal versioned shell.
   */
  Storage.setMainLastLessonId = function (lessonId) {
    try {
      const raw = localStorage.getItem(Storage.MAIN_APP_KEY);
      const parsed = raw ? JSON.parse(raw) : { __v: Storage.MAIN_APP_VERSION };
      parsed.lastLessonId = lessonId;
      localStorage.setItem(Storage.MAIN_APP_KEY, JSON.stringify(parsed));
      return true;
    } catch (e) {
      console.warn('setMainLastLessonId failed:', e);
      return false;
    }
  };

  // ============================================================================
  // INTERNAL
  // ============================================================================
  function _readRaw(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('storage parse failed for', key, e);
      return null;
    }
  }

  function _safeLoad(key, acceptedVersions) {
    const parsed = _readRaw(key);
    if (!parsed) return null;
    if (acceptedVersions && !acceptedVersions.includes(parsed.__v)) {
      console.warn('storage rejected ' + key + ' with __v=' + parsed.__v +
        '; expected one of ' + acceptedVersions.join(', '));
      return null;
    }
    return parsed;
  }

  function _safeSave(key, state) {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      // Likely quota exceeded. Swallow so a single bad write doesn't crash
      // the app, but log loudly.
      console.warn('storage write failed for', key, e);
    }
  }

  // Optional layers (js/sync.js) listen for this without creating a
  // circular dependency. `detail.key` is 'progress' | 'prep' | 'diagnostic'
  // | 'systemdesign' so consumers can be selective if they want — sync.js
  // debounce-pushes the whole bundle on any write.
  function _fireWriteEvent(key) {
    if (typeof root.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
    try {
      root.dispatchEvent(new CustomEvent('drill:storage-written', { detail: { key } }));
    } catch (e) { /* ignore */ }
  }

  // ============================================================================
  // EXPOSURE
  // ============================================================================
  root.DrillStorage = Storage;
})(typeof window !== 'undefined' ? window : globalThis);
