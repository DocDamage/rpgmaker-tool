"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("hybridTileNative", Object.freeze({
  chooseProjectPath: () => ipcRenderer.invoke("htg:choose-project"),
  recentProjects: () => ipcRenderer.invoke("htg:recent-projects"),
  openRecentProject: path => ipcRenderer.invoke("htg:open-recent", path),
  gitStatus: cwd => ipcRenderer.invoke("htg:git-status", cwd),
  stat: (root, relative) => ipcRenderer.invoke("htg:stat", root, relative),
  mkdir: (root, relative) => ipcRenderer.invoke("htg:mkdir", root, relative),
  list: (root, relative) => ipcRenderer.invoke("htg:list", root, relative),
  remove: (root, relative, recursive) => ipcRenderer.invoke("htg:remove", root, relative, recursive),
  rename: (root, fromPath, toPath) => ipcRenderer.invoke("htg:rename", root, fromPath, toPath),
  readText: (root, relative) => ipcRenderer.invoke("htg:read", root, relative, "utf8"),
  readBase64: (root, relative) => ipcRenderer.invoke("htg:read", root, relative, "base64"),
  writeText: (root, relative, value) => ipcRenderer.invoke("htg:write", root, relative, value),
  launchPlaytest: (root, options) => ipcRenderer.invoke("htg:launch-playtest", root, options),
  git: (cwd, args) => ipcRenderer.invoke("htg:git", cwd, args),
  checkUpdates: () => ipcRenderer.invoke("htg:check-updates"),
  downloadUpdate: () => ipcRenderer.invoke("htg:download-update"),
  installUpdate: () => ipcRenderer.invoke("htg:install-update"),
  onUpdateStatus: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on("htg:update-status", listener); return () => ipcRenderer.removeListener("htg:update-status", listener); },
  onAssociatedFile: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on("htg:associated-file", listener); return () => ipcRenderer.removeListener("htg:associated-file", listener); }
}));
