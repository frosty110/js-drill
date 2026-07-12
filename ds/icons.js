// ds/icons.js — the design system's stroke line-icon set (decision D07).
//
// One visual language for every affordance icon: 24×24 viewBox, stroke =
// currentColor, fill none, stroke-width 1.9, round caps/joins — matching the
// bottom nav's icons. Emoji is banned from chrome (it renders differently per
// platform and reads as placeholder design); it remains acceptable only in
// authored lesson content and celebratory toasts.
//
// Usage:  dsIcon('target')            → svg string, 20px
//         dsIcon('flame', 14)         → svg string, custom px
//         DS_MODE_ICONS['mock-btn']   → icon name for a mode launcher id
//
// Paths are Lucide-style (ISC), hand-picked for the modes we ship. Add a new
// icon here — never inline a one-off <svg> path in a surface file.

const DS_ICONS = {
  // navigation / shell
  home: '<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/>',
  grid: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="15" width="7" height="5" rx="1.5"/><rect x="14" y="15" width="7" height="5" rx="1.5"/>',
  zap: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3.5-4 3 2.5L20 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>',
  funnel: '<path d="M4 4h16l-6.5 8v6l-3 2v-8z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.1-3 4"/><path d="M12 17.5h.01"/>',
  sliders: '<path d="M21 6h-7"/><path d="M10 6H3"/><circle cx="12" cy="6" r="2"/><path d="M21 12h-3"/><path d="M14 12H3"/><circle cx="16" cy="12" r="2"/><path d="M21 18h-9"/><path d="M8 18H3"/><circle cx="10" cy="18" r="2"/>',
  code: '<path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/>',
  'book-open': '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  'clipboard-list': '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',

  // sessions
  'calendar-check': '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h.01"/><path d="M16 8h.01"/><path d="M12 12h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/>',
  sunrise: '<path d="M12 3v5"/><path d="m5.6 9.6-1.4-1.4"/><path d="m18.4 9.6 1.4-1.4"/><path d="M8 18a4 4 0 0 1 8 0"/><path d="M2 18h3"/><path d="M19 18h3"/><path d="M4 22h16"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',

  // drill families
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',

  // streams
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M4 22V4c4-2 8 2 12 0v10c-4 2-8-2-12 0"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  phone: '<path d="M22 16.92v2a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h2a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',

  // review / reference
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  // System Design — a 3-tier architecture diagram (two components fanning into
  // a shared service). Distinct from `grid` (Browse) and `layers` (Gauntlet).
  sysdesign: '<rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="8.5" y="15" width="7" height="5" rx="1"/><path d="M6.5 8v4M17.5 8v4M6.5 12h11M12 12v3"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  sparkles: '<path d="m12 3 1.9 5.8 5.8 1.9-5.8 1.9L12 18.4l-1.9-5.8-5.8-1.9 5.8-1.9z"/><path d="M19 3v4"/><path d="M17 5h4"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',

  // ambient / status
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  alert: '<path d="m10.29 3.86-8.4 14.5A2 2 0 0 0 3.62 21.4h16.76a2 2 0 0 0 1.73-3.03l-8.4-14.5a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',

  // settings surface (P6)
  type: '<path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  gauge: '<path d="M12 14 15 9"/><path d="M3.5 15a9 9 0 1 1 17 0"/><circle cx="12" cy="14" r="1.5"/>',
  vibrate: '<path d="m2 8 2 2-2 2 2 2-2 2"/><path d="m22 8-2 2 2 2-2 2 2 2"/><rect x="8" y="5" width="8" height="14" rx="1"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.5-1.5A4 4 0 0 0 6.5 19z"/>',
  download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 21V9"/><path d="m7 13 5-5 5 5"/><path d="M4 3h16"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
  smartphone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  'download-cloud': '<path d="M8 17a5 5 0 1 1 1.9-9.6A6 6 0 0 1 21 10.5a4 4 0 0 1-1 7.5"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 13h6"/>',

  // drill-screen chrome (P7)
  lightbulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.1 14c.2-1 .7-1.7 1.4-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.8 1.2 1.5 1.4 2.5"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.2 8.2a2 2 0 0 0 2.8 0l6.8-6.8a2 2 0 0 0 0-2.8z"/><path d="M7 7h.01"/>',
  play: '<path d="M6 4v16l14-8z"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M3 12h18"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z"/>',
};

// Mode-launcher iconography: hidden-button id (or taxonomy `icon` key) → icon.
const DS_MODE_ICONS = {
  'today-btn': 'calendar-check',
  'mock-btn': 'target',
  'warmup-btn': 'sunrise',
  'audio-btn': 'headphones',
  'conv-drill-btn': 'message',
  'rapid-fire-btn': 'zap',
  'big-o-btn': 'clock',
  'speedrun-btn': 'flag',
  'gauntlet-btn': 'layers',
  'phone-screen-btn': 'phone',
  'sections-grid-btn': 'grid',
  'mechanics-btn': 'box',
  'export-btn': 'clipboard',
  'ai-coach-btn': 'sparkles',
  'cram-cheat-btn': 'zap',
  'cram-glossary-btn': 'book-open',
  'cram-behavior-btn': 'mic',
  'cram-shapes-btn': 'braces',
  'cram-review-btn': 'refresh',
};

function dsIcon(name, size = 20) {
  const paths = DS_ICONS[name];
  if (!paths) return '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
