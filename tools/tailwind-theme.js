// ============================================================================
//  tools/tailwind-theme.js — the Ink & Amber palette, in ONE place
// ============================================================================
// This mapping used to live inline in index.html, next to the Tailwind CDN
// script it configured. The CDN is gone (see tools/build-tailwind-subset.js
// for why), so the palette now lives here and is baked into the generated
// stylesheet at build time instead of being applied by a compiler in the
// user's browser on every page load.
//
// What it does (design-loop D06): remap the Tailwind palette so every existing
// utility class re-renders in the app's design language — slate/gray/zinc
// become the ink neutrals, every cool accent ramp collapses onto the single
// amber accent. Status ramps (emerald/green good · rose/red bad · orange warn)
// stay stock, because those carry meaning.
//
// Values mirror ds/tokens.css. If you change a token there, change it here —
// they are the same design decision expressed for two different consumers, and
// tools/check-tailwind-subset.js will not catch a mismatch between them.

const ink = {
  50: '#fafbfc', 100: '#f2f3f5', 200: '#eef0f2', 300: '#c4c9cf', 400: '#9aa0aa',
  500: '#6b7079', 600: '#4a4f58', 700: '#363a43', 800: '#262930', 900: '#17181c',
  950: '#0e0f12'
};

const amber = {
  50: '#fff8e6', 100: '#ffedc2', 200: '#ffdd8a', 300: '#ffce5a', 400: '#f5b62b',
  500: '#f5b62b', 600: '#e0a41e', 700: '#c78f15', 800: '#8a6a10', 900: '#4a3d13',
  950: '#2a2410'
};

// Exactly the object the inline `tailwind.config` used to build.
const colors = {
  slate: ink, gray: ink, zinc: ink,
  blue: amber, sky: amber, cyan: amber, indigo: amber,
  violet: amber, purple: amber, fuchsia: amber, pink: amber,
  amber: { 300: '#ffce5a', 400: '#f5b62b' }
};

module.exports = { ink, amber, colors };
