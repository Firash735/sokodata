# MuftahX + SokoData — System Architecture

## Overview
Two brands. One ecosystem. Zero shared branding on the frontend.

- **MuftahX** — B2B export marketplace. Kenyan exporters meet global buyers.
- **SokoData** — Intelligence layer. Live prices, forex, exploitation detection.

SokoData feeds MuftahX invisibly. Every MuftahX listing shows a SokoData
benchmark automatically. The exporter sees fair price. The buyer cannot lowball.

---

## File Structure

```
muftahx/
├── frontend/
│   ├── pages/
│   │   ├── index.html          ← MuftahX landing (public)
│   │   ├── join.html           ← Exporter onboarding MVP (shareable)
│   │   ├── diaspora.html       ← Kenyan diaspora connection
│   │   └── listings.html       ← Browse all verified listings
│   ├── css/
│   │   ├── tokens.css          ← Design variables — ONE source of truth
│   │   ├── components.css      ← Cards, badges, buttons, modals
│   │   └── pages.css           ← Page-specific overrides only
│   └── js/
│       ├── env.js              ← API keys (gitignored — NEVER committed)
│       ├── config.js           ← Reads from env.js safely
│       ├── auth.js             ← Supabase auth
│       ├── listings.js         ← Load, filter, render listings
│       └── ui.js               ← Cursor, modals, scroll, reveal
├── tests/
│   ├── functional.test.js
│   └── security.test.js
├── docs/
│   ├── ARCHITECTURE.md         ← This file
│   ├── TRADEOFFS.md            ← Every decision explained
│   └── ONBOARDING.md           ← Manual seller listing playbook
├── supabase/
│   └── migrations/
│       ├── 001_sellers.sql
│       ├── 002_listings.sql
│       └── 003_inquiries.sql
├── .gitignore
└── README.md
```

---

## Design Token System (tokens.css)

All colors, fonts, and spacing defined ONCE. No hex values anywhere else.

```css
--kgreen:  #1b4332;  /* Deep Kenyan highland green */
--gold:    #c9952a;  /* Rift valley gold */
--navy:    #0f2044;  /* Professional buyer dashboard */
--serif:   "Cormorant Garamond", Georgia, serif;
--sans:    "Inter", system-ui, sans-serif;
--mono:    "DM Mono", monospace;
```

---

## Data Flow

SokoData Supabase → sokodata.js → MuftahX listing cards → Buyer sees fair price

---

## Security Rules (non-negotiable)

1. API keys: env.js only, gitignored, never committed
2. Database: Supabase RLS on every table
3. Documents: Signed upload URLs only
4. Scripts: HTTPS only, no eval(), no document.write()
5. Test before every deploy: node tests.js

---

## Configuration (config.js)

```js
const CONFIG = {
  supabase: { url: window.__MX__?.url || '', anon: window.__MX__?.anon || '' },
  platform: {
    name: 'MuftahX',
    email: 'trade@muftahx.com',
    free_months: 3,
    seller_price_usd: 49,
  }
}
```
