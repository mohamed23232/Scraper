# What This Project Actually Is

Plain-language explanation of every moving part, what the system can do, exactly how to scrape a real website with it, and why this is a different (and better, for this use case) tool than just writing a scraping script by hand.

For the config field reference and full history, see the [roadmap doc](./Configuration-Driven%20Web%20Scraping%20System%20%E2%80%94%20Development%20Roadmap.md). For quick copy-paste commands, see the [README](./README.md). This document is the "explain it to me like I'm starting fresh" version.

---

## 1. The one-sentence version

You send it a URL and a description of *what you want extracted* (either inline, or a saved recipe by name) — it fetches the page, runs the extraction, cleans up the data, and hands you back JSON. No code to write per website; the description IS the scraper.

---

## 2. The core idea: config, not code

A normal scraper is a program: for every website you want to scrape, you write a new script — open the page, find the right CSS selectors, pull out text, clean it, save it. Every new site is new code.

This system flips that. You describe a website once, as data (a JSON "config"), and the same engine executes any config you give it:

```json
{
  "id": "books-toscrape",
  "startUrl": "https://books.toscrape.com/",
  "scraper": { "type": "static" },
  "item": { "selector": "article.product_pod" },
  "fields": {
    "title": { "selector": "h3 a", "extract": "attribute", "attribute": "title" },
    "price": { "selector": ".price_color", "extract": "text", "transform": ["removeCurrency", "parseNumber"] },
    "inStock": { "selector": ".availability", "extract": "text", "transform": [{ "name": "regex", "pattern": "In stock" }] },
    "detailUrl": { "selector": "h3 a", "extract": "attribute", "attribute": "href", "transform": ["absoluteUrl"] }
  },
  "pagination": { "enabled": true, "nextSelector": "li.next a", "maxPages": 5 }
}
```

Save that once (`PUT /websites/books-toscrape`), and forever after, `{"website": "books-toscrape"}` gives you every book on every page, as clean typed JSON — title, a real number for price, a real boolean for stock, an absolute link. Change the site's layout later? Edit the JSON, not a program.

---

## 3. Every part of the system, in simple terms

**Fastify** — the web server. Receives HTTP requests (`POST /scrape`, etc.) and routes them.

**Two scraping strategies, chosen per-request:**
- **Static (Cheerio)** — downloads the raw HTML and parses it, like a browser's "view source." Fast (milliseconds), cheap, no rendering. Works for any page where the data is already in the HTML.
- **Browser (Playwright/Chromium)** — actually launches a real (headless) Chrome, loads the page, runs its JavaScript, waits for content to appear, *then* reads the resulting HTML. Slower (seconds), but works for sites that build their content with JavaScript after the initial page load (infinite scroll feeds, React/Vue apps, etc.). You can also tell it to wait for a specific selector to appear first, or block images/fonts/CSS to load faster.

You pick which one per request/config (`"scraper": {"type": "static"}` or `"browser"`) — the rest of the pipeline behaves identically either way.

**The extraction engine** — given a CSS selector and an "extract mode" (`text`, `html`, or `attribute`), pulls the value(s) out of the parsed page. Supports pulling a single field or a whole list of repeating items (e.g. every product card on a page).

**The transform pipeline** — a small chain of cleanup steps applied to each extracted value, in order:
- `trim` — strip whitespace
- `removeCurrency` — strip `$`, `€`, commas, etc.
- `parseNumber` — turn `"19.99"` into the number `19.99` (handles `,` as decimal separator too)
- `absoluteUrl` — turn a relative link (`/product/42`) into a full URL, using the page it came from
- `regex` — extract a capture group, or just validate a pattern matched
- `replace` — regex-based find/replace
- `default` — fall back to a fixed value if extraction found nothing

These compose: `["trim", "removeCurrency", "parseNumber"]` turns `"  $1,299.00  "` straight into the number `1299`. You never hand-write this cleanup logic again — it's declared once and reused everywhere.

**Field typing** — each field can declare its output type (`string`, `number`, `boolean`, `url`), and whether it's `required` (fail loudly if missing) or has a `default`. This is what makes the output *structured* JSON rather than a pile of raw strings.

**The pagination engine** — given a "next page" selector, it keeps following it automatically: scrapes page 1, clicks/follows to page 2, page 3, etc., merging every page's items into one result. It stops when it hits the last page, a page limit, an item-count limit, a time limit, a duplicate URL/content (loop detection), or an error — and tells you exactly which one (`stopReason`), plus whether the result was `truncated` by a limit you set.

**Saved website configs** (`/websites` endpoints) — a small CRUD API to store, list, update, and delete named configs (`configs/websites/<id>.json`, or in a local SQLite database if you prefer — both are interchangeable). Writing configs requires a bearer-token admin key if you set one; reading and scraping never do.

**Caching** — attach `"cache": {"enabled": true, "ttl": 300}` to any request or saved config. Identical repeat requests within the TTL window return instantly from memory (`metadata.cached: true`) instead of re-scraping the live site.

**Async jobs + queue** — add `"async": true` to any request and instead of waiting for the scrape, you get back `{jobId, status: "queued"}` immediately; poll `GET /jobs/:id` until it's `completed` or `failed`. By default this runs in the same process; optionally (`QUEUE_DRIVER=bullmq`), it hands off to a real Redis-backed queue that separate worker processes pull from — so scraping load can be scaled out across multiple machines without touching the API.

**Security hardening (SSRF protection)** — before fetching *any* URL (from a request or a saved config), the system checks: is the protocol `http`/`https` only (no `file:`, no `gopher:`, etc.)? Does the hostname resolve to a private/internal/loopback IP address (`127.x`, `10.x`, `192.168.x`, link-local, etc.)? If it's private, the request is refused — this stops the server from being tricked into scraping your own internal network or cloud metadata endpoints. The IP that gets validated is the same one the connection actually uses (pinned), so a malicious DNS server can't swap the address out between the check and the real request (a "DNS rebinding" attack). There's also a hard cap on response size (default 5 MB) so a hostile server can't stream gigabytes at you.

**One consistent error model** — every failure, from a bad URL to a missing selector to a page timeout, comes back as `{"success": false, "error": {"code": "SELECTOR_NOT_FOUND", "message": "..."}}` with one of a fixed, documented set of error codes (`INVALID_URL`, `URL_NOT_ALLOWED`, `CONFIG_NOT_FOUND`, `TIMEOUT`, `RESPONSE_TOO_LARGE`, `SELECTOR_NOT_FOUND`, `BROWSER_ERROR`, etc.) — never a raw stack trace or an inconsistent shape.

---

## 4. What it's capable of, end to end

- Scrape any public static or JavaScript-rendered page, with no per-site code.
- Extract single fields or repeating lists of items, typed and cleaned.
- Follow pagination automatically across many pages, with safety limits.
- Save reusable "recipes" per website and manage them through an API.
- Cache results to avoid hammering a site or re-paying render cost.
- Run scrapes synchronously (wait for the answer) or asynchronously (fire-and-forget + poll), backed by an in-process queue or a real distributed Redis queue.
- Defend itself against being used as an SSRF proxy into private infrastructure.
- Report failures in one predictable, machine-readable shape.

---

## 5. Exactly how to scrape a website you want

Say you want product data from `https://books.toscrape.com/`. Here's the actual process:

**Step 1 — Open the page in a browser and inspect it.** Right-click a product → "Inspect." Find:
- The repeating container for one item (here, `article.product_pod` — one per book)
- The CSS selector *inside* that container for each field you want (title, price, etc.)

**Step 2 — Decide static or browser mode.** Does the data appear in "View Page Source" (right-click → View Page Source, then Ctrl+F for the text you want)? If yes → `"type": "static"` (fast). If the text is missing from page source but visible in the rendered page → the site builds it with JavaScript → `"type": "browser"`.

**Step 3 — Write the config** (see the example in section 2). One field per piece of data you want, each with its own selector/extract/transform.

**Step 4 — Try it inline first, without saving anything:**
```json
POST /scrape
{
  "url": "https://books.toscrape.com/",
  "config": {
    "item": { "selector": "article.product_pod" },
    "fields": {
      "title": { "selector": "h3 a", "extract": "attribute", "attribute": "title" },
      "price": { "selector": ".price_color", "extract": "text", "transform": ["removeCurrency", "parseNumber"] }
    }
  }
}
```
Check the response. Missing/wrong values almost always mean the selector doesn't match what you think it matches — go back to the browser inspector.

**Step 5 — Add pagination if there's a "next" link,** and any transforms needed to get clean typed values.

**Step 6 — Once it looks right, save it as a named config** (`PUT /websites/books-toscrape` with the same `config` body plus `id`/`startUrl`/`scraper`), and from then on just call `{"website": "books-toscrape"}` — short, reusable, and safe to call from anywhere (a cron job, another service, a Unity client) without re-sending the whole recipe every time.

**Step 7 — If it's slow or you're scraping many pages,** add `"async": true` and poll `/jobs/:id`, and/or add `"cache"` if you'll request the same thing repeatedly.

That's the entire workflow for *any* website — the only thing that ever changes between sites is the JSON config, never the underlying engine.

---

## 6. What makes this better than "just write a scraping script"

A hand-written script (a Python file with BeautifulSoup/Scrapy, or a Node script with Cheerio/Puppeteer) is usually the faster thing to build *once, for one site*. This system is a different trade: more setup, far less marginal cost per site, and safe to expose as a shared service. Concretely:

- **No code per new website.** A one-off script means a new file, new imports, new "find the selector, write the loop" boilerplate every time. Here, a new website is a JSON object — no deploy, no code review, addable through the API itself.
- **A real, callable API instead of a script you run locally.** A hand-written scraper is typically a script someone runs on their machine and pastes output from. This is an HTTP service — your Unity client, a cron job, another backend, or a teammate can all call `POST /scrape` directly, with a stable contract (always the same response/error shape).
- **Consistent, typed output across every website.** Hand-rolled scripts tend to each have their own ad-hoc output format. Here, every config declares field types, so `price` is always a real number and `inStock` is always a real boolean, for every site, without re-implementing that parsing logic each time.
- **Static vs. browser rendering is a config flag, not a rewrite.** With raw scripts, "oh, this site needs a headless browser after all" usually means switching libraries and rewriting the script. Here it's `"type": "browser"` instead of `"type": "static"` — the extraction/transform/pagination logic underneath doesn't change at all.
- **Pagination, caching, and async execution are already solved, once, for everything.** In a one-off script you write the "follow next page" loop, the "don't refetch too often" logic, and the "run this in the background" plumbing yourself, per script. Here every website gets all three for free, just by setting a flag in its config.
- **Built-in SSRF protection.** A quick personal script that fetches "whatever URL the user gives it" is a textbook SSRF vulnerability if it's ever exposed as a service — it'll happily fetch `http://169.254.169.254/` or your internal admin panel. This system blocks that by default; you'd have to build that protection yourself in a hand-written scraper, and it's easy to forget.
- **Centralized, predictable failure handling.** One fixed set of error codes for the entire system, instead of each script handling (or not handling) timeouts, missing selectors, and malformed pages differently.
- **Scales out without a redesign.** Turning on `QUEUE_DRIVER=bullmq` lets you add more worker processes/machines to handle more scraping load, with zero changes to how you call the API. A one-off script has no equivalent "just add more workers" story — you'd be building this yourself from scratch.

The honest trade-off: if you truly only ever need to scrape one page, one time, a 10-line script is less total effort than writing a JSON config for a system like this. This system pays off the moment you have more than a couple of websites, need it callable from other software, need it to run unattended/repeatedly, or need it exposed somewhere that isn't just your own laptop.

---

## 7. Building the `/scrape` request JSON, step by step — a complete guide

This section is a self-contained reference. Follow it top to bottom for any website and you'll end up with a working request, with no prior knowledge of the system assumed beyond "I can right-click a webpage."

### 7.1 The three request shapes — pick one

Every `POST /scrape` body is exactly one of these three shapes (never a mix):

| Shape | Body has... | Use it when |
|---|---|---|
| **Flat** | `url`, `selector`, `extract` | You want one field, every match, no repeating "items" — e.g. "every heading on this page." |
| **Inline config** | `url`, `config: { item, fields }` | You want repeating items (a list of products, articles, etc.), each with multiple named fields — but you don't want to save it. |
| **Saved website** | `website` (an id you saved earlier via `PUT /websites/:id`) | You've already worked out a config for this site and just want to call it by name. |

Start with **flat** to test a single selector, move to **inline config** once you need multiple fields per item, and only save it as a **website** config once it works.

```jsonc
// Flat
{ "url": "https://example.com", "selector": "h1", "extract": "text" }

// Inline config
{
  "url": "https://example.com",
  "config": {
    "item": { "selector": ".product" },
    "fields": {
      "name": { "selector": ".name", "extract": "text" }
    }
  }
}

// Saved website
{ "website": "example" }
```

### 7.2 How to actually find a selector (the part that isn't code)

This is manual, visual work in your browser — nothing about it requires programming:

1. Open the target page in Chrome/Edge/Firefox.
2. Right-click the exact piece of text or element you want → **Inspect**. This opens DevTools with that element highlighted in the HTML tree.
3. Look at the highlighted tag. Note its **class** (`class="product-title"` → selector `.product-title`) or **id** (`id="price"` → selector `#price`). Prefer a class/id that's specific to that piece of data over a generic tag name like `div` or `span`.
4. **Test the selector before using it anywhere**, in the DevTools Console tab (still open):
   ```js
   document.querySelectorAll(".product-title").length   // how many matches?
   document.querySelectorAll(".product-title")[0].textContent   // what's actually in it?
   ```
   If the count is wrong (0, or way more than expected), the selector is wrong or too broad — fix it here first, before ever calling the API. This is the single most useful habit for building configs quickly.
5. **For a repeating list** (products, articles, search results): find the smallest element that wraps *one full item* (one product card, one row) — that's your `item.selector`. Then find each field's selector **relative to that item** (it only needs to be unique *inside* one card, not on the whole page).
6. **Watch for duplicated selectors.** Some sites reuse the same class/attribute on more than one element per item (a hidden decoy button, a duplicate mobile-only copy of the same card, etc.). Always sanity-check the *count* (step 4) matches what you expect — if `.load_more` matches 3 elements instead of 1, you've found one of these traps. Narrow the selector by scoping it to a parent container, e.g. `#results .load_more` instead of just `.load_more`.

### 7.3 Static vs. browser mode — how to decide, correctly

This decides whether the data even exists for the scraper to find:

1. On the target page, right-click → **View Page Source** (not "Inspect" — a different view: this is the *raw* HTML the server sent, before any JavaScript ran).
2. Press Ctrl+F and search for the text you want to extract.
3. **Found it?** → `"scraper": { "type": "static" }` (or omit `scraper` entirely — static is the default). Fast (usually well under a second).
4. **Not found, but it's visible on the actual page?** → the site built it with JavaScript after loading. Use `"scraper": { "type": "browser" }` — this launches a real headless Chrome that runs the page's JavaScript before reading it. Slower (seconds), but works.
5. If you use browser mode and the data still doesn't appear, the content probably loads *after* the initial page load (e.g. on scroll, or after a delayed API call). Add `"waitFor": ".the-selector-you-need"` — the browser will wait for that element to exist before reading the page.

### 7.4 `extract` — the three ways to pull a value out of an element

| Value | Returns | Example use |
|---|---|---|
| `"text"` | The element's visible text, trimmed of extra whitespace | Titles, prices, descriptions |
| `"html"` | The element's inner HTML markup, as a string | You need formatting/structure preserved (rare) |
| `"attribute"` | The value of one of the element's HTML attributes — **requires the `attribute` field too** | Links (`href`), image URLs (`src`), IDs, `data-*` attributes |

```json
{ "selector": "a.product-link", "extract": "attribute", "attribute": "href" }
```

### 7.5 Field options — every option, for `config.fields.<name>` (inline/saved configs)

A field's `selector` is evaluated **inside its item's element**, not the whole page.

| Option | Values | Default | What it does |
|---|---|---|---|
| `selector` | any CSS selector | *(required)* | Where to find this field, relative to the item |
| `extract` | `"text"` \| `"html"` \| `"attribute"` | *(required)* | See 7.4 |
| `attribute` | attribute name string | — | Required only when `extract: "attribute"` |
| `multiple` | `true` / `false` | `false` | `false` → returns the **first** match's value only. `true` → returns an **array** of every match's value (e.g. all tags on a product, not just one) |
| `required` | `true` / `false` | `true` | `true` → missing selector = the whole request fails with `SELECTOR_NOT_FOUND`. `false` → missing selector quietly becomes `default` (or `null` if no default is set) — use this for fields that don't exist on every item (e.g. a "on sale" badge) |
| `default` | any JSON value | `null` | The fallback value when `required: false` and the selector wasn't found |
| `transform` | array of transform specs | — | See 7.6 — cleanup/conversion steps run in order |
| `type` | `"string"` \| `"number"` \| `"boolean"` \| `"url"` | — | **A validation check, not a converter.** After transforms run, the final value must already match this type or the request fails with `TRANSFORMATION_ERROR`. Pair it with a transform that actually produces that type (e.g. `parseNumber` before `"type": "number"`) |

```json
{
  "price": { "selector": ".price", "extract": "text", "transform": ["removeCurrency", "parseNumber"], "type": "number" },
  "onSale": { "selector": ".badge-sale", "extract": "text", "required": false, "default": false },
  "tags": { "selector": ".tag", "extract": "text", "multiple": true }
}
```

Flat requests (7.1) skip field objects entirely — they take `selector`/`extract`/`attribute`/`transform` directly at the top level, for one value (or list of matches) with no "item" wrapper.

### 7.6 `transform` — every value, exactly

`transform` is an array run **in order**, each step feeding the next. Two kinds of entries:

**Plain string shorthand** (no options needed):

| Name | What it does |
|---|---|
| `"trim"` | Strips leading/trailing whitespace |
| `"removeCurrency"` | Strips `$`, `€`, `£`, commas, etc. from a price-like string |
| `"parseNumber"` | Converts a numeric string into a real JSON number |
| `"absoluteUrl"` | Converts a relative link (`/item/42`) into a full URL, using the scraped page as the base |

**Object form** (when you need to configure the step):

```jsonc
{ "name": "parseNumber", "decimal": "," }                         // for "1.299,00"-style European numbers
{ "name": "regex", "pattern": "\\d+", "group": 0, "flags": "g" }   // extract a regex match/capture group
{ "name": "replace", "pattern": "\\s+", "replacement": " ", "flags": "g" }  // regex find/replace
{ "name": "default", "value": "N/A" }                              // substitute a fixed value if the extracted value was null/undefined — the only transform that still runs even on an empty value
```

Example chain, in order: `["trim", "removeCurrency", "parseNumber"]` turns `"  $1,299.00  "` into the number `1299`.

### 7.7 `scraper` — how the page gets fetched

| Option | Values | Default | What it does |
|---|---|---|---|
| `type` | `"static"` \| `"browser"` | `"static"` | See 7.3 |
| `timeout` | milliseconds, positive integer | `15000` (static), `10000` (browser) | How long to wait before giving up (`TIMEOUT` error) |
| `waitFor` | a CSS selector | — | **Browser mode only.** Waits for this element to appear before reading the page — needed for content that loads after the initial page load |
| `blockResources` | `true` / `false` | `true` | **Browser mode only.** Skips loading images/fonts/stylesheets for speed, since only the HTML/text matters. Set `false` if you specifically need a fully rendered page (rare) |

### 7.8 `pagination` — following "next page" automatically (inline/saved configs only)

| Option | Values | Default | What it does |
|---|---|---|---|
| `enabled` | `true` / `false` | *(required to turn on)* | Without this block, only one page is scraped |
| `nextSelector` | a CSS selector for the "next page" link | *(required)* | Must resolve to an element with an `href` (see 7.2 step 6 — check this doesn't match a decoy) |
| `maxPages` | positive integer | `10` | Hard stop after this many pages |
| `maxItems` | positive integer | — | Hard stop once this many total items are collected |
| `maxDurationMs` | positive integer | `60000` | Hard stop after this much wall-clock time |
| `delayMs` | non-negative integer | `0` | Pause this long between page requests (be polite to the target site) |
| `failOnPageError` | `true` / `false` | `false` | `false` → a failing page after the first just stops pagination there and returns what's collected so far (with a warning). `true` → the whole request fails instead |

The response tells you exactly why it stopped, in `metadata.stopReason`: `"lastPage"` (no more next-link found — the normal, successful end), `"maxPages"` / `"maxItems"` / `"timeout"` (a limit was hit — check `metadata.truncated: true`), `"duplicateUrl"` / `"duplicateContent"` (loop detection caught a site linking back to a page it already showed), or `"error"` (a later page failed and `failOnPageError` was left off).

### 7.9 `cache` and `async` — the two flags, on any request shape

```json
{ "cache": { "enabled": true, "ttl": 300 } }
```
`ttl` is in seconds. Identical repeat requests within that window return instantly with `metadata.cached: true` instead of re-scraping.

```json
{ "async": true }
```
Instead of waiting, get back `{"jobId": "...", "status": "queued"}` immediately (HTTP 202). Poll `GET /jobs/:jobId` until `status` is `"completed"` or `"failed"`. Use this for slow browser-mode scrapes or heavy pagination.

### 7.10 The whole process, as a checklist

1. Open the target page. Decide: one field (flat) or a repeating list (config)?
2. Find the item container selector (for lists) and test its match **count** in the DevTools console.
3. For each field you want: find its selector *relative to the item*, test it the same way.
4. View Page Source and Ctrl+F for your data → decide `static` or `browser` (7.3).
5. Pick `extract` per field (7.4), and any `transform`s needed to get clean, typed values (7.6).
6. Send it as a flat or inline-config request to `POST /scrape`. Fix selectors based on the actual response/errors — `SELECTOR_NOT_FOUND` errors tell you exactly which field and which item index failed.
7. If there's a "next page" link, add `pagination` (7.8) — test with a small `maxPages` first.
8. Add `cache` and/or `async` if the request is slow or will be repeated (7.9).
9. Once it's right, save it: `PUT /websites/<your-id>` with `id`, `startUrl`, `scraper`, and the same `item`/`fields`/`pagination` you just tested — then call it forever after with just `{"website": "<your-id>"}`.
