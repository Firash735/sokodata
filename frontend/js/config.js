const CONFIG = {
  SUPABASE_URL:  window.__SOKO__?.url  || '',
  SUPABASE_ANON: window.__SOKO__?.anon || '',
  FX_URL:        'https://open.er-api.com/v6/latest/USD',
  APP_NAME:      'SokoData',
  APP_URL:       'https://sokodata.co.ke',
  PRICE_STALE_MIN: 360,
  EXPLOIT_THRESH:  0.80,
  PLAN_PRO_MONTHLY:  1499,
  PLAN_PRO_ANNUAL:   14990,
  PLAN_ENTERPRISE:   null,
};

Object.freeze(CONFIG);