# Scraping System

A configuration-driven web scraping backend: give it a URL and a config (inline, or a saved id), it returns structured JSON. Static (Cheerio) and JavaScript-rendered (Playwright) sites, pagination, data transforms, and a management API for saved site configs.

Full design history and every config option: [`Configuration-Driven Web Scraping System — Development Roadmap.md`](./Configuration-Driven%20Web%20Scraping%20System%20%E2%80%94%20Development%20Roadmap.md) (see §22a for the config reference, §29 for security notes).

## Run it

```bash
npm install
npx playwright install chromium   # first time only
npm run dev                       # http://localhost:3000
```

Copy `.env.example` to `.env` and adjust if you need auth, a different configs directory, etc. — every variable has a working default for local development.

## Test it

```bash
npm run typecheck
npm test
```

Tests run entirely against local fixture servers (`tests/fixtures/`) — none depend on a live website.

## Call it

`POST /scrape` accepts one of three request shapes:

```jsonc
// 1. Flat — one field, every match
{ "url": "https://example.com", "selector": "title", "extract": "text" }

// 2. Inline config — item + fields, no saved config needed
{ "url": "https://example.com", "config": { "item": {...}, "fields": {...} } }

// 3. Saved config by id
{ "website": "example" }
```

Manage saved configs:

```text
GET    /websites            list saved configs
GET    /websites/:id        fetch one
POST   /websites             create               } requires Authorization: Bearer <ADMIN_API_KEY>
PUT    /websites/:id         replace (or create)   } if ADMIN_API_KEY is set
DELETE /websites/:id         remove                }
```

Every response is `{ success, url?, data?, metadata? }` on success or `{ success: false, error: { code, message } }` on failure — see §22 of the roadmap doc for the full error code list.

Add `"cache": { "enabled": true, "ttl": 300 }` to any request (or to a saved website config) to cache its result in memory for that many seconds — repeat identical requests return instantly with `metadata.cached: true` instead of re-scraping.

Add `"async": true` to any request to get an instant `202 { jobId, status: "queued" }` instead of waiting — useful for slow `scraper.type: "browser"` scrapes. Poll `GET /jobs/:jobId` until `status` is `"completed"` (with `result`) or `"failed"` (with `error`).

## Website config storage

Saved configs live as `configs/websites/<id>.json` files by default. To use a local SQLite database instead:

```bash
npm run migrate:sqlite         # one-time: imports existing *.json configs into data/configs.sqlite
CONFIG_STORAGE=sqlite npm run dev
```

Both backends implement the same `ConfigRepository` interface and are interchangeable — `/scrape` and `/websites` behave identically either way.

## Admin UI

A browser-based dashboard for building, testing, and saving website configs without hand-writing JSON: `http://localhost:3000/admin/` (served by the same server, no separate setup). Build a config in the form, click **Test Scrape** to run it for real and see the results in a table, then **Save**. Enter your `ADMIN_API_KEY` in the bar at the top if one is set (only needed for Save/Delete — testing and browsing don't require it).

## Scaling async jobs with a real queue

By default, `"async": true` jobs run in-process (no setup needed). To hand them off to a real Redis-backed queue processed by separate worker process(es) instead:

```bash
# needs a running Redis — REDIS_URL defaults to redis://127.0.0.1:6379
QUEUE_DRIVER=bullmq npm run dev      # API process — only enqueues jobs now
QUEUE_DRIVER=bullmq npm run worker   # a separate process that actually runs them; start more than one to scale out
```

Both processes must point at the same `REDIS_URL`. Without at least one worker running, jobs queue but never complete.
