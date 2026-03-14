// dashboard.js — renders the main dashboard page

const Dashboard = (() => {

  function render(container) {
    const cache = Prices.getCache();
    const fx    = cache.forex       || {};
    const comms = cache.commodities || [];
    const arb   = Prices.calcArbitrage(comms);
    const alerts = Prices.checkExploitation(comms);

    container.innerHTML = `
      ${_statsRow(fx, comms, alerts)}
      <div class="grid-main">
        <div class="grid-left">
          ${_commodityPanel(comms)}
          ${_arbPanel(arb)}
        </div>
        <div class="grid-right">
          ${_alertsPanel(alerts)}
          ${_forexMiniPanel(fx)}
          ${_heatmapPanel(comms)}
        </div>
      </div>`;

    _bindTicker(fx, comms);
  }

  function _statsRow(fx, comms, alerts) {
    const maize = comms.find(c => c.commodity === 'Maize (white)' && c.location === 'Nairobi');
    const coffee = comms.find(c => c.commodity === 'Coffee AA');
    const mandera = comms.find(c => c.location === 'Mandera');
    const nairobi = comms.find(c => c.location === 'Nairobi' && c.commodity === 'Maize (white)');
    const spread = mandera && nairobi
      ? ((mandera.price_kes - nairobi.price_kes) / nairobi.price_kes * 100).toFixed(0)
      : '42';

    return `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-lbl">USD / KES</div>
        <div class="stat-val">${(fx.USD_KES || 129.40).toFixed(2)}</div>
        <div class="stat-sub">${fx.source?.includes('live') ? '🟢 Live' : '🟡 Cached'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Nairobi Maize</div>
        <div class="stat-val">KES ${maize?.price_kes || '66'}</div>
        <div class="stat-sub trend-up">▲ Above 5yr avg</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Coffee AA</div>
        <div class="stat-val">KES ${coffee?.price_kes || '637'}</div>
        <div class="stat-sub trend-up">▲ Season high</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Mandera Spread</div>
        <div class="stat-val trend-red">+${spread}%</div>
        <div class="stat-sub trend-red">vs Nairobi maize</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Active Alerts</div>
        <div class="stat-val trend-red">${alerts.length}</div>
        <div class="stat-sub">${alerts.length} exploitation risk</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Last Update</div>
        <div class="stat-val" style="font-size:13px" id="lastUpdateStat">--</div>
        <div class="stat-sub" id="dataSourceStat">--</div>
      </div>
    </div>`;
  }

  function _commodityPanel(comms) {
    const rows = comms.map(c => `
      <tr>
        <td class="td-commodity">${c.commodity}</td>
        <td class="td-location">${c.location}</td>
        <td class="td-price">KES ${c.price_kes}</td>
        <td class="td-usd">$${(c.price_usd || (c.price_kes / 129.4)).toFixed(3)}</td>
        <td class="td-trend ${c.trend === 'up' ? 'trend-up' : c.trend === 'down' ? 'trend-red' : ''}">
          ${c.trend === 'up' ? '▲' : c.trend === 'down' ? '▼' : '—'}
        </td>
        <td><span class="action-pill action-${c.action}">${(c.action || 'hold').toUpperCase()}</span></td>
        <td class="td-source">${c.source || '—'}</td>
      </tr>`).join('');

    const stale = comms.some(c => !c.fetched_at);
    return `
    <div class="panel mb">
      <div class="panel-head">
        <span class="panel-title">Commodity Prices</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${stale ? '<span class="badge badge-warn">⚠ STATIC DATA</span>' : '<span class="badge badge-live">LIVE</span>'}
        </div>
      </div>
      <div class="table-wrap">
        <table class="ptable">
          <thead><tr>
            <th>Commodity</th><th>Location</th><th>KES/kg</th><th>USD/kg</th>
            <th>Trend</th><th>Action</th><th>Source</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }

  function _arbPanel(arb) {
    if (!arb.length) return '<div class="panel mb"><div class="panel-head"><span class="panel-title">Arbitrage</span></div><div class="empty-state">No significant spreads detected</div></div>';

    const rows = arb.map(a => `
      <div class="arb-row">
        <div>
          <div class="arb-name">${a.commodity}</div>
          <div class="arb-route">Buy ${a.buy_loc} @ KES ${a.buy_price} → Sell ${a.sell_loc} @ KES ${a.sell_price}</div>
          <div class="arb-route">Est. net after transport: KES ${a.net_spread}/kg</div>
        </div>
        <div style="text-align:right">
          <div class="arb-spread trend-up">KES ${a.gross_spread}/kg</div>
          <div class="arb-spread" style="font-size:11px">+${a.spread_pct}%</div>
        </div>
        <span class="arb-rating arb-${a.rating}">${a.rating.toUpperCase()}</span>
      </div>`).join('');

    return `
    <div class="panel">
      <div class="panel-head">
        <span class="panel-title">Arbitrage Opportunities</span>
        <span class="badge badge-alert">${arb.filter(a=>a.rating==='hot').length} HOT</span>
      </div>
      ${rows}
    </div>`;
  }

  function _alertsPanel(alerts) {
    if (!alerts.length) {
      return `
      <div class="panel mb">
        <div class="panel-head"><span class="panel-title">Price Alerts</span><span class="badge badge-live">ALL CLEAR</span></div>
        <div class="empty-state">No exploitation alerts</div>
      </div>`;
    }

    const items = alerts.map(a => `
      <div class="alert-item crit">
        <div class="alert-header">
          <span><span class="alert-tag tag-crit">EXPLOIT</span>${a.commodity} — ${a.location}</span>
        </div>
        <div class="alert-desc">
          KES ${a.price}/kg is ${a.gap_pct}% below benchmark KES ${a.benchmark}/kg.
          Report to cooperative if offered below KES ${Math.floor(a.benchmark * CONFIG.EXPLOIT_THRESH)}.
        </div>
      </div>`).join('');

    return `
    <div class="panel mb">
      <div class="panel-head">
        <span class="panel-title">Price Alerts</span>
        <span class="badge badge-alert">${alerts.length} ALERT</span>
      </div>
      ${items}
    </div>`;
  }

  function _forexMiniPanel(fx) {
    const pairs = [
      { sym:'USD/KES', val: fx.USD_KES },
      { sym:'EUR/KES', val: fx.EUR_KES },
      { sym:'GBP/KES', val: fx.GBP_KES },
      { sym:'USD/UGX', val: fx.USD_UGX },
      { sym:'USD/TZS', val: fx.USD_TZS },
      { sym:'USD/SOS', val: fx.USD_SOS },
    ];
    const rows = pairs.map(p => `
      <div class="fx-mini-row">
        <span class="fx-sym">${p.sym}</span>
        <span class="fx-rate">${p.val ? Number(p.val).toLocaleString(undefined,{maximumFractionDigits:2}) : '—'}</span>
      </div>`).join('');

    return `
    <div class="panel mb">
      <div class="panel-head">
        <span class="panel-title">Forex — EA Currencies</span>
        ${Auth.isPro() ? '<span class="badge badge-live">LIVE</span>' : '<span class="badge badge-pro">PRO</span>'}
      </div>
      ${Auth.isPro() ? rows : `<div class="lock-mini"><span>🔒</span><button class="lock-upgrade" onclick="App.showPage('plans')">Upgrade to Pro</button></div>`}
    </div>`;
  }

  function _heatmapPanel(comms) {
    const regions = [
      {name:'Nairobi',  val:2},{name:'Mombasa',  val:1},{name:'Kisumu',   val:1},
      {name:'Nakuru',   val:1},{name:'Eldoret',  val:0},{name:'Garissa',  val:4},
      {name:'Wajir',    val:5},{name:'Mandera',  val:5},{name:'Isiolo',   val:3},
      {name:'Marsabit', val:4},{name:'Moyale',   val:4},{name:'Malindi',  val:2},
      {name:'Machakos', val:2},{name:'Thika',    val:1},{name:'Nyeri',    val:1},
      {name:'Meru',     val:2},{name:'Kericho',  val:0},{name:'Bomet',    val:0},
    ];
    const colors = ['#1a4d1a','#2d7a2d','#8b7300','#ba7517','#d85a30','#c23030'];
    const cells  = regions.map(r => `
      <div class="heatmap-cell" title="${r.name}" style="background:${colors[Math.min(r.val,5)]}">
        ${r.name.slice(0,3).toUpperCase()}
      </div>`).join('');

    return `
    <div class="panel">
      <div class="panel-head"><span class="panel-title">Regional Heatmap</span><span style="font-size:10px;color:var(--text3)">price vs avg</span></div>
      <div class="heatmap-grid">${cells}</div>
      <div class="heatmap-legend">
        <span style="background:#1a4d1a"></span>Low
        <span style="background:#8b7300;margin-left:8px"></span>Avg
        <span style="background:#c23030;margin-left:8px"></span>High
      </div>
    </div>`;
  }

  function _bindTicker(fx, comms) {
    const parts = [
      `USD/KES ${(fx.USD_KES||129.4).toFixed(2)}`,
      `EUR/KES ${(fx.EUR_KES||140.2).toFixed(2)}`,
      ...comms.slice(0,6).map(c => `${c.commodity.split(' ')[0].toUpperCase()}(${c.location.split(' ')[0]}) KES${c.price_kes}`)
    ].join(' · ');
    const el = document.getElementById('tickerTrack');
    if (el) el.textContent = parts + ' · ' + parts;
  }

  return { render };
})();
