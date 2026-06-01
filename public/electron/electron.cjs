const { app, BrowserWindow, ipcMain, dialog, Notification } = require("electron/main");
const fs = require("node:fs/promises");
const path = require("node:path");
const {
  backupDatabase,
  closeDatabase,
  getDatabasePath,
  initializeDatabase,
  registerDatabaseIpc,
} = require("../database/localDb.cjs");
// 2. 설정값 / 환경 구분
const isDev = !app.isPackaged;

function getSettingsPath() {
  return path.join(app.getPath("userData"), "app-settings.json");
}

function getDefaultAppSettings() {
  const workspaceRoot = path.join(app.getPath("documents"), "ExcelDesktopApp");

  return {
    databasePath: path.join(
      app.getPath("userData"),
      "excel-desktop-app.sqlite",
    ),
    settingsPath: getSettingsPath(),
    exportPath: path.join(workspaceRoot, "Exports"),
    backupPath: path.join(workspaceRoot, "Backups"),
    tempPath: path.join(workspaceRoot, "Temp"),
    retentionDays: 31,
    maxBackupSizeMb: 2048,
    autoBackupEnabled: true,
    autoBackupIntervalMinutes: 30,
    autoBackupTime: "23:50",
    performanceMode: "LIGHT",
    notificationsEnabled: true,
    desktopNotificationsEnabled: true,
    notificationSoundEnabled: true,
    notificationSoundPath: "",
  };
}

async function ensureAppFolders(settings) {
  await Promise.all([
    fs.mkdir(settings.exportPath, { recursive: true }),
    fs.mkdir(settings.backupPath, { recursive: true }),
    fs.mkdir(settings.tempPath, { recursive: true }),
  ]);
}

async function readAppSettings() {
  const defaults = getDefaultAppSettings();

  try {
    const saved = JSON.parse(await fs.readFile(getSettingsPath(), "utf8"));
    const settings = { ...defaults, ...saved };
    settings.retentionDays = Math.min(Math.max(Number(settings.retentionDays) || 31, 1), 31);
    settings.autoBackupTime = settings.autoBackupTime || "23:50";
    await ensureAppFolders(settings);
    return settings;
  } catch {
    await ensureAppFolders(defaults);
    await fs.writeFile(
      getSettingsPath(),
      JSON.stringify(defaults, null, 2),
      "utf8",
    );
    return defaults;
  }
}

async function writeAppSettings(nextSettings) {
  const settings = {
    ...getDefaultAppSettings(),
    ...nextSettings,
  };
  settings.retentionDays = Math.min(Math.max(Number(settings.retentionDays) || 31, 1), 31);
  settings.autoBackupTime = settings.autoBackupTime || "23:50";
  await ensureAppFolders(settings);
  await fs.writeFile(
    getSettingsPath(),
    JSON.stringify(settings, null, 2),
    "utf8",
  );
  return settings;
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "_",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function toDisplayDate(date = new Date()) {
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalizeBackupManifest(manifest, backupFolder) {
  return {
    id: manifest.id,
    message: manifest.message,
    type: manifest.type,
    createdBy: manifest.createdBy,
    createdAt: manifest.createdAt,
    retentionUntil: manifest.retentionUntil,
    folderPath: backupFolder,
    databasePath: manifest.databasePath
      ? path.join(backupFolder, path.basename(manifest.databasePath))
      : path.join(backupFolder, "database.sqlite"),
    settingsPath: manifest.settingsPath
      ? path.join(backupFolder, path.basename(manifest.settingsPath))
      : path.join(backupFolder, "app-settings.json"),
    sizeBytes: manifest.sizeBytes ?? 0,
    summary: manifest.summary ?? {},
  };
}

async function getFolderSize(folderPath) {
  let size = 0;
  const entries = await fs.readdir(folderPath, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      size += await getFolderSize(entryPath);
      return;
    }
    const stats = await fs.stat(entryPath);
    size += stats.size;
  }));

  return size;
}

async function listBackupManifests(settings) {
  await fs.mkdir(settings.backupPath, { recursive: true });
  const entries = await fs.readdir(settings.backupPath, { withFileTypes: true });
  const manifests = await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      const backupFolder = path.join(settings.backupPath, entry.name);
      const manifestPath = path.join(backupFolder, "manifest.json");
      try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
        return normalizeBackupManifest(manifest, backupFolder);
      } catch {
        return null;
      }
    }));

  return manifests
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function pruneExpiredBackups(settings) {
  const retentionDays = Math.min(Math.max(Number(settings.retentionDays) || 31, 1), 31);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const backups = await listBackupManifests(settings);

  await Promise.all(backups.map(async (backup) => {
    if (new Date(backup.createdAt).getTime() >= cutoff) return;
    await fs.rm(backup.folderPath, { recursive: true, force: true });
  }));
}

async function createBackup(app, options = {}) {
  const settings = await readAppSettings();
  const now = new Date();
  const type = options.type ?? "manual";
  const id = `${type}_${formatTimestamp(now)}`;
  const backupFolder = path.join(settings.backupPath, id);
  const databaseBackupPath = path.join(backupFolder, "database.sqlite");
  const settingsBackupPath = path.join(backupFolder, "app-settings.json");
  const retentionDays = Math.min(Math.max(Number(settings.retentionDays) || 31, 1), 31);
  const retentionUntil = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

  await fs.mkdir(backupFolder, { recursive: true });
  await backupDatabase(app, databaseBackupPath);

  try {
    await fs.copyFile(getSettingsPath(), settingsBackupPath);
  } catch {
    await fs.writeFile(settingsBackupPath, JSON.stringify(settings, null, 2), "utf8");
  }

  const sizeBytes = await getFolderSize(backupFolder);
  const manifest = {
    id,
    message: options.message?.trim()
      || (type === "auto" ? `자동 백업 - ${toDisplayDate(now)}` : `수동 백업 - ${toDisplayDate(now)}`),
    type,
    createdBy: options.createdBy ?? (type === "auto" ? "시스템" : "사용자"),
    createdAt: now.toISOString(),
    retentionUntil,
    databasePath: "database.sqlite",
    settingsPath: "app-settings.json",
    sizeBytes,
    summary: {
      databasePath: getDatabasePath(app),
      retentionDays,
      schedule: settings.autoBackupTime,
    },
  };

  await fs.writeFile(path.join(backupFolder, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await pruneExpiredBackups(settings);

  return normalizeBackupManifest(manifest, backupFolder);
}

async function restoreBackup(app, backupId) {
  const settings = await readAppSettings();
  const backups = await listBackupManifests(settings);
  const backup = backups.find((item) => item.id === backupId);

  if (!backup) {
    throw new Error("선택한 백업을 찾을 수 없습니다.");
  }

  const beforeRestore = await createBackup(app, {
    type: "restore_point",
    message: `복구 전 자동 저장 - ${toDisplayDate(new Date())}`,
    createdBy: "시스템",
  });

  closeDatabase();
  const databasePath = path.join(app.getPath("userData"), "excel-desktop-app.sqlite");
  await Promise.all([
    fs.rm(`${databasePath}-wal`, { force: true }),
    fs.rm(`${databasePath}-shm`, { force: true }),
  ]);
  await fs.copyFile(backup.databasePath, databasePath);

  try {
    await fs.copyFile(backup.settingsPath, getSettingsPath());
  } catch {
    // Settings are helpful but not mandatory for a database restore.
  }

  initializeDatabase(app);

  return {
    restored: backup,
    beforeRestore,
  };
}

let autoBackupTimer;
let lastAutoBackupKey = "";

function scheduleAutoBackup(app) {
  clearInterval(autoBackupTimer);
  autoBackupTimer = setInterval(async () => {
    try {
      const settings = await readAppSettings();
      if (!settings.autoBackupEnabled) return;
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${currentTime}`;

      if (currentTime !== (settings.autoBackupTime || "23:50") || lastAutoBackupKey === todayKey) return;

      await createBackup(app, { type: "auto", createdBy: "시스템" });
      lastAutoBackupKey = todayKey;
    } catch (error) {
      console.error("Automatic backup failed", error);
    }
  }, 30 * 1000);
}

// 3. BrowserWindow 생성 관련 기능
function createWindow() {
  const iconPath = path.join(__dirname, "../icon.ico");

  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 480,
    minHeight: 360,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.maximize();

  if (isDev) {
    win.loadURL("http://localhost:5173");
    // win.webContents.openDevTools({ mode: "detach" });
  } else {
    // Packaged app layout: app.asar/public/electron -> app.asar/dist/index.html
    win.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

// 4. IPC 기능
function registerIpcHandlers() {
  ipcMain.handle("ping", () => "pong");

  ipcMain.handle("file:open", async () => {
    // 파일 열기
  });

  ipcMain.handle("file:save-as", async (_, { fileName, bytes }) => {
    const extension = path.extname(fileName).replace(".", "").toLowerCase();
    const filters =
      extension === "csv"
        ? [{ name: "CSV File", extensions: ["csv"] }]
        : [{ name: "Excel Workbook", extensions: ["xlsx"] }];

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "파일 저장",
      defaultPath: path.join(app.getPath("downloads"), fileName),
      filters,
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    await fs.writeFile(filePath, Buffer.from(bytes));
    return { canceled: false, filePath };
  });

  ipcMain.handle("app-settings:get", async () => ({
    ok: true,
    settings: await readAppSettings(),
  }));

  ipcMain.handle("app-settings:save", async (_, settings) => ({
    ok: true,
    settings: await writeAppSettings(settings),
  }));

  ipcMain.handle("app-settings:choose-directory", async (_, { title }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: title ?? "폴더 선택",
      properties: ["openDirectory", "createDirectory"],
    });

    if (canceled || !filePaths?.[0]) {
      return { canceled: true };
    }

    return { canceled: false, path: filePaths[0] };
  });

  ipcMain.handle("app-settings:choose-file", async (_, { title, filters }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: title ?? "파일 선택",
      properties: ["openFile"],
      filters: filters ?? [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a"] }],
    });

    if (canceled || !filePaths?.[0]) {
      return { canceled: true };
    }

    return { canceled: false, path: filePaths[0] };
  });

  ipcMain.handle("notifications:show", async (_, payload) => {
    if (!Notification?.isSupported?.()) {
      return { ok: false, mode: "unsupported" };
    }

    const settings = await readAppSettings();
    if (!settings.notificationsEnabled || !settings.desktopNotificationsEnabled) {
      return { ok: false, mode: "disabled" };
    }

    new Notification({
      title: payload?.title ?? "알림",
      body: payload?.body ?? "",
      silent: true,
    }).show();

    return { ok: true };
  });

  ipcMain.handle("backups:list", async () => {
    const settings = await readAppSettings();
    await pruneExpiredBackups(settings);
    return {
      ok: true,
      backups: await listBackupManifests(settings),
      settings,
    };
  });

  ipcMain.handle("backups:create", async (_, payload) => ({
    ok: true,
    backup: await createBackup(app, {
      message: payload?.message,
      type: payload?.type ?? "manual",
      createdBy: payload?.createdBy ?? "사용자",
    }),
  }));

  ipcMain.handle("backups:restore", async (_, payload) => ({
    ok: true,
    ...(await restoreBackup(app, payload?.backupId)),
  }));
}

// 5. 앱 생명주기
app.whenReady().then(() => {
  // preload.js 메서드 가져옴
  registerIpcHandlers();
  registerDatabaseIpc(ipcMain, app);

  //Electron 시작 시 DB 초기화.
  initializeDatabase(app);
  scheduleAutoBackup(app);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 6. 종료 처리
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    closeDatabase();
    app.quit();
  }
});
