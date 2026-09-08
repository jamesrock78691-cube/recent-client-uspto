# Trademark Monitor (USPTO) — pro se outreach

Automatically monitors **new USPTO trademark filings** and emails applicants using your templates.

**Patents are not supported.** Attorney-filed trademarks are **always skipped**.

## How it works

1. Every ~10 minutes (Vercel Cron) the app scans recent trademark serial numbers via **TSDR**
2. New filings are saved to Postgres
3. If the filing has **no attorney** and an **email** is available → send your default template via **Resend**
4. Optionally log rows to Google Sheets

> USPTO does not provide a public webhook for “someone just filed.” Near-real-time means frequent polling (cron).

## Required env vars (Vercel)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `RESEND_API_KEY` | Send emails ([resend.com](https://resend.com)) |
| `USPTO_TSDR_API_KEY` | TSDR key from [account.uspto.gov/api-manager](https://account.uspto.gov/api-manager/) |
| `TRADEMARK_START_SERIAL` | Bootstrap serial to start scanning (e.g. recent live serial from TSDR) |
| `EMAIL_FROM` | Verified Resend from-address |
| `EMAIL_FROM_NAME` | Display name (optional) |
| `CRON_SECRET` | Optional bearer token for `/api/sync` |

Optional Google Sheets: configure in the UI / `google_sync_config` table.

## Deploy on Vercel

1. Import this GitHub repo in Vercel
2. Add env vars above
3. Deploy (Hobby cron minimum interval is 1/day on free; Pro allows `*/10`)
4. Open the app → set **default email template**
5. Trigger once: `POST /api/sync` with `{ "daysBack": 2, "limit": 40 }`

## Local

```bash
npm install
cp .env.example .env.local   # fill keys
npx drizzle-kit push         # if using drizzle migrate
npm run dev
```

## Rules baked in

- **Trademarks only** (TSDR serial scan — no patent APIs)
- **Skip if `hasAttorney`**
- **Skip if no email** on the record
- Template variables: `{{serialNumber}}`, `{{markText}}`, `{{ownerName}}`, `{{filingDate}}`, `{{status}}`, `{{goodsAndServices}}`, …

## Notes on emails

Many trademarks list a **correspondent** email that is the attorney. Pro se filers are the main targets this tool will email. Mass commercial email must follow CAN-SPAM and applicable solicitation rules.
