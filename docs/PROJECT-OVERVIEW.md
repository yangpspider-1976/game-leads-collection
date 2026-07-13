# GameLead Radar: Project Overview

## Purpose

GameLead Radar is a local-first sales-intelligence application for identifying game-industry opportunities relevant to QROAD. It collects public game news and official source updates, finds launch-related signals, and turns qualifying items into structured leads for review and outreach.

The primary market focus is Japan and North America, with particular attention to Steam and mobile games. The app is designed to surface early commercial signals such as closed/open beta tests, pre-registration, Steam wishlists and playtests, soft launches, regional or global launches, platform expansions, relaunches, and major expansions.

## How it works

- Register and manage public sources, such as RSS feeds, websites, Steam, App Store, Google Play, and YouTube.
- Crawl active sources, save new articles, and record each crawl run.
- Analyze pending articles with OpenAI structured output when configured, with deterministic local heuristics as a fallback.
- Create a qualified opportunity linked to a company and game, including its score, grade, evidence, uncertainty, next action, and recommended QROAD service packages.
- Enrich company details, review and update lead status, generate outreach drafts, export the lead list, or back up the local database.
## Main features

- Dashboard with daily and total activity metrics, crawl/analyze actions, crawl issues, and recent leads.
- Source management: add, import, export, activate/deactivate, verify, delete, crawl individually, and attempt RSS/Atom discovery.
- Article pipeline: collect, deduplicate by URL and content hash, track processing state, review, and remove articles.
- Lead qualification: recognizes target regions, developer/publisher ownership, Steam/mobile platforms, launch stages, supporting evidence, and QROAD-package fit.
- AI-assisted analysis: validates structured analysis with Zod; gracefully falls back to offline heuristics if an API key, model request, or response validation fails.
- Company enrichment: captures websites, contact pages, email addresses, phone numbers, social profiles, descriptions, provenance, confidence, and manual notes. Existing article and source URLs are used first; optional search providers can be enabled for additional discovery.
- Lead management: filter and review opportunities, inspect a detailed lead record, maintain pipeline status, and create email or LinkedIn drafts for Grade A/B leads.
- Outreach records: keeps generated drafts and email logs associated with each opportunity.
- Exports: downloads filtered opportunities as CSV or Excel-readable files.
- Operations support: application settings, crawl/analysis limits, backup creation, test data, and run/error logging.

## QROAD package matching

The qualification engine can recommend one or more of these service packages from detected article signals:

- Pre-Launch QA Package
- Store & Platform QA Package
- Global Launch Localization Package
- Launch Operation Support Package
- Pre-Registration Marketing Package
- Game Creative Production Package
- AI Community & CS Monitoring Package

Scores are converted to grades: A (80-100), B (60-79), C (40-59), and D (below 40). Included launch stages are strongest signals; early announcements and in-development items are treated as conditional, while post-launch-only coverage is penalized.

## Application areas

| Area | What it provides |
| --- | --- |
| `/` | Overview dashboard and manual operational actions |
| `/leads` | Lead list, filtering, statuses, exports, and enrichment actions |
| `/leads/[id]` | Opportunity evidence, company/game details, and outreach drafts |
| `/articles` | Collected article review and removal |
| `/sources` | Source registry, validation, RSS discovery, import/export, and crawling |
| `/email-log` | Outreach email history |
| `/settings` | Operational limits, email templates, provider tests, backups, and debugging controls |

## Technology

| Layer | Technology |
| --- | --- |
| Web application | Next.js 15 App Router, React 18, TypeScript |
| UI | Material UI, Emotion, Lucide icons, application CSS |
| Server/API | Next.js Route Handlers and Server Components |
| Database | SQLite with Prisma ORM |
| Validation | Zod |
| Collection and parsing | `rss-parser`, Cheerio, native fetch |
| AI analysis | OpenAI API structured JSON output, with local heuristic fallback |
| Enrichment | Public source/article extraction; optional Serper, SerpAPI, Google, or Bing search providers |
| Outreach | Nodemailer/SMTP and template-based draft generation |
| File generation | ExcelJS for spreadsheet-compatible exports |
| Testing and quality | Vitest, Testing Library, ESLint, TypeScript |

## Data model

The core entities are:

- `Source`: a registered collection source, its verification state, crawl settings, and parser/filter configuration.
- `Article`: fetched content, publication metadata, deduplication data, and processing/exclusion state.
- `Company`: developer or publisher details and enrichment results.
- `Game`: title, platform, genre, launch stage, and expected date.
- `Opportunity`: the qualified QROAD lead connecting one article, company, and game; it holds score, grade, evidence, package recommendations, and pipeline status.
- `OutreachMessage`: email or LinkedIn draft/history for an opportunity.
- `CrawlRun` and `SystemLog`: operational audit and diagnostic records.
- `AppSetting`: persisted application and operations settings.
## Configuration and local use

The project is intended to run locally. Copy `.env.example` to `.env`, add only the integrations you need, then initialize and start the app:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Important configuration groups include:

- `DATABASE_URL` for the SQLite database.
- `OPENAI_API_KEY`, `OPENAI_MODEL`, and analysis limits for AI-assisted qualification.
- Search-provider keys and enrichment flags for website/contact discovery.
- Crawling frequency, request delay, item limits, and article recency settings.
- SMTP values for email delivery.
- Export and backup directories.

Useful operational scripts include `npm run crawl:once`, `npm run analyze:pending`, `npm run leads:enrich`, `npm run backup`, and the `sources:*` utilities. Before a production-facing change, run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.

## Safety and operating boundaries

- The app is intended to crawl RSS and public webpages only where access is permitted; it does not implement CAPTCHA bypass, login bypass, or block circumvention.
- Secrets are read from server-side environment variables and must not be committed to the repository.
- Lead analysis can operate without an OpenAI key through deterministic local heuristics.
- LinkedIn automation is disabled.
- Automatic email sending is disabled by default and requires explicit operations settings plus SMTP configuration. Generated outreach should be reviewed for accuracy and suitability before delivery.
- SQLite makes the application easy to back up locally; database backups are written to `backups/db/`.

## Current constraints

- Crawling uses a conservative general-purpose implementation; source-specific collectors should be added only when their terms and technical behavior have been verified.
- Seed sources and source-type selectors are examples until individually verified.
- YouTube, App Store, Google Play, and Steam Upcoming inputs are supporting signals and may require manual validation of feeds or selectors.
- AI results are schema-validated, but lead qualification and enrichment remain decision-support tools that need human review.
