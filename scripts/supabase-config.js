// supabase-config.js
// Safe to commit — the anon key is public by design.
// Uses ENV from env.js (loaded first) to pick the right project.
//
// Recommended setup:
//   - One Supabase project for production
//   - One Supabase project for local/test (so test data stays separate)
//
// Find these values at: supabase.com → your project → Settings → API

const SUPABASE_CONFIGS = {
  local: {
    url:  "http://127.0.0.1:54321",
    anon: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
  },
  test: {
    url:  "https://djtwsbinrkymdbnmdasj.supabase.co",
    anon: "sb_publishable_hyaA12CQLTQV4fowRdnvNA_0vUv1O3X",
  },
  production: {
    url:  "https://aesczcwhsxaalthpcfsb.supabase.co",
    anon: "sb_publishable_OmkBPJ5AvzCz0_sVz0_xLQ_QEWpiQj_",
  },
};

const { url: SUPABASE_URL, anon: SUPABASE_ANON } = SUPABASE_CONFIGS[ENV];
