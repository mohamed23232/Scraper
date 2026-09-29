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
