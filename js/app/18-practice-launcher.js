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
      const idList = Array.isArray(it.ids) ? it.ids : [];
      const ids = idList.join(',');
      // The row tap keeps launching a RANDOM family member (good interleaving),
      // but a ▾ disclosure now expands the member list so a user who wants a
      // SPECIFIC drill can pick it deterministically instead of typing into the
      // palette (nav-audit P2-4). Members resolve via the same data-btn-id
      // synth-click contract; labels come from the hidden buttons. Zero state.
      const members = idList.map(id => {
        const m = _topbarItemFromButton(document.getElementById(id));
        if (!m) return '';
        const mi = m.icon || DS_MODE_ICONS[id];
        const mbadge = `<span class="ds-row__badge" style="width:24px;height:24px;" aria-hidden="true">${mi ? dsIcon(mi, 14) : escapeHtml((m.label || '?').charAt(0))}</span>`;
        return `<button class="ds-row" data-btn-id="${escapeHtml(id)}" style="width:100%; text-align:left; background:none; border:0; cursor:pointer; min-height: var(--ds-tap); padding-left: var(--ds-s5);">${mbadge}<div class="ds-row__main"><b style="font-weight: var(--ds-fw-med); font-size: var(--ds-fs-sm);">${escapeHtml(m.label)}</b></div></button>`;
      }).filter(Boolean).join('');
      const shuffleRow = `<button data-action="shuffle" data-shuffle-ids="${escapeHtml(ids)}" style="flex:1; min-width:0; display:flex; align-items:flex-start; gap: var(--ds-s3); text-align:left; background:none; border:0; cursor:pointer; min-height: var(--ds-tap);">${badge}${main}</button>`;
      const disclose = members
        ? `<button data-disclose aria-expanded="false" aria-label="Show every drill in this family" style="flex:none; width: var(--ds-tap); min-height: var(--ds-tap); background:none; border:0; color: var(--ds-text-mute); cursor:pointer; font-size: var(--ds-fs-md); line-height:1;">▾</button>`
        : `<span class="ds-row__chev">›</span>`;
      return `<div data-family>
        <div class="ds-row" style="padding-right:0;">${shuffleRow}${disclose}</div>
        ${members ? `<div data-members hidden>${members}</div>` : ''}
      </div>`;
    }
    if (it.action === 'pick-smart') {
      return `<button class="ds-row" data-action="pick-smart" style="width:100%; text-align:left; background:none; border:0; cursor:pointer; min-height: var(--ds-tap);">${badge}${main}${chev}</button>`;
    }
    if (it.action === 'href') {
      // Plain link row (nav-audit P1-2) — a real <a> so modifier-click /
      // "Open in New Tab" work natively; onRowTap just closes the sheet.
      return `<a class="ds-row" data-action="href" href="${escapeHtml(it.href)}" style="width:100%; text-align:left; text-decoration:none; color:inherit; cursor:pointer; min-height: var(--ds-tap);">${badge}${main}${chev}</a>`;
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
    // ▾ disclosure — expand/collapse a drill family's member list in place
    // (nav-audit P2-4). Kept ahead of the launch branches so it never triggers
    // a random pick.
    const disc = e.target.closest('[data-disclose]');
    if (disc) {
      e.stopPropagation();
      const members = disc.closest('[data-family]')?.querySelector('[data-members]');
      if (members) {
        const opening = members.hasAttribute('hidden');
        members.toggleAttribute('hidden', !opening);
        disc.setAttribute('aria-expanded', String(opening));
        disc.textContent = opening ? '▴' : '▾';
      }
      return;
    }
    const row = e.target.closest('[data-action], [data-btn-id]');
    if (!row) return;
    e.stopPropagation();
    if (row.dataset.action === 'href') {
      // Real page link — no preventDefault, the anchor navigates natively.
      closeSheet();
      return;
    }
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
