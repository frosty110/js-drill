# Supabase Cross-Device Sync — Audit Report

**Date:** 2026-07-10 · **Branch:** `claude/ddia-learning-tool-peiw5t` · **Scope:** `js/sync.js`, `js/storage.js`, `js/supabase-config.js`, `js/supabase-client.js`, `supabase/migrations/001_user_progress.sql`, `tools/cdp/sync-merge.js`, page wiring in `index.html` / `system-design.html` / `diagnostic.html`, app state in `js/app/04-progress-sr.js`, reset/backup/restore in `js/app/14-init-core.js`, service worker.

This is an audit-only report. No app code was modified.

---

## Executive summary

The sync layer is well-architected for its size: single JSONB row per user, RLS correctly scoped on all four verbs, anon-key-only client, pull-merge-push with a carry-over base that survived the "47 dropped fields" incident (commit `edc806b`), and real unit tests for the merge rules. The header-comment contract in `js/sync.js` matches the implemented merge code almost exactly.

But the audit found **two P0s and six P1s**:

- **P0-1 (data loss):** the System Design surface's Leitner state for **559 questions** (`jsdrill.systemdesign.v1`) is never synced. A cross-device user silently loses all System Design progress on the second device. Ironically, every System Design grade *triggers* a push (the `drill:storage-written` listener doesn't filter by key) — a push that excludes the very blob that changed. Fix is schema-free (new JSON key inside the existing JSONB column) — full spec below.
- **P0-2 (privacy / cross-account bleed):** sign-out preserves local data (by design), but sign-in unconditionally merges local into the new session's cloud row. On a shared device, **user A's entire drill history is absorbed into user B's account** the moment B signs in.
- **P1s:** additive counters **inflate on every cross-device round-trip** (SUM is not idempotent — a two-device user's `recognize.attempts` grows without drilling); four newer state fields (`clarify`, `hotseat`, `timeCalibration`, `cramTaskChecks`) are missing from the additive registry and never converge; **cleared flags resurrect** (`revealed`/`partialL1`/`weakness` merge as monotone OR while the app clears them — Reveal Replay's clean-pass invariant is undone by the next pull); **Reset never sticks** for a synced user (the other device's pull-merge unions everything back); **Restore bypasses `DrillStorage`** so a rollback is silently re-merged away after reload; and **push is a blind whole-row upsert** with no concurrency check.

Nothing here requires a Postgres migration. Everything is fixable inside `js/sync.js` + small app-side touches, with new unit tests in `tools/cdp/sync-merge.js`.

---

## P0 findings

### P0-1 — System Design progress (559 questions) is never synced [DATA LOSS — confirmed]

**Evidence**

- `js/storage.js:104-116` — `SYSDESIGN_KEY = 'jsdrill.systemdesign.v1'`, `saveSystemDesign()` fires `_fireWriteEvent('systemdesign')`.
- `js/sync.js:263-269` — `loadLocalBundle()` returns only `{ progress, prep, diagnostic }`. No `systemdesign`.
- `js/sync.js:274-285` — `normalizeCloudBundle()` returns only the same three keys.
- `js/sync.js:326-330` — `doPull` merges only three blobs; `js/sync.js:337-339` saves only three.
- `js/sync.js:207-210` — the `drill:storage-written` listener does **not** filter on `detail.key`, so a System Design grade *does* schedule a push (`schedulePush()`), which then pushes a bundle that omits systemdesign.
- `system-design.html:10-15` — the page loads all four sync scripts, so the Sync chip renders and reads "Synced" on this page while syncing nothing it writes.
- State shape at `system-design.html:251` / `:263-275`: `{ __v, boxes: { "topic/chapterId/qIdx": { box, seen, good, again, due, last } }, lastTopic, lastChapter }`. 559 questions across `data/system-design/*/` (counted on disk).

**User impact:** the target user (PROFILE.md: phone 80% of the time) drills DDIA on the phone, opens the laptop, and every box/due date is gone — with the green "Synced" chip visible the whole time. Worse: laptop grades then push nothing either, so the two devices diverge forever.

**Fix spec (implementation-ready)**

**(a) Postgres row shape — NO migration needed.** `supabase/migrations/001_user_progress.sql:9-13` defines one `data jsonb` column; the bundle envelope `{ progress, prep, diagnostic }` is purely a client convention (`js/sync.js:15-17`). Adding a `systemdesign` key inside the same JSONB is fully backward-compatible: old clients' `normalizeCloudBundle` ignores unknown keys on pull, but see the caveat in P1-6 — an old client's blind `doPush` will **drop** the `systemdesign` key when it upserts. Mitigation: the SW `CACHE_VERSION` bump (below) evicts stale clients; a newer device's next pull-merge-push restores the key from its local copy (self-healing, same dynamics as the `edc806b` class).

**(b) Merge policy — `mergeSystemDesign(local, cloud)`.** Defensible rules, matching the spirit of the existing contract:

```
__v:                     MAX (mirror of existing rule, sync.js:74)
boxes:                   UNION of keys ("topic/unit/qIdx"). Per key, both sides present:
  box, due, last         → the entry with the GREATER `last` wins as a unit
                           (most-recent grade is the scheduling truth — exact analogue
                           of reviews[id] "greater lastPassedAt wins", sync.js:520-528,
                           and prep.reviewed "greater lastReviewedAt wins", sync.js:601-611)
  seen, good, again      → MAX of each side (lifetime counters; MAX not SUM because
                           the merge must be IDEMPOTENT — see P1-1 for why SUM inflates)
lastTopic, lastChapter:  prefer LOCAL (device/session state, same as lastLessonId/lastTab)
```

Concretely: winner = `(l.last||0) >= (c.last||0) ? l : c`; then output `{ ...winner, seen: Math.max(l.seen||0, c.seen||0), good: Math.max(...), again: Math.max(...) }`. Do **not** route this through `mergeAdditive` — its SUM rule is the P1-1 bug and `last`-vs-counters need different treatments within one object.

**(c) Exact `js/sync.js` changes**

1. **Header comment** (`js/sync.js:1-4` and the conflict-policy block `:29-78`): add the fourth blob and the rules above.
2. **`loadLocalBundle()`** (`:263-269`): add `systemdesign: root.DrillStorage.loadSystemDesign()`.
3. **`normalizeCloudBundle()`** (`:274-285`): add `systemdesign: raw.systemdesign || null` to the pass-through branch; the legacy `__v`-at-top-level branch returns `systemdesign: null`.
4. **`doPush()`** (`:291`): extend the nothing-to-push guard: `if (!bundle.progress && !bundle.prep && !bundle.diagnostic && !bundle.systemdesign) return;`.
5. **`doPull()`** merge block (`:326-330`): add `systemdesign: mergeSystemDesign(local.systemdesign, cloud.systemdesign)`; save block (`:337-339`): `if (merged.systemdesign) root.DrillStorage.saveSystemDesign(stripVersion(merged.systemdesign));` (`saveSystemDesign` re-stamps `__v` — `js/storage.js:113`).
6. **New `mergeSystemDesign()`** next to `mergePrep`/`mergeDiagnostic` (`:575-675`), with the standard null-passthrough head (`if (!local && !cloud) return null; …`) and the carry-over base `{ ...cloud, ...local }` for forward-compat.
7. **`Sync._testInternals`** (`:994-996`): export `mergeSystemDesign`.
8. **Chip status:** no change — the chip is binary signed-in/out (`:973-987`), not per-blob.
9. **`js/storage.js:200-202`** comment (`detail.key` is `'progress' | 'prep' | 'diagnostic'`): add `'systemdesign'`. (The listener itself already fires for it.)
10. **`service-worker.js:17`**: bump `CACHE_VERSION` so PWA/returning clients pick up the new `js/sync.js` (precached at `service-worker.js:57`).

**Required companion fix in `system-design.html`:** the page hydrates `let progress = load()` once at boot (`system-design.html:251`) and every `persist()` writes that in-memory object back (`:260`). After a background pull rewrites `jsdrill.systemdesign.v1`, the page's stale in-memory `progress` will **clobber the pulled data on its next `persist()`**. Add a listener alongside the boot code:

```js
window.addEventListener('drill:sync-pulled', () => { progress = load(); /* re-render current screen */ });
```

(The main app has the analogous multi-tab re-hydrate at `js/app/14-init-core.js:2372-2381`; system-design.html has none.)

**(d) New unit tests — `tools/cdp/sync-merge.js`** (same `check()` harness, drive `window.DrillSync._testInternals.mergeSystemDesign`):

1. `normalize: bundle with systemdesign passes through` — extend the existing normalize test (`sync-merge.js:46-51`); assert legacy `__v`-shape yields `systemdesign: null`.
2. `sysdesign: boxes UNION across different keys` — phone drilled `ddia/ch01/0`, laptop `ddia/ch02/3` → both present.
3. `sysdesign: same key — greater last wins box/due` — local `{box:2, last:200, due:900}` vs cloud `{box:4, last:100, due:500}` → box 2, due 900 (recency wins even when the box is lower — a miss that reset the box is the truth).
4. `sysdesign: seen/good/again take MAX not SUM` — local `{seen:10, good:7, again:3, last:200}` + cloud `{seen:6, good:5, again:1, last:100}` → `{seen:10, good:7, again:3}`; re-merging the result with either input is a no-op (idempotence assertion).
5. `sysdesign: lastTopic/lastChapter prefer local`.
6. `sysdesign: one side null passes the other through` (both directions).
7. `sysdesign: __v MAX`.

---

### P0-2 — Cross-account bleed: second sign-in on a shared device absorbs the first user's data [SECURITY/PRIVACY — confirmed]

**Evidence**

- `js/sync.js:168-172` — `signOut()` deliberately leaves all local blobs intact ("sign-out should never delete drill history").
- `js/sync.js:197-203` + `:227-237` — any signed-out→signed-in transition calls `onSignedIn()` → `doPull({ mergeAndPush: true })`, which merges the **current local blobs** (i.e., the previous user's) with the new user's cloud row, saves the merged result locally, **and pushes it into the new user's row** (`:347`).
- There is no record anywhere of *which account* the local data belongs to — nothing in `js/storage.js`, nothing in `js/sync.js`.

**User impact:** two directions of damage. (1) *Privacy:* user A's full history — every lesson, timestamp, miss tag, mock time — is uploaded into user B's Postgres row, visible on all of B's devices. (2) *Corruption:* B's stats/streaks/SR schedule are permanently polluted with A's monotone fields (progress OR, history union, counters) that no reset can remove (see P1-4). Also triggerable solo: sign in with a typo'd/second email and the rows cross-pollinate.

**Fix spec**

1. Track blob ownership: on every successful `onSignedIn()` merge+push, store the user id — new `DrillStorage` accessor pair, e.g. `Storage.SYNC_OWNER_KEY = 'jsdrill.sync.owner.v1'` with `loadSyncOwner()` / `saveSyncOwner(uid)` (plain string, not part of any synced bundle) in `js/storage.js` after the systemdesign section.
2. In `onSignedIn()` (`js/sync.js:227-237`), before `doPull`:
   - `owner === session.user.id` or `owner == null && local bundle is empty` → current behavior (merge+push).
   - `owner == null && local has data` → first-ever sign-in on this device: legit bootstrap, merge+push (this is today's intended path), then `saveSyncOwner(uid)`.
   - `owner !== session.user.id` → **do not merge.** Show a one-shot `confirm()` (matching the existing reset-btn UX register, `js/app/14-init-core.js:399`): "This device has local progress from a different account. Replace it with <email>'s cloud progress? (Cancel keeps local data and disables sync for this session.)" On OK: `doPull` with a new `{ replaceLocal: true }` mode that writes cloud blobs over local (no merge, wrapped in `suppressNextPush`), then `saveSyncOwner(uid)`. On Cancel: `signOut()` quietly, chip stays "Sync".
3. `signOut()` keeps local data (unchanged) and keeps the owner marker (so a re-sign-in by the same user is frictionless).
4. Tests: merge-policy tests are unaffected; add a CDP probe asserting `jsdrill.sync.owner.v1` is written on sign-in and that mismatch does not call `doPush` (can be unit-tested by exposing the decision function in `_testInternals`).

---

## P1 findings

### P1-1 — Additive counters inflate on every cross-device round-trip (SUM is not idempotent)

**Evidence:** `js/sync.js:407-443` (`mergeAdditive`: plain numbers → `a + b`), applied to all 26 `ADDITIVE_STAT_KEYS` (`:449-455`). The `lastSeenUpdatedAt` guard (`:320-322`) only prevents *same-device* re-merge of an unchanged row; it cannot prevent the cross-device case.

**Inflation trace:** phone `recognize.attempts = 4` pushes → cloud 4. Laptop (local 10) pulls: 10+4 = **14**, pushes. Phone pulls (updated_at advanced): local 4 + cloud 14 = **18** (its own 4 counted twice). Any later laptop pull: 14+18 = **32**. Every device pair round-trip compounds. All SUM-merged counters (`recognize`, `rapidFire.attempts`, `speedrun.sessions`, `commandUsage`, per-lesson `walkthrough.quizAttempts`, …) drift upward without any drilling. The existing test `sync-merge.js:214-219` asserts the single-merge case (10+4=14) and is correct as far as it goes — it never asserts idempotence.

**Impact:** Stats dashboard / Progress surface show fabricated volume; accuracy ratios (`correct/attempts`) stay roughly consistent (both inflate) but session counts and totals become meaningless for a two-device user — the exact user sync exists for.

**Fix spec:** change the SUM branch in `mergeAdditive` (`js/sync.js:414`) from `return a + b;` to `return Math.max(a, b);`, and update the header comment (`:51-53`) and the SUM-asserting tests (`sync-merge.js:214-254`: recognize 10/4 → 10, rapidFire attempts 5/3 → 5, speedrun sessions → 2, glossaryQuiz attempts → 2, commandUsage `open_stats` → 3, walkthrough quizAttempts → 2). Add an explicit idempotence test: `mergeAdditive(merge(a,b), b) === merge(a,b)`. Rationale: MAX undercounts (each device's independent reps aren't combined) but is idempotent, monotone, and order-independent — for motivational lifetime counters, a stable undercount beats runaway inflation. The *correct* CRDT (per-device G-counter: `{ byDevice: { devId: n } }`, total = sum of entries, merge = per-device MAX) requires a device id outside the synced blob and touching ~26 read sites across `js/app/*`; record it as the follow-up if exact totals ever matter. Do **not** ship G-counter and MAX together; pick MAX now.

### P1-2 — Four state fields missing a merge policy: `clarify`, `hotseat`, `timeCalibration`, `cramTaskChecks` never converge (and a fresh device's defaults shadow cloud values)

**Evidence:** `saveProgress` writes them (`js/app/04-progress-sr.js:419` clarify, `:421` hotseat, `:423` timeCalibration, `:435` cramTaskChecks) and `loadProgress` always materializes them with zeroed/empty defaults (`:216-224`, `:227-234`, `:282-291`, `:307`). None appear in `ADDITIVE_STAT_KEYS` (`js/sync.js:449-455`) nor in any explicit policy, so they ride the carry-over base `{ ...cloud, ...local }` (`:467`) — whole-object prefer-LOCAL. Because local **always** has the field (defaults), the cloud copy never wins: a fresh phone's `clarify: {attempts:0,…}` shadows the laptop's real counters in every merge, and each device pushes its own version last. `cramTaskChecks` is worse: it's a completion map (4-Day Cram task checkboxes) that should union like `prep.completed` (`sync.js:586-591`) — with prefer-local, checks made on the laptop never appear on the phone.

**Impact:** silent per-field non-sync — same bug class as the pre-`edc806b` "47 dropped fields," softened to "never merges" by the carry-over base. Header comment (`sync.js:46-53`) is also out of date: it doesn't list these fields.

**Fix spec:**
- Add `'clarify'`, `'hotseat'`, `'timeCalibration'` to `ADDITIVE_STAT_KEYS` (`js/sync.js:449-455`). `timeCalibration.byMechanic` and `.meta` are counter objects — `mergeAdditive` recursion handles them (counters MAX per P1-1; `estimates/skips/passes` are counters).
- Add an explicit OR-union block for `cramTaskChecks` in `mergeProgress` (copy the `weakness` pattern, `:530-535`).
- Update the header comment and add 4 tests to `sync-merge.js` (clarify counters merge; hotseat counters merge; `timeCalibration.byMechanic` per-mechanic recursion; `cramTaskChecks` OR across devices — the load-bearing one: `{t1:true}` + `{t2:true}` → both).
- Add a **registry-parity guard test**: extract the `saveProgress` key list and assert every key is either in `ADDITIVE_STAT_KEYS`, in an explicit merge block, or on a documented prefer-local list — this converts the recurring "new field forgotten" bug into a test failure. (A node-side static check in `tools/validate-data.js` or a new `tools/check-sync-coverage.js` grepping `js/app/04-progress-sr.js:386-450` against `js/sync.js` is acceptable and cheaper than the CDP harness.)

### P1-3 — Cleared flags resurrect: `revealed`, `partialL1`, `weakness` merge as monotone OR but the app clears them

**Evidence:** merges are OR-forever: `revealed` (`js/sync.js:508-518`), `weakness` (`:530-535`), `partialL1` (`:537-543`) — header says "once revealed, always revealed" (`:39`). But the app deletes these keys as a *feature*: Reveal Replay's clean-pass invariant deletes `state.revealed[lessonId][level]` (`js/app/09-stats-cheatsheet-mock.js:802-804`; CLAUDE.md iter 56: "passing the revealed level without re-revealing clears the flag and demotes the ringed-green dot"); clean L1 pass deletes `weakness` (`js/app/04-progress-sr.js:918`, also `07-drills-swap-speedrun.js:1101`, `12a-l1.js:307`); 100% pass deletes `partialL1` (`04-progress-sr.js:934`). After the local delete + push, the *other* device still holds the flag and its next pull-merge-push ORs it back into both devices.

**Impact:** for a synced user, Reveal Replay can never permanently clear a ring, weak-spot flags never die, and the amber partial-L1 tick reappears after being earned away — the user "fixes" the same lessons repeatedly. This contradicts a shipped invariant.

**Fix spec (tombstones-lite):** these need clear-wins-if-newer semantics. Cheapest sound design without a schema bump: change the cleared representation from *key deletion* to an explicit timestamped record, and merge by recency:
- App side: instead of `delete state.revealed[id][level]`, write `state.revealed[id][level] = { cleared: true, at: Date.now() }`; symmetric for `weakness[id]` and `partialL1[id]` (`false` + `at`). Readers (`revealed[id][level]` truthiness checks) must treat `{cleared:true}` as falsy — audit read sites (`grep -n "revealed\[" js/app/*.js`) — or keep boolean reads working by writing `false` and putting the timestamp in a sibling map `revealedClearedAt[id][level]`. **The sibling-map variant is less invasive:** readers unchanged; merge rule becomes "OR of flag, unless the other side's clearedAt is newer than the flag-setting side's last set" — which requires a set-timestamp too. Given the complexity, the pragmatic scope: apply it to `revealed` only (the user-visible invariant), accept OR resurrection for `weakness`/`partialL1` (they self-heal on the next clean pass), and document that acceptance in the sync.js header.
- Tests: `revealed` clear on device A (newer clearedAt) survives merge with device B's stale flag; stale clear loses to a newer re-reveal.

### P1-4 — Reset never sticks for a synced user (and can race its own device's poll)

**Evidence:** `reset-btn` (`js/app/14-init-core.js:398-415`) zeroes seven fields and calls `saveProgress()` → debounced push replaces the cloud row. But every *other* device still has full local state; its next 30s poll (`js/sync.js:245-248`) or focus pull merges cloud(empty) with local(full) — all merge rules are union/OR/MAX, so **everything returns**, and `mergeAndPush`/next write pushes it back; the resetting device then pulls it all down again. Same-device race: if a poll tick or window-focus pull lands inside the 500ms push debounce (`:84`, `:254-261`), the pull's union restores the data *before the reset is even pushed*. Also note reset only clears 7 of ~50 fields — `history`, `misses`, `partialL1`, and all lifetime counters survive reset even locally (pre-existing app gap, but it widens the resurrection surface).

**Impact:** "Reset ALL progress… cannot be undone" is factually wrong for the sync user — it *is* undone, automatically, within 30 seconds. User cannot start fresh.

**Fix spec:** resets must be cloud-authoritative. In the reset handler, when `window.DrillSync` reports a signed-in user: after clearing state, call a new `DrillSync.resetCloud()` that (1) cancels the debounce timer, (2) immediately upserts the cleared bundle, (3) sets `lastSeenUpdatedAt` from the response (already done in `doPush`, `js/sync.js:298`). That fixes the same-device race but **not** other devices — their local unions still win. Complete fix requires a reset marker in the row: add `data.resetAt` (epoch ms) written by `resetCloud()`; in `doPull`, before merging, if `cloud.resetAt > (local.lastResetSeenAt || 0)` → replace local with cloud (no merge, suppress push) and persist `lastResetSeenAt` locally (unsynced key, reuse the P0-2 owner-key pattern). Tests: merge skipped when resetAt is newer; normal merge when absent. This is the minimal "clear beats union" channel and also gives P1-5 (restore) a primitive to reuse.

### P1-5 — Restore bypasses `DrillStorage`, so a restored backup fires no push and is then half-undone by the next pull-merge

**Evidence:** `js/app/14-init-core.js:2326` — `localStorage.setItem(LS_KEY, ev.target.result)` writes the backup **directly**, violating the CLAUDE.md storage contract ("Don't call localStorage.getItem/setItem directly") and skipping `_fireWriteEvent` (`js/storage.js:203-208`) → no push. Then `location.reload()` (`:2328`) → boot has a persisted session (`js/supabase-client.js:27-36`) → `onSignedIn` → pull-merge: the newer cloud state (everything since the backup date) unions into the restored blob. The user asked for a point-in-time rollback; sync silently converts it into "backup ∪ current".

**Impact:** restore-as-rollback is broken for signed-in users, with no indication. (Restore-as-recovery-onto-empty-device still works, which hides the bug.)

**Fix spec:** route the write through the contract: `window.DrillStorage.saveAppProgress(parsed)` instead of raw `setItem` (fires the event → push replaces cloud row before reload; add a short `await`/`setTimeout(600)` before `location.reload()` so the 500ms debounce fires, or call a new `DrillSync.pushNow()` that bypasses the debounce). For full rollback semantics, stamp `resetAt` from P1-4's mechanism so other devices adopt the restored state instead of union-merging their own back in. Also fix `backup-btn` (`14-init-core.js:2300`) which reads `localStorage.getItem(LS_KEY)` raw — harmless read, but contract-violating; use `DrillStorage.loadAppProgress()` + `JSON.stringify`.

### P1-6 — Push is a blind whole-row upsert: no optimistic concurrency, lost-update window for stale/legacy clients

**Evidence:** `doPush` (`js/sync.js:287-299`) upserts `loadLocalBundle()` unconditionally — no `updated_at` precondition, no merge-before-push (merge only happens at pull time, `:324-330`). Two write paths can clobber:
1. **Concurrent devices:** A pushes at T1; B (last pulled at T0) pushes at T1+ε → B's row replaces A's contribution until A's *next* pull-merge-push restores union-mergeable fields. Permanent loss only for recency-merged fields where B's copy is stale-but-later-pushed — self-healing for OR/MAX/union fields, so severity is bounded.
2. **Stale-schema clients (audit Q4):** a service-worker-pinned client running pre-`edc806b` `js/sync.js` still *drops* the 47 unmerged fields, and any pre-v6 `js/storage.js` (`MAIN_APP_ACCEPTED_VERSIONS`, `js/storage.js:42`) rejects a pulled `__v:6` blob → `loadAppProgress()` → null → merge returns cloud → local save that the old app then rejects on read → the old app re-saves its own `__v:5` shape and **pushes it over the v6 row**. `mergeProgress` pins `__v` to ≥6 on the *next* modern-client merge (`js/sync.js:468`) and the carry-over base restores fields from the modern device's local copy, so this is transient — but only as long as a modern device still holds the data locally.

**Impact:** correctness, bounded by self-healing; becomes real data loss when the only modern device is lost/cleared while the cloud row holds a degraded shape.

**Fix spec:** add compare-and-swap: `doPush` sends `.update(...).eq('user_id', uid).eq('updated_at', lastSeenUpdatedAt)` when `lastSeenUpdatedAt` is known, falling back to insert when no row exists; on 0-rows-affected (conflict), run `doPull({ mergeAndPush: true })` instead (pull-merge-push loop, max 2 retries). This turns every conflicting push into a merge. Keep plain upsert only for the no-row bootstrap path (`js/sync.js:313-318`). Additionally, guard against schema downgrade server-free: in `doPush`, refuse to push a `progress` blob whose `__v` is *lower* than the cloud's last-pulled `__v` (cache the pulled `__v` next to `lastSeenUpdatedAt`) — log and skip instead. SW `CACHE_VERSION` bumps (`service-worker.js:17`) remain the front-line mitigation for stale clients.

---

## P2 findings

### P2-1 — Final write can be lost on tab close (500ms debounce, no unload flush)
`js/sync.js:84` (`PUSH_DEBOUNCE_MS = 500`) + the only triggers are `drill:storage-written` (`:207-210`), focus (`:214`), 30s poll (`:245-248`), and sign-in. There is **no `pagehide`/`visibilitychange` flush**. The mobile-primary user's classic gesture — answer last L1, swipe the PWA away — loses the push. Not permanent loss: data is still local, and the next open on that device runs `onSignedIn → doPull({mergeAndPush:true})` (`:191-195`, `:231`) which pushes it. But the laptop that evening won't have the phone's last reps, and if the phone is never opened again the reps are gone.
**Fix:** add `document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pushTimer) { clearTimeout(pushTimer); pushTimer = null; doPush().catch(()=>{}); } })` — `visibilitychange`→hidden is the only reliable mobile signal; supabase-js pushes over fetch which is allowed during hidden (best-effort; `keepalive` isn't available through the SDK, acceptable).

### P2-2 — Quota-failed local save still fires the write event and advances `lastSeenUpdatedAt`
`js/storage.js:189-197` — `_safeSave` swallows quota errors, then `saveAppProgress` unconditionally fires `_fireWriteEvent` (`:48-51`). Two consequences: (a) a push fires that re-reads localStorage (`loadLocalBundle`, `js/sync.js:263-269`) and pushes the *old* blob — harmless echo; (b) in `doPull`, if the merged save fails on quota, `lastSeenUpdatedAt = data.updated_at` still runs (`js/sync.js:343`) so that cloud revision is never re-pulled until it changes again — the device silently misses a sync generation.
**Fix:** make `_safeSave` return a boolean; `saveAppProgress`/etc. skip `_fireWriteEvent` on failure; `doPull` only records `lastSeenUpdatedAt` if all saves reported success.

### P2-3 — Offline/PWA and multi-tab behavior: acceptable, with notes
- Offline: the SW bypasses cross-origin (`service-worker.js:113`), so `@supabase/supabase-js` (CDN, `index.html:62`) may be absent offline → `SupabaseClient = null` (`js/supabase-client.js:21-25`) → sync silently off for the session; local writes accumulate and the next online boot merge+pushes them. Graceful. Minor: if the CDN script loads from the browser HTTP cache but the network is down, `doPush` failures are `console.warn` only (`js/sync.js:259`) with **no retry/backoff and no offline queue** — the next local write re-arms it, which in practice suffices; optionally re-push on `window.addEventListener('online', …)`.
- Multi-tab: only the writing tab pushes (`CustomEvent` doesn't cross tabs); other tabs re-hydrate via the app's `storage` listener (`js/app/14-init-core.js:2372-2381`); `suppressNextPush` is toggled synchronously around pull-saves (`js/sync.js:335-342`) and event dispatch is synchronous, so no echo loop. Two signed-in tabs each poll every 30s — redundant reads, no correctness issue. OK as-is.
- The Sync chip shows "Synced" even when pushes are failing (`renderAuthState`, `:973-987`, is auth-state-only). Consider an `is-syncing`/error state driven by `doPush` outcomes — the CSS for `is-syncing` already exists (`:706`) but nothing ever sets it.

### P2-4 — `jsdrill.prep.v1` sync is dead weight (audit Q5)
No live page writes it (prep.html dissolved; `js/storage.js:60-75` retained "for historical blobs"; CLAUDE.md § Shared UI). `mergePrep` (`js/sync.js:575-620`) + 4 unit tests (`sync-merge.js:97-122`) maintain a merge for data that can no longer change. **Verdict: keep, but freeze.** Cost is ~50 LoC and a few bytes per row; removing it would strand historical prep data on whichever device holds it and would need a tombstone in the cloud shape. Recommended action: mark `mergePrep` and its header section as frozen/legacy (comment only), and stop *extending* it. Removal only makes sense bundled with a future row-shape versioning change.

### P2-5 — `syncHintShown` re-prompts on other devices
`js/app/04-progress-sr.js:213` — one-time "set up sync" hint flag; rides prefer-local carry-over. Once the user is signed in the hint is presumably moot, but any dismiss-tracking flag of this class should be OR (like `welcomed`, `js/sync.js:546`). One-line fix + one test.

---

## Auth & security review (audit Q3)

**RLS — correct.** `supabase/migrations/001_user_progress.sql:31-52`: RLS enabled; four policies (`select`/`insert`/`update`/`delete`) all scoped `auth.uid() = user_id`, with `with check` on both insert and update (blocks writing a row *as* another user and re-pointing `user_id` on update). `user_id` is the PK referencing `auth.users` with cascade delete (`:9-13`). The `updated_at` touch trigger (`:17-27`) is `security`-neutral. No gaps found.

**Keys — clean.** `js/supabase-config.js:16-19` ships only the anon key (JWT payload role `"anon"` — decoded and verified). Repo-wide grep for `service_role`/secrets: only the warning comment in `supabase-config.js:8`. No privileged key client-side.

**Email+password flow (`3f9456b`).**
- Session persistence: `persistSession: true`, `autoRefreshToken: true`, `storageKey: 'jsdrill.auth.v1'` (`js/supabase-client.js:27-36`) — shared across all three pages on the same origin, as intended.
- Sign-out (`js/sync.js:168-172`): stops polling, clears timers (`:239-243`), leaves local data — which is precisely what enables **P0-2 cross-account bleed** (see above; that's the "classic bug" and it is present).
- Password policy is client-side-only min-6 (`:879`, `:913`); server-side policy is whatever the Supabase project sets — fine for this app's threat model.
- `signInWithOtp` uses `shouldCreateUser: true` (`:122`) — anyone can mint an account; harmless here (empty row, RLS-scoped).
- `detectSessionInUrl: true` for magic links (`js/supabase-client.js:33`) — standard; token is consumed and removed by the SDK.
- Minor UX bug: the `verify` handler (`js/sync.js:945-957`) is not wrapped per-button like signin/signup — a thrown `verifyOtp` error is caught by the outer catch (`:966-970`) which re-enables all buttons; acceptable.
- Auth error messages are surfaced verbatim (`:904`) — no secrets in supabase-js messages; fine.

---

## Appendix A — state-field × merge-behavior table

Every key written by `saveProgress` (`js/app/04-progress-sr.js:386-450`) vs. what `mergeProgress` (`js/sync.js:457-573`) does. "Carry-over" = `{ ...cloud, ...local }` base (`:467`) = whole-object prefer-LOCAL.

| Field | Written at (04-progress-sr.js) | Merge behavior (sync.js) | Verdict |
|---|---|---|---|
| `__v` | :387 | MAX, floor 6 (:468) | OK |
| `progress` | :388 | OR per level (:471-481) | OK |
| `bestTimes` | :389 | MIN (:484-491) | OK |
| `mockHistory` | :390 | union+sort+cap 5 (:493-506) | OK |
| `revealed` | :391 | OR (:509-518) | **RESURRECTS cleared flags — P1-3** |
| `partialL1` | :392 | OR (:537-543) | **RESURRECTS — P1-3** |
| `lastLessonId`/`lastTab` | :393-394 | prefer local (:565-570) | OK |
| `starterPath`/`starterPathTrack` | :395-396 | explicit / carry-over prefer local | OK |
| `recognize` … `match`, `whatif`, `mutate`, `phoneScreen`, `constraintShift`, `flash`, `walkthrough`, `glossaryQuiz`, `cramReview`, `commandUsage` (26 keys) | :397-438 | `mergeAdditive` (:449-455, :556-559) | **SUM double-counts — P1-1** |
| `offlinePack` | :416 | carry-over prefer local | OK (device-specific) |
| `syncHintShown` | :417 | carry-over prefer local | should be OR — P2-5 |
| `clarifyRitualOn`/`hotseatOn`/`calibrateOn`/`paceBarOn`/`hapticOn`/`adhdMode`/`fontScale` | :418-427 | carry-over prefer local | OK (settings, per header :55-58) |
| `clarify` | :419 | carry-over prefer local | **CLOBBERS/never converges — P1-2** |
| `hotseat` | :421 | carry-over prefer local | **CLOBBERS — P1-2** |
| `timeCalibration` | :423 | carry-over prefer local | **CLOBBERS — P1-2** |
| `misses` | :433 | `mergeEventLog` union+cap 50 (:552) | OK |
| `subscribedPathId` | :434 | carry-over prefer local (tested, sync-merge.js:259) | OK |
| `cramTaskChecks` | :435 | carry-over prefer local | **CLOBBERS (should be OR) — P1-2** |
| `cramView` | :436 | carry-over prefer local | OK (device view state) |
| `welcomed` | :439 | OR (:546) | OK |
| `hideMastered`/`repairFilter`/`tagFilter`/`tagFilterOpen` | :440-443 | carry-over prefer local | OK (device filters, per header :57) |
| `reviews` | :444 | greater `lastPassedAt` wins (:521-528) | OK |
| `weakness` | :445 | OR (:531-535) | **RESURRECTS cleared flags — P1-3 (accepted risk if scoped fix)** |
| `sidebarTrack`/`surface`/`surfaceCtx` | :446-448 | prefer local | OK |
| `history` | :449 | `mergeEventLog` union+cap 50 (:551) | OK |
| **`jsdrill.systemdesign.v1` (entire blob)** | system-design.html:260 | **not synced at all** | **DROPPED — P0-1** |
| `jsdrill.prep.v1` | no live writer | full policy (:575-620) | dead weight — P2-4 |
| `jsdrill.diagnostic.v1` | diagnostic.html | full policy (:622-675) | OK (matches header :67-72; tested) |

Header-comment vs. implementation drift: the documented rules (`js/sync.js:29-78`) match the code one-for-one for every listed field; the drift is by **omission** — `clarify`, `hotseat`, `timeCalibration`, `cramTaskChecks`, and the systemdesign blob are absent from both the docs and the merge logic (P1-2, P0-1).

## Appendix B — recommended implementation order

1. P0-1 systemdesign sync (incl. `system-design.html` re-hydrate listener) + tests + SW bump — pure addition, no behavior risk.
2. P1-2 missing-field policies + registry-parity guard test — small, prevents recurrence.
3. P1-1 SUM→MAX + test rewrite — one line + test edits, stops ongoing stat corruption.
4. P0-2 owner tracking + replace-local path — new small surface area, needs the confirm UX.
5. P1-6 CAS push + P1-4 `resetAt` channel + P1-5 restore-through-contract — one coherent "authoritative write" changeset.
6. P2s opportunistically (visibilitychange flush first — biggest phone-user payoff).
