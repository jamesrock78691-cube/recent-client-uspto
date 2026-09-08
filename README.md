# Trademark Monitor (USPTO) — pro se outreach

Pulls **official Trademark Daily XML** (product `TRTDXFAP`) and emails pro se applicants.

**Not patents. Attorney filings are skipped.**

## Data source (important)

TSDR website is **lookup-by-serial**, not a feed of “who filed today.”

We use the **Open Data Portal bulk file**:

```
GET https://api.uspto.gov/api/v1/datasets/products/files/TRTDXFAP/apcYYMMDD.zip
Header: x-api-key: YOUR_ODP_KEY
```

Files publish daily (~01:00 Eastern). Example: `apc260908.zip`.

Get a free key: [account.uspto.gov](https://account.uspto.gov) → API / Open Data Portal.

## Env vars

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Postgres |
| `RESEND_API_KEY` | yes | Send mail |
| `USPTO_ODP_API_KEY` | yes | Download daily trademark XML |
| `USPTO_TSDR_API_KEY` | optional | Single-serial enrichment |
| `EMAIL_FROM` | recommended | Verified Resend from |
| `CRON_SECRET` | optional | Protect `/api/sync` |

## Flow

1. Cron / manual sync downloads `apcYYMMDD.zip` for last N days
2. Parses case-files → serial, mark, owner, attorney, goods/services
3. **Skip if attorney present**
4. Email only if an email is on the record (mostly pro se)
5. Optional Google Sheets

## Deploy Vercel

Import repo → set env → deploy → set default template in UI → Run Sync.

Hobby cron is limited; Pro needed for frequent schedules.

## Local core file

If `src/lib/uspto.ts` on GitHub still shows patent code, replace it with the Trademark Daily XML version from your latest workspace copy (or ask to re-push).
