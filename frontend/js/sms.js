// sms.js — SMS alert generator page

const SMS = (() => {

  const templates = {
    maize: {
      en: (p) => `SOKODATA ${_today()} | MAIZE\nNairobi: KES ${_price(p,'Maize (white)','Nairobi')}/kg\nGarissa: KES ${_price(p,'Maize (white)','Garissa')}/kg\nMandera: KES ${_price(p,'Maize (white)','Mandera')}/kg\nACTION: Sell surplus to Garissa/Mandera\nInfo: sokodata.co.ke`,
      sw: (p) => `SOKODATA ${_today()} | MAHINDI\nNairobi: KES ${_price(p,'Maize (white)','Nairobi')}/kg\nGarissa: KES ${_price(p,'Maize (white)','Garissa')}/kg\nMandera: KES ${_price(p,'Maize (white)','Mandera')}/kg\nHATUA: Uza ziada Garissa/Mandera\nMaelezo: sokodata.co.ke`,
    },
    coffee: {
      en: (p) => `SOKODATA ${_today()} | COFFEE\nNCE avg: KES ${_price(p,'Coffee AA','NCE Nairobi')}/kg\nSeason HIGH - sell now\n⚠ If offered below KES 510 = exploitation risk\nReport: sokodata.co.ke`,
      sw: (p) => `SOKODATA ${_today()} | KAHAWA\nNCE wastani: KES ${_price(p,'Coffee AA','NCE Nairobi')}/kg\nKILELE - uza sasa\n⚠ Chini ya KES 510 = unyonyaji\nRipoti: sokodata.co.ke`,
    },
    forex: {
      en: (fx) => `SOKODATA ${_today()} | FOREX\nUSD/KES: ${(fx?.USD_KES||129.4).toFixed(2)}\nEUR/KES: ${(fx?.EUR_KES||140.2).toFixed(2)}\nUSD/SOS: ${(fx?.USD_SOS||571).toFixed(0)}\nUSD/UGX: ${(fx?.USD_UGX||3710).toFixed(0)}\nRates: sokodata.co.ke`,
      sw: (fx) => `SOKODATA ${_today()} | FEDHA\nUSD/KES: ${(fx?.USD_KES||129.4).toFixed(2)}\nEUR/KES: ${(fx?.EUR_KES||140.2).toFixed(2)}\nUSD/SOS: ${(fx?.USD_SOS||571).toFixed(0)}\nViwango: sokodata.co.ke`,
    },
  };

  function _today() {
    return new Date().toLocaleDateString('en-KE',{day:'2-digit',month:'2-digit',year:'2-digit'});
  }

  function _price(comms, commodity, location) {
    const found = comms.find(c => c.commodity === commodity && c.location === location);
    return found?.price_kes || '—';
  }

  function render(container) {
    container.innerHTML = `
    <div class="grid-half">
      <div class="panel">
        <div class="panel-head"><span class="panel-title">SMS Generator</span></div>
        <div style="padding:20px">
          <div class="auth-field" style="margin-bottom:12px">
            <label>Commodity</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap" id="smsToggles">
              <button class="sms-btn active" data-key="maize">Maize</button>
              <button class="sms-btn" data-key="coffee">Coffee</button>
              <button class="sms-btn" data-key="forex">Forex</button>
            </div>
          </div>
          <div class="auth-field" style="margin-bottom:16px">
            <label>Language</label>
            <div style="display:flex;gap:6px">
              <button class="sms-btn active" data-lang="en">English</button>
              <button class="sms-btn" data-lang="sw">Kiswahili</button>
            </div>
          </div>
          <div class="sms-output" id="smsOutput">Select options above</div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            <button class="sms-btn" id="smsCopy">Copy SMS</button>
            <button class="sms-btn" id="smsRegen">Regenerate</button>
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:8px;font-family:monospace" id="smsCount">0 chars · 0 units</div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">Scheduled Broadcasts</span>
          <span class="badge badge-pro">PRO</span>
        </div>
        ${Auth.isPro() ? _scheduledPanel() : `<div class="lock-mini"><span>🔒</span><button class="lock-upgrade" onclick="App.showPage('plans')">Upgrade to Pro</button></div>`}
      </div>
    </div>`;

    _bindSMS();
  }

  function _scheduledPanel() {
    return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:10px">
      <div class="sched-item active">
        <div style="font-weight:600;font-size:12px">Daily 6:00 AM — Maize + Beans</div>
        <div style="font-size:11px;color:var(--text2)">All enrolled cooperatives · Kiswahili</div>
      </div>
      <div class="sched-item">
        <div style="font-weight:600;font-size:12px">Alert trigger — below 80% benchmark</div>
        <div style="font-size:11px;color:var(--text2)">Instant · All subscribers</div>
      </div>
    </div>`;
  }

  let activeKey  = 'maize';
  let activeLang = 'en';

  function _generate() {
    const cache  = Prices.getCache();
    const comms  = cache.commodities || [];
    const fx     = cache.forex || {};
    const tmpl   = templates[activeKey];
    if (!tmpl) return 'Template not found';
    const arg    = activeKey === 'forex' ? fx : comms;
    return tmpl[activeLang](arg);
  }

  function _update() {
    const out = document.getElementById('smsOutput');
    const cnt = document.getElementById('smsCount');
    if (!out) return;
    const txt = _generate();
    out.textContent = txt;
    const chars = txt.length;
    cnt.textContent = `${chars} chars · ${Math.ceil(chars/160)} SMS unit${chars>160?'s':''}`;
  }

  function _bindSMS() {
    document.getElementById('smsToggles')?.querySelectorAll('.sms-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#smsToggles .sms-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeKey = btn.dataset.key;
        _update();
      });
    });

    document.querySelectorAll('[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-lang]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLang = btn.dataset.lang;
        _update();
      });
    });

    document.getElementById('smsCopy')?.addEventListener('click', () => {
      const txt = document.getElementById('smsOutput')?.textContent || '';
      navigator.clipboard.writeText(txt).then(() => {
        const btn = document.getElementById('smsCopy');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy SMS', 1500); }
      });
    });

    document.getElementById('smsRegen')?.addEventListener('click', _update);
    _update();
  }

  return { render };
})();
