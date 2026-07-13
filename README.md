# GameLead Radar

GameLead Radar is a local Next.js + TypeScript + SQLite/Prisma web app for finding QROAD sales opportunities from game industry news. It focuses on Japan and North America; Steam and mobile games; and pre-launch or new-launch signals such as CBT, OBT, pre-registration, Steam wishlist, soft launch, regional launch, platform expansion, and relaunch.

## Safety Boundaries

- Automatic email sending is disabled.
- LinkedIn automation is disabled.
- No login bypass, CAPTCHA bypass, or block circumvention is implemented.
- API keys are read only from server-side environment variables.
- Crawling is intended for RSS and public webpages that permit access.

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create a local environment file. Keep `.env` private and never commit it.

```bash
copy .env.example .env
```

3. Generate Prisma Client and create the SQLite database.

```bash
npm run db:migrate
npm run db:seed
```

4. Start the app.

```bash
npm run dev
```

Open http://localhost:3000.

## Environment Variables

Copy `.env.example` to `.env` and fill in only the providers you want to use locally.

- `DATABASE_URL` points Prisma to the local SQLite database.
- `OPENAI_API_KEY` enables OpenAI-backed article analysis.
- Search provider keys such as `SERPER_API_KEY`, `SERPAPI_API_KEY`, `GOOGLE_SEARCH_API_KEY`, or `BING_SEARCH_API_KEY` improve lead website enrichment.
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and related SMTP fields enable manual email sending from selected leads.

Do not put real secrets in `.env.example`, README files, docs, screenshots, or committed test fixtures.

## Validation

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Main Workflows

- Add or manage sources in `/sources`.
- Verify sources, discover RSS feeds, crawl one source, or activate/deactivate sources in `/sources`.
- Run a manual crawl from the dashboard.
- Analyze pending articles from the dashboard.
- Review qualified leads in `/leads`.
- Open a lead detail page to generate email and LinkedIn drafts for A/B opportunities.
- Download CSV or Excel-readable exports from the export menu on `/leads`.
- Run a local DB backup from `/settings`.

## GitHub Readiness

Before opening a pull request or pushing to `main`, run:

```bash
npm run lint
npm run typecheck
npm run test
```

The GitHub Actions workflow in `.github/workflows/ci.yml` runs the same checks with `npm ci`.

## Database Summary

The Prisma schema includes `Source`, `Article`, `Company`, `Game`, `Opportunity`, `OutreachMessage`, `CrawlRun`, and `SystemLog`. `Opportunity` connects a source article, company, and game; stores the QROAD package recommendations as JSON text; and tracks score, grade, status, reasoning, evidence, uncertainty, and next action.

## Known Limitations

- AI analysis currently uses deterministic local heuristics so the app works without an OpenAI key. The strict JSON schema is implemented and ready for an OpenAI-backed analyzer.
- When `OPENAI_API_KEY` is configured, article analysis uses OpenAI first on full fetched article content and falls back to deterministic heuristics if the API call or JSON validation fails.
- Website crawling is intentionally simple and should be replaced with source-specific collectors where terms permit.
- Source seed URLs are examples and should be verified before production use.
- YouTube, App Store, Google Play, and Steam Upcoming support are source-type aware, but they should be treated as supporting signals until their selectors/feed URLs are manually verified.

## Source Utilities

```bash
npm run sources:seed
npm run sources:check
npm run sources:check:active
npm run sources:discover-rss
npm run crawl:once
npm run crawl:source -- "Steam All News RSS"
npm run analyze:pending
```

`OPENAI_ANALYZE_BATCH_SIZE` controls how many articles the dashboard analyzes per click when OpenAI is enabled. The default is `10` to avoid accidentally processing a large backlog with API calls.

## Rollback

- Code rollback: use Git commits once changes are committed.
- DB rollback: restore a SQLite file from `backups/db/`.
- Configuration rollback: update `.env` from `.env.example`; never commit `.env`.
