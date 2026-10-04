const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");
const Store = require("electron-store");

const BACKEND_URL = "http://localhost:3000";
const READY_LINE = "Server running on http://localhost:3000";
const START_TIMEOUT_MS = 30000;

const store = new Store({
    defaults: {
        settings: { configStorage: "file", databasePath: "", adminApiKey: "" }
    }
});

let mainWindow = null;
let backendProcess = null;
let appliedAdminKey = "";

function backendRepoRoot() {
    // Dev mode: electron/ sits one level under the backend repo root.
    return path.join(__dirname, "..");
}

/** Quick check for a server already answering on BACKEND_URL — if so, we reuse it rather than spawn a second one. */
function pingExisting() {
    return new Promise((resolve) => {
        const req = http.get(`${BACKEND_URL}/websites`, { timeout: 1500 }, (res) => {
            res.resume();
            resolve(res.statusCode !== undefined);
        });
        req.on("error", () => resolve(false));
        req.on("timeout", () => {
            req.destroy();
            resolve(false);
        });
    });
}

function waitForReady(child) {
    return new Promise((resolve, reject) => {
        let settled = false;
        let stderrBuffer = "";

        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new Error(`Backend did not report ready within ${START_TIMEOUT_MS / 1000}s.${stderrBuffer ? ` stderr: ${stderrBuffer.slice(-500)}` : ""}`));
            }
        }, START_TIMEOUT_MS);

        child.stdout.on("data", (chunk) => {
            const text = chunk.toString();
            console.log(`[backend] ${text.trim()}`);
            if (!settled && text.includes(READY_LINE)) {
                settled = true;
                clearTimeout(timer);
                resolve();
            }
        });

        child.stderr.on("data", (chunk) => {
            const text = chunk.toString();
            console.error(`[backend:stderr] ${text.trim()}`);
            stderrBuffer += text;
        });

        child.on("exit", (code) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(new Error(`Backend process exited early (code ${code}).${stderrBuffer ? ` stderr: ${stderrBuffer.slice(-500)}` : ""}`));
            }
        });

        child.on("error", (err) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(err);
            }
        });
    });
}

function buildBackendEnv(settings) {
    const env = { ...process.env };

    if (settings.configStorage === "sqlite") {
        env.CONFIG_STORAGE = "sqlite";
        if (settings.databasePath && settings.databasePath.trim()) {
            env.DATABASE_PATH = settings.databasePath.trim();
        }
    }
    // configStorage === "file" needs no env vars at all — that's already the backend's own default.

    if (settings.adminApiKey && settings.adminApiKey.trim()) {
        env.ADMIN_API_KEY = settings.adminApiKey.trim();
    }

    return env;
}

function spawnBackend(settings) {
    const env = buildBackendEnv(settings);

    if (app.isPackaged) {
        const backendRoot = path.join(process.resourcesPath, "backend");
        const entry = path.join(backendRoot, "dist", "index.js");
        return spawn(process.execPath, [entry], {
            cwd: backendRoot,
            env: { ...env, ELECTRON_RUN_AS_NODE: "1" }
        });
    }

    const repoRoot = backendRepoRoot();
    const isWindows = process.platform === "win32";
    const tsxBin = path.join(repoRoot, "node_modules", ".bin", isWindows ? "tsx.cmd" : "tsx");
    // On Windows, npm's .bin shims are .cmd batch files — spawn() can't exec those directly
    // without shell:true (fails with EINVAL otherwise, since CreateProcess can't run a .cmd as a binary).
    return spawn(tsxBin, ["src/index.ts"], { cwd: repoRoot, env, shell: isWindows });
}

async function startBackend(settings) {
    const alreadyRunning = await pingExisting();

    if (alreadyRunning) {
        appliedAdminKey = "";
        return { success: true, reusedExisting: true };
    }

    try {
        backendProcess = spawnBackend(settings);
        await waitForReady(backendProcess);
        appliedAdminKey = settings.adminApiKey ? settings.adminApiKey.trim() : "";
        return { success: true, reusedExisting: false };
    } catch (error) {
        backendProcess = null;
        return { success: false, error: error.message };
    }
}

function stopBackend() {
    if (!backendProcess || backendProcess.killed) {
        backendProcess = null;
        return;
    }

    if (process.platform === "win32") {
        // Dev mode spawns tsx.cmd via shell:true, so backendProcess is cmd.exe, not the real
        // node process underneath it — a plain kill() only signals cmd.exe and leaks the actual
        // server. /T kills the whole process tree; /F because the backend doesn't handle a
        // graceful-shutdown signal from taskkill otherwise.
        spawn("taskkill", ["/pid", String(backendProcess.pid), "/T", "/F"]);
    } else {
        backendProcess.kill();
    }

    backendProcess = null;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, "setup.html"));
}

ipcMain.handle("settings:get", () => store.get("settings"));

ipcMain.handle("settings:start", async (_event, formValues) => {
    store.set("settings", formValues);
    const result = await startBackend(formValues);

    if (result.success) {
        mainWindow.loadURL(`${BACKEND_URL}/admin/`);
    }

    return result;
});

ipcMain.handle("auth:get-admin-key", () => appliedAdminKey);

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    stopBackend();
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("before-quit", () => {
    stopBackend();
});
