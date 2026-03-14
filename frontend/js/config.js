// ============================================================
// config.js — ALL secrets come from environment variables
// NEVER hardcode keys here. Add them to:
//   - .env.local (your machine, never committed)
//   - GitHub Secrets (Settings → Secrets → Actions)
//   - Vercel Environment Variables (Project → Settings → Env)
// ============================================================

const CONFIG = {
  // Supabase — get from supabase.com → Project → Settings → API
  SUPABASE_URL:  window.__env?.SUPABASE_URL  || 'https://mbwvwiqktikzflkfqiph.supabase.co',
  SUPABASE_ANON: window.__env?.SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1id3Z3aXFrdGlremZsa2ZxaXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Nzk1NTQsImV4cCI6MjA4OTA1NTU1NH0.dJQqJUCwheblZyqh_83aALJSWIq6WiY5QpBEYT6HUeo',

  // ExchangeRate-API — free at exchangerate-api.com (no key needed for open tier)
  FX_URL: 'https://open.er-api.com/v6/latest/USD',

  // App settings
  APP_NAME:        'SokoData',
  APP_URL:         'https://sokodata.co.ke',
  PRICE_STALE_MIN: 360,   // show "stale" warning after 6 hours
  EXPLOIT_THRESH:  0.80,  // alert when local < 80% of benchmark

  // Plan prices (KES)
  PLAN_PRO_MONTHLY:    1499,
  PLAN_PRO_ANNUAL:     14990,
  PLAN_ENTERPRISE:     null, // contact sales

  // Africa's Talking SMS — only used server-side in Edge Function
  // Never expose AT_API_KEY in frontend
};

// Freeze so no script can accidentally mutate config
Object.freeze(CONFIG);
