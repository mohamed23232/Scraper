# Configuration-Driven Web Scraping System

## 1. Project Goal

Build a reusable web scraping backend that can receive a website URL and a scraping configuration, retrieve the website's data, extract the requested information, normalize it, and return structured JSON to a Unity application.

The system should support:

- Static HTML websites
- JavaScript-rendered websites
- CSS selectors
- HTML attributes
- Text extraction
- Nested objects
- Arrays/lists
- Pagination
- Data transformations
- Website-specific configurations
- Caching
- Error handling
- Logging
- Future database storage
- Unity integration

The core principle is:

> **The scraper engine contains the logic for HOW to scrape. Configurations contain the information about WHAT to scrape.**

---

# 2. Target Architecture

The final system should look approximately like this:

```text
                         ┌─────────────────────┐
                         │       Unity         │
                         │     Application     │
                         └──────────┬──────────┘
                                    │
                              HTTP / JSON
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │     Scraper API     │
                         │      Fastify        │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Request Manager   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Scraper Engine    │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
        ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
        │ Static HTML   │ │   Playwright   │ │  API / JSON    │
        │   Cheerio     │ │    Browser     │ │    Scraper     │
        └────────────────┘ └────────────────┘ └────────────────┘
                 │                  │                  │
                 └──────────────────┼──────────────────┘
                                    ▼
                         ┌─────────────────────┐
                         │     Extractors      │
                         └──────────┬──────────┘
                                    ▼
                         ┌─────────────────────┐
                         │   Transformations   │
                         └──────────┬──────────┘
                                    ▼
                         ┌─────────────────────┐
                         │    Normalization    │
                         └──────────┬──────────┘
                                    ▼
                              JSON Response
```

---

# 3. Current Project State

You have already completed:

- Node.js installation
- npm project initialization
- TypeScript installation
- `tsconfig.json`
- Fastify installation
- Cheerio installation
- Playwright installation
- Zod installation
- Playwright Chromium installation
- Project structure
- `package.json` scripts
- Basic Fastify server

Your current server successfully runs with:

```bash
npm run dev
```

and responds from:

```text
http://localhost:3000
```

---

# 4. Development Phases

Build the project in these phases:

```text
Phase 1  → Basic HTTP scraper
Phase 2  → Generic extraction engine
Phase 3  → Configuration system
Phase 4  → Transformations
Phase 5  → Dynamic websites / Playwright
Phase 6  → Pagination
Phase 7  → Better data models & standard errors
Phase 8  → Website configuration manager (scrape by website id)
Phase 9  → Database
Phase 10 → Caching
Phase 11 → Scraping jobs
Phase 12 → Queue system
Phase 13 → Unity client
Phase 14 → Admin/configuration UI
```

(This list previously didn't match the phase headers below it — e.g. it once said "Phase 7 → Scraping jobs" when the actual Phase 7 section below is "Better Data Models." It's now kept in sync with the real headers.)

Do not implement everything at once.

---

# Phase 1 — Build the First Scraper

## Goal

Create an endpoint:

```http
POST /scrape
```

that receives:

```json
{
    "url": "https://example.com"
}
```

and returns basic information about the page.

For example:

```json
{
    "success": true,
    "url": "https://example.com",
    "title": "Example Domain"
}
```

---

# 5. Create the Scraper Engine

Create:

```text
src/
└── core/
    └── ScraperEngine.ts
```

The engine will initially have one responsibility:

```text
URL
 ↓
Download HTML
 ↓
Parse HTML
 ↓
Return document
```

Conceptually:

```typescript
class ScraperEngine {

    async scrape(url: string) {
        // Download website
        // Parse HTML
        // Return result
    }
}
```

Do not put extraction logic here yet.

The engine is responsible for obtaining the page.

---

# 6. Create an HTTP Fetcher

Create:

```text
src/
└── core/
    └── HttpClient.ts
```

Responsibilities:

- Send HTTP requests
- Set headers
- Handle HTTP errors
- Handle timeouts
- Return HTML

Conceptually:

```typescript
class HttpClient {

    async get(url: string): Promise<string> {
        // Perform HTTP request
        // Return HTML
    }
}
```

Eventually this class can handle:

```text
GET
POST
headers
cookies
timeouts
redirects
```

without making the scraper engine aware of those details.

---

# 7. Add Your First `/scrape` Endpoint

Create:

```text
src/
└── api/
    └── routes/
        └── scrape.ts
```

The endpoint should:

```text
POST /scrape
      ↓
Validate request
      ↓
ScraperEngine
      ↓
Return JSON
```

Request:

```json
{
    "url": "https://example.com"
}
```

Response:

```json
{
    "success": true,
    "url": "https://example.com",
    "title": "Example Domain"
}
```

---

# 8. Validate Requests With Zod

Create:

```text
src/
└── api/
    └── schemas/
        └── scrape.schema.ts
```

Define something similar to:

```typescript
const ScrapeRequestSchema = z.object({
    url: z.string().url()
});
```

This prevents requests such as:

```json
{
    "url": "hello"
}
```

from reaching the scraper.

---

# 9. Test Phase 1

Use Postman, Insomnia, Bruno, curl, or another API client.

Example:

```bash
curl -X POST http://localhost:3000/scrape ^
  -H "Content-Type: application/json" ^
  -d "{\"url\":\"https://example.com\"}"
```

Expected result:

```json
{
    "success": true,
    "url": "https://example.com",
    "title": "Example Domain"
}
```

Once this works, Phase 1 is complete.

---

# Phase 2 — Build the Extraction Engine

**Status: Complete.**

The scraper currently only downloads pages.

Now we need to tell it:

> "Find this element and extract this information."

For example:

```text
.product
    ↓
.product-name
    ↓
.price
    ↓
img[src]
```

---

# 10. Create Extractors

Implemented in:

```text
src/
└── extractors/
    ├── Extractor.ts             (shared interface)
    ├── TextExtractor.ts
    ├── AttributeExtractor.ts
    ├── HtmlExtractor.ts
    └── ExtractionEngine.ts      (orchestrates the extractors)
```

Each extractor implements a common interface:

```typescript
interface Extractor {
    extract(element: Cheerio<AnyNode>): string;
}
```

so the engine can treat `text`, `html`, and `attribute` extraction interchangeably instead of branching on type everywhere.

## TextExtractor

Input:

```text
.product-name
```

Output:

```text
Gaming Laptop
```

---

## AttributeExtractor

Input:

```text
img
attribute = src
```

Output:

```text
/images/laptop.jpg
```

---

## HtmlExtractor

Input:

```text
.description
```

Output:

```html
<p>This is a laptop...</p>
```

---

## Multiple Elements

A selector rarely matches a single node — `.product-name` usually matches many products on the page. `ExtractionEngine.extract()` runs the selector once, then loops over **every** matched element and extracts a value from each one, returning an array:

```typescript
extract($, {
    selector: ".product-name",
    extract: "text"
});

// [ "Gaming Laptop", "Wireless Mouse", "USB-C Hub" ]
```

If the selector matches nothing, the engine throws (`Selector not found: ...`) rather than silently returning an empty array — a missing selector almost always means the config is wrong, not that the page has zero items.

---

# 11. Separate Extraction From Scraping

This distinction is extremely important.

The scraper should do:

```text
Website
 ↓
HTML
```

The extractor should do:

```text
HTML
 ↓
Data
```

Therefore:

```text
ScraperEngine
      │
      ▼
HTML Document
      │
      ▼
ExtractionEngine
      │
      ▼
Structured Data
```

This makes the architecture much easier to extend. `ScraperEngine` (in `src/core/scraper/`) knows nothing about selectors or extraction types, and `ExtractionEngine` never makes an HTTP request — it only operates on the `CheerioAPI` document it's handed.

---

# 11a. Bridge to Phase 3 — Extracting Items With Multiple Fields

So far `extract()` pulls **one field** across many elements (all `.product-name` text values, as a flat array). Real configs need **one object per item**, with several fields each:

```json
{
    "name": "Gaming Laptop",
    "price": "$1299",
    "image": "/images/laptop.jpg"
}
```

`ExtractionEngine.extractItems()` adds this:

```typescript
extractItems($, ".product", {
    name:  { selector: ".product-name", extract: "text" },
    price: { selector: ".price",        extract: "text" },
    image: { selector: "img",           extract: "attribute", attribute: "src" }
});
```

How it works:

```text
Find every .product (the "item" selector)
      ↓
For each .product element:
      ↓
      For each field (name, price, image):
            ↓
            Search *inside* that one item (scope.find(...))
            ↓
            Extract text / html / attribute
      ↓
      Combine fields into one object
      ↓
Return an array of objects
```

If a field selector matches more than one element inside a single item, that field becomes an array instead of a string — the same "multiple elements" behavior as `extract()`, just scoped per-item.

This is still plain TypeScript (no JSON config, no Zod validation, no route wired up yet) — it exists so Phase 3 only has to add configuration loading and validation on top of an engine that already knows how to produce item objects.

---

# Phase 3 — Configuration System

**Status: Complete.**

This is where the project becomes the system you actually want.

Instead of writing code for every website, create configurations.

Implemented in:

```text
configs/
└── websites/
    ├── example.json
    └── wikipedia.json

src/
└── core/
    └── config/
        ├── ScraperConfig.ts   (Zod schema + inferred types)
        └── ConfigLoader.ts    (loads + validates a config file by id)
```

The `/scrape` endpoint now accepts three request shapes:

```json
// 1. Flat (Phase 2 behavior) — one field, many elements
{ "url": "...", "selector": ".price", "extract": "text" }

// 2. Inline config — item + fields, no file needed
{ "url": "...", "config": { "item": {...}, "fields": {...} } }

// 3. Website id — loads configs/websites/<id>.json
{ "url": "...", "website": "example" }
```

Modes 2 and 3 both call `ExtractionEngine.extractItems()` under the hood and return an array of objects (one per matched item) instead of a flat array of strings. This is the "configuration-driven extraction" from Milestone 4 — Unity (or Postman) can now say "use the `wikipedia` config" instead of hand-crafting a selector every time.

Loading a config by id is intentionally minimal right now: `ConfigLoader.load(id)` reads `configs/websites/<id>.json` from disk, rejects an `id` containing anything other than letters/digits/`-`/`_` (to rule out path traversal), and validates the parsed JSON against the same Zod schema used for the `config` field of an inline request. There's still no `GET/POST/PUT/DELETE /websites` management API — that's Phase 8, once a database is in the picture.

---

# 12. First Configuration Format

Create:

```text
configs/
└── websites/
    └── example.json
```

Example:

```json
{
    "id": "example",

    "website": "https://example.com",

    "scraper": {
        "type": "static"
    },

    "item": {
        "selector": ".product"
    },

    "fields": {
        "name": {
            "selector": ".product-name",
            "extract": "text"
        },

        "price": {
            "selector": ".price",
            "extract": "text"
        },

        "image": {
            "selector": "img",
            "extract": "attribute",
            "attribute": "src"
        }
    }
}
```

---

# 13. What the Configuration Means

The engine reads:

```json
"item": {
    "selector": ".product"
}
```

meaning:

> Find every `.product`.

Then:

```json
"name": {
    "selector": ".product-name",
    "extract": "text"
}
```

means:

> Inside each product, find `.product-name` and extract its text.

And:

```json
"image": {
    "selector": "img",
    "extract": "attribute",
    "attribute": "src"
}
```

means:

> Find the image and return its `src`.

---

# 14. Expected Result

The configuration:

```json
{
    "fields": {
        "name": {
            "selector": ".product-name",
            "extract": "text"
        }
    }
}
```

could produce:

```json
{
    "success": true,

    "data": [
        {
            "name": "Product A"
        },
        {
            "name": "Product B"
        },
        {
            "name": "Product C"
        }
    ]
}
```

The exact website determines the selectors.

---

# 15 & 16. Configuration Types + Zod Validation

`ScraperConfig.ts` defines a single Zod schema — `scraperConfigSchema` — covering `id`, `website`, `scraper.type`, `item.selector`, and `fields` (each field validating `selector`, `extract`, and a conditionally-required `attribute` when `extract` is `"attribute"`). The `ScraperConfig` and `FieldConfig` TypeScript types are then inferred from that schema with `z.infer<...>` rather than hand-written separately.

This deviates slightly from the original plan of "write the interface, then write a matching Zod schema": with the schema as the single source of truth, the types can't drift out of sync with what's actually validated. `ConfigLoader.load(id)` uses this same schema, so an inline `config` in a request body and a `configs/websites/<id>.json` file are held to identical rules.

Invalid:

```json
{
    "item": {}
}
```

Valid:

```json
{
    "item": {
        "selector": ".product"
    }
}
```

This becomes very important once you have many website configurations.

---

# Phase 4 — Transformations

**Status: Complete.**

Raw scraped data is rarely exactly what your application needs.

Example:

```text
"$1,299.99"
```

Unity might need:

```text
1299.99
```

---

# 17. Create Transformation System

Implemented in:

```text
src/
└── transforms/
    ├── Transform.ts              (interface + TransformContext)
    ├── TrimTransform.ts
    ├── ParseNumberTransform.ts
    ├── RemoveCurrencyTransform.ts
    ├── AbsoluteUrlTransform.ts
    ├── TransformPipeline.ts      (name → instance registry, runs the chain)
    └── applyFieldTransforms.ts   (applies transforms to every item's fields)
```

`Transform.apply(value, context)` takes `unknown` in and out — a transform can change a field's *type*, not just reshape a string (`parseNumber` turns `"1,299.99"` into the number `1299.99`), so the transform layer can't stay string-in/string-out the way extractors do. `TransformContext` currently only carries `baseUrl`, since `absoluteUrl` is the one transform that needs anything beyond the raw value — it resolves a relative path (`/images/laptop.jpg`) against the page's URL.

`TRANSFORM_NAMES` (in `TransformPipeline.ts`) is the single source of truth for valid transform names — it's a `const` tuple used both to build the runtime registry and, via `z.enum(TRANSFORM_NAMES)`, to validate the `transform` array in `fieldConfigSchema` (`ScraperConfig.ts`). An unknown transform name is now a Zod validation error (`400`) rather than something that could slip through to a runtime lookup failure.

There's no separate `removeComma` file — the roadmap's example pipeline below shows it as its own step, but `ParseNumberTransform` strips thousands-separator commas itself before calling `Number(...)`, since Milestone 5 only calls for four named transforms (`trim`, `parseNumber`, `removeCurrency`, `absoluteUrl`) and a fifth file just for comma-stripping would've been a needless extra step with no config-level name of its own.

Both `selector`+`extract` fields (flat request mode) and `config`/`website` fields (item mode) accept an optional `transform: string[]`, applied in that exact order via `TransformPipeline.run()`. For item mode, `applyFieldTransforms()` walks each extracted item's fields and reruns the pipeline for any field that declared one — array-valued fields (multiple matches inside one item) get the pipeline applied element-by-element, same as single values.

The configuration could eventually support:

```json
{
    "price": {
        "selector": ".price",
        "extract": "text",
        "transform": [
            "trim",
            "removeCurrency",
            "parseNumber"
        ]
    }
}
```

---

# 18. Transform Pipeline

The data flow becomes:

```text
HTML
 ↓
Selector
 ↓
Extraction
 ↓
Transformation 1
 ↓
Transformation 2
 ↓
Transformation 3
 ↓
Final value
```

Example (as actually implemented — `parseNumber` strips thousands-separator commas itself, so there's no separate `removeComma` step):

```text
"$ 1,299.99"
      ↓
trim
      ↓
"$ 1,299.99"
      ↓
removeCurrency
      ↓
"1,299.99"
      ↓
parseNumber
      ↓
1299.99
```

---

# Phase 5 — Dynamic Websites

**Status: Complete.**

Some websites won't work with a simple HTTP request.

For example:

```text
HTTP GET
   ↓
HTML
   ↓
No products
```

because JavaScript creates the products after the page loads.

This is where Playwright comes in.

---

# 19. Create Browser Strategy

Implemented in:

```text
src/
└── strategies/
    ├── ScrapingStrategy.ts
    ├── StaticStrategy.ts
    └── BrowserStrategy.ts
```

The interface ended up carrying one optional second argument beyond the original plan:

```typescript
interface ScrapeOptions {
    waitFor?: string;
    timeout?: number;
}

interface ScrapingStrategy {
    scrape(url: string, options?: ScrapeOptions): Promise<string>;
}
```

`StaticStrategy` wraps the existing `HttpClient` and ignores `options` (there's nothing for a plain HTTP GET to wait for). `BrowserStrategy` launches a fresh headless Chromium via Playwright per call, navigates, optionally calls `page.waitForSelector(options.waitFor)`, reads `page.content()`, and — inside a `try/finally` — always closes the browser, including when navigation or the wait times out. A new browser per request is simple and correct but not fast; pooling/reusing a browser instance is a Phase 12 (production hardening) concern, not this one.

`ScraperEngine` no longer talks to `HttpClient` directly — it takes both strategies in its constructor and picks one per call based on `options.type`, then still owns `cheerio.load(html)` itself (parsing stays the engine's job either way; the strategies only ever return a raw HTML string).

Then:

```text
StaticStrategy
        │
        └── HTTP + Cheerio

BrowserStrategy
        │
        └── Playwright
```

---

# 20. Configuration Chooses the Strategy

Static:

```json
{
    "scraper": {
        "type": "static"
    }
}
```

Dynamic:

```json
{
    "scraper": {
        "type": "browser"
    }
}
```

The engine chooses the appropriate strategy.

---

# 21. Browser Configuration

Supported now, on all three request shapes:

```json
{
    "scraper": {
        "type": "browser",

        "waitFor": ".products",

        "timeout": 10000
    }
}
```

`scraperOptionsSchema` (in `ScraperConfig.ts`) is the single schema validating this shape everywhere it can appear: a `configs/websites/<id>.json` file's `scraper` field (required), and an optional `scraper` field on both the inline-`config` and flat request bodies (defaulting to `static` when omitted, so every request made before this phase still behaves identically).

The browser strategy does:

```text
Launch browser
      ↓
Navigate
      ↓
Wait for required element (if waitFor given)
      ↓
Obtain DOM
      ↓
Pass DOM to extraction engine
```

Verified against a page whose `.product` element is injected by a `setTimeout` after load (so it's genuinely absent from the raw HTTP response): the `static` strategy correctly fails to find it, `browser` without `waitFor` is a race against that timer, and `browser` with `waitFor: ".product"` finds it reliably every time — across all three request modes (flat, inline `config`, and `website` id loading a file whose `scraper.type` is `"browser"`).

Respect website terms, robots policies, authentication boundaries, and access controls. The system should not attempt to defeat CAPTCHAs or other access-control mechanisms.

**Revised during the later design/security audit** (see §22a and §29): `BrowserStrategy` and `StaticStrategy` were both substantially rewritten. `StaticStrategy`/`HttpClient` silently ignored `scraper.timeout` entirely — fixed with a real `AbortController` timeout. `BrowserStrategy` launched (and leaked) a brand-new Chromium instance on every single call — including once per page during pagination — with no check on *what* it was allowed to navigate to; a demonstrated `file:///` local-file read is now blocked, and it reuses one shared, concurrency-limited browser instead, closed on server shutdown.

---

# Phase 6 — Pagination

**Status: Complete.**

Many websites have:

```text
Page 1
Page 2
Page 3
Page 4
...
```

Implemented in:

```text
src/
└── core/
    └── pagination/
        └── PaginationEngine.ts
```

The configuration supports (as an optional `pagination` field alongside `item`/`fields`/`scraper`, on both a `configs/websites/<id>.json` file and an inline `config` request body):

```json
{
    "pagination": {
        "enabled": true,

        "nextSelector": ".next",

        "maxPages": 10
    }
}
```

`PaginationEngine.scrapeAllPages()` sits between `ScraperEngine` (fetch one page) and `ExtractionEngine` (extract one page's items), looping:

```text
Page 1
 ↓
Extract items
 ↓
Find next button (nextSelector's href, resolved against the current page's URL)
 ↓
Page 2
 ↓
Extract items
 ↓
Find next button
 ↓
...
```

When `pagination` is absent or `enabled: false`, behavior is exactly what it was before this phase — one page, one `extractItems()` call. This is opt-in, so nothing that worked before changed.

Important safeguards, all implemented:

```text
maxPages     — hard cap on pages visited, defaults to 10 if omitted
maxItems     — hard cap on total items collected across all pages, trims the final page's results if needed
duplicate URL detection — a Set of visited (absolute) URLs; landing on one already seen stops pagination immediately
```

One more implicit safeguard: reaching the *last* page (where `nextSelector` no longer matches anything, or the matched element has no `href`) or a page where the item selector matches zero elements (past the first page — the first page still throws on a genuinely wrong selector, matching Phase 2's strict behavior) stops the loop gracefully and returns whatever was collected, rather than throwing.

**Verified against real sites/scenarios, not just typechecked:**
- `books.toscrape.com` (a real paginated site — 50 pages, 20 books each) with `maxPages: 3` → exactly 60 items, from the correct 3 pages.
- Same site with `maxItems: 25` → exactly 25 items, stopping partway through page 2.
- A synthetic two-page loop (page A links to page B, page B links back to page A) with `maxPages: 50` → stopped after 2 items (A, then B), proving duplicate-URL detection kicks in long before `maxPages` would, rather than looping forever.

These prevent accidental infinite scraping.

**Revised during the later design/security audit** (see §22a for full details): an actual overall time budget (`maxDurationMs`) was added — the line above about `timeout` not being a pagination-level safeguard is no longer true. The duplicate-URL check now normalizes URLs first (strips the fragment, sorts query params, trims a trailing slash) instead of comparing raw strings. A second safeguard was added alongside it: if a page's *content* is identical to the previous page's (some sites clamp an out-of-range page number back to the last valid page instead of 404ing), pagination stops too. An optional `delayMs` and `failOnPageError` were also added. Every stopping condition is now reported back as `metadata.stopReason` instead of being indistinguishable from a normal "ran out of pages" exit.

---

# Phase 7 — Better Data Models

**Status: Complete** (landed early, during a design/security audit — see below).

Implemented in:

```text
src/
└── core/
    └── errors/
        ├── ScraperError.ts     (typed error + error codes)
        └── errorHandler.ts     (maps codes → HTTP status, one Fastify setErrorHandler)
```

`ScraperError` carries `{code, message, details?}`; the route no longer catches anything itself — every thrown error (from extraction, transforms, config loading, the URL policy, the scraper strategies) propagates to one `app.setErrorHandler`, which maps each code to an HTTP status and returns the standard envelope below. A non-`ScraperError` (a genuine bug) is logged server-side and returned as a generic `500` — its message/stack is never sent to the client.

Every response — success or error — now looks like:

```json
{
    "success": true,
    "url": "https://example.com",
    "data": [ { "title": "Example Domain" } ],
    "metadata": {
        "durationMs": 216,
        "items": 1,
        "pages": 1,
        "stopReason": "lastPage",
        "truncated": false,
        "warnings": []
    }
}
```

`pages`/`stopReason`/`truncated`/`warnings` only appear for `config`/`website` mode (they come from `PaginationEngine`, Phase 6); flat mode only gets `durationMs`/`items`.

---

# 22. Error Handling

Implemented exactly as planned, with one deliberate deviation:

```text
INVALID_URL
INVALID_CONFIGURATION
URL_NOT_ALLOWED          (added — the SSRF/private-network policy needed its own code)
REQUEST_FAILED
TIMEOUT
PAGE_NOT_FOUND
SELECTOR_NOT_FOUND
BROWSER_ERROR
PARSING_ERROR
TRANSFORMATION_ERROR
```

`PAGINATION_LIMIT` was deliberately **not** added. Hitting `maxPages`/`maxItems` isn't an error — the request still succeeds (`success: true`); which limit was hit is reported as `metadata.stopReason` (`"maxPages" | "maxItems" | "lastPage" | "duplicateUrl" | "duplicateContent" | "emptyPage" | "timeout" | "error"`) instead. Treating a page-count cap as a thrown error would have meant a perfectly normal, expected stopping point looked identical to a real failure to the caller.

Status → HTTP mapping (`errorHandler.ts`):

```text
400  INVALID_URL, INVALID_CONFIGURATION
403  URL_NOT_ALLOWED
422  SELECTOR_NOT_FOUND, TRANSFORMATION_ERROR
502  REQUEST_FAILED, PAGE_NOT_FOUND, BROWSER_ERROR, PARSING_ERROR
504  TIMEOUT
```

Example:

```json
{
    "success": false,

    "error": {
        "code": "SELECTOR_NOT_FOUND",
        "message": "Selector not found: .product-name"
    }
}
```

---

# 22a. Config Option Reference (added during a design/security audit)

A design review after Phase 6 added a batch of config options across `field`, `item`, `scraper`, and `pagination` that don't belong to any single phase above. Every one is optional — an existing config with none of these still validates and behaves exactly as before. This section is the one place they're all documented together.

## Field options (inside `fields.<name>`)

```json
{
    "fields": {
        "rating": {
            "selector": ".rating",
            "extract": "text",

            "multiple": false,
            "required": false,
            "default": null,
            "type": "string",

            "transform": [
                "trim",
                { "name": "parseNumber", "decimal": "," },
                { "name": "regex", "pattern": "(\\d+)", "group": 1 },
                { "name": "replace", "pattern": "\\s+", "replacement": " " },
                { "name": "default", "value": "unknown" }
            ]
        }
    }
}
```

- **`multiple`** (default `false`) — when a field's selector matches more than one element inside an item, `false` takes the first match (a plain string), `true` always returns every match as an array. Before this option existed, the field silently switched between a string and an array depending on how many elements happened to match — this makes that a deliberate choice instead of an accident of the page's markup.
- **`required`** (default `true`) — when the field's selector matches nothing inside an item: `true` throws `SELECTOR_NOT_FOUND` naming the field and the item's index; `false` uses `default` instead (or `null` if no `default` is set).
- **`default`** — the fallback value used when `required: false` and the selector didn't match. Any JSON value, not just a string.
- **`type`** — `"string" | "number" | "boolean" | "url"`. After extraction and any transforms run, the final value (or every element, if `multiple: true`) is checked against this type; a mismatch throws `TRANSFORMATION_ERROR` naming the field. Useful as a safety net when a `transform` is supposed to produce a specific type (e.g. `parseNumber` → `"number"`).
- **`transform`** — an array where each entry is either a bare name (`"trim"`, `"removeCurrency"`, `"parseNumber"`, `"absoluteUrl"`) or an object for the parameterized ones:
  - `{ "name": "parseNumber", "decimal": "." | "," }` — `","` treats `.` as a thousands separator and `,` as the decimal point (e.g. `"1.299,99"` → `1299.99`).
  - `{ "name": "regex", "pattern": string, "group"?: number, "flags"?: string }` — matches `pattern` against the value and returns capture group `group` (default `0`, the whole match).
  - `{ "name": "replace", "pattern": string, "replacement": string, "flags"?: string }` — regex replace (default flags `"g"`).
  - `{ "name": "default", "value"?: unknown }` — mid-pipeline fallback: substitutes `value` only if the value *at that point in the pipeline* is `null`/`undefined`/`""` (different from field-level `default`, which only fires when the selector matched nothing at all).

## Item options (inside `item`)

```json
{
    "item": {
        "selector": ".product",
        "allowEmpty": false
    }
}
```

- **`allowEmpty`** (default `false`) — when the item selector matches nothing on the first page: `false` throws (a broken selector almost always means a wrong config); `true` returns `[]` instead — for legitimate zero-result cases like a search with no matches.

## Scraper options (inside `scraper`)

Unchanged from Phase 5 (`type`, `waitFor`, `timeout`) — `timeout` is now actually honored in static mode too (it was silently ignored before this audit).

## Pagination options (inside `pagination`)

```json
{
    "pagination": {
        "enabled": true,
        "nextSelector": "li.next a",
        "maxPages": 10,
        "maxItems": 500,
        "maxDurationMs": 60000,
        "delayMs": 250,
        "failOnPageError": false
    }
}
```

- **`maxDurationMs`** (default `60000`) — overall wall-clock budget for the whole paginated scrape, not per page. Each page's own timeout gets clipped to whatever's left of the budget.
- **`delayMs`** — a pause before fetching each page after the first, for sites that rate-limit or just to be a considerate scraper.
- **`failOnPageError`** (default `false`) — when a page after the first fails (network error, selector suddenly missing, timeout): `false` stops pagination and returns whatever was collected so far (`success: true`, `metadata.stopReason: "error"`, a message in `metadata.warnings`); `true` fails the whole request instead, like a page-1 failure always does.

`metadata.stopReason` on every `config`/`website`-mode response is one of: `"maxPages" | "maxItems" | "lastPage" | "duplicateUrl" | "duplicateContent" | "emptyPage" | "timeout" | "error"`.

## Top-level config options

```json
{
    "id": "example",
    "schemaVersion": 1,
    "startUrl": "https://example.com"
}
```

- **`schemaVersion`** — currently only `1` is valid; reserved for when the config shape needs a breaking change later.
- **`startUrl`** — the site's URL. Renamed from `website` (the old name is still accepted, with a console warning, so existing config files don't need to change immediately — though both shipped configs in this repo have been migrated).

## Request-level additions

- In `website` mode, the request's `url` is now optional — it defaults to the config's `startUrl`. If both are given, they must be on the same hostname (guards against accidentally applying one site's selectors to a completely different site).
- A request body must unambiguously match exactly one of the three shapes (flat / inline `config` / `website`) — extra or conflicting fields (e.g. sending both `config` and `website`) are now a `400`, where they used to be silently accepted and partially ignored.
- **`ALLOW_INLINE_CONFIGS`** (env var; default: `true` unless `NODE_ENV=production`) — when `false`, flat and inline-`config` requests are rejected; only `website`-id requests (against saved, reviewed configs) are served. Meant for a production deployment that only wants to expose pre-approved scrapes.
- **`ALLOW_PRIVATE_NETWORKS`** (env var; default `false`) — must stay `false`/unset anywhere this API is actually reachable; see §29.

---

# Phase 8 — Website Configuration Manager

Once the engine works, you can manage configurations.

Eventually:

```text
GET    /websites
GET    /websites/:id
POST   /websites
PUT    /websites/:id
DELETE /websites/:id
```

Example:

```http
GET /websites
```

returns:

```json
[
    {
        "id": "store-a",
        "name": "Store A"
    },
    {
        "id": "news-a",
        "name": "News Website"
    }
]
```

---

# 23. Scraping by Website ID

Instead of Unity sending an entire configuration:

```http
POST /scrape
```

with:

```json
{
    "website": "store-a",
    "url": "https://store-a.com/products"
}
```

the backend can load:

```text
configs/websites/store-a.json
```

automatically.

This is much cleaner for Unity.

---

# Phase 9 — Database

Once the configuration system is stable, move configurations from JSON files to a database.

Possible structure:

```text
Website
----------------
id
name
baseUrl
enabled
createdAt
updatedAt
```

```text
ScraperConfig
----------------
id
websiteId
config
version
enabled
createdAt
updatedAt
```

You can initially keep configurations as JSON.

Do **not** add a database before the scraping engine works.

---

# Phase 10 — Caching

If Unity asks:

```text
Get products
```

ten times in one minute, you don't necessarily want to scrape the website ten times.

Architecture:

```text
Unity
 ↓
API
 ↓
Cache?
 ├── YES → Return cached result
 │
 └── NO
       ↓
    Scraper
       ↓
    Store result
       ↓
    Return result
```

Example configuration:

```json
{
    "cache": {
        "enabled": true,
        "ttl": 300
    }
}
```

`300` means five minutes.

---

# Phase 11 — Scraping Jobs

For slow websites, don't make Unity wait for a browser operation.

Eventually introduce jobs:

```text
Unity
 ↓
POST /scrape
 ↓
Job created
 ↓
202 Accepted
 ↓
Job ID
```

Example:

```json
{
    "jobId": "abc123",
    "status": "queued"
}
```

Then:

```http
GET /jobs/abc123
```

returns:

```json
{
    "jobId": "abc123",
    "status": "completed",

    "result": {
        ...
    }
}
```

This will become especially useful if you later scrape multiple websites simultaneously.

---

# Phase 12 — Queue System

When scraping becomes larger:

```text
API
 ↓
Queue
 ↓
Workers
```

For example:

```text
                    ┌─────────────┐
                    │     API     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    Queue    │
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
         Worker 1      Worker 2      Worker 3
             │             │             │
             ▼             ▼             ▼
          Website A     Website B     Website C
```

A queue system such as BullMQ + Redis can be added at this stage.

Do not add it yet.

---

# Phase 13 — Unity Client

Once the backend is stable, create a Unity client.

For example:

```text
Assets/
└── Scripts/
    └── Networking/
        ├── ScraperClient.cs
        ├── ScrapeRequest.cs
        └── ScrapeResponse.cs
```

Unity sends:

```json
{
    "website": "store-a"
}
```

The backend responds:

```json
{
    "success": true,
    "data": [
        {
            "name": "Product A",
            "price": 100
        }
    ]
}
```

Unity then deserializes the JSON into C# models.

---

# 24. Unity Should Know Nothing About Selectors

This is an important architectural rule.

Avoid:

```csharp
Scrape(".product-name");
```

inside Unity.

Instead:

```csharp
await scraperClient.GetProducts("store-a");
```

Unity should only know:

```text
store-a
```

The backend knows:

```text
.product
.product-name
.price
img
```

This means you can change the website configuration without rebuilding your Unity application.

---

# Phase 14 — Admin UI

After the backend works, build a web dashboard for configuring websites.

Possible interface:

```text
┌───────────────────────────────────────────────┐
│ Website URL                                   │
│ [ https://example.com/products             ] │
│                                  [Load Page]  │
├───────────────────────────────────────────────┤
│                                               │
│              Website Preview                  │
│                                               │
│      ┌──────────────────────────────┐         │
│      │ Product                      │         │
│      │                              │         │
│      │ Gaming Laptop                │         │
│      │ $1299                        │         │
│      └──────────────────────────────┘         │
│                                               │
├───────────────────────────────────────────────┤
│ Selected Element                              │
│                                               │
│ Selector: .product                            │
│                                               │
│ Fields                                        │
│                                               │
│ name      .product-name       TEXT            │
│ price     .price              TEXT            │
│ image     img                  SRC             │
│                                               │
│                    [Test Scrape]              │
│                    [Save Config]              │
└───────────────────────────────────────────────┘
```

This allows you to create configurations visually instead of manually editing JSON.

---

# 25. Project Structure

**Status: below is the actual current tree**, not an aspirational target — kept up to date as phases land. `api/routes/websites.ts`, `api/routes/jobs.ts`, and `workers/` from the original plan don't exist yet (Phases 8, 9/11, 12 respectively); `strategies/ApiStrategy.ts` (a JSON/API-only scraper strategy) was never called for by any phase actually implemented and was dropped from the plan.

```text
scraper-system/
│
├── src/
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   └── scrape.ts
│   │   │
│   │   └── schemas/
│   │       └── scrape.schema.ts
│   │
│   ├── core/
│   │   ├── scraper/
│   │   │   └── ScraperEngine.ts        (fetch → cheerio; picks static vs. browser strategy)
│   │   │
│   │   ├── config/
│   │   │   ├── ScraperConfig.ts        (Zod schemas — field/scraper/pagination/site config)
│   │   │   ├── ConfigLoader.ts         (loads + validates configs/websites/<id>.json)
│   │   │   └── featureFlags.ts         (ALLOW_INLINE_CONFIGS)
│   │   │
│   │   ├── errors/
│   │   │   ├── ScraperError.ts         (typed error + error codes)
│   │   │   └── errorHandler.ts         (Fastify setErrorHandler — code → HTTP status)
│   │   │
│   │   ├── http/
│   │   │   ├── HttpClient.ts           (manual redirect-following, timeout, FetchedPage)
│   │   │   └── FetchedPage.ts
│   │   │
│   │   ├── pagination/
│   │   │   └── PaginationEngine.ts     (multi-page loop, safeguards, stopReason)
│   │   │
│   │   └── security/
│   │       └── UrlPolicy.ts            (protocol + private-IP/SSRF allowlist)
│   │
│   ├── strategies/
│   │   ├── ScrapingStrategy.ts
│   │   ├── StaticStrategy.ts
│   │   └── BrowserStrategy.ts          (shared/reused Chromium instance + concurrency limit)
│   │
│   ├── extractors/
│   │   ├── Extractor.ts
│   │   ├── ExtractionEngine.ts
│   │   ├── TextExtractor.ts
│   │   ├── AttributeExtractor.ts
│   │   └── HtmlExtractor.ts
│   │
│   ├── transforms/
│   │   ├── Transform.ts
│   │   ├── TransformPipeline.ts        (name/param resolution + registry)
│   │   ├── applyFieldTransforms.ts     (per-item orchestration + type validation)
│   │   ├── TrimTransform.ts
│   │   ├── RemoveCurrencyTransform.ts
│   │   ├── ParseNumberTransform.ts
│   │   ├── AbsoluteUrlTransform.ts
│   │   ├── RegexTransform.ts
│   │   ├── ReplaceTransform.ts
│   │   └── DefaultTransform.ts
│   │
│   └── index.ts
│
├── configs/
│   └── websites/
│       ├── example.json
│       └── wikipedia.json
│
├── tests/
│   ├── helpers/
│   │   ├── testServer.ts               (local fixture HTTP server for tests)
│   │   └── buildApp.ts                 (in-process Fastify app for route tests)
│   ├── fixtures/                       (saved HTML — no test depends on a live site)
│   ├── setup.ts
│   └── *.test.ts
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .gitignore
```

Not yet present, called for by later phases: `api/routes/websites.ts` + `website.schema.ts` (Phase 8), `api/routes/jobs.ts` + `workers/` (Phases 9/11/12), `.env`/`README.md`.

---

# 26. Development Order

Follow this exact order.

## Milestone 1

```text
[x] Fastify server
[x] Server runs
[x] TypeScript configured
[x] Dependencies installed
```

---

## Milestone 2

```text
[x] POST /scrape
[x] Validate URL
[x] HTTP request
[x] Download HTML
[x] Parse HTML with Cheerio
[x] Return page title
```

---

## Milestone 3

```text
[x] Text extraction
[x] Attribute extraction
[x] HTML extraction
[x] CSS selectors
[x] Multiple elements
[x] Item + fields extraction (extractItems, bridge to Phase 3)
```

---

## Milestone 4

```text
[x] ScraperConfig
[x] JSON configurations
[x] ConfigLoader
[x] Config validation
[x] Configuration-driven extraction
```

---

## Milestone 5

```text
[x] Transform system
[x] trim
[x] parse number
[x] remove currency
[x] absolute URLs
```

---

## Milestone 6

```text
[x] ScrapingStrategy interface
[x] StaticStrategy
[x] BrowserStrategy
[x] Playwright
[x] waitFor
[x] browser timeout
```

---

## Milestone 7

```text
[x] Pagination
[x] maxPages
[x] maxItems
[x] duplicate detection
```

---

## Milestone 8

```text
[x] Standard errors
[x] Logging
[x] Request timeout
[x] Browser cleanup
[x] Better validation
```

---

## Milestone 9

```text
[ ] Website configurations
[ ] GET /websites
[ ] POST /websites
[ ] PUT /websites/:id
[ ] DELETE /websites/:id
```

---

## Milestone 10

```text
[ ] Database
[ ] Configuration persistence
[ ] Configuration versions
```

---

## Milestone 11

```text
[ ] Cache
[ ] Jobs
[ ] Queue
[ ] Workers
```

---

## Milestone 12

```text
[ ] Unity client
[ ] Authentication if needed
[ ] Unity models
[ ] API integration
[ ] Error handling
```

---

# 27. First Real Target

**Achieved.** This works today exactly as originally envisioned — with two small corrections learned along the way: `example.com` no longer has an `<h1>` (its markup changed since this doc was written — see Phase 5's notes), and the item selector needed to be `html` rather than `body` so a field can reach `<title>` in `<head>`.

### Request

```http
POST /scrape
```

```json
{
    "url": "https://example.com",

    "config": {
        "item": {
            "selector": "html"
        },

        "fields": {
            "title": {
                "selector": "title",
                "extract": "text"
            }
        }
    }
}
```

### Response

```json
{
    "success": true,

    "data": [
        {
            "title": "Example Domain"
        }
    ],

    "metadata": {
        "durationMs": 216,
        "items": 1,
        "pages": 1,
        "stopReason": "lastPage",
        "truncated": false,
        "warnings": []
    }
}
```

This is the foundation Phases 2–7 were all built on.

---

# 28. Important Design Rules

## Rule 1 — Keep Unity separate

Unity is a client.

The scraper is a backend service.

---

## Rule 2 — Don't create one scraper class per website

Avoid:

```text
AmazonScraper
WikipediaScraper
NewsScraper
StoreScraper
...
```

Prefer:

```text
ScraperEngine
+
WebsiteConfiguration
```

---

## Rule 3 — Separate responsibilities

Do not create one giant:

```text
Scraper.ts
```

that does everything.

Separate:

```text
HTTP
Browser
Extraction
Transformation
Configuration
Pagination
Caching
API
```

---

## Rule 4 — Prefer interfaces

For example:

```text
ScrapingStrategy
Extractor
Transformer
Cache
```

This allows you to add implementations later without rewriting the engine.

---

## Rule 5 — Configuration should be versionable

Website layouts change.

Therefore:

```text
website-a
    version 1
    version 2
    version 3
```

should eventually be possible.

---

# 29. Security and Reliability

Because this API accepts URLs, treat it as a potentially dangerous boundary.

If the service is ever exposed outside your own machine, do not blindly allow arbitrary servers to be requested.

At minimum consider:

```text
[x] URL validation           — protocol allowlist (http/https only), Zod-validated
[x] SSRF / private-network blocking — see below
[x] request timeouts         — per-request + overall pagination budget
[x] redirect limits          — max 5 hops, each hop re-validated
[x] concurrency limits       — browser strategy caps concurrent Chromium pages (default 2)
[ ] response-size limits     — not yet implemented
[ ] rate limiting            — not yet implemented
[ ] resource limits          — not yet implemented (beyond browser concurrency)
[x] logging                  — Fastify's logger + ScraperError codes
[ ] authentication           — not yet implemented (fine while this only runs locally)
```

Be especially careful about server-side request forgery (SSRF). A public scraper API should not be able to freely request internal network addresses or cloud metadata endpoints.

**This was a real, demonstrated vulnerability, not a hypothetical** — an audit found that browser mode (`scraper.type: "browser"`) could navigate to `file:///` URLs and return local file contents as "scraped data," and nothing blocked requests to `127.0.0.1`, `10.0.0.0/8`, `169.254.169.254` (cloud metadata), etc. Fixed in `src/core/security/UrlPolicy.ts`: only `http`/`https` are allowed, and every hostname is DNS-resolved and checked against the private/loopback/link-local ranges before every fetch — the initial URL, every redirect hop, and every pagination "next" page. An `ALLOW_PRIVATE_NETWORKS=true` env var exists solely so the test suite can hit its own local fixture server; it must stay unset (or `false`) anywhere this API is actually reachable.

Also respect the target site's terms, robots policies where applicable, copyright, and access controls.

---

# 30. Current Status and What's Actually Next

Phases 1–7 are complete and tested (see each phase's own "Status" line above, and `tests/`). That original three-step arc this section used to describe —

```text
POST /scrape → validate → fetch → parse → extract page title
                                              ↓
                            HTML → CSS selector → Extractor → JSON
                                              ↓
                JSON configuration → Scraper Engine → Extractor → Transformers → JSON
```

— is exactly what exists today, plus pagination, dynamic (Playwright) sites, standard error codes, and a security-hardening pass (SSRF/private-network blocking, timeouts, redirect limits, browser reuse) that came out of an audit rather than a planned phase.

Genuinely next, in order, per the phase list in Section 4:

```text
Phase 8  → Website configuration manager (GET/POST/PUT/DELETE /websites)
Phase 9  → Database (move configs off the filesystem)
Phase 10 → Caching
Phase 11 → Scraping jobs (async, for slow browser-mode scrapes)
Phase 12 → Queue system (BullMQ + Redis, only once jobs exist)
Phase 13 → Unity client
Phase 14 → Admin UI
```

Also still open, noted but deliberately deferred during the audit (see each phase's notes above for why): nested objects/sub-items in extraction, `pagination.mode: "click"` / `"urlPattern"` for pagination that isn't link-based, response-size limits, and rate limiting.