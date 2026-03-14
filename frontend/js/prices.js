// prices.js — fetches live forex + commodity prices
// Always falls back to last Supabase DB value if any API is down
// Never shows a blank dashboard

const Prices = (() => {
  // In-memory cache so pages don't re-fetch on every render
  let _cache = {
    forex:       null,
    commodities: null,
    livestock:   null,
    lastFetched: null,
  };

  // ── Forex ──────────────────────────────────────────────────

  async function fetchForex() {
    try {
      const res  = await fetch(CONFIG.FX_URL, { cache: 'no-store' });
      const json = await res.json();

      if (json.result !== 'success') throw new Error('FX API returned error');

      const r = json.rates;
      const rates = {
        USD_KES: r.KES,
        USD_UGX: r.UGX,
        USD_TZS: r.TZS,
        USD_ETB: r.ETB,
        USD_SOS: r.SOS,
        EUR_KES: r.KES / r.EUR,
        GBP_KES: r.KES / r.GBP,
        KES_SOS: r.SOS / r.KES,
        fetched_at: new Date().toISOString(),
        source: 'ExchangeRate-API (live)',
      };

      // Persist to Supabase so we always have a fallback
      await dbQuery(sb => sb.from('forex_cache').upsert({
        id: 'latest', ...rates
      }));

      _cache.forex = rates;
      return rates;

    } catch (err) {
      console.warn('[Prices] Forex API failed, using DB fallback:', err.message);
      return _fetchForexFallback();
    }
  }

  async function _fetchForexFallback() {
    const { data } = await dbQuery(sb =>
      sb.from('forex_cache').select('*').eq('id', 'latest').single()
    );
    if (data) {
      data.source = `DB fallback (last: ${_formatAge(data.fetched_at)})`;
      _cache.forex = data;
      return data;
    }
    // Last resort: hardcoded approximate values with warning
    return _hardcodedForexFallback();
  }

  function _hardcodedForexFallback() {
    return {
      USD_KES: 129.40, USD_UGX: 3710, USD_TZS: 2615,
      USD_ETB: 57.85,  USD_SOS: 571,  EUR_KES: 140.22,
      GBP_KES: 165.80, KES_SOS: 4.41,
      fetched_at: null,
      source: '⚠ Static fallback — API unavailable',
    };
  }

  // ── Commodities (from Supabase — populated by Edge Function) ──

  async function fetchCommodities() {
    const { data, error } = await dbQuery(sb =>
      sb.from('prices')
        .select('*')
        .order('fetched_at', { ascending: false })
    );

    if (error || !data || data.length === 0) {
      console.warn('[Prices] Using static commodity fallback');
      return _staticCommodities();
    }

    // Group by commodity + location, take latest per pair
    const seen = new Set();
    const latest = data.filter(row => {
      const key = `${row.commodity}:${row.location}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    _cache.commodities = latest;
    return latest;
  }

  function _staticCommodities() {
    // Static fallback with timestamp null so UI can show warning
    return [
      { commodity:'Maize (white)', location:'Nairobi',     price_kes:66,  price_usd:0.51, trend:'up',   action:'hold', source:'Static', fetched_at:null },
      { commodity:'Maize (white)', location:'Garissa',     price_kes:85,  price_usd:0.66, trend:'up',   action:'sell', source:'Static', fetched_at:null },
      { commodity:'Maize (white)', location:'Mandera',     price_kes:94,  price_usd:0.73, trend:'up',   action:'sell', source:'Static', fetched_at:null },
      { commodity:'Beans (Nyayo)', location:'Nairobi',     price_kes:115, price_usd:0.89, trend:'up',   action:'sell', source:'Static', fetched_at:null },
      { commodity:'Coffee AA',     location:'NCE Nairobi', price_kes:637, price_usd:4.92, trend:'up',   action:'sell', source:'Static', fetched_at:null },
      { commodity:'Tea leaf',      location:'Nyamira',     price_kes:24,  price_usd:0.19, trend:'flat', action:'hold', source:'Static', fetched_at:null },
    ];
  }

  // ── Livestock ──────────────────────────────────────────────

  async function fetchLivestock() {
    const { data } = await dbQuery(sb =>
      sb.from('livestock_prices').select('*').order('fetched_at', { ascending: false })
    );
    if (data && data.length > 0) {
      _cache.livestock = data;
      return data;
    }
    return _staticLivestock();
  }

  function _staticLivestock() {
    return [
      { animal:'Cattle Grade 1', location:'Nairobi',  price_kes_kg:'320–336', trend:'up',   action:'sell', source:'FEWS NET', fetched_at:null },
      { animal:'Cattle Grade 2', location:'Garissa',  price_kes_kg:'295–315', trend:'up',   action:'sell', source:'FEWS NET', fetched_at:null },
      { animal:'Cattle',         location:'Wajir',    price_kes_kg:'210–250', trend:'down', action:'hold', source:'FEWS NET', fetched_at:null },
      { animal:'Goat (mature)',  location:'Garissa',  price_kes_kg:'380–420', trend:'up',   action:'sell', source:'FEWS NET', fetched_at:null },
      { animal:'Camel',          location:'Burao SOM',price_kes_kg:'$480–520 / head', trend:'up', action:'sell', source:'FEWS NET', fetched_at:null },
    ];
  }

  // ── Arbitrage calculation ───────────────────────────────────

  function calcArbitrage(commodities) {
    const arb = [];
    const byName = {};
    commodities.forEach(c => {
      if (!byName[c.commodity]) byName[c.commodity] = [];
      byName[c.commodity].push(c);
    });

    Object.entries(byName).forEach(([name, markets]) => {
      if (markets.length < 2) return;
      markets.sort((a, b) => a.price_kes - b.price_kes);
      const low  = markets[0];
      const high = markets[markets.length - 1];
      const spread = high.price_kes - low.price_kes;
      const pct    = ((spread / low.price_kes) * 100).toFixed(1);
      if (spread > 5) {
        arb.push({
          commodity: name,
          buy_loc:   low.location,
          sell_loc:  high.location,
          buy_price: low.price_kes,
          sell_price:high.price_kes,
          gross_spread: spread,
          spread_pct: pct,
          // Rough net after transport (35% of gross for Kenya corridors)
          net_spread: (spread * 0.65).toFixed(0),
          rating: spread > 40 ? 'hot' : spread > 15 ? 'warm' : 'low',
        });
      }
    });

    return arb.sort((a, b) => b.gross_spread - a.gross_spread);
  }

  // ── Exploitation check ────────────────────────────────────

  function checkExploitation(commodities) {
    // Benchmarks in KES/kg (updated by Edge Function from World Bank)
    const benchmarks = {
      'Coffee AA':     637,
      'Maize (white)': 66,
      'Beans (Nyayo)': 115,
      'Tea leaf':      32,
    };

    return commodities
      .filter(c => {
        const bench = benchmarks[c.commodity];
        if (!bench) return false;
        return c.price_kes < bench * CONFIG.EXPLOIT_THRESH;
      })
      .map(c => ({
        commodity:  c.commodity,
        location:   c.location,
        price:      c.price_kes,
        benchmark:  benchmarks[c.commodity],
        gap_pct:    (((benchmarks[c.commodity] - c.price_kes) / benchmarks[c.commodity]) * 100).toFixed(1),
      }));
  }

  // ── Cache & helpers ────────────────────────────────────────

  function getCache()     { return _cache; }
  function getCached(key) { return _cache[key]; }

  function _formatAge(isoString) {
    if (!isoString) return 'unknown';
    const mins = Math.floor((Date.now() - new Date(isoString)) / 60000);
    if (mins < 60)  return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins/60)}h ago`;
    return `${Math.floor(mins/1440)}d ago`;
  }

  function formatAge(isoString) { return _formatAge(isoString); }

  // ── Init: load everything at startup ──────────────────────

  async function init() {
    // Run in parallel — don't block UI on any single source
    const [forex, commodities, livestock] = await Promise.allSettled([
      fetchForex(),
      fetchCommodities(),
      fetchLivestock(),
    ]);
    _cache.forex       = forex.value       || _hardcodedForexFallback();
    _cache.commodities = commodities.value || _staticCommodities();
    _cache.livestock   = livestock.value   || _staticLivestock();
    _cache.lastFetched = new Date();
    return _cache;
  }

  return {
    init, fetchForex, fetchCommodities, fetchLivestock,
    calcArbitrage, checkExploitation, getCache, getCached, formatAge,
  };
})();
