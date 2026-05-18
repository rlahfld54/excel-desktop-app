const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  ping: () => ipcRenderer.invoke("ping"),
  // we can also expose variables, not just functions
});

contextBridge.exposeInMainWorld("api", {
  openFile: () => ipcRenderer.invoke("file:open"),
  saveData: (data) => ipcRenderer.invoke("data:save", data),
  saveFileAs: (file) => ipcRenderer.invoke("file:save-as", file),
  getDatabaseHealth: () => ipcRenderer.invoke("db:health"),
  getDatabaseSummary: () => ipcRenderer.invoke("db:summary"),
  addEvent: (event) => ipcRenderer.invoke("events:add", event),
  getEvents: () => ipcRenderer.invoke("events:list"),
  getRecentFiles: () => ipcRenderer.invoke("recent-files:get"),
  getMasterData: () => ipcRenderer.invoke("master-data:get"),
  seedMasterData: () => ipcRenderer.invoke("master-data:seed"),
  importContacts: (contacts) => ipcRenderer.invoke("contacts:import", contacts),
  getMessageTemplates: () => ipcRenderer.invoke("message-templates:get"),
  getSendPackages: () => ipcRenderer.invoke("send-packages:get"),
  createSampleSendPackage: () => ipcRenderer.invoke("send-packages:create-sample"),
  prepareSendPackageAttachments: (packageId) => ipcRenderer.invoke("send-packages:prepare-attachments", packageId),
  getAppSettings: () => ipcRenderer.invoke("app-settings:get"),
  saveAppSettings: (settings) => ipcRenderer.invoke("app-settings:save", settings),
  chooseDirectory: (options) => ipcRenderer.invoke("app-settings:choose-directory", options),
});
