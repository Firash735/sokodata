# MuftahX Technical Tradeoffs

Every decision has a cost. Documented so future decisions are made clearly.

---

## Plain HTML/CSS/JS vs React

Chose plain HTML. Zero build step. Instant load. No npm vulnerabilities.
GitHub Pages serves it directly. Any developer can read it.
Cost: More copy-paste for repeated UI. Acceptable at this scale.
Revisit when: 10+ pages where duplication exceeds simplicity benefit.

---

## GitHub Pages vs Vercel

Chose GitHub Pages. Free forever. Auto-deploys on git push.
Zero configuration. Proven at scale.
Cost: No server-side rendering. No edge functions.
Cron handled by Supabase pg_cron instead.

---

## Manual seller verification vs automated

Chose manual. KEPHIS compliance documents require human judgment.
An automated system cannot detect a forged certificate.
Buyers trust MuftahX because a human checked every document.
Cost: 48-hour approval delay. Does not scale past ~50 new sellers/week.
Revisit when: Partner with KEPHIS for API verification.

---

## No in-house payment processing

Chose to facilitate only. Holding international B2B payments requires
a Central Bank of Kenya regulated payment license.
A startup cannot legally hold buyer funds without this.
Cost: Cannot earn per-transaction revenue.
Revisit when: Partner with NCBA or Stanbic Trade Finance for
licensed escrow. MuftahX earns a referral fee per transaction.

---

## Supabase vs Firebase

Chose Supabase (PostgreSQL). SQL is auditable. RLS is granular.
Real relational data. pg_cron for scheduled jobs.
Africa's Talking SMS via Edge Functions.
Cost: More complex than Firestore. Deno runtime for Edge Functions.
Revisit: Never. PostgreSQL is the right choice for compliance data.

---

## SokoData vs merged into MuftahX

Chose separate brands, shared data.
SokoData is East African local price intelligence.
MuftahX is international B2B. Different users, different trust signals.
A Dutch importer does not want a "local price tool."
Connection: SokoData prices appear in MuftahX listings automatically
via shared Supabase database. Invisible to users. Powerful for business.
