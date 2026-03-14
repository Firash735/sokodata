// forex.js — full forex page with live calculator

const Forex = (() => {

  function render(container) {
    const fx = Prices.getCached('forex') || {};

    container.innerHTML = `
    <div class="grid-half">
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">Live EA Currency Rates</span>
          <span class="badge ${fx.source?.includes('live') ? 'badge-live' : 'badge-warn'}">
            ${fx.source?.includes('live') ? 'LIVE' : 'CACHED'}
          </span>
        </div>
        <div id="fxPairList"></div>
        <div class="panel-foot">
          Source: ${fx.source || '—'} · 
          ${fx.fetched_at ? 'Updated ' + Prices.formatAge(fx.fetched_at) : 'Time unknown'}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><span class="panel-title">Currency Calculator</span></div>
        <div class="fx-calc">
          <div class="auth-field">
            <label>Amount</label>
            <input type="number" id="fxAmt" value="1000" min="0" step="any" />
          </div>
          <div class="auth-field">
            <label>From</label>
            <select id="fxFrom">${_currencyOptions('KES')}</select>
          </div>
          <div class="auth-field">
            <label>To</label>
            <select id="fxTo">${_currencyOptions('USD')}</select>
          </div>
          <div class="fx-result-box">
            <div class="fx-result-label">Converted</div>
            <div class="fx-result-val" id="fxResult">—</div>
            <div class="fx-result-rate" id="fxRateLabel">—</div>
          </div>
        </div>
      </div>
    </div>`;

    _renderPairs(fx);
    _bindCalc(fx);
  }

  const CURRENCIES = {
    USD: 1,      KES: null, SOS: null,
    UGX: null,   TZS: null, ETB: null,
    EUR: null,   GBP: null,
  };

  function _getRates(fx) {
    return {
      USD: 1,
      KES: fx.USD_KES || 129.40,
      SOS: fx.USD_SOS || 571,
      UGX: fx.USD_UGX || 3710,
      TZS: fx.USD_TZS || 2615,
      ETB: fx.USD_ETB || 57.85,
      EUR: fx.USD_KES ? (1 / (fx.EUR_KES / fx.USD_KES)) : 0.921,
      GBP: fx.USD_KES ? (1 / (fx.GBP_KES / fx.USD_KES)) : 0.779,
    };
  }

  function _currencyOptions(selected) {
    const labels = {
      USD:'USD — US Dollar',   KES:'KES — Kenyan Shilling',
      SOS:'SOS — Somali Shilling', UGX:'UGX — Ugandan Shilling',
      TZS:'TZS — Tanzanian Shilling', ETB:'ETB — Ethiopian Birr',
      EUR:'EUR — Euro',        GBP:'GBP — Sterling',
    };
    return Object.entries(labels).map(([code, label]) =>
      `<option value="${code}" ${code === selected ? 'selected' : ''}>${label}</option>`
    ).join('');
  }

  function _renderPairs(fx) {
    const rates  = _getRates(fx);
    const pairs  = [
      ['USD','KES'],['EUR','KES'],['GBP','KES'],
      ['USD','UGX'],['USD','TZS'],['USD','ETB'],
      ['USD','SOS'],['KES','SOS'],
    ];
    const el = document.getElementById('fxPairList');
    if (!el) return;
    el.innerHTML = pairs.map(([from, to]) => {
      const rate = (rates[to] / rates[from]);
      return `
      <div class="fx-pair">
        <span class="fx-sym">${from}/${to}</span>
        <span class="fx-rate">${rate.toLocaleString(undefined,{maximumFractionDigits:2})}</span>
      </div>`;
    }).join('');
  }

  function _bindCalc(fx) {
    const rates   = _getRates(fx);
    const calc    = () => {
      const amt    = parseFloat(document.getElementById('fxAmt').value) || 0;
      const from   = document.getElementById('fxFrom').value;
      const to     = document.getElementById('fxTo').value;
      const inUSD  = amt / rates[from];
      const result = inUSD * rates[to];
      const rate   = rates[to] / rates[from];
      document.getElementById('fxResult').textContent =
        result.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + to;
      document.getElementById('fxRateLabel').textContent =
        `1 ${from} = ${rate.toFixed(4)} ${to}`;
    };
    document.getElementById('fxAmt')?.addEventListener('input', calc);
    document.getElementById('fxFrom')?.addEventListener('change', calc);
    document.getElementById('fxTo')?.addEventListener('change', calc);
    calc(); // run immediately
  }

  return { render };
})();
