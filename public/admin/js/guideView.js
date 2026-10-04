import { icon } from "./icons.js";

export function renderGuideView(container) {
    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Guide</h2>
                <p>How to build, test, and save a scraping config with this tool.</p>
            </div>
        </div>

        ${section("1. The basic workflow", `
            <ol class="guide-steps">
                <li><strong>Find your selectors first.</strong> Open the target page in your browser, right-click the thing you want &rarr; <em>Inspect</em>, and note its CSS class or id. Do this before touching this tool &mdash; it's the one step this UI can't do for you.</li>
                <li><strong>Click "+ New Website"</strong> from the Websites tab.</li>
                <li><strong>Fill in Id, Start URL, and the Item selector</strong> &mdash; the Item selector matches one repeating "card" (e.g. one product, one article). If you just want a single value from the page (see §3), switch to <em>Single value (flat)</em> mode instead and skip this.</li>
                <li><strong>Add fields</strong> &mdash; one row per piece of data, with a selector relative to the item.</li>
                <li><strong>Click Test Scrape.</strong> Fix selectors based on what comes back &mdash; an error tells you exactly which field failed.</li>
                <li><strong>Click Save</strong> once it looks right. From then on the config is reusable by id.</li>
            </ol>
        `)}

        ${section("2. Item + Fields mode", `
            <p>This is the default mode, for extracting a <strong>repeating list</strong> &mdash; every product on a page, every article, every row. Each field's selector is evaluated <em>relative to the item</em>, not the whole page.</p>
            <div class="guide-field-grid">
                ${fieldDoc("Selector", "Where to find this value, relative to the item (e.g. <code>.price</code>).")}
                ${fieldDoc("Extract", "<code>text</code> (visible text), <code>html</code> (inner markup), or <code>attribute</code> (one HTML attribute &mdash; set the Attribute box too, e.g. <code>href</code> or <code>src</code>).")}
                ${fieldDoc("Multi", "Off = use only the first match. On = collect every match into a list (e.g. several tags on one product).")}
                ${fieldDoc("Req", "On (default) = fail the whole scrape if this selector isn't found on an item. Off = quietly fall back to Default instead.")}
                ${fieldDoc("Default", "The value to use when Req is off and nothing matched. Type <code>false</code>, <code>0</code>, or plain text &mdash; it's parsed automatically.")}
                ${fieldDoc("Type", "An optional check: after any transforms run, the value must already be this type or the scrape fails. Pair it with a transform that actually produces that type (e.g. <code>parseNumber</code> before setting Type to <code>number</code>).")}
                ${fieldDoc("Transforms", "A chain of cleanup steps run in order &mdash; see §4.")}
            </div>
        `)}

        ${section("3. Single value (flat) mode &mdash; “just give me the page HTML”", `
            <p>Item + Fields mode always requires an item selector <em>and</em> at least one field &mdash; that's a hard rule of the config shape, not a bug. If you don't want a repeating list at all, just one value (or every match of one selector, with no per-item wrapping), switch to <strong>Single value (flat)</strong> at the top of the editor instead.</p>
            <p>To grab a page's entire HTML: set <strong>Selector</strong> to <code>html</code> and <strong>Extract</strong> to <code>html</code>. To grab every link's address: selector <code>a</code>, extract <code>attribute</code>, attribute <code>href</code> &mdash; you'll get a list of every URL on the page.</p>
            <p class="muted">Trade-off: flat results can be Test Scraped but not Saved as a reusable website config &mdash; the backend only supports saving the Item + Fields shape. If you'll reuse it, wrap it as a one-field Item + Fields config instead (item selector <code>html</code>, one field with selector <code>body</code>, extract <code>html</code> gets you almost the same thing, saved).</p>
        `)}

        ${section("4. Transforms", `
            <p>A chain of cleanup steps applied to an extracted value, run in order &mdash; each step's output feeds the next.</p>
            <table class="guide-table">
                <thead><tr><th>Transform</th><th>What it does</th></tr></thead>
                <tbody>
                    <tr><td><code>trim</code></td><td>Strips leading/trailing whitespace.</td></tr>
                    <tr><td><code>removeCurrency</code></td><td>Strips <code>$</code>, <code>&euro;</code>, commas, etc. from a price-like string.</td></tr>
                    <tr><td><code>parseNumber</code></td><td>Converts a numeric string into a real number. Has a Decimal separator option for "1.299,00"-style numbers.</td></tr>
                    <tr><td><code>absoluteUrl</code></td><td>Turns a relative link (<code>/item/42</code>) into a full URL.</td></tr>
                    <tr><td><code>regex</code></td><td>Extracts a regex match or capture group (Pattern, optional Group #, optional Flags).</td></tr>
                    <tr><td><code>replace</code></td><td>Regex find-and-replace (Pattern, Replacement, optional Flags).</td></tr>
                    <tr><td><code>default</code></td><td>Substitutes a fixed Value when the extracted value is empty &mdash; the only transform that still runs on an empty value.</td></tr>
                </tbody>
            </table>
            <p class="muted">Example chain for a price field: <code>trim</code> &rarr; <code>removeCurrency</code> &rarr; <code>parseNumber</code> turns <code>"&nbsp;$1,299.00&nbsp;"</code> into the number <code>1299</code>.</p>
        `)}

        ${section("5. Scraper, Pagination, Cache", `
            <div class="guide-field-grid">
                ${fieldDoc("Scraper &middot; Type", "<code>static</code> (default) downloads raw HTML &mdash; fast, works when the data is in “View Page Source”. <code>browser</code> runs a real headless Chromium first &mdash; slower, but needed when the data only appears after the page's own JavaScript runs.")}
                ${fieldDoc("Scraper &middot; Wait for selector", "Browser mode only: waits for this element to exist before reading the page &mdash; use it for content that loads after the initial page load.")}
                ${fieldDoc("Pagination", "Turn on and set a Next-page selector to follow “next page” links automatically across many pages, up to Max pages/items/duration. The result tells you why it stopped (ran out of pages, hit a limit, or an error).")}
                ${fieldDoc("Cache", "Turn on with a TTL (seconds) to reuse a recent identical result instead of re-scraping &mdash; the results strip shows a Cached badge when this kicks in.")}
            </div>
        `)}

        ${section("6. Worked examples", `
            <div class="example-card">
                <h4>${icon("globe", 15)} A single field, from the built-in "example" config</h4>
                <p>Item selector <code>html</code> (matches the whole page once), one field: name <code>title</code>, selector <code>title</code>, extract <code>text</code>. Open the saved <strong>example</strong> config from the Websites tab to see this live.</p>
            </div>
            <div class="example-card">
                <h4>${icon("globe", 15)} A product list</h4>
                <p>Item selector <code>.product-card</code>. Fields: <code>name</code> (selector <code>.product-title</code>, extract text) &middot; <code>price</code> (selector <code>.price</code>, extract text, transforms <code>trim</code> &rarr; <code>removeCurrency</code> &rarr; <code>parseNumber</code>, Type <code>number</code>) &middot; <code>image</code> (selector <code>img</code>, extract attribute, attribute <code>src</code>).</p>
            </div>
            <div class="example-card">
                <h4>${icon("globe", 15)} The whole page's HTML</h4>
                <p>Switch to <strong>Single value (flat)</strong>. Selector <code>html</code>, extract <code>html</code>. Test Scrape returns one item: the full page markup.</p>
            </div>
        `)}

        ${section("7. When something fails", `
            <p>Every failure shows a red banner with a short code and a plain-language message:</p>
            <div class="guide-field-grid">
                ${fieldDoc("SELECTOR_NOT_FOUND", "That selector matched nothing on the page (or inside the item). Re-check it in your browser's DevTools.")}
                ${fieldDoc("CONFIG_NOT_FOUND", "The website id you asked for doesn't exist &mdash; check the Websites list.")}
                ${fieldDoc("URL_NOT_ALLOWED", "The target URL resolves to a private/internal address or a disallowed protocol &mdash; blocked for safety, not a selector problem.")}
                ${fieldDoc("TIMEOUT", "The page took too long &mdash; try raising Scraper &middot; Timeout, or switch to browser mode if the site is slow to render.")}
            </div>
        `)}
    `;
}

function section(title, bodyHtml) {
    return `
        <div class="card form-section guide-section">
            <h3>${title}</h3>
            ${bodyHtml}
        </div>
    `;
}

function fieldDoc(term, html) {
    return `<div class="guide-field"><div class="term">${term}</div><div class="desc">${html}</div></div>`;
}
