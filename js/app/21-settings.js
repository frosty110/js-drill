// ── 21: Settings — one grouped ds settings surface (design-loop P6) ─────────
// The nav's Settings destination: a thumb-first ds-sheet (bottom sheet ≤639px,
// centered panel ≥640px — identical presentation to the Practice launcher, so
// the two "pop-in panels reached from nav" read the same). Replaces the legacy
// top-right #topbar-dropdown for settings, which the nav-audit measured opening
// 1,199px from its rail trigger, over the lesson, with emoji rows and no close
// affordance (D07 + ADHD single-focus violations). See DECISIONS.md D11.
//
// Groups: Display · Feedback · Interview rituals · Data & sync · Install &
// offline · Keyboard. Every control is the SAME hidden sidebar button the old
// dropdown drove — each toggle row synth-clicks its <id>-btn (the D05 contract),
// so state + persistence + sync registries are UNCHANGED (no new saveProgress
// field). The sheet re-renders after each flip to reflect the switch.
//
// Entry points (all resolve here): the rail/bar Settings item + mobile topbar ⚙
// synth-click #topbar-settings → openSettings (wired in 15-init); the command
// palette + #/m/settings (and the toggle slugs #/m/clarify-ritual, /haptic,
// /reset … via MODE_ROUTE_SURFACE in 10-render-sidebar-lesson.js).

let _settingsScrim = null;

// Toggle/segmented rows, grouped. `btn` = the hidden sidebar button that owns
// the real state mutation; `field` = the state flag the switch reflects.
const _SETTINGS_TOGGLES = [
  { group: 'display', kind: 'font',   btn: 'font-size-btn',     icon: 'type',
    label: 'Text size', desc: 'Scale all text uniformly — M · L · XL' },
  { group: 'display', kind: 'toggle', btn: 'adhd-mode-btn',     field: 'adhdMode',       icon: 'sparkles',
    label: 'ADHD reading mode', desc: 'Bionic word-heads + marker highlight in Conversation' },
  { group: 'display', kind: 'toggle', btn: 'pace-bar-btn',      field: 'paceBarOn',      icon: 'gauge',
    label: 'Pace bar', desc: 'Peripheral tempo cue on the L3 editor vs your median time' },
  { group: 'feedback', kind: 'toggle', btn: 'haptic-btn',       field: 'hapticOn',       icon: 'vibrate',
    label: 'Haptics', desc: 'Vibrate on correct · miss · pass (supported devices only)' },
  { group: 'rituals', kind: 'toggle', btn: 'clarify-ritual-btn', field: 'clarifyRitualOn', icon: 'mic',
    label: 'Clarify-first ritual', desc: 'Gate every L3 behind clarifying-question chips' },
  { group: 'rituals', kind: 'toggle', btn: 'hotseat-btn',       field: 'hotseatOn',      icon: 'flame',
    label: 'Hot-seat follow-up', desc: 'An interviewer follow-up after each L3 pass' },
  { group: 'rituals', kind: 'toggle', btn: 'calibrate-btn',     field: 'calibrateOn',    icon: 'clock',
    label: 'Time calibration', desc: 'Estimate-vs-actual solve time, tracked per mechanic' },
];

const _SETTINGS_GROUP_LABELS = { display: 'Display', feedback: 'Feedback', rituals: 'Interview rituals' };

const _FONT_STEPS = [
  { key: 'md', label: 'M' }, { key: 'lg', label: 'L' }, { key: 'xl', label: 'XL' },
];

// A hidden button is "actionable" when present and not hidden by either channel
// (.hidden = dynamic empty-state; inline display:none = capability, e.g. haptics
// on iOS, install with no prompt). Mirrors _topbarItemFromButton's filter.
function _settingsBtnActionable(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  if (el.classList.contains('hidden')) return false;
  if (el.style && el.style.display === 'none') return false;
  return true;
}

function _settingsToggleRow(t) {
  const badge = `<span class="ds-row__badge" aria-hidden="true">${dsIcon(t.icon, 16)}</span>`;
  const main = `<div class="ds-row__main"><b>${escapeHtml(t.label)}</b><span>${escapeHtml(t.desc)}</span></div>`;
  if (t.kind === 'font') {
    const cur = (typeof state !== 'undefined' && state.fontScale) || 'lg';
    const segs = _FONT_STEPS.map(s =>
      `<button type="button" data-font="${s.key}" class="${s.key === cur ? 'is-on' : ''}" aria-pressed="${s.key === cur}">${s.label}</button>`
    ).join('');
    return `<div class="settings-row"><div class="settings-row__lead">${badge}${main}</div>
      <div class="ds-seg" role="group" aria-label="Text size">${segs}</div></div>`;
  }
  const on = !!(typeof state !== 'undefined' && state[t.field]);
  return `<button type="button" class="settings-row settings-row--tap" data-toggle="${escapeHtml(t.btn)}" role="switch" aria-checked="${on}">
    <div class="settings-row__lead">${badge}${main}</div>
    <span class="ds-switch${on ? ' is-on' : ''}" aria-hidden="true"></span></button>`;
}

function _settingsActionRow(icon, label, desc, attrs, danger) {
  const badge = `<span class="ds-row__badge${danger ? ' settings-badge--danger' : ''}" aria-hidden="true">${dsIcon(icon, 16)}</span>`;
  const main = `<div class="ds-row__main"><b${danger ? ' style="color: var(--ds-bad);"' : ''}>${escapeHtml(label)}</b>${desc ? `<span>${escapeHtml(desc)}</span>` : ''}</div>`;
  return `<button type="button" class="settings-row settings-row--tap settings-row--action" ${attrs}>
    ${badge}${main}<span class="ds-row__chev">${dsIcon('chevron-right', 17)}</span></button>`;
}

function _settingsRenderBody() {
  let html = '';

  // Toggle groups (Display · Feedback · Interview rituals) — render a group only
  // if it has ≥1 actionable control (haptics vanishes on unsupported devices).
  for (const g of ['display', 'feedback', 'rituals']) {
    const rows = _SETTINGS_TOGGLES.filter(t => t.group === g && _settingsBtnActionable(t.btn)).map(_settingsToggleRow).join('');
    if (!rows) continue;
    html += `<p class="ds-label settings-grouplabel">${escapeHtml(_SETTINGS_GROUP_LABELS[g])}</p>
      <div class="ds-card ds-card--flat settings-card">${rows}</div>`;
  }

  // Data & sync — sync status (opens the existing sync modal), backup, restore,
  // reset (destructive; the #reset-btn handler's own confirm is the guard).
  let dataRows = '';
  const syncAvail = window.DrillSync && typeof DrillSync.isAvailable === 'function' && DrillSync.isAvailable();
  if (syncAvail) {
    const user = typeof DrillSync.getCurrentUser === 'function' ? DrillSync.getCurrentUser() : null;
    const status = user && user.email ? `Signed in · ${user.email}` : 'Local only — tap to sign in & sync devices';
    dataRows += _settingsActionRow('cloud', 'Cross-device sync', status, 'data-action="sync"');
  }
  if (_settingsBtnActionable('backup-btn')) dataRows += _settingsActionRow('download', 'Back up progress', 'Download your progress as a JSON file', 'data-action-btn="backup-btn"');
  if (_settingsBtnActionable('restore-btn')) dataRows += _settingsActionRow('upload', 'Restore from file', 'Replace local progress from a backup', 'data-action-btn="restore-btn"');
  if (_settingsBtnActionable('reset-btn')) dataRows += _settingsActionRow('trash', 'Reset all progress', 'Erase progress, reviews & history — cannot be undone', 'data-action-btn="reset-btn"', true);
  if (dataRows) {
    html += `<p class="ds-label settings-grouplabel">Data &amp; sync</p>
      <div class="ds-card ds-card--flat settings-card">${dataRows}</div>`;
  }

  // Install & offline — both hidden until the browser/capability allows them.
  let ioRows = '';
  if (_settingsBtnActionable('install-btn')) ioRows += _settingsActionRow('smartphone', 'Install app', 'Add JS Drill to your home screen', 'data-action-btn="install-btn"');
  if (_settingsBtnActionable('offline-pack-btn')) {
    const cnt = document.getElementById('offline-pack-count');
    const n = cnt ? (cnt.textContent || '0') : '0';
    ioRows += _settingsActionRow('download-cloud', 'Offline pack', `${n} lessons cached for offline drilling`, 'data-action-btn="offline-pack-btn"');
  }
  if (ioRows) {
    html += `<p class="ds-label settings-grouplabel">Install &amp; offline</p>
      <div class="ds-card ds-card--flat settings-card">${ioRows}</div>`;
  }

  // Keyboard shortcuts (folds the topbar help button into Settings — nav-audit P2-6).
  if (document.getElementById('topbar-help')) {
    html += `<p class="ds-label settings-grouplabel">Help</p>
      <div class="ds-card ds-card--flat settings-card">${_settingsActionRow('keyboard', 'Keyboard shortcuts', 'The full key map', 'data-action-btn="topbar-help"')}</div>`;
  }

  return html;
}

function _settingsEnsureSheet() {
  if (_settingsScrim) return _settingsScrim;
  _settingsScrim = document.createElement('div');
  _settingsScrim.className = 'ds-root ds-scrim';
  _settingsScrim.id = 'settings-sheet';
  _settingsScrim.innerHTML = `
    <div class="ds-sheet ds-sheet--scroll" role="dialog" aria-modal="true" aria-label="Settings">
      <div class="settings-head">
        <h2 class="ds-h2">Settings</h2>
        <button class="ds-iconbtn" data-settings-close aria-label="Close settings">${dsIcon('x', 20)}</button>
      </div>
      <div data-settings-body></div>
    </div>`;
  document.body.appendChild(_settingsScrim);
  _settingsScrim.addEventListener('click', (e) => { if (e.target === _settingsScrim) _closeSettings(); });
  _settingsScrim.querySelector('[data-settings-close]').addEventListener('click', _closeSettings);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _settingsScrim.classList.contains('is-open')) { e.stopPropagation(); _closeSettings(); }
  });
  _settingsScrim.querySelector('[data-settings-body]').addEventListener('click', _settingsOnTap);
  return _settingsScrim;
}

function _settingsOnTap(e) {
  // Text-size segment → set the scale by clicking #font-size-btn until it lands
  // on the requested step (the button only cycles md→lg→xl→md; ≤2 clicks).
  const seg = e.target.closest('[data-font]');
  if (seg) {
    e.stopPropagation();
    const want = seg.getAttribute('data-font');
    const fontBtn = document.getElementById('font-size-btn');
    if (fontBtn) {
      let guard = 0;
      while ((state.fontScale || 'lg') !== want && guard++ < 4) fontBtn.click();
    }
    _settingsRefresh();
    return;
  }
  const toggle = e.target.closest('[data-toggle]');
  if (toggle) {
    e.stopPropagation();
    const btn = document.getElementById(toggle.getAttribute('data-toggle'));
    if (btn) btn.click();       // flips state + saves + re-renders lesson if needed
    _settingsRefresh();
    return;
  }
  const action = e.target.closest('[data-action], [data-action-btn]');
  if (!action) return;
  e.stopPropagation();
  if (action.dataset.action === 'sync') {
    _closeSettings();
    const chip = document.getElementById('sync-chip');
    if (chip) chip.click();     // opens the existing sync modal (sign in/out + status)
    return;
  }
  const btn = document.getElementById(action.dataset.actionBtn);
  _closeSettings();             // close first so the action's own UI (confirm / file picker / download) is unobstructed
  if (btn) btn.click();
}

function _settingsRefresh() {
  if (!_settingsScrim) return;
  const body = _settingsScrim.querySelector('[data-settings-body]');
  if (body) body.innerHTML = _settingsRenderBody();
}

function openSettings() {
  const s = _settingsEnsureSheet();
  s.querySelector('[data-settings-body]').innerHTML = _settingsRenderBody();
  s.classList.add('is-open');
  const close = s.querySelector('[data-settings-close]');
  if (close) close.focus({ preventScroll: true });
}

function _closeSettings() {
  if (_settingsScrim) _settingsScrim.classList.remove('is-open');
}
