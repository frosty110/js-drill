// Initializes the @supabase/supabase-js v2 client and exposes it as
// `window.SupabaseClient`. Kept separate from sync.js so future features
// (e.g. Supabase Storage uploads) can share the same client instance.
//
// Loads after js/supabase-config.js and after the @supabase/supabase-js
// CDN script (which exposes the `supabase` global with `createClient`).
//
// If config is missing or the SDK didn't load, this is a no-op — the
// rest of the app keeps working in local-only mode.

(function (root) {
  'use strict';

  const cfg = root.SUPABASE_CONFIG;
  const sdk = root.supabase;

  if (!cfg || !cfg.url || !cfg.anonKey) {
    root.SupabaseClient = null;
    return;
  }
  if (!sdk || typeof sdk.createClient !== 'function') {
    console.warn('[supabase-client] @supabase/supabase-js not loaded; sync disabled.');
    root.SupabaseClient = null;
    return;
  }

  root.SupabaseClient = sdk.createClient(cfg.url, cfg.anonKey, {
    auth: {
      // Persist the session in localStorage so a sign-in survives reloads
      // and is shared across the three pages (same origin).
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,   // for magic-link fallback (?token=…)
      storageKey: 'jsdrill.auth.v1'
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
