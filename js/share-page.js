// ============================================================================
//  js/share-page.js — progressive enhancement for the static share pages
// ============================================================================
// The generated pages are COMPLETE without this file: the questions, the answer
// key and the code legend are all in the HTML, which is what lets an agent or a
// crawler fetch one and understand it. This script is for the human who opened
// the same link — it decodes the `?s=` result set and marks up the page so
// "what did I miss" is visible instead of something you decode by hand.
//
// Never required, never load-bearing. If it fails, the page still says
// everything it said before.
// ============================================================================

(function () {
  'use strict';

  const S = window.DrillShare;
  if (!S) return;

  const code = S.readShareParam(location.search);
  if (!code) return;

  const dataEl = document.getElementById('drill-data');
  let data = null;
  try { data = dataEl ? JSON.parse(dataEl.textContent) : null; } catch (_) { return; }

  const mount = document.getElementById('your-results');
  const body = mount && mount.querySelector('[data-results]');

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const VERDICT = {
    full: { cls: 'is-right', label: 'correct' },
    partial: { cls: 'is-partial', label: 'partial' },
    none: { cls: 'is-wrong', label: 'missed' },
    stale: { cls: 'is-stale', label: 'code out of date' }
  };

  // Positional encoding is only as good as the ordering it points at. If a code
  // claims credit for an option that is not this page's answer (or claims a
  // miss on one that is), the code predates a content edit — say so rather than
  // report a verdict that would mislead a reader, human or otherwise.
  function isStale(d, item) {
    if (d.kind !== 'mc' || typeof item.answer !== 'number') return false;
    return (d.credit === 'full') !== (d.picked === item.answer);
  }

  // ── Session code on the index page ────────────────────────────────────────
  // `two-sum:AbbC.Y.n,lru-cache:AAbD.Y.Y` — annotate each lesson row with its
  // score and link through carrying that lesson's own code.
  if (S.isSession(code)) {
    if (!body) return;
    const entries = S.decodeSession(code);
    const rows = entries.map(e => {
      const sum = S.summarize(S.flattenLesson(S.decodeLesson(e.code)));
      const href = `${location.pathname.replace(/\/$/, '')}/${encodeURIComponent(e.id)}/?s=${e.code}`;
      return `<tr>
        <td><a href="${esc(href)}">${esc(e.id)}</a></td>
        <td><code>${esc(e.code)}</code></td>
        <td>${sum.full}/${sum.total}</td>
      </tr>`;
    }).join('');
    body.innerHTML = `<p>${entries.length} lesson${entries.length === 1 ? '' : 's'} in this session.</p>
      <table class="legend"><thead><tr><th>Lesson</th><th>Code</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>`;
    mount.hidden = false;
    return;
  }

  if (!data || !body) return;

  // ── Single unit ───────────────────────────────────────────────────────────
  // Flatten the page's question list into the same order the code is written
  // in, so index N of one lines up with index N of the other.
  const isLesson = Array.isArray(data.codeShape) && data.codeShape.length === 3;
  const groups = isLesson
    ? [
        { anchor: n => `q${n}`, label: n => `Q${n}`, items: data.L1 || [], decoded: S.decodeLesson(code).L1 },
        { anchor: n => `l2-${n}`, label: n => `Fill ${n}`, items: data.L2 || [], decoded: S.decodeLesson(code).L2 },
        { anchor: () => 'L3', label: () => 'Drill', items: data.L3 || [], decoded: S.decodeLesson(code).L3 }
      ]
    : [{ anchor: n => `q${n}`, label: n => `Q${n}`, items: data.questions || [], decoded: S.decodeUnit(code) }];

  const rows = [];
  let any = false;
  const tally = { attempted: 0, full: 0, partial: 0, missed: 0, stale: 0 };

  for (const g of groups) {
    g.items.forEach((item, i) => {
      const d = g.decoded[i];
      if (!d || !d.attempted) return;
      any = true;
      const stale = isStale(d, item);
      const v = stale ? VERDICT.stale : (VERDICT[d.credit] || VERDICT.none);
      const n = item.n || i + 1;
      const anchor = g.anchor(n);

      // What the user answered, in the page's own vocabulary.
      let answered = '—';
      if (d.kind === 'mc' && Array.isArray(item.options)) {
        const picked = item.options[d.picked];
        answered = `${String.fromCharCode(65 + d.picked)}. ${picked == null ? '?' : picked}`;
      } else if (d.kind === 'graded') {
        answered = { good: 'self-graded: got it', partial: 'self-graded: partial', again: 'self-graded: missed' }[d.outcome] || '—';
      }

      rows.push(`<tr class="${v.cls}">
        <td><a href="#${esc(anchor)}">${esc(g.label(n))}</a></td>
        <td>${esc(answered)}</td>
        <td>${esc(v.label)}</td>
      </tr>`);

      // Tally from the SAME pass that judged staleness, so the headline can
      // never disagree with the rows beneath it.
      tally.attempted++;
      if (stale) tally.stale++;
      else if (d.credit === 'full') tally.full++;
      else if (d.credit === 'partial') tally.partial++;
      else tally.missed++;

      // Inline: mark the option the user picked, right where they'd look.
      const card = document.getElementById(anchor);
      if (!card) return;
      card.classList.add('has-result', v.cls);
      if (d.kind === 'mc') {
        const li = card.querySelectorAll('.sharepage__opts li')[d.picked];
        if (li) {
          li.classList.add('is-picked');
          // A stale row gets no verdict at all. Saying "correct" here while the
          // table says "code out of date" is the exact confident-but-wrong
          // reading this safeguard exists to prevent.
          const note = stale ? 'you picked this — code out of date'
                     : d.credit === 'full' ? 'you picked this — correct'
                     : 'you picked this';
          li.insertAdjacentHTML('beforeend', ` <span class="sharepage__mine">${note}</span>`);
        }
      } else {
        card.insertAdjacentHTML('afterbegin', `<p class="sharepage__mine sharepage__mine--block">${esc(answered)}</p>`);
      }
    });
  }

  if (!any) return;

  // Unattempted is the one figure the walk can't see — it skips those rows.
  const unattempted = groups.reduce(
    (n, g) => n + g.decoded.slice(0, g.items.length).filter(d => d && !d.attempted).length, 0);
  // Stale answers are excluded from the score rather than counted either way:
  // their verdict is unknowable, so scoring them would be a guess.
  const scored = tally.attempted - tally.stale;
  body.innerHTML = `
    ${scored
      ? `<p class="sharepage__score"><strong>${tally.full}/${scored}</strong> correct on the questions attempted${tally.partial ? `, ${tally.partial} partial` : ''}${unattempted ? ` · ${unattempted} not attempted` : ''}${tally.stale ? ` · ${tally.stale} not scored` : ''}.</p>`
      : `<p class="sharepage__score">No answer in this code can be scored against the current version of this page.</p>`}
    ${tally.stale ? `<p class="sharepage__stale">⚠ ${tally.stale} answer${tally.stale === 1 ? '' : 's'} in this code disagree${tally.stale === 1 ? 's' : ''} with the current version of ${tally.stale === 1 ? 'its' : 'their'} question — the code predates an edit to this content, so ${tally.stale === 1 ? 'that row is' : 'those rows are'} left unscored rather than given a verdict.</p>` : ''}
    <table class="legend"><thead><tr><th>Question</th><th>Answered</th><th>Result</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    <p class="sharepage__note">Decoded from <code>${esc(code)}</code> in this page's URL.</p>`;
  mount.hidden = false;
})();
