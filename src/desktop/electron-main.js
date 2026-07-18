"use strict";
const { app, BrowserWindow, dialog, ipcMain, session } = require("electron");
const { execFile, spawn } = require("child_process");
const path = require("path");
const fs = require("fs/promises");
const { pathToFileURL } = require("url");
let autoUpdater = null;
try { ({ autoUpdater } = require("electron-updater")); } catch (_) { /* optional in unpackaged development */ }

let mainWindow = null;
const allowedRoots = new Set();
const recentFile = () => path.join(app.getPath("userData"), "recent-projects.json");
async function readRecentProjects() {
  try { const values = JSON.parse(await fs.readFile(recentFile(), "utf8")); return Array.isArray(values) ? values.filter(item => item?.path).slice(0, 12) : []; }
  catch (_) { return []; }
}
async function recoveryHealth(root) {
  const directory = path.join(root, ".hybrid", "worldsmith", "drafts");
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const names = entries.filter(entry => entry.isFile() && /\.htgmapdraft$/i.test(entry.name));
    const times = await Promise.all(names.map(async entry => { try { return (await fs.stat(path.join(directory, entry.name))).mtimeMs; } catch (_) { return 0; } }));
    return { recoveryCount: names.length, lastRecoveryAt: Math.max(0, ...times) ? new Date(Math.max(...times)).toISOString() : null };
  } catch (_) { return { recoveryCount: 0, lastRecoveryAt: null }; }
}
async function recentProjects() {
  return Promise.all((await readRecentProjects()).map(async item => {
    const root = path.resolve(item.path);
    try {
      const info = await fs.stat(root);
      if (!info.isDirectory()) throw new Error("not-directory");
      return { ...item, path: root, name: item.name || path.basename(root), available: true, ...(await recoveryHealth(root)) };
    } catch (_) { return { ...item, path: root, name: item.name || path.basename(root), available: false, recoveryCount: 0, lastRecoveryAt: null }; }
  }));
}
async function rememberProject(root) { const values = (await readRecentProjects()).filter(item => path.resolve(item.path) !== root); values.unshift({ path: root, name: path.basename(root), openedAt: new Date().toISOString() }); await fs.mkdir(path.dirname(recentFile()), { recursive: true }); await fs.writeFile(recentFile(), JSON.stringify(values.slice(0, 12), null, 2), "utf8"); }
function resolveAllowed(root, relative = "") {
  const base = path.resolve(String(root || "")); const target = path.resolve(base, String(relative || ""));
  if (!allowedRoots.has(base) || (target !== base && !target.startsWith(`${base}${path.sep}`))) throw new Error("Path is outside the selected project.");
  return target;
}
function resolveDestructive(root, relative) {
  const value = String(relative || "").replace(/\\/g, "/").trim();
  if (!value || value === "." || value.split("/").filter(Boolean).some(part => part === "..")) throw new Error("Choose a specific project entry; the project root cannot be changed or removed.");
  const target = resolveAllowed(root, value), base = path.resolve(String(root || ""));
  if (target === base) throw new Error("The project root cannot be changed or removed.");
  return target;
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600, height: 960, minWidth: 960, minHeight: 640,
    icon: path.join(__dirname, "HybridTileStudio.png"),
    backgroundColor: "#ecebea",
    webPreferences: { preload: path.join(__dirname, "electron-preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false }
  });
  mainWindow.loadFile("HybridTileStudio.html");
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const applicationUrl = pathToFileURL(path.join(__dirname, "HybridTileStudio.html")).href;
  mainWindow.webContents.on("will-navigate", (event, target) => { if (target !== applicationUrl) event.preventDefault(); });
  mainWindow.webContents.on("will-attach-webview", event => event.preventDefault());
  mainWindow.webContents.once("did-finish-load", () => { const associated = process.argv.find(value => /\.(htgworkspace|htgprefab|htgchangeset|htgrecipes|htgworld|htgcatalog|htgextension|htgrecording|htgscenario|htgjourney|htgreview|htgrelease|htgfingerprint|htgtestmanifest|htgcompat|htgmerge|htgmanifest|htgrecovery|htgmapdraft|htggraph|htgquest|htgcontent|htgbug)$/i.test(value)); if (associated) sendAssociatedFile(associated); });
}
async function sendAssociatedFile(filename) { if (!mainWindow || !filename) return false; try { const target = path.resolve(filename); const info = await fs.stat(target); if (!info.isFile() || info.size > 20 * 1024 * 1024) throw new Error("Associated file is invalid or too large."); mainWindow.webContents.send("htg:associated-file", { name: path.basename(target), text: await fs.readFile(target, "utf8") }); return true; } catch (error) { dialog.showErrorBox("Could not open Hybrid Tile Studio file", error.message); return false; } }
function configureUpdater() { if (!autoUpdater) return; autoUpdater.autoDownload = false; const send = (status, detail = {}) => mainWindow?.webContents.send("htg:update-status", { status, ...detail }); autoUpdater.on("checking-for-update", () => send("checking")); autoUpdater.on("update-available", info => send("available", { version: info.version })); autoUpdater.on("update-not-available", info => send("current", { version: info.version })); autoUpdater.on("download-progress", progress => send("downloading", { percent: progress.percent })); autoUpdater.on("update-downloaded", info => send("downloaded", { version: info.version })); autoUpdater.on("error", error => send("error", { message: error.message })); }

ipcMain.handle("htg:choose-project", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory", "createDirectory"] });
  if (result.canceled) return null; const root = path.resolve(result.filePaths[0]); allowedRoots.add(root); await rememberProject(root); return root;
});
ipcMain.handle("htg:recent-projects", async () => recentProjects());
ipcMain.handle("htg:open-recent", async (_event, selectedPath) => { const root = path.resolve(String(selectedPath || "")); const allowed = (await recentProjects()).some(item => path.resolve(item.path) === root); if (!allowed) throw new Error("Project is not in the recent-project list."); const info = await fs.stat(root); if (!info.isDirectory()) throw new Error("Recent project directory is unavailable."); allowedRoots.add(root); await rememberProject(root); return root; });
ipcMain.handle("htg:stat", async (_event, root, relative) => { const info = await fs.stat(resolveAllowed(root, relative)); return { file: info.isFile(), directory: info.isDirectory(), size: info.size }; });
ipcMain.handle("htg:mkdir", async (_event, root, relative) => { await fs.mkdir(resolveAllowed(root, relative), { recursive: true }); return true; });
ipcMain.handle("htg:list", async (_event, root, relative) => (await fs.readdir(resolveAllowed(root, relative), { withFileTypes: true })).map(entry => [entry.name, entry.isDirectory() ? "directory" : "file"]));
ipcMain.handle("htg:remove", async (_event, root, relative, recursive = false) => { await fs.rm(resolveDestructive(root, relative), { recursive: !!recursive, force: false }); return true; });
ipcMain.handle("htg:rename", async (_event, root, fromPath, toPath) => { const source = resolveDestructive(root, fromPath); const target = resolveDestructive(root, toPath); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.rename(source, target); return true; });
ipcMain.handle("htg:read", async (_event, root, relative, encoding = "utf8") => fs.readFile(resolveAllowed(root, relative), encoding === "base64" ? { encoding: "base64" } : { encoding: "utf8" }));
ipcMain.handle("htg:write", async (_event, root, relative, value) => { const target = resolveAllowed(root, relative); await fs.mkdir(path.dirname(target), { recursive: true }); const temporary = `${target}.htg-tmp-${process.pid}-${Date.now()}`; await fs.writeFile(temporary, String(value), "utf8"); await fs.rename(temporary, target); return true; });
ipcMain.handle("htg:launch-playtest", async (_event, root, options = {}) => {
  const project = resolveAllowed(root); const names = process.platform === "win32" ? ["Game.exe"] : process.platform === "darwin" ? ["Game.app/Contents/MacOS/nwjs", "Game.app/Contents/MacOS/Game"] : ["Game", "nw", "nwjs"];
  let executable = null; for (const name of names) { const candidate = resolveAllowed(project, name); try { const info = await fs.stat(candidate); if (info.isFile()) { executable = candidate; break; } } catch (_) { /* try the next known launcher */ } }
  if (!executable) return { launched: false, reason: "launcher-not-found", message: "No exported Game executable was found. Start Playtest from RPG Maker; Live Production will connect through the project data folder." };
  const child = spawn(executable, options.test === false ? [] : ["test"], { cwd: project, detached: true, stdio: "ignore" }); child.unref(); return { launched: true, executable: path.basename(executable), pid: child.pid };
});
ipcMain.handle("htg:git-status", async (_event, cwd) => new Promise((resolve, reject) => {
  const root = resolveAllowed(cwd);
  execFile("git", ["status", "--short"], { cwd: root }, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve(stdout.trim() || "Git working tree is clean."));
}));
const SAFE_GIT_COMMANDS = new Set(["status", "log", "diff", "add", "commit", "branch", "switch", "tag", "merge", "show", "rev-parse", "lfs"]);
ipcMain.handle("htg:git", async (_event, cwd, args = []) => new Promise((resolve, reject) => {
  const root = resolveAllowed(cwd); const values = Array.isArray(args) ? args.map(String) : []; if (!values.length || !SAFE_GIT_COMMANDS.has(values[0])) return reject(new Error("Unsupported Git command."));
  if (values[0] === "lfs" && values[1] !== "status") return reject(new Error("Only git lfs status is available."));
  if (values.some((value,index) => value.includes("\0") || path.isAbsolute(value) || value === ".." || value.startsWith("../") || value.includes("/../") || /^--(?:git-dir|work-tree)=/.test(value) || value === "-C" || (index > 0 && value.startsWith("--exec-path")))) return reject(new Error("Unsafe Git argument."));
  execFile("git", values, { cwd: root, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => error ? reject(new Error(stderr || stdout || error.message)) : resolve({ stdout, stderr }));
}));
ipcMain.handle("htg:check-updates", async () => { if (!app.isPackaged) return { status: "development", version: app.getVersion() }; if (!autoUpdater) throw new Error("Auto-updater is unavailable."); const result = await autoUpdater.checkForUpdates(); return { status: result?.updateInfo?.version === app.getVersion() ? "current" : "available", version: result?.updateInfo?.version || app.getVersion() }; });
ipcMain.handle("htg:download-update", async () => { if (!autoUpdater) throw new Error("Auto-updater is unavailable."); await autoUpdater.downloadUpdate(); return true; });
ipcMain.handle("htg:install-update", async () => { if (!autoUpdater) throw new Error("Auto-updater is unavailable."); autoUpdater.quitAndInstall(false, true); return true; });
app.on("open-file", (event, filename) => { event.preventDefault(); if (mainWindow) sendAssociatedFile(filename); else app.whenReady().then(() => sendAssociatedFile(filename)); });
app.whenReady().then(() => { session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false)); createWindow(); configureUpdater(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
