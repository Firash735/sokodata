// supabase.js — single Supabase client, shared across all modules
// Uses the anon/public key — safe in frontend (RLS enforces security at DB level)

let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL.includes('YOUR_PROJECT')) {
      console.error('[SokoData] Supabase URL not configured. Add it to config or .env.local');
      return null;
    }
    _supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON);
  }
  return _supabase;
}

// Helper: run a query safely, always returns { data, error }
async function dbQuery(queryFn) {
  try {
    const client = getSupabase();
    if (!client) return { data: null, error: 'Supabase not configured' };
    return await queryFn(client);
  } catch (err) {
    console.error('[SokoData] DB error:', err.message);
    return { data: null, error: err.message };
  }
}
