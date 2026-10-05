# How to Build a Config for a Website

A walkthrough for turning "I want this data from this website" into a saved config in the Admin UI. No coding involved, this is all done in the browser-based (or desktop app) interface.

This is also available inside the app itself under the **Guide** tab, with the same content kept in sync with whatever this file says.

## The one step the app can't do for you: find your selectors

Before touching the Admin UI, open the target website in your own browser and figure out *where* the data you want actually lives in the page's HTML:

1. Right-click the piece of text/image/link you want → **Inspect**. This opens DevTools with that exact element highlighted.
2. Look at its `class` or `id` in the highlighted HTML. A class like `class="product-title"` becomes the selector `.product-title`; an id like `id="price"` becomes `#price`.
3. **Test it before using it anywhere**, in the DevTools Console tab, type:
   ```js
   document.querySelectorAll(".product-title").length        // how many matches?
   document.querySelectorAll(".product-title")[0].textContent // what's actually in it?
   ```
   If the count looks wrong, the selector is wrong or too broad, fix it here, before it ever reaches the Admin UI. This single habit will save you more time than anything else in this guide.
4. For a repeating list (every product, every article, every row): find the smallest element that wraps **one full item**, that's your item selector. Then find each field's selector **relative to that item**, it only needs to be unique *inside* one item, not on the whole page.
5. **Watch for duplicate/decoy matches.** Some sites reuse a class on more than one element per item (a hidden button, a second mobile-only copy of the same card). Always sanity-check the match *count* from step 3, if something matches 3 elements when you expected 1, narrow the selector by scoping it to a parent (e.g. `#results .load-more` instead of just `.load-more`).

## Static vs. browser mode, which one does this site need?

This decides whether your data even exists for the scraper to find, so get it right before anything else:

1. On the target page, right-click → **View Page Source** (not Inspect — this shows the *raw* HTML before any JavaScript runs).
2. Ctrl+F for the text you want.
3. **Found it?** → Scraper type `static` (the default, and much faster).
4. **Not found, but visible on the real page?** → the site builds it with JavaScript after loading. Use Scraper type `browser`, this runs a real headless browser that executes the page's JavaScript before reading it.
5. Still missing in browser mode? The content probably loads after a delay (on scroll, or after its own API call). Set **Wait for selector** to something that only exists once that content has loaded.

## Building the config in the Admin UI

Open the **Websites** tab → **+ New Website**.

### Mode: Item + Fields vs. Single value (flat)

- **Item + Fields** (the default): for a repeating list, every product, every article. Requires an item selector and at least one field.
- **Single value (flat)**: for one value, or every match of one selector with no per-item wrapping, e.g. "just give me the whole page's HTML" (selector `html`, extract `html`) or "every link on the page" (selector `a`, extract `attribute`, attribute `href`). Can be tested but not saved as a reusable config, the backend only supports saving the Item + Fields shape.

### Field options, in full

| Option | Values | Default | What it does |
|---|---|---|---|
| Selector | any CSS selector | *(required)* | Where to find this value, relative to the item |
| Extract | `text` / `html` / `attribute` | *(required)* | `text` = visible text, `html` = inner markup, `attribute` = one HTML attribute (also set **Attribute**, e.g. `href` or `src`) |
| Multi | on/off | off | Off = first match only. On = every match, as a list (e.g. several tags on one product) |
| Req | on/off | on | On = fail the whole item if this selector isn't found. Off = quietly fall back to **Default** instead |
| Default | any value | — | Used only when Req is off and nothing matched. Type `false`, `0`, or plain text — it's parsed automatically |
| Type | `string`/`number`/`boolean`/`url` | — | A check, not a conversion: after transforms run, the value must already be this type or the scrape fails. Pair it with a transform that produces that type |
| Transforms | see below | — | A cleanup chain, run in order |

### Transforms, in full

| Name | What it does |
|---|---|
| `trim` | Strips leading/trailing whitespace |
| `removeCurrency` | Strips `$`, `€`, commas, etc. from a price-like string |
| `parseNumber` | Converts a numeric string to a real number (has a decimal-separator option for "1.299,00"-style numbers) |
| `absoluteUrl` | Turns a relative link (`/item/42`) into a full URL |
| `regex` | Extracts a regex match or capture group (pattern, optional group #, optional flags) |
| `replace` | Regex find-and-replace (pattern, replacement, optional flags) |
| `default` | Substitutes a fixed value when the extracted value is empty, the only transform that still runs on an empty value |

Example chain for a price field: `trim` → `removeCurrency` → `parseNumber` turns `"  $1,299.00  "` into the number `1299`.

### Scraper, Pagination, Cache

- **Scraper → Type**: `static` or `browser`, as decided above. **Timeout**: how long to wait before giving up. **Wait for selector**: browser mode only. **Block images/fonts**: browser mode only, on by default for speed.
- **Pagination**: turn on, set a **Next-page selector** (the "next page" link, double-check it isn't matching a decoy elsewhere on the page). **Max pages/items/duration** cap how far it goes. The result tells you exactly why it stopped: ran out of pages (`lastPage`), hit a limit (`maxPages`/`maxItems`/`timeout`), or a later page failed (`error`).
- **Cache**: turn on with a TTL in seconds to reuse a recent identical result instead of re-scraping, the results panel shows a `Cached: yes` badge when this kicks in.

## Test, fix, save

1. Click **Test Scrape**. The results table shows exactly what came back; an error banner shows the exact code and message if something's wrong, it tells you which field or selector failed, not just "it broke."
2. Fix selectors based on what you see, repeat.
3. Once it looks right, click **Save**. It's now reusable by id from any client, see the **Connect** tab for copy-paste examples in cURL, JavaScript, and Unity/C#.


## When something fails

| Error code | What it means |
|---|---|
| `SELECTOR_NOT_FOUND` | That selector matched nothing on the page (or inside the item). Re-check it in DevTools. |
| `CONFIG_NOT_FOUND` | The website id you asked for doesn't exist, check the Websites list. |
| `URL_NOT_ALLOWED` | The target URL resolves to a private/internal address or disallowed protocol, blocked for safety, not a selector problem. |
| `TIMEOUT` | The page took too long, raise Scraper → Timeout, or try browser mode if the site renders slowly. |
| `INVALID_CONFIGURATION` | The request itself doesn't match the expected shape (e.g. an empty string where a real URL or value was required), check for blank optional fields that should either have a real value or be left out entirely. |

A site that actively blocks automated requests (bot-detection, CAPTCHA challenges) will fail in ways no selector fix can solve, that's the target site's own defense working as intended, not a bug in a config.
