# Unity Client Setup

How to connect a Unity project to the Scraping System backend. This assumes the backend (either the desktop Admin UI app or `npm run dev`) is already running somewhere, see [`README.md`](./README.md) if it isn't yet.

Unity never needs to know about selectors, CSS, or how a website's page is structured, it only ever asks for a saved website by its id and gets back data. All of that is handled by the `ScraperClient` C# classes described below.

## 1. Requirements

- Unity 6000.x or later (this client was built and verified against 6000.3.10f1).
- The **Newtonsoft Json.NET** package, add it via the Package Manager: `Window → Package Manager → + → Add package by name… → com.unity.nuget.newtonsoft-json`.

## 2. Get the client scripts


```
Networking/Scraper/
    ScraperClient.cs                 — the class your game code calls
    ScraperClientConfig.cs           — a ScriptableObject holding the backend URL/key
    Models/                          — result types, error types, generic record type
    Internal/                        — HTTP/JSON plumbing (not called directly)
    UI/ScraperFeedbackPanel.cs       — optional: a visual status/log HUD panel for a Canvas
Demo/
    ExampleItem.cs, ScraperDemoController.cs   — optional: a working example scene script
```

You don't need to modify any of these files to use the client — only `ScraperClientConfig` (a data asset, not code) needs your input.

## 3. Create the config asset

In the Project window: right-click → **Create → Scraper → Client Config**. Select it and fill in:

| Field | Value |
|---|---|
| **Base Url** | The URL from the backend's **Connect** tab (Admin UI → Connect tab → "Base URL" box, with a Copy button). Usually `http://localhost:3000` if Unity and the backend run on the same machine. |
| **Request Timeout Seconds** | Leave at the default (15) unless you have a reason to change it. |
| **Admin Api Key** | Only fill this in if you're calling the admin-only methods (`CreateWebsite`/`UpdateWebsite`/`DeleteWebsite`) — also copyable from the Connect tab. Leave blank for normal gameplay scraping. |

**Different machines?** If the backend runs on a different computer than the one running Unity, use that machine's LAN IP instead of `localhost` (e.g. `http://192.168.1.50:3000`), and make sure Windows Firewall on that machine allows inbound connections on port 3000.

## 4. Call it from your code

Drag the config asset into a `[SerializeField] ScraperClientConfig` reference, then:

```csharp
var client = new ScraperClient(myConfig);

// Simplest path — no C# class needed per website, read fields by name:
var result = await client.ScrapeWebsiteRaw("your-website-id");
if (result.IsSuccess)
{
    foreach (var item in result.Value)
    {
        string title = item["title"]?.ToString();
    }
}
else
{
    Debug.LogError($"{result.Error.Code}: {result.Error.Message}");
}
```

## 5. See it work before writing your own code

Attach `ScraperDemoController` (from the `Demo/` folder) to an empty GameObject, assign your `ScraperClientConfig`, and press Play, it runs through six request paths (typed, raw, an expected error, async, and the fully-generic SO-driven path) and logs each result to the Console. Optionally assign a `ScraperFeedbackPanel` (create an empty GameObject under a Canvas, add that component) to its `Feedback` slot to see the same progress as a status/log HUD at runtime instead of only in the Console.

## 6. Common issues

| Symptom | Fix |
|---|---|
| Every call fails with a network error | The backend isn't running, open the Admin UI app (or `npm run dev`) first. |
| Works in the Unity **Editor** but not in a **standalone build** | Player Settings → **Player → Other Settings → Allow downloads over HTTP** must be `Always allowed`. The backend uses plain `http://`, not `https://`, and Unity blocks that by default in built players. |
| `ConfigNotFound` error | The website id doesn't exist on this backend, check the **Websites** tab (or `GET /websites`) for the exact id. |
| A `ScraperWebsiteDefinition`'s `Url Override` field causes an `INVALID_CONFIGURATION`/"Invalid URL" error | Leave it completely blank, not a placeholder string, a blank Inspector field is sent as `""`, and an explicit empty string there is invalid. (Already fixed in the current client; mentioned here in case you're on an older copy.) |
