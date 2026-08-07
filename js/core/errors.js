// ============================================================================
//  js/core/errors.js — so a failure on someone's phone isn't invisible forever
// ============================================================================
// This app has no server, no analytics and no error reporting. If something
// throws on a user's phone, nobody ever finds out — not the user, who sees a
// surface that silently didn't render, and not us. Combined with 54 of the
// codebase's 82 catch blocks being empty or comment-only, the default outcome
// for a runtime failure is that it is swallowed and forgotten.
//
// tools/check-dom-refs.js's header describes the same shape from the other
// side: "All were null-guarded, so the app stayed green while the code
// underneath was dead."
//
// This is deliberately the smallest thing that fixes that: a bounded in-page
// record of what actually went wrong, surfaced in Settings when it is non-empty
// and copyable in one tap. No network, no new dependency, nothing sent
// anywhere — the user is the one who chooses to report it.
//
// Load it FIRST on every page, before any other script, so it is installed
// before there is anything to catch.
//   <script src="js/core/errors.js"></script>
// Exposed as `window.DrillErrors`.

(function (root) {
  'use strict';

  var MAX = 50;                     // ring buffer; a loop that throws every
                                    // frame must not become a memory leak
  var KEY = 'jsdrill.errors.session';
  var buffer = [];
  var notifying = false;

  // sessionStorage, not localStorage, and therefore NOT DrillStorage's
  // business (invariant 5 governs the four persisted localStorage blobs):
  // these records are per-tab debugging exhaust, they must never sync, and
  // they should evaporate when the tab closes. Surviving a RELOAD is the
  // point — an error that reloads the page is exactly the one you can't
  // otherwise inspect.
  function persist() {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.setItem(KEY, JSON.stringify(buffer.slice(-MAX)));
    } catch (e) { /* private mode / quota — the in-memory buffer still works */ }
  }

  function restore() {
    try {
      if (typeof sessionStorage === 'undefined') return;
      var raw = sessionStorage.getItem(KEY);
      if (raw) buffer = JSON.parse(raw) || [];
      if (!Array.isArray(buffer)) buffer = [];
    } catch (e) { buffer = []; }
  }

  function record(kind, message, detail) {
    var entry = {
      kind: kind,
      message: String(message == null ? '(no message)' : message).slice(0, 500),
      at: new Date().toISOString(),
      where: (root.location && root.location.hash) || '',
      detail: detail ? String(detail).slice(0, 800) : ''
    };
    // Collapse a repeat of the immediately-preceding error into a count rather
    // than filling the buffer with one message 50 times.
    var last = buffer[buffer.length - 1];
    if (last && last.kind === entry.kind && last.message === entry.message) {
      last.repeated = (last.repeated || 1) + 1;
      last.at = entry.at;
    } else {
      buffer.push(entry);
      if (buffer.length > MAX) buffer.shift();
    }
    persist();
    if (typeof root.__drillOnError === 'function' && !notifying) {
      // `notifying` guards re-entry, not just throwing. console.error is patched
      // below to funnel into record(), so a listener that logs an error would
      // otherwise loop record → listener → console.error → record forever, and
      // a try/catch cannot see that.
      notifying = true;
      try { root.__drillOnError(entry); }
      catch (e) { /* a listener must not break error recording */ }
      finally { notifying = false; }
    }
  }

  var R = {
    list: function () { return buffer.slice(); },
    count: function () { return buffer.reduce(function (n, e) { return n + (e.repeated || 1); }, 0); },
    clear: function () { buffer = []; persist(); },
    record: function (message, detail) { record('manual', message, detail); },

    // For a catch block that genuinely should not stop anything — a quota
    // error, an unreadable blob, a missing optional API. Swallowing those is
    // usually CORRECT; the bug is swallowing them without a trace, which is
    // what 22 bare `catch (_) {}` blocks in js/app/ still do.
    //
    //   try { risky(); } catch (e) { DrillErrors.swallow('offline pack count', e); }
    //
    // Prefer this to an empty catch in new code: the app carries on exactly as
    // it would have, and the failure is still there to find in Settings →
    // Diagnostics when someone eventually asks why a number looks wrong.
    swallow: function (context, err) {
      record('swallowed', context + ': ' + ((err && err.message) || err),
        (err && err.stack) || '');
    },

    // A paste-ready report. The user is on a phone with no devtools, so the
    // realistic bug-report path is "copy this, send it to someone".
    report: function () {
      if (!buffer.length) return 'No errors recorded this session.';
      var head = 'JS Drill — ' + R.count() + ' error(s) this session\n' +
        'page: ' + ((root.location && root.location.pathname) || '?') + '\n' +
        'agent: ' + ((root.navigator && root.navigator.userAgent) || '?') + '\n';
      return head + buffer.map(function (e, i) {
        return '\n[' + (i + 1) + '] ' + e.kind + (e.repeated ? ' (x' + e.repeated + ')' : '') +
          '\n  ' + e.message +
          (e.where ? '\n  at ' + e.where : '') +
          (e.detail ? '\n  ' + e.detail.split('\n').slice(0, 4).join('\n  ') : '');
      }).join('\n');
    }
  };

  restore();

  if (root.addEventListener) {
    // Uncaught exceptions. Using the event (not window.onerror =) so we can
    // never clobber another handler.
    root.addEventListener('error', function (ev) {
      // Resource load failures (a 404'd <script>) arrive here too, with the
      // failing element as the target and no message. Those matter just as
      // much — a missing slice is exactly the bug the app-shell gate exists
      // to prevent.
      if (ev && ev.target && ev.target !== root && ev.target.tagName) {
        record('resource', (ev.target.tagName || '').toLowerCase() + ' failed to load',
          ev.target.src || ev.target.href || '');
        return;
      }
      record('exception', ev && ev.message,
        ev && ev.error && ev.error.stack ? ev.error.stack : '');
    }, true);

    root.addEventListener('unhandledrejection', function (ev) {
      var r = ev && ev.reason;
      record('rejection', (r && r.message) || r, r && r.stack ? r.stack : '');
    });
  }

  // console.error is the app's own "something is wrong" channel, and it is
  // what CI now fails the boot probe on — so the in-app record should agree
  // with the gate. Passthrough is preserved; the original is called first so a
  // fault in here can never swallow the developer's message.
  if (root.console && typeof root.console.error === 'function') {
    var native = root.console.error.bind(root.console);
    root.console.error = function () {
      native.apply(null, arguments);
      try {
        var parts = [];
        for (var i = 0; i < arguments.length; i++) {
          var a = arguments[i];
          parts.push(a && a.message ? a.message : String(a));
        }
        record('console', parts.join(' '), (arguments[0] && arguments[0].stack) || '');
      } catch (e) { /* never let recording break logging */ }
    };
  }

  root.DrillErrors = R;
})(typeof window !== 'undefined' ? window : this);
