# SokoData — East Africa Market Intelligence Platform

Live commodity prices, forex rates, arbitrage alerts, and exploitation detection for Kenya & Somalia.

---

## Project Structure

```
sokodata/
├── frontend/               ← Everything Vercel deploys (your website)
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── config.js       ← API config (no secrets here)
│       ├── supabase.js     ← DB client
│       ├── auth.js         ← Login / signup / plan gating
│       ├── prices.js       ← Fetch & cache all live prices
│       ├── dashboard.js    ← Main dashboard page
│       ├── forex.js        ← Forex page + calculator
│       ├── sms.js          ← SMS generator
│       └── app.js          ← Router + controller (loads last)
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql   ← Run this ONCE in Supabase SQL Editor
│   └── functions/
│       └── fetch-prices/index.ts    ← Auto price fetcher (runs every 6h)
└── .github/
    └── workflows/deploy.yml         ← CI/CD pipeline
```

---

## Setup (One-Time)

### Step 1 — Clone and open in VS Code
```bash
git clone https://github.com/YOUR_USERNAME/sokodata.git
cd sokodata
code .
```

### Step 2 — Create Supabase project
1. Go to [supabase.com](https://supabase.com) → New project
2. Name it `sokodata`, choose region: `ap-southeast-1` (Singapore, closest to EA)
3. Copy **Project URL** and **anon/public key** from Settings → API

### Step 3 — Create `.env.local` (never commit this file)
```bash
# frontend/.env.local  ← add to .gitignore
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON=YOUR_ANON_KEY
COMMODITIES_API_KEY=YOUR_COMMODITIES_API_KEY
```

### Step 4 — Update config.js
Open `frontend/js/config.js` and replace the placeholder URLs with your real Supabase URL and anon key. (**anon key is safe to put in frontend** — Row Level Security protects the data.)

### Step 5 — Run SQL migration
1. Go to Supabase → SQL Editor
2. Open `supabase/migrations/001_initial_schema.sql`
3. Copy entire file → paste into SQL Editor → Run

### Step 6 — Deploy Edge Function
```bash
# Install Supabase CLI first: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets (server-side only — never goes to frontend)
supabase secrets set COMMODITIES_API_KEY=your_key_here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Deploy function
supabase functions deploy fetch-prices

# Schedule it to run every 6 hours
# Go to Supabase → Edge Functions → fetch-prices → Schedule
# Cron: 0 */6 * * *
```

### Step 7 — Deploy to Vercel
```bash
npm i -g vercel
cd frontend
vercel --prod
# Follow prompts → link to sokodata.co.ke
```

### Step 8 — Add GitHub Secrets for CI/CD
Go to GitHub repo → Settings → Secrets → Actions → add:
- `VERCEL_TOKEN` — from vercel.com → Settings → Tokens
- `VERCEL_ORG_ID` — from `.vercel/project.json` after `vercel` init
- `VERCEL_PROJECT_ID` — from `.vercel/project.json`

---

## Development Workflow (daily use)

```bash
# Start new feature
git checkout -b feature/mpesa-payments

# Make changes in VS Code
# Test locally: open frontend/index.html in browser
# Or use live server: VS Code extension "Live Server" → right click index.html → Open with Live Server

# Push to GitHub (triggers preview deploy automatically)
git add .
git commit -m "feat: add M-Pesa STK push checkout"
git push origin feature/mpesa-payments

# When ready → create Pull Request on GitHub
# Review preview URL in PR comment
# Merge to main → automatically deploys to sokodata.co.ke
```

## Key Rules
1. **Never push directly to main** — always use feature branches
2. **Never put real API keys in any .js file** — use config.js with placeholder + Vercel env vars
3. **All DB changes via migration SQL files** — never edit tables manually in Supabase UI (except emergencies)
4. **Test on staging URL before merging** — the GitHub Action posts the preview URL in your PR

---

## Adding a new subscriber manually (before M-Pesa integration)
1. Receive M-Pesa payment
2. Go to Supabase → Table Editor → `users` → find by email
3. Set `plan = 'pro'`, `plan_expires_at = now() + interval '30 days'`
4. User gets Pro access immediately on next page refresh (session auto-updates)

---

## Costs
| Service | Cost |
|---------|------|
| Vercel hosting | Free |
| Supabase (DB + Auth + Edge Functions) | Free |
| ExchangeRate-API (forex) | Free |
| Commodities-API (live CORN/COFFEE/TEA) | $9/mo |
| Africa's Talking SMS | KES 0.80/SMS |
| sokodata.co.ke domain | KES ~100/mo |
| **Total** | **~KES 1,345/mo** |

Break-even: **1 Pro subscriber**
