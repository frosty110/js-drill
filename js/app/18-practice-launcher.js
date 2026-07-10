// ── 18: Practice launcher — bottom-sheet mode launcher (design-loop P3) ────
// The bottom nav's "Practice" destination: a thumb-first ds-sheet that groups
// every practice/drill/train mode (progressive disclosure — PRINCIPLES #5),
// replacing the interim top-anchored dropdown the nav's Practice tab opened
// (contrarian iter-2 notes: eye-jump to top + "Practice > Practice" label
// collision — both die here).
//
// Content is 100% derived from TOPBAR_MENU_TAXONOMY (15-init) — labels/descs
// come from the hidden sidebar buttons via _topbarItemFromButton, so the
// launcher can never drift from the canonical mode list. Action rows reuse
// the shared semantics: 'shuffle' picks a random member id; 'pick-smart'
// routes via topbarPickSmartTarget(). Concrete rows synth-click their button
// (the palette contract). Deep link: #/m/practice-launcher.
//
// The desktop topbar menus are untouched (they retire with the P4 rail).

(() => {
  const GROUPS = [
    { key: 'practice', label: 'Sessions' },
    { key: 'drills', label: 'Drills · pick a recall family' },
    { key: 'train', label: 'Streams · timed & coverage' },
    { key: 'insights', label: 'Review & reference' },
  ];

  let scrim = null;

  function ensureSheet() {
    if (scrim) return scrim;
    scrim = document.createElement('div');
    scrim.className = 'ds-root ds-scrim';
    scrim.id = 'practice-launcher';
    scrim.innerHTML = `
      <div class="ds-sheet ds-sheet--scroll" role="dialog" aria-modal="true" aria-label="Practice launcher">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: var(--ds-s2);">
          <h2 class="ds-h2">Practice</h2>
          <button class="ds-iconbtn" data-launcher-close aria-label="Close">${dsIcon('x', 18)}</button>
        </div>
        <div data-launcher-body></div>
      </div>`;
    document.body.appendChild(scrim);
    scrim.addEventListener('click', (e) => { if (e.target === scrim) closeSheet(); });
    scrim.querySelector('[data-launcher-close]').addEventListener('click', closeSheet);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && scrim.classList.contains('is-open')) closeSheet();
    });
    scrim.querySelector('[data-launcher-body]').addEventListener('click', onRowTap);
    return scrim;
  }

  function rowHtml(it) {
    // Stroke line-icons only in chrome (decision D07) — emoji reads as
    // placeholder design. Icon by taxonomy `icon` key or DS_MODE_ICONS map;
    // fallback = the label's initial in the badge tile.
    const iconName = it.icon || DS_MODE_ICONS[it.id];
    const badge = `<span class="ds-row__badge" aria-hidden="true">${
      iconName ? dsIcon(iconName, 16) : escapeHtml((it.label || '?').charAt(0))
    }</span>`;
    const main = `<div class="ds-row__main"><b>${escapeHtml(it.label)}</b>${it.desc ? `<span style="display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(it.desc)}</span>` : ''}</div>`;
    const chev = `<span class="ds-row__chev">›</span>`;
    if (it.action === 'shuffle') {
      const ids = Array.isArray(it.ids) ? it.ids.join(',') : '';
      return `<button class="ds-row" data-action="shuffle" data-shuffle-ids="${escapeHtml(ids)}" style="width:100%; text-align:left; background:none; border:0; cursor:pointer; min-height: var(--ds-tap);">${badge}${main}${chev}</button>`;
    }
    if (it.action === 'pick-smart') {
      return `<button class="ds-row" data-action="pick-smart" style="width:100%; text-align:left; background:none; border:0; cursor:pointer; min-height: var(--ds-tap);">${badge}${main}${chev}</button>`;
    }
    return `<button class="ds-row" data-btn-id="${escapeHtml(it.id)}" style="width:100%; text-align:left; background:none; border:0; cursor:pointer; min-height: var(--ds-tap);">${badge}${main}${chev}</button>`;
  }

  function renderBody() {
    const resolve = (entry) => {
      if (typeof entry === 'string') return _topbarItemFromButton(document.getElementById(entry));
      if (entry && typeof entry === 'object') return entry;
      return null;
    };
    return GROUPS.map(({ key, label }) => {
      const cat = TOPBAR_MENU_TAXONOMY[key];
      if (!cat) return '';
      // insights uses sub-groups; flatten them under the one section label.
      const entries = Array.isArray(cat.groups)
        ? cat.groups.flatMap(g => g.items)
        : cat.items;
      const rows = entries.map(resolve).filter(Boolean).map(rowHtml).join('');
      if (!rows) return '';
      return `<p class="ds-label" style="margin: var(--ds-s4) 0 var(--ds-s1);">${escapeHtml(label)}</p>
        <div class="ds-card ds-card--flat" style="padding: 0 var(--ds-s3);">${rows}</div>`;
    }).join('');
  }

  function onRowTap(e) {
    const row = e.target.closest('[data-action], [data-btn-id]');
    if (!row) return;
    e.stopPropagation();
    let target = null;
    if (row.dataset.action === 'shuffle') {
      const ids = (row.dataset.shuffleIds || '').split(',').filter(Boolean);
      const pick = ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
      target = pick ? document.getElementById(pick) : null;
    } else if (row.dataset.action === 'pick-smart') {
      target = topbarPickSmartTarget();
    } else {
      target = document.getElementById(row.dataset.btnId);
    }
    closeSheet();
    if (target) target.click();
  }

  function openSheet() {
    const s = ensureSheet();
    // Re-render at open time so hidden/unactionable buttons filter correctly
    // (counts, platform capability, cram gating all change at runtime).
    s.querySelector('[data-launcher-body]').innerHTML = renderBody();
    s.classList.add('is-open');
    s.querySelector('[data-launcher-close]').focus({ preventScroll: true });
  }

  function closeSheet() {
    if (scrim) scrim.classList.remove('is-open');
  }

  const btn = document.getElementById('practice-launcher-btn');
  if (btn) btn.addEventListener('click', openSheet);
})();
