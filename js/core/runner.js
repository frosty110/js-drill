// Sandboxed code runner for the L3 drill + L2 fill grader.
//
// Why this exists: extracted from app.js so the runner can evolve (better
// timeouts, smarter formatting for Map/Set, etc.) without anchoring 8.9k
// other lines. Also lets future surfaces (a "compare two snippets" drill,
// say) call into runCode without dragging app state with them.
//
// Mirror copy lives in tools/validate-data.js — that's a Node CommonJS
// script and can't share a browser-only module. Behavior MUST stay in
// sync between the two (subsequence match semantics + 8-tick drain).
//
// To consume: include before app.js.
//   <script src="js/core/runner.js"></script>
// Exposed as `window.DrillRunner`.

(function (root) {
  'use strict';

  const R = {};

  // ── TypeScript support ───────────────────────────────────────────────────
  // A lesson may declare `"lang": "ts"`, in which case every code string that
  // belongs to it (reference, L2 templates, L3 canonical, and whatever the
  // user types in the editor) is TypeScript and must have its types erased
  // before `new Function` sees it — `new Function` is a JavaScript parser, so
  // a bare `x: number` annotation is a SyntaxError.
  //
  // The compiler is loaded LAZILY, on first use only. It's ~1.6 MB gzipped,
  // which would be an unacceptable boot cost on the phone this app is built
  // for (PROFILE.md), so JS lessons never pay it. Once fetched the browser
  // caches it for every later TS lesson.
  //
  // We use `transpileModule`, not a full program: it erases types and does NOT
  // type-check. That's deliberate. The drill grades on OUTPUT, and a lesson
  // whose canonical is mid-typing shouldn't refuse to run because an inferred
  // type is momentarily wrong.
  //
  // Node's validator (tools/validate-data.js) erases types with the built-in
  // `module.stripTypeScriptTypes` instead of shipping this 9 MB dependency.
  // Different engines, same contract: both erase, neither type-checks. Only
  // erasable syntax is allowed in lessons (see docs/canonical-style.md § TS),
  // which is what keeps the two paths equivalent.
  R.TS_URL = 'https://cdn.jsdelivr.net/npm/typescript@5.6.3/lib/typescript.js';

  let tsLoad = null;
  R.ensureTypeScript = function () {
    if (root.ts && root.ts.transpileModule) return Promise.resolve(root.ts);
    if (tsLoad) return tsLoad;
    tsLoad = new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('TypeScript compiler unavailable (no document)'));
        return;
      }
      const el = document.createElement('script');
      el.src = R.TS_URL;
      el.async = true;
      el.onload = () => {
        if (root.ts && root.ts.transpileModule) resolve(root.ts);
        else reject(new Error('TypeScript loaded but transpileModule is missing'));
      };
      el.onerror = () => {
        tsLoad = null; // let a later attempt retry after a transient failure
        reject(new Error('Could not load the TypeScript compiler (offline?)'));
      };
      document.head.appendChild(el);
    });
    return tsLoad;
  };

  // Language resolver. Call sites that know the lesson pass `{ lang }`
  // explicitly; the rest fall back to whatever the app registers here (the
  // currently-open lesson's `lang`). Registered once, in the app's init.
  let langResolver = null;
  R.setLanguageResolver = function (fn) { langResolver = fn; };

  R.resolveLang = function (lang) {
    if (lang) return lang;
    try { return (langResolver && langResolver()) || 'js'; } catch { return 'js'; }
  };

  // Erase types. A no-op for JS, so it's safe to call unconditionally.
  R.transpile = async function (code, lang) {
    if (R.resolveLang(lang) !== 'ts') return code;
    const ts = await R.ensureTypeScript();
    const out = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.None,
        removeComments: false
      },
      reportDiagnostics: true
    });
    // transpileModule only ever reports SYNTACTIC problems (it does no type
    // analysis), so anything here is genuinely malformed source and would
    // otherwise become confusing garbage JS.
    const syntax = (out.diagnostics || []).filter(
      d => d.category === ts.DiagnosticCategory.Error
    );
    if (syntax.length) {
      const first = syntax[0];
      const msg = ts.flattenDiagnosticMessageText(first.messageText, ' ');
      throw new Error(`TypeScript syntax error: ${msg}`);
    }
    return out.outputText;
  };

  // formatArg controls how console-log args are stringified into the graded
  // output. Special-cases Map/Set so `console.log(myMap)` shows real content
  // (native JSON.stringify produces "{}" for them).
  R.formatArg = function formatArg(a) {
    if (typeof a === 'string') return a;
    if (typeof a === 'number' || typeof a === 'boolean') return String(a);
    if (a === null) return 'null';
    if (a === undefined) return 'undefined';
    if (typeof a === 'function') return `[Function${a.name ? ': ' + a.name : ''}]`;
    if (a instanceof Map) {
      const pairs = [...a.entries()].map(([k, v]) => `${formatArg(k)} => ${formatArg(v)}`);
      return `Map(${a.size}) { ${pairs.join(', ')} }`;
    }
    if (a instanceof Set) {
      const items = [...a].map(formatArg);
      return `Set(${a.size}) { ${items.join(', ')} }`;
    }
    try { return JSON.stringify(a); } catch { return String(a); }
  };

  // Async runner. Strict-mode wraps the user code so `this` semantics match
  // what the s-this lesson teaches. Adaptive drain (up to 8 macrotasks) lets
  // async IIFEs settle without blocking forever on stuck timers.
  //
  // console.debug / console.info are captured separately and NEVER fed to the
  // grader — that's the escape hatch for users who want to log mid-attempt
  // without breaking the subsequence match.
  // `opts.lang` — 'ts' erases types first; omitted falls back to the resolver.
  R.runCode = async function (code, opts) {
    const logs = [];
    const debugLogs = [];
    // Type erasure happens before anything else so a TS syntax error is
    // reported the same way a runtime error is, rather than as a bare
    // SyntaxError from `new Function`.
    let source;
    try {
      source = await R.transpile(code, opts && opts.lang);
    } catch (e) {
      return { ok: false, output: (e && e.message) || String(e), debug: '' };
    }
    const fakeConsole = {
      log:   (...args) => logs.push(args.map(R.formatArg).join(' ')),
      error: (...args) => logs.push('[error] ' + args.map(R.formatArg).join(' ')),
      warn:  (...args) => logs.push('[warn] '  + args.map(R.formatArg).join(' ')),
      debug: (...args) => debugLogs.push(args.map(R.formatArg).join(' ')),
      info:  (...args) => debugLogs.push(args.map(R.formatArg).join(' '))
    };
    // Capture unhandled async rejections inside the user code — async IIFEs
    // whose returned Promise isn't surfaced to us would otherwise hit the
    // window-level handler with no lesson feedback.
    let unhandled = null;
    const rejectionHandler = (e) => {
      if (!unhandled) unhandled = (e && e.reason) || new Error('Unhandled rejection');
      e && e.preventDefault && e.preventDefault();
    };
    const hasWindow = typeof window !== 'undefined';
    if (hasWindow) window.addEventListener('unhandledrejection', rejectionHandler);
    try {
      const wrapped = '"use strict";\n' + source;
      // eslint-disable-next-line no-new-func
      const result = new Function('console', wrapped)(fakeConsole);
      if (result && typeof result.then === 'function') {
        await result;
      }
      let prev = -1;
      for (let i = 0; i < 8; i++) {
        if (logs.length === prev) break;
        prev = logs.length;
        await new Promise(r => setTimeout(r, 0));
      }
      if (unhandled) {
        return { ok: false, output: (unhandled && unhandled.message) || String(unhandled), debug: debugLogs.join('\n') };
      }
      return { ok: true, output: logs.join('\n'), debug: debugLogs.join('\n') };
    } catch (e) {
      return { ok: false, output: (e && e.message) || String(e), debug: debugLogs.join('\n') };
    } finally {
      if (hasWindow) window.removeEventListener('unhandledrejection', rejectionHandler);
    }
  };

  // ── Iteration-budget guard for DRILL-GENERATED code (nav-audit P1-1) ──────
  // A single-operator mutation of a canonical (e.g. `lo < hi` → `lo <= hi`)
  // can stop a loop's pointers from progressing, and runCode's `new Function`
  // body is SYNCHRONOUS — un-interruptible from the page, so a mutant that
  // loops forever freezes the tab (reproduced 2/2 on #/m/bug-hunt cold boot).
  // Before running, source-transform the code: inject a shared counter check
  // at the top of every `for`/`while` loop body so runaway loops throw instead
  // of spinning. A scanner-level transform is acceptable because the inputs
  // are the app's own canonicals + single-operator mutants (the validator bans
  // do/while and the comma operator; canonical style braces loop bodies) —
  // NOT arbitrary user code. User-typed L2/L3 paths keep plain runCode
  // semantics, unchanged.
  R.injectLoopGuard = function (code, budget) {
    const max = budget || 2e6;
    const GUARD = ` if (++__iterGuard > ${max}) throw new Error('Iteration budget exceeded (possible infinite loop)');`;
    const re = /\b(?:for|while)\s*\(/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(code)) !== null) {
      // Walk from the keyword's '(' to its balanced ')', skipping quoted spans.
      let j = m.index + m[0].length;
      let depth = 1;
      while (j < code.length && depth > 0) {
        const ch = code[j];
        if (ch === '"' || ch === "'" || ch === '`') {
          const q = ch;
          j++;
          while (j < code.length && code[j] !== q) {
            if (code[j] === '\\') j++;
            j++;
          }
        } else if (ch === '(') depth++;
        else if (ch === ')') depth--;
        j++;
      }
      // j = char after the closing ')'. Skip whitespace; inject after '{' when
      // the body is braced (canonical style always braces). A braceless body
      // is left unguarded — same exposure as before, never worse.
      let k = j;
      while (k < code.length && /\s/.test(code[k])) k++;
      if (code[k] === '{') {
        out += code.slice(last, k + 1) + GUARD;
        last = k + 1;
      }
      re.lastIndex = j;
    }
    out += code.slice(last);
    return 'let __iterGuard = 0;\n' + out;
  };

  // Budgeted runner — same grading semantics as runCode, but the code is
  // loop-guard-transformed first. A budget overrun surfaces as a normal
  // { ok: false } result whose output contains "Iteration budget exceeded".
  R.runCodeBudgeted = async function (code, opts) {
    // Erase types BEFORE the loop guard: injectLoopGuard is a source scanner
    // looking for `for (` / `while (`, and a type annotation can carry its own
    // parens (`Array<(n: number) => void>`) that would confuse its brace walk.
    let source;
    try {
      source = await R.transpile(code, opts && opts.lang);
    } catch (e) {
      return { ok: false, output: (e && e.message) || String(e), debug: '' };
    }
    // Already plain JS at this point, so pin lang to skip a second transpile.
    return R.runCode(R.injectLoopGuard(source, opts && opts.maxIterations), { lang: 'js' });
  };

  root.DrillRunner = R;
})(typeof window !== 'undefined' ? window : this);
