const form = document.getElementById("form");
const sqliteFields = document.getElementById("sqlite-fields");
const databasePathInput = document.getElementById("databasePath");
const adminApiKeyInput = document.getElementById("adminApiKey");
const startBtn = document.getElementById("start-btn");
const statusEl = document.getElementById("status");

function showStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = kind;
}

function syncSqliteFieldVisibility() {
    const selected = document.querySelector('input[name="configStorage"]:checked').value;
    sqliteFields.classList.toggle("hidden", selected !== "sqlite");
}

document.querySelectorAll('input[name="configStorage"]').forEach((el) => {
    el.addEventListener("change", syncSqliteFieldVisibility);
});

async function init() {
    const settings = await window.scraperAdmin.getSettings();

    if (settings.configStorage === "sqlite") {
        document.querySelector('input[name="configStorage"][value="sqlite"]').checked = true;
    }
    databasePathInput.value = settings.databasePath || "";
    adminApiKeyInput.value = settings.adminApiKey || "";
    syncSqliteFieldVisibility();
}

startBtn.addEventListener("click", async () => {
    const configStorage = document.querySelector('input[name="configStorage"]:checked').value;
    const settings = {
        configStorage,
        databasePath: databasePathInput.value.trim(),
        adminApiKey: adminApiKeyInput.value.trim()
    };

    startBtn.disabled = true;
    form.disabled = true;
    showStatus("Starting backend…", "info");

    const result = await window.scraperAdmin.startWithSettings(settings);

    if (!result.success) {
        showStatus(`Could not start the backend: ${result.error}`, "error");
        startBtn.disabled = false;
        form.disabled = false;
        return;
    }

    if (result.reusedExisting) {
        showStatus("A server is already running on port 3000 — using it as-is. These settings were not applied.", "info");
    }
    // On success, main.js navigates this window to the admin UI — nothing else to do here.
});

init();
