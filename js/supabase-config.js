// Supabase project credentials.
//
// The anon key is designed to be public — it's a JWT that says "this
// client is anonymous" and on its own grants ZERO data access. Row-Level
// Security policies in supabase/migrations/001_user_progress.sql enforce
// that even after sign-in, a user can only touch their own row.
//
// If you EVER see a service_role key in this file, delete it immediately
// and rotate it in the Supabase dashboard — that one IS sensitive.
//
// To disable sync entirely (e.g. for a private fork), set both to empty
// strings. The app will detect the missing config and skip the Sync UI.

(function (root) {
  'use strict';
  root.SUPABASE_CONFIG = {
    url: 'https://teewigrfhkbhxttsuuet.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZXdpZ3JmaGtiaHh0dHN1dWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NTU3NjksImV4cCI6MjA5NTIzMTc2OX0.L_agapcFPyEnjzPR1BW9rvp8hxJ9ciT13_xT8ZTtng4'
  };
})(typeof window !== 'undefined' ? window : globalThis);
