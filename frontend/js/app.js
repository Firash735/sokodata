// app.js — main controller: routing, page init, clock, event bindings
// This runs last — all other modules must be loaded before this

const App = (() => {

  let _currentPage = 'dashboard';

  // ── Pages registry ─────────────────────────────────────────
  const PAGES = {
    dashboard:   (el) => Dashboard.render(el),
    forex:       (el) => Forex.render(el),
    commodities: (el) => _renderCommoditiesFull(el),
    livestock:   (el) => _renderLivestock(el),
    arbitrage:   (el) => _renderArbitrage(el),
    sms:         (el) => SMS.render(el),
    plans:       (el) => _renderPlans(el),
  };

  // ── Boot ───────────────────────────────────────────────────

  async function init() {
    _startClock();
    _bindNav();
    _bindAuth();

    // Show skeleton immediately
    document.getElementById('appMain').innerHTML = '<div class="loading-state">Loading market data…</div>';

    // Init auth (restores session silently)
    await Auth.init();

    // Fetch all prices in parallel
    await Prices.init();

    // Render default page
    showPage('dashboard');

    // Refresh prices every 6 minutes without page reload
    setInterval(async () => {
      await Prices.fetchForex();
      await Prices.fetchCommodities();
      renderCurrentPage(); // re-render in place
    }, 6 * 60 * 1000);
  }

  // ── Page routing ───────────────────────────────────────────

  function showPage(pageId, tabEl) {
    if (!PAGES[pageId]) return;
    _currentPage = pageId;

    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    if (tabEl) {
      tabEl.classList.add('active');
    } else {
      document.querySelector(`.nav-tab[data-page="${pageId}"]`)?.classList.add('active');
    }

    // Render into main container
    const main = document.getElementById('appMain');
    main.innerHTML = `<div class="page" id="page-${pageId}"></div>`;
    PAGES[pageId](document.getElementById(`page-${pageId}`));
  }

  function renderCurrentPage() {
    showPage(_currentPage);
  }

  // ── Nav binding ───────────────────────────────────────────

  function _bindNav() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => showPage(tab.dataset.page, tab));
    });
    document.getElementById('btnUpgrade')?.addEventListener('click', () => showPage('plans'));
    document.getElementById('alertDismiss')?.addEventListener('click', () => {
      document.getElementById('alertBanner').style.display = 'none';
    });
  }

  function _bindAuth() {
    document.getElementById('btnLogin')?.addEventListener('click', () => {
      if (Auth.isLoggedIn()) {
        Auth.logout();
      } else {
        Auth.showModal('login');
      }
    });
    document.getElementById('modalClose')?.addEventListener('click', Auth.hideModal);
    document.getElementById('tabLogin')?.addEventListener('click', () => Auth.renderAuthForm('login'));
    document.getElementById('tabSignup')?.addEventListener('click', () => Auth.renderAuthForm('signup'));
  }

  // ── Clock ─────────────────────────────────────────────────

  function _startClock() {
    const el = document.getElementById('navTime');
    const tick = () => {
      if (el) {
        const now = new Date();
        // East Africa Time = UTC+3
        const eat = new Date(now.getTime() + 3 * 3600000);
        el.textContent = eat.toISOString().slice(11, 19) + ' EAT';
      }
    };
    tick();
    setInterval(tick, 1000);
  }

  // ── Inline page renderers ─────────────────────────────────

  function _renderCommoditiesFull(container) {
    const comms = Prices.getCached('commodities') || [];
    const rows  = comms.map(c => `
      <tr>
        <td class="td-commodity">${c.commodity}</td>
        <td class="td-location">${c.location}</td>
        <td class="td-price">KES ${c.price_kes}</td>
        <td>$${(c.price_usd || (c.price_kes/129.4)).toFixed(3)}</td>
        <td class="td-trend ${c.trend==='up'?'trend-up':c.trend==='down'?'trend-red':''}">${c.trend==='up'?'▲':c.trend==='down'?'▼':'—'}</td>
        <td><span class="action-pill action-${c.action||'hold'}">${(c.action||'hold').toUpperCase()}</span></td>
        <td class="td-source">${c.source||'—'}</td>
        <td class="td-source">${c.fetched_at ? Prices.formatAge(c.fetched_at) : '⚠ static'}</td>
      </tr>`).join('');

    container.innerHTML = `
    <div class="panel">
      <div class="panel-head"><span class="panel-title">Full Commodity Matrix</span><span class="badge badge-live">${new Date().toLocaleDateString('en-KE')}</span></div>
      <div class="table-wrap">
        <table class="ptable">
          <thead><tr><th>Commodity</th><th>Location</th><th>KES/kg</th><th>USD/kg</th><th>Trend</th><th>Action</th><th>Source</th><th>Age</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }

  function _renderLivestock(container) {
    const ls   = Prices.getCached('livestock') || [];
    const rows = ls.map(a => `
      <tr>
        <td class="td-commodity">${a.animal}</td>
        <td class="td-location">${a.location}</td>
        <td class="td-price">${a.price_kes_kg}</td>
        <td class="td-trend ${a.trend==='up'?'trend-up':a.trend==='down'?'trend-red':''}">${a.trend==='up'?'▲ Good':a.trend==='down'?'▼ Weak':'— Stable'}</td>
        <td><span class="action-pill action-${a.action||'hold'}">${(a.action||'hold').toUpperCase()}</span></td>
        <td class="td-source">${a.source||'—'}</td>
      </tr>`).join('');

    container.innerHTML = `
    <div class="panel">
      <div class="panel-head"><span class="panel-title">Livestock Prices — Kenya &amp; Somalia</span><span class="badge badge-live">FEWS NET</span></div>
      <div class="table-wrap">
        <table class="ptable">
          <thead><tr><th>Animal</th><th>Location</th><th>Price</th><th>Trend</th><th>Signal</th><th>Source</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }

  function _renderArbitrage(container) {
    const comms = Prices.getCached('commodities') || [];
    const arb   = Prices.calcArbitrage(comms);

    if (!arb.length) {
      container.innerHTML = '<div class="panel"><div class="empty-state">No significant arbitrage spreads detected with current prices.</div></div>';
      return;
    }

    const rows = arb.map(a => `
      <div class="arb-row">
        <div style="flex:1">
          <div class="arb-name">${a.commodity}</div>
          <div class="arb-route">Buy: ${a.buy_loc} @ KES ${a.buy_price}/kg</div>
          <div class="arb-route">Sell: ${a.sell_loc} @ KES ${a.sell_price}/kg</div>
          <div class="arb-route" style="color:var(--green)">Est. net after transport: KES ${a.net_spread}/kg</div>
        </div>
        <div style="text-align:right;margin-right:12px">
          <div class="arb-spread trend-up">KES ${a.gross_spread}/kg</div>
          <div style="font-size:11px;color:var(--text2)">+${a.spread_pct}% gross</div>
        </div>
        <span class="arb-rating arb-${a.rating}">${a.rating.toUpperCase()}</span>
      </div>`).join('');

    container.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <span class="panel-title">Arbitrage Opportunities</span>
        <span class="badge badge-alert">${arb.filter(a=>a.rating==='hot').length} HOT · ${arb.length} total</span>
      </div>
      ${rows}
      <div class="panel-foot">Gross spreads only. Deduct ~35% for transport, levies, broker fees. Verify before trading.</div>
    </div>`;
  }

  function _renderPlans(container) {
    const currentPlan = Auth.getPlan();
    container.innerHTML = `
    <div class="plans-wrap">
      <div class="plans-hero">
        <h1>Market intelligence, priced for impact</h1>
        <p>Real prices. Live forex. Exploitation alerts. From KES 0 to enterprise.</p>
      </div>
      <div class="plans-grid">
        ${_planCard('free','Free','0','/mo','No card needed',[
          'Nairobi daily prices','Maize, beans, tea','7-day trend',
          '1 SMS alert/week'
        ],[
          'Live forex rates','Arbitrage alerts','Somalia data','API access'
        ], currentPlan==='free')}
        ${_planCard('pro','Pro','1,499','/mo','or KES 14,990/year (save 17%)',[
          'All Free features','Live forex — 8 EA currencies',
          'Full commodity matrix','Somalia GSMSG data',
          'Arbitrage alerts','Unlimited SMS broadcasts',
          'Exploitation <80% alerts','CBOT futures signals'
        ],[
          'API access','White-label SMS'
        ], currentPlan==='pro', true)}
        ${_planCard('enterprise','Enterprise','Custom','','Annual contract',[
          'Everything in Pro','Full REST API access',
          'Cross-border Somalia corridors','White-label SMS',
          'Custom alert thresholds','Dedicated analyst','SLA uptime'
        ],[], currentPlan==='enterprise')}
      </div>
      <div class="plans-footer">
        M-Pesa · Card · Bank Transfer · Airtel Money
      </div>
    </div>`;
  }

  function _planCard(id, name, price, period, sub, included, locked, isCurrent, featured=false) {
    const incItems = included.map(i => `<li>${i}</li>`).join('');
    const lockItems = locked.map(i => `<li class="locked">${i}</li>`).join('');
    let btn;
    if (isCurrent) {
      btn = `<button class="plan-btn plan-btn-outline" disabled>Current Plan</button>`;
    } else if (id === 'enterprise') {
      btn = `<button class="plan-btn plan-btn-enterprise" onclick="window.location='mailto:sales@sokodata.co.ke'">Contact Sales →</button>`;
    } else {
      btn = `<button class="plan-btn plan-btn-primary" onclick="App.startCheckout('${id}')">Get ${name} →</button>`;
    }

    return `
    <div class="plan-card${featured?' featured':''}">
      ${featured ? '<div class="plan-popular">MOST POPULAR</div>' : ''}
      <div class="plan-name">${name}</div>
      <div class="plan-price">KES ${price}<span>${period}</span></div>
      <div class="plan-period">${sub}</div>
      <ul class="plan-features">${incItems}${lockItems}</ul>
      ${btn}
    </div>`;
  }

  async function startCheckout(planId) {
    if (!Auth.isLoggedIn()) {
      Auth.showModal('signup');
      return;
    }
    // TODO: integrate Daraja M-Pesa STK Push or Flutterwave
    // For now, show instructions
    alert(`To activate ${planId.toUpperCase()} plan:\n\n1. M-Pesa → Till/Paybill: [YOUR NUMBER]\n2. Amount: KES ${planId==='pro'?CONFIG.PLAN_PRO_MONTHLY:CONFIG.PLAN_ENTERPRISE||0}\n3. Reference: ${Auth.getUser()?.email}\n4. Screenshot → WhatsApp: [YOUR NUMBER]\n\nPlan activated within 1 hour.`);
  }

  return { init, showPage, renderCurrentPage, startCheckout };
})();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
