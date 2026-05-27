#!/usr/bin/env python3
"""
analyze-tool-stats.py — Mine Claude Code transcripts for tool-call statistics.

WHY: This project is built largely by Claude (autonomous loop + interactive).
Every tool call across every conversation is logged as JSONL under
  ~/.claude/projects/<cwd-with-slashes-as-dashes>/*.jsonl
This script aggregates those logs to surface WHERE the AI struggles to
read / write / create — so a refactor can optimize for AI legibility.

The load-bearing signals:
  * WRITE HEALTH  — per-file Edit/Write failure rate. High failure on a file
                    == the AI can't make a unique, safe edit there (the
                    monolith / duplication tax).
  * READ COST     — per-file read-token volume. Files that dominate read cost
                    are the ones worth splitting so partial reads suffice.
  * READ CHURN    — same file re-read many times in one session (context
                    thrash — a symptom of "can't hold the file in mind").
  * BASH NAV      — grep/find/sed/cat usage as a proxy for navigating around
                    missing structure.

USAGE:
  python3 tools/analyze-tool-stats.py                 # auto-derives transcript dir from cwd
  python3 tools/analyze-tool-stats.py /path/to/dir    # explicit transcript dir
  python3 tools/analyze-tool-stats.py --json          # machine-readable dump (share this)
"""
import json
import os
import sys
from collections import defaultdict, Counter

CHARS_PER_TOKEN = 4  # rough estimate for token counts

# The tools that touch the codebase — the read/write/create signal the refactor
# cares about. Everything else (Task*, Cron*, Agent, Skill, …) is loop
# orchestration / meta and is reported separately so it doesn't drown the signal.
CODEBASE_TOOLS = {"Read", "Edit", "Write", "NotebookEdit", "Bash", "Grep", "Glob"}


def transcript_dir_from_cwd():
    slug = os.getcwd().replace("/", "-")
    return os.path.expanduser(f"~/.claude/projects/{slug}")


def result_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for b in content:
            if isinstance(b, dict):
                out.append(b.get("text", "") or "")
            else:
                out.append(str(b))
        return "".join(out)
    return "" if content is None else str(content)


def classify_edit_error(text):
    t = text.lower()
    if "not been read" in t or "read it first" in t:
        return "must-read-first"
    if "match" in t and ("found" in t or "multiple" in t) and "not found" not in t:
        return "not-unique (multiple matches)"
    if "not found" in t or "no match" in t or "to replace" in t:
        return "string-not-found"
    if "modified" in t or "changed since" in t:
        return "file-modified-since-read"
    return "other"


def short(path, n=60):
    if path is None:
        return "(none)"
    p = path.replace(os.path.expanduser("~"), "~")
    return p if len(p) <= n else "…" + p[-(n - 1):]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    want_json = "--json" in sys.argv
    tdir = args[0] if args else transcript_dir_from_cwd()

    # Project root: per-file READ and WRITE tables are scoped to files under it,
    # so agent worktree sandboxes under /private/tmp/claude-*/<slug>/<uuid>/ (which
    # mirror the project slug but aren't the real checkout), memory files in
    # ~/.claude, and /tmp scratch don't pollute the signal. Only the canonical
    # checkout counts.
    proj_root = os.getcwd()
    # Min write attempts before a per-file fail% is trustworthy. A rate on a
    # tiny denominator (1 fail / 2 tries = 50%) is noise, so the WRITE HEALTH
    # table hides files below this. Volume tables (reads/tokens) are NOT
    # thresholded — a small count there is accurate, not noise.
    min_attempts = 20
    for a in sys.argv[1:]:
        if a.startswith("--project-dir="):
            proj_root = a.split("=", 1)[1]
        elif a.startswith("--min-attempts="):
            min_attempts = int(a.split("=", 1)[1])
    proj_root = os.path.abspath(os.path.expanduser(proj_root)).rstrip(os.sep)

    def in_project(fp):
        return bool(fp) and os.path.abspath(fp).startswith(proj_root + os.sep)

    if not os.path.isdir(tdir):
        print(f"No transcript dir at: {tdir}", file=sys.stderr)
        sys.exit(1)

    files = sorted(f for f in os.listdir(tdir) if f.endswith(".jsonl"))

    tool_counts = Counter()                 # tool name -> calls
    tool_errors = Counter()                 # tool name -> errored calls
    write_attempts = Counter()              # file -> edit/write attempts
    write_fails = Counter()                 # file -> edit/write failures
    edit_fail_reasons = Counter()           # reason -> count
    read_count = Counter()                  # file -> reads
    read_full = Counter()                   # file -> reads with no offset/limit
    read_tokens = Counter()                 # file -> est tokens pulled in
    bash_nav = Counter()                    # nav-command -> count
    churn = Counter()                       # (session, file) -> reads in that session
    n_sessions = 0

    for fn in files:
        path = os.path.join(tdir, fn)
        n_sessions += 1
        # id -> {name, input}
        calls = {}
        with open(path, "r", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    ev = json.loads(line)
                except json.JSONDecodeError:
                    continue
                msg = ev.get("message") or {}
                content = msg.get("content")
                if not isinstance(content, list):
                    continue
                for b in content:
                    if not isinstance(b, dict):
                        continue
                    if b.get("type") == "tool_use":
                        cid = b.get("id")
                        name = b.get("name", "?")
                        inp = b.get("input") or {}
                        if cid:
                            calls[cid] = {"name": name, "input": inp}
                        tool_counts[name] += 1
                        # bash navigation proxy
                        if name == "Bash":
                            cmd = (inp.get("command") or "").strip()
                            head = cmd.split()[0] if cmd else ""
                            # also catch piped greps
                            for navtool in ("grep", "rg", "find", "sed", "awk", "cat", "head", "tail"):
                                if head == navtool or f"| {navtool}" in cmd or f"|{navtool}" in cmd:
                                    bash_nav[navtool] += 1
                                    break
                        # write/create attempts (project files only)
                        if name in ("Edit", "Write", "NotebookEdit"):
                            fp = inp.get("file_path") or inp.get("notebook_path")
                            if in_project(fp):
                                write_attempts[fp] += 1
                        # reads (project files only)
                        if name == "Read":
                            fp = inp.get("file_path")
                            if in_project(fp):
                                read_count[fp] += 1
                                if not inp.get("offset") and not inp.get("limit"):
                                    read_full[fp] += 1
                                churn[(fn, fp)] += 1
                    elif b.get("type") == "tool_result":
                        cid = b.get("tool_use_id")
                        info = calls.get(cid)
                        if not info:
                            continue
                        name = info["name"]
                        inp = info["input"]
                        txt = result_text(b.get("content"))
                        is_err = b.get("is_error") is True
                        if is_err:
                            tool_errors[name] += 1
                        if name in ("Edit", "Write", "NotebookEdit"):
                            fp = inp.get("file_path") or inp.get("notebook_path")
                            if is_err and in_project(fp):
                                write_fails[fp] += 1
                                edit_fail_reasons[classify_edit_error(txt)] += 1
                        if name == "Read" and not is_err:
                            fp = inp.get("file_path")
                            if in_project(fp):
                                read_tokens[fp] += len(txt) // CHARS_PER_TOKEN

    if want_json:
        # sort each dict by value descending and drop zero-signal rows
        # (read_tokens is the only dict that can hold 0 — e.g. binary/image reads)
        def ranked(counter):
            return {k: v for k, v in sorted(counter.items(), key=lambda kv: -kv[1]) if v}
        cb = Counter({k: v for k, v in tool_counts.items() if k in CODEBASE_TOOLS})
        orch = Counter({k: v for k, v in tool_counts.items() if k not in CODEBASE_TOOLS})
        dump = {
            "sessions": n_sessions,
            "tool_counts_codebase": ranked(cb),
            "tool_counts_orchestration": ranked(orch),
            "tool_counts": ranked(tool_counts),
            "tool_errors": ranked(tool_errors),
            "write_attempts": ranked(write_attempts),
            "write_fails": ranked(write_fails),
            "edit_fail_reasons": ranked(edit_fail_reasons),
            "read_count": ranked(read_count),
            "read_tokens": ranked(read_tokens),
        }
        print(json.dumps(dump, indent=2))
        return

    total_calls = sum(tool_counts.values())
    bar = "=" * 72
    print(bar)
    print(f"CLAUDE CODE TOOL-CALL STATS  ·  {n_sessions} transcripts  ·  {total_calls} tool calls")
    print(f"dir: {short(tdir, 90)}")
    print(bar)

    def print_freq(rows):
        print(f"  {'tool':<16}{'calls':>8}{'  err':>7}{'  err%':>7}")
        for name, c in rows:
            e = tool_errors[name]
            print(f"  {name:<16}{c:>8}{e:>7}{(100*e/c if c else 0):>6.0f}%")
        sub = sum(c for _, c in rows)
        print(f"  {'— subtotal —':<16}{sub:>8}")

    cb_rows = [(n, c) for n, c in tool_counts.most_common() if n in CODEBASE_TOOLS]
    orch_rows = [(n, c) for n, c in tool_counts.most_common() if n not in CODEBASE_TOOLS]

    print("\n## TOOL FREQUENCY — CODEBASE I/O (calls · error rate)  ⭐ the read/write/create signal")
    print_freq(cb_rows)
    print("\n## TOOL FREQUENCY — orchestration / meta (loop bookkeeping, not codebase)")
    print_freq(orch_rows)

    print(f"\n## WRITE/CREATE HEALTH — per-file Edit/Write failures · project files · attempts ≥ {min_attempts}  ⭐ refactor signal")
    print("   (high fail% = AI can't make a unique/safe edit there; low-attempt files hidden — fail% is noise there)")
    print(f"  {'file':<52}{'try':>5}{'fail':>6}{'fail%':>7}")
    rows = sorted(write_attempts.items(), key=lambda kv: (-write_fails[kv[0]], -kv[1]))
    shown = [(fp, t) for fp, t in rows if t >= min_attempts]
    for fp, tries in shown[:20]:
        f = write_fails[fp]
        print(f"  {short(fp, 52):<52}{tries:>5}{f:>6}{(100*f/tries):>6.0f}%")
    tot_try = sum(write_attempts.values())
    tot_fail = sum(write_fails.values())
    hidden = len(write_attempts) - len(shown)
    print(f"  {'— TOTAL (all files) —':<52}{tot_try:>5}{tot_fail:>6}{(100*tot_fail/tot_try if tot_try else 0):>6.0f}%")
    if hidden:
        print(f"  ({hidden} files with <{min_attempts} attempts hidden; pass --min-attempts=0 to show all)")
    if edit_fail_reasons:
        print("\n   failure reasons:")
        for r, c in edit_fail_reasons.most_common():
            print(f"     {c:>5}  {r}")

    print("\n## READ COST — per-file read volume · project files only  ⭐ refactor signal")
    print("   (files dominating read-tokens are the ones worth splitting)")
    print(f"  {'file':<52}{'reads':>6}{'full':>6}{'est tok':>9}")
    for fp, tok in sorted(read_tokens.items(), key=lambda kv: -kv[1])[:20]:
        print(f"  {short(fp, 52):<52}{read_count[fp]:>6}{read_full[fp]:>6}{tok:>9}")

    print("\n## READ CHURN — same file re-read ≥4× in one session (context thrash)")
    big = sorted(((v, sess, fp) for (sess, fp), v in churn.items() if v >= 4), reverse=True)
    if not big:
        print("  (none — no file re-read 4+ times in a single session)")
    for v, sess, fp in big[:15]:
        print(f"  {v:>3}×  {short(fp, 48):<48}  {sess[:8]}")

    print("\n## BASH NAVIGATION — workarounds for missing structure")
    for tool, c in bash_nav.most_common():
        print(f"  {tool:<8}{c:>6}")

    print("\n" + bar)
    print("Share the output (or run with --json) so the refactor can target the")
    print("highest fail% writes and highest read-token files first.")
    print(bar)


if __name__ == "__main__":
    main()
