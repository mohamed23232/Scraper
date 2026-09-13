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
Phase 7  → Scraping jobs
Phase 8  → Database and saved configurations
Phase 9  → Caching
Phase 10 → Unity integration
Phase 11 → Admin/configuration UI
Phase 12 → Production hardening
```

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

Create:

```text
src/
└── transforms/
    ├── Transform.ts
    ├── TrimTransform.ts
    ├── ParseNumberTransform.ts
    ├── RemoveCurrencyTransform.ts
    └── AbsoluteUrlTransform.ts
```

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

Example:

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
removeComma
      ↓
"1299.99"
      ↓
parseNumber
      ↓
1299.99
```

---

# Phase 5 — Dynamic Websites

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

Create:

```text
src/
└── strategies/
    ├── ScrapingStrategy.ts
    ├── StaticStrategy.ts
    └── BrowserStrategy.ts
```

Use an interface:

```typescript
interface ScrapingStrategy {

    scrape(url: string): Promise<string>;

}
```

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

Eventually support options such as:

```json
{
    "scraper": {
        "type": "browser",

        "waitFor": ".products",

        "timeout": 10000
    }
}
```

The browser strategy can:

```text
Launch browser
      ↓
Navigate
      ↓
Wait for required element
      ↓
Obtain DOM
      ↓
Pass DOM to extraction engine
```

Respect website terms, robots policies, authentication boundaries, and access controls. The system should not attempt to defeat CAPTCHAs or other access-control mechanisms.

---

# Phase 6 — Pagination

Many websites have:

```text
Page 1
Page 2
Page 3
Page 4
...
```

Your configuration should eventually support:

```json
{
    "pagination": {
        "enabled": true,

        "nextSelector": ".next",

        "maxPages": 10
    }
}
```

The engine:

```text
Page 1
 ↓
Extract
 ↓
Find next button
 ↓
Page 2
 ↓
Extract
 ↓
Find next button
 ↓
...
```

Important safeguards:

```text
maxPages
maxItems
timeout
duplicate URL detection
```

These prevent accidental infinite scraping.

---

# Phase 7 — Better Data Models

At this point, introduce a consistent internal result model.

Something like:

```typescript
interface ScrapeResult<T> {

    success: boolean;

    url: string;

    data?: T;

    error?: {
        code: string;
        message: string;
    };

    metadata?: {
        duration: number;
        pages: number;
        items: number;
    };
}
```

This makes your API predictable.

---

# 22. Error Handling

Define standard error types.

For example:

```text
INVALID_URL
INVALID_CONFIGURATION
REQUEST_FAILED
TIMEOUT
PAGE_NOT_FOUND
SELECTOR_NOT_FOUND
BROWSER_ERROR
PARSING_ERROR
TRANSFORMATION_ERROR
PAGINATION_LIMIT
```

Instead of returning random errors from different parts of the application.

Example:

```json
{
    "success": false,

    "error": {
        "code": "SELECTOR_NOT_FOUND",
        "message": "Could not find selector '.product-name'"
    }
}
```

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

# 25. Recommended Final Project Structure

Eventually aim for:

```text
scraper-system/
│
├── src/
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── scrape.ts
│   │   │   ├── websites.ts
│   │   │   └── jobs.ts
│   │   │
│   │   ├── schemas/
│   │   │   ├── scrape.schema.ts
│   │   │   └── website.schema.ts
│   │   │
│   │   └── server.ts
│   │
│   ├── core/
│   │   ├── ScraperEngine.ts
│   │   ├── ScrapeContext.ts
│   │   ├── ScrapeResult.ts
│   │   │
│   │   └── config/
│   │       ├── ScraperConfig.ts
│   │       └── ConfigLoader.ts
│   │
│   ├── strategies/
│   │   ├── ScrapingStrategy.ts
│   │   ├── StaticStrategy.ts
│   │   ├── BrowserStrategy.ts
│   │   └── ApiStrategy.ts
│   │
│   ├── extractors/
│   │   ├── ExtractionEngine.ts
│   │   ├── TextExtractor.ts
│   │   ├── AttributeExtractor.ts
│   │   └── HtmlExtractor.ts
│   │
│   ├── transforms/
│   │   ├── Transform.ts
│   │   ├── TrimTransform.ts
│   │   ├── ParseNumberTransform.ts
│   │   └── AbsoluteUrlTransform.ts
│   │
│   ├── workers/
│   │   └── scraper.worker.ts
│   │
│   └── index.ts
│
├── configs/
│   └── websites/
│       ├── example.json
│       └── ...
│
├── tests/
│   ├── extractors/
│   ├── transforms/
│   └── strategies/
│
├── package.json
├── tsconfig.json
├── .env
├── .gitignore
└── README.md
```

---

# 26. Development Order

Follow this exact order.

## Milestone 1

```text
[ ] Fastify server
[x] Server runs
[x] TypeScript configured
[x] Dependencies installed
```

You are here.

---

## Milestone 2

```text
[ ] POST /scrape
[ ] Validate URL
[ ] HTTP request
[ ] Download HTML
[ ] Parse HTML with Cheerio
[ ] Return page title
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
[ ] Transform system
[ ] trim
[ ] parse number
[ ] remove currency
[ ] absolute URLs
```

---

## Milestone 6

```text
[ ] ScrapingStrategy interface
[ ] StaticStrategy
[ ] BrowserStrategy
[ ] Playwright
[ ] waitFor
[ ] browser timeout
```

---

## Milestone 7

```text
[ ] Pagination
[ ] maxPages
[ ] maxItems
[ ] duplicate detection
```

---

## Milestone 8

```text
[ ] Standard errors
[ ] Logging
[ ] Request timeout
[ ] Browser cleanup
[ ] Better validation
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

Before adding Playwright, databases, queues, or Unity, make this work:

### Request

```http
POST /scrape
```

```json
{
    "url": "https://example.com",

    "config": {
        "item": {
            "selector": "body"
        },

        "fields": {
            "title": {
                "selector": "h1",
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
    ]
}
```

Once this works, you have the foundation of the entire system.

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
URL validation
request timeouts
response-size limits
redirect limits
rate limiting
concurrency limits
resource limits
logging
authentication
```

Be especially careful about server-side request forgery (SSRF). A public scraper API should not be able to freely request internal network addresses or cloud metadata endpoints.

Also respect the target site's terms, robots policies where applicable, copyright, and access controls.

---

# 30. The Immediate Next Step

Do **not** implement the whole roadmap now.

Your immediate task is:

```text
                    POST /scrape
                         │
                         ▼
                  Validate URL
                         │
                         ▼
                    HTTP GET
                         │
                         ▼
                       HTML
                         │
                         ▼
                      Cheerio
                         │
                         ▼
                    Page title
                         │
                         ▼
                      JSON
```

After that works, move to:

```text
HTML
 ↓
CSS selector
 ↓
Extractor
 ↓
JSON
```

Then:

```text
JSON configuration
 ↓
Scraper Engine
 ↓
Extractor
 ↓
Transformers
 ↓
JSON
```

That is the point where your project becomes a genuinely **configuration-driven scraping system** rather than a collection of website-specific scripts.