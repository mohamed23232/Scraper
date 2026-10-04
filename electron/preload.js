const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("scraperAdmin", {
    getSettings: () => ipcRenderer.invoke("settings:get"),
    startWithSettings: (settings) => ipcRenderer.invoke("settings:start", settings),
    getAdminApiKey: () => ipcRenderer.invoke("auth:get-admin-key")
});
