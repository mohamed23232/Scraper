import { escapeHtml, copyToClipboard } from "./utils.js";
import { listWebsites } from "./api.js";
import { getAdminApiKey } from "./auth.js";
import { icon } from "./icons.js";

export async function renderConnectView(container) {
    const baseUrl = window.location.origin;
    const adminKey = getAdminApiKey();

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Connect a client</h2>
                <p>Everything another app — Unity, a web front end, a script, Postman — needs to talk to this backend.</p>
            </div>
        </div>

        <div class="card form-section">
            <div class="section-title"><span class="icon">${icon("globe", 16)}</span> Base URL</div>
            <p class="section-hint">Use this exact address in any client's configuration. It already matches how you're reaching this page right now — same machine, use it as-is; a different device on your network, use this machine's LAN IP with the same port instead of "localhost".</p>
            <div class="copy-row">
                <code class="copy-value">${escapeHtml(baseUrl)}</code>
                <button type="button" class="btn-small" data-copy="${escapeHtml(baseUrl)}">Copy</button>
            </div>
        </div>

        <div class="card form-section">
            <div class="section-title"><span class="icon">${icon("key", 16)}</span> Admin API key</div>
            ${adminKey
                ? `<p class="section-hint">Only needed by a client that creates, updates, or deletes saved configs — not for scraping. This is the key currently entered in the bar above.</p>
                   <div class="copy-row">
                       <code class="copy-value">${escapeHtml(adminKey)}</code>
                       <button type="button" class="btn-small" data-copy="${escapeHtml(adminKey)}">Copy</button>
                   </div>`
                : `<p class="section-hint">No key is entered in this session. If the backend has one configured, a client only needs it to create/update/delete saved configs — scraping and browsing never require it. Enter it in the bar at the top of this page to see it here.</p>`}
        </div>

        <div class="card form-section">
            <div class="section-title"><span class="icon">${icon("sliders", 16)}</span> Saved websites</div>
            <p class="section-hint">The id any client sends to scrape one of these — no selectors, no fields, just the id.</p>
            <div id="connect-website-list"><p class="muted">Loading…</p></div>
        </div>

        <div class="card form-section" id="connect-examples">
            <div class="section-title"><span class="icon">${icon("play", 16)}</span> Quick examples</div>
            <p class="section-hint">Loading…</p>
        </div>

        ${section("Endpoint reference", `
            <table class="guide-table">
                <thead><tr><th>Method &amp; path</th><th>Needs the admin key?</th><th>What it does</th></tr></thead>
                <tbody>
                    <tr><td><code>POST /scrape</code></td><td>No</td><td>Run a saved config — <code>{"website":"&lt;id&gt;"}</code></td></tr>
                    <tr><td><code>GET /websites</code></td><td>No</td><td>List saved configs</td></tr>
                    <tr><td><code>GET /websites/:id</code></td><td>No</td><td>Fetch one full saved config</td></tr>
                    <tr><td><code>POST /websites</code></td><td>Yes*</td><td>Create a new saved config</td></tr>
                    <tr><td><code>PUT /websites/:id</code></td><td>Yes*</td><td>Create or replace a saved config</td></tr>
                    <tr><td><code>DELETE /websites/:id</code></td><td>Yes*</td><td>Remove a saved config</td></tr>
                    <tr><td><code>GET /jobs/:id</code></td><td>No</td><td>Poll an async ("async":true) scrape job</td></tr>
                </tbody>
            </table>
            <p class="muted">*Only if this backend has <code>ADMIN_API_KEY</code> set at all — otherwise these are open too (with a startup warning logged on the server).</p>
        `)}
    `;

    container.querySelectorAll("[data-copy]").forEach((btn) => {
        btn.addEventListener("click", () => copyToClipboard(btn.dataset.copy, btn));
    });

    const response = await listWebsites();
    const websiteListEl = container.querySelector("#connect-website-list");
    const websites = response.success ? (response.data || []) : [];

    websiteListEl.innerHTML = websites.length === 0
        ? `<p class="muted">No saved websites yet — build one in the Websites tab first.</p>`
        : websites.map((w) => `
            <div class="copy-row">
                <code class="copy-value">${escapeHtml(w.id)}</code>
                <span class="muted">${escapeHtml(w.name || "")}</span>
                <button type="button" class="btn-small" data-copy="${escapeHtml(w.id)}">Copy id</button>
            </div>
        `).join("");

    websiteListEl.querySelectorAll("[data-copy]").forEach((btn) => {
        btn.addEventListener("click", () => copyToClipboard(btn.dataset.copy, btn));
    });

    renderExamples(container.querySelector("#connect-examples"), baseUrl, websites[0]?.id || "your-website-id");
}

function renderExamples(container, baseUrl, exampleId) {
    const curl = `curl -X POST ${baseUrl}/scrape \\\n  -H "Content-Type: application/json" \\\n  -d '{"website": "${exampleId}"}'`;

    const js = `const res = await fetch("${baseUrl}/scrape", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ website: "${exampleId}" })\n});\nconst { success, data } = await res.json();`;

    const csharp = `// Using this project's Unity client (ScraperClient.cs) — BaseUrl on your\n// ScraperClientConfig asset should be "${baseUrl}"\nvar result = await scraperClient.ScrapeWebsiteRaw("${exampleId}");\nif (result.IsSuccess) {\n    foreach (var item in result.Value) { /* item["fieldName"] */ }\n}`;

    container.innerHTML = `
        <div class="section-title"><span class="icon">${icon("play", 16)}</span> Quick examples</div>
        <p class="section-hint">All three do the same thing: run the "${escapeHtml(exampleId)}" saved config and get its data back.</p>
        ${exampleBlock("cURL / terminal", curl)}
        ${exampleBlock("JavaScript (fetch)", js)}
        ${exampleBlock("Unity (this project's C# client)", csharp)}
    `;

    container.querySelectorAll("[data-copy-block]").forEach((btn) => {
        btn.addEventListener("click", () => copyToClipboard(btn.dataset.copyBlock, btn));
    });
}

function exampleBlock(title, code) {
    return `
        <div class="example-card">
            <h4>${escapeHtml(title)}</h4>
            <pre class="raw-json">${escapeHtml(code)}</pre>
            <button type="button" class="btn-small" data-copy-block="${escapeHtml(code)}">Copy</button>
        </div>
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
