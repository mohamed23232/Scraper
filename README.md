# Scraping System

A configuration-driven web scraping system: describe a website once (what to click, what to extract) as a saved config, and any client, the desktop Admin UI, Unity, a script, anything, can ask for it by name and get back structured JSON. No per-website code.

- **New user, just want to run it?** Start right below.
- **Setting up the Unity client?** See [`UNITY-CLIENT-SETUP.md`](./UNITY-CLIENT-SETUP.md).
- **Building a config for a specific website?** See [`SCRAPING-GUIDE.md`](./SCRAPING-GUIDE.md).
---

## Install and run the Admin UI app

This is the normal way to use the system, a desktop app that starts the backend for you and gives you a visual tool for building and testing scraping configs. No terminal, no Node.js install required.

1. Get the installer: `Scraper Admin Setup 1.0.0.exe`.
2. Double-click it. Windows will likely show a blue **"Windows protected your PC"** SmartScreen warning, this is expected for an installer without a paid code-signing certificate, not a sign anything is wrong. Click **More info → Run anyway**.
3. When the installation is finished, launch **Scraper Admin** from the Start Menu.

### First launch

the app works fully with zero configuration.

| Setting | What it does | Leave blank to... |
|---|---|---|
| **Config storage** | Where saved website configs live: plain JSON files (default) or a local SQLite database | Use JSON files in a `configs/` folder |
| **Database path** | Only used if you picked SQLite above | Use the default path (`data/configs.sqlite`) |
| **Admin API key** | A password required to create/update/delete saved configs | Allow saving/deleting without a password (fine for personal/local use) |

Click **Start**. The window switches to the Admin UI automatically once the backend is ready, usually a couple of seconds.

### Using the app

Three tabs along the top:

- **Websites**: list, create, edit, test, and delete saved scraping configs. This is where you'll spend most of your time; see [`SCRAPING-GUIDE.md`](./SCRAPING-GUIDE.md) for exactly how to build a config for a real website.
- **Connect**: everything another app needs to talk to this backend: the exact URL to use, your admin key (if you set one), the id of every saved website, and copy-paste example requests in cURL, JavaScript, and C#/Unity. Use this when wiring up a new client.
- **Guide**: an in-app reference for every option in the config form, with worked examples.

---

## Connecting a client

Open the **Connect** tab in the running app, it shows the exact URL and example code for your situation, generated live (not a static example). For the full step-by-step Unity setup specifically, see [`UNITY-CLIENT-SETUP.md`](./UNITY-CLIENT-SETUP.md).

---

## For developers (running from source)

Everything below is for working on the backend/Admin UI source itself, or running it without the packaged app.

### Run it

```bash
npm install
npx playwright install chromium   # first time only — needed for scraper.type: "browser" configs
npm run dev                       # http://localhost:3000, Admin UI at http://localhost:3000/admin/
```

Copy `.env.example` to `.env` and adjust if you need auth, a different configs directory, etc. — every variable has a working default for local development.

### Call the API directly

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

Every response is `{ success, url?, data?, metadata? }` on success or `{ success: false, error: { code, message } }` on failure, see the **Connect** tab in the running app for live, copy-paste examples.

Add `"cache": { "enabled": true, "ttl": 300 }` to any request (or to a saved website config) to cache its result in memory for that many seconds, repeat identical requests return instantly with `metadata.cached: true` instead of re-scraping.

Add `"async": true` to any request to get an instant `202 { jobId, status: "queued" }` instead of waiting, useful for slow `scraper.type: "browser"` scrapes. Poll `GET /jobs/:jobId` until `status` is `"completed"` (with `result`) or `"failed"` (with `error`).

### Website config storage

Saved configs live as `configs/websites/<id>.json` files by default. To use a local SQLite database instead:

```bash
npm run migrate:sqlite         # one-time: imports existing *.json configs into data/configs.sqlite
CONFIG_STORAGE=sqlite npm run dev
```

Both backends implement the same `ConfigRepository` interface and are interchangeable, `/scrape` and `/websites` behave identically either way.

### Scaling async jobs with a real queue

By default, `"async": true` jobs run in-process (no setup needed). To hand them off to a real Redis-backed queue processed by separate worker process(es) instead:

```bash
# needs a running Redis — REDIS_URL defaults to redis://127.0.0.1:6379
QUEUE_DRIVER=bullmq npm run dev      # API process — only enqueues jobs now
QUEUE_DRIVER=bullmq npm run worker   # a separate process that actually runs them; start more than one to scale out
```

Both processes must point at the same `REDIS_URL`. Without at least one worker running, jobs queue but never complete.

### Building the installer yourself

```bash
cd electron
npm install                      # one-time
npm run prepare-backend          # builds the backend and stages a production-only copy
npx electron-builder --win nsis  # produces electron/release/Scraper Admin Setup <version>.exe
```

Re-run both commands any time you change backend or Admin UI source, the installer is a snapshot, not a live link to the source, and won't pick up changes on its own.