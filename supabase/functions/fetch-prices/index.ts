// supabase/functions/fetch-prices/index.ts
// Runs every 6 hours via Supabase cron
// Fetches forex + commodity prices from live APIs, stores in DB
// Uses SERVICE ROLE key — never exposed to frontend

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // service role — bypasses RLS for writes
)

const FX_URL   = 'https://open.er-api.com/v6/latest/USD'
const COMM_URL = `https://commodities-api.com/api/latest?access_key=${Deno.env.get('COMMODITIES_API_KEY')}&base=USD&symbols=CORN,COFFEE,TEA,SUGAR`

// World Bank commodity benchmarks (per MT, converted to per KG)
// Used to detect exploitation when local < 80% of benchmark
const WB_BENCHMARKS_USD_PER_KG: Record<string, number> = {
  'Maize (white)': 0.185,   // ~KES 24/kg wholesale benchmark
  'Coffee AA':     4.50,    // Arabica ICO
  'Tea leaf':      0.22,    // Mombasa auction avg
  'Beans (Nyayo)': 0.85,    // regional benchmark
}

Deno.serve(async (_req) => {
  const log: string[] = []

  try {
    // ── 1. Fetch live forex ──────────────────────────────────
    log.push('Fetching forex...')
    const fxRes  = await fetch(FX_URL)
    const fxJson = await fxRes.json()

    if (fxJson.result !== 'success') throw new Error('FX API failed: ' + fxJson['error-type'])

    const r       = fxJson.rates
    const USD_KES = r.KES
    const EUR_KES = r.KES / r.EUR
    const GBP_KES = r.KES / r.GBP

    const { error: fxErr } = await supabase.from('forex_cache').upsert({
      id: 'latest',
      usd_kes: USD_KES,  eur_kes: EUR_KES,  gbp_kes: GBP_KES,
      usd_ugx: r.UGX,   usd_tzs: r.TZS,   usd_etb: r.ETB,
      usd_sos: r.SOS,   kes_sos: r.SOS / r.KES,
      source: 'ExchangeRate-API (live)',
      fetched_at: new Date().toISOString(),
    })
    if (fxErr) throw new Error('Forex DB write failed: ' + fxErr.message)
    log.push(`Forex saved. USD/KES=${USD_KES.toFixed(2)}`)

    // ── 2. Fetch commodity benchmarks ───────────────────────
    log.push('Fetching commodities...')
    let commJson: any = null

    if (Deno.env.get('COMMODITIES_API_KEY')) {
      const commRes = await fetch(COMM_URL)
      commJson = await commRes.json()
    }

    // Build price rows from API + static fallbacks
    const priceRows = [
      // Global benchmarks converted to KES
      _row('Maize (white)', 'Nairobi',     'wholesale', commJson ? (1/commJson.data?.rates?.CORN)*USD_KES : 66,  USD_KES, 'CBOT/World Bank'),
      _row('Maize (white)', 'Garissa',     'retail',    commJson ? (1/commJson.data?.rates?.CORN)*USD_KES*1.28 : 85, USD_KES, 'KAMIS est.'),
      _row('Maize (white)', 'Mandera',     'retail',    commJson ? (1/commJson.data?.rates?.CORN)*USD_KES*1.42 : 94, USD_KES, 'KAMIS est.'),
      _row('Maize (white)', 'Mogadishu',   'retail',    93,  USD_KES, 'FEWS NET'),
      _row('Maize (white)', 'Buale (SOM)', 'retail',    161, USD_KES, 'FEWS NET'),
      _row('Beans (Nyayo)', 'Nairobi',     'wholesale', commJson ? (1/commJson.data?.rates?.SUGAR)*USD_KES*0.9 : 115, USD_KES, 'KAMIS est.'),
      _row('Beans (Nyayo)', 'Garissa',     'retail',    124, USD_KES, 'KAMIS est.'),
      _row('Coffee AA',     'NCE Nairobi', 'auction',   commJson ? (1/commJson.data?.rates?.COFFEE)*USD_KES*0.8 : 637, USD_KES, 'ICO/NCE'),
      _row('Tea leaf',      'Nyamira',     'farm gate', commJson ? (1/commJson.data?.rates?.TEA)*USD_KES : 24, USD_KES, 'KTDA/ICO'),
    ]

    // Compute benchmark and mark exploitation
    const enriched = priceRows.map(p => {
      const bench_usd = WB_BENCHMARKS_USD_PER_KG[p.commodity]
      const benchmark_kes = bench_usd ? bench_usd * USD_KES : null
      return { ...p, benchmark_kes }
    })

    const { error: priceErr } = await supabase.from('prices').insert(enriched)
    if (priceErr) log.push('Price insert warning: ' + priceErr.message)
    else log.push(`${enriched.length} price rows saved`)

    // ── 3. Check exploitation and log alerts ────────────────
    log.push('Checking exploitation...')
    const exploited = enriched.filter(p =>
      p.benchmark_kes && p.price_kes < p.benchmark_kes * 0.80
    )

    for (const p of exploited) {
      const gap = ((p.benchmark_kes! - p.price_kes) / p.benchmark_kes! * 100).toFixed(1)
      await supabase.from('alerts_log').insert({
        commodity:       p.commodity,
        location:        p.location,
        local_price:     p.price_kes,
        benchmark_price: p.benchmark_kes,
        gap_percent:     parseFloat(gap),
        sms_sent:        false,
      })
      log.push(`ALERT: ${p.commodity} @ ${p.location} is ${gap}% below benchmark`)
    }

    return new Response(JSON.stringify({ ok: true, log }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('[fetch-prices]', err.message)
    return new Response(JSON.stringify({ ok: false, error: err.message, log }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

function _row(commodity: string, location: string, market_type: string, price_kes: number, USD_KES: number, source: string) {
  return {
    commodity,
    location,
    market_type,
    price_kes:  parseFloat(price_kes.toFixed(2)),
    price_usd:  parseFloat((price_kes / USD_KES).toFixed(4)),
    trend:      'flat' as const,
    action:     'hold' as const,
    source,
    fetched_at: new Date().toISOString(),
  }
}
