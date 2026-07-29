const { app, BrowserWindow, ipcMain, dialog, Notification, safeStorage } = require("electron/main");
const { shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const nodemailer = require("nodemailer");
const {
  backupDatabase,
  checkDatabaseIntegrity,
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

function getSecureCredentialsPath() {
  return path.join(app.getPath("userData"), "secure-credentials.json");
}

function getRuntimeStatePath() {
  return path.join(app.getPath("userData"), "last-run-state.json");
}

async function readGmailAppPassword() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return "";
    const saved = JSON.parse(await fs.readFile(getSecureCredentialsPath(), "utf8"));
    if (!saved.gmailAppPassword) return "";
    return safeStorage.decryptString(Buffer.from(saved.gmailAppPassword, "base64"));
  } catch {
    return "";
  }
}

async function writeGmailAppPassword(value) {
  const password = String(value || "").replace(/\s+/g, "");
  if (!password) {
    await fs.rm(getSecureCredentialsPath(), { force: true });
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("이 PC에서 보안 저장소를 사용할 수 없어 Gmail 앱 비밀번호를 저장하지 못했습니다.");
  }
  const encrypted = safeStorage.encryptString(password).toString("base64");
  await fs.writeFile(
    getSecureCredentialsPath(),
    JSON.stringify({ version: 1, gmailAppPassword: encrypted }, null, 2),
    "utf8",
  );
}

async function readRuntimeState() {
  try {
    return JSON.parse(await fs.readFile(getRuntimeStatePath(), "utf8"));
  } catch {
    return null;
  }
}

async function writeRuntimeState(state) {
  await fs.writeFile(getRuntimeStatePath(), JSON.stringify(state, null, 2), "utf8");
}

function getWorkspaceRoot() {
  return path.join(app.getPath("documents"), "ExcelDesktopApp");
}

function getLegacyBackupPath() {
  return path.join(getWorkspaceRoot(), "Backups");
}

function getCommonBackupPath() {
  if (process.platform === "win32" && process.env.ProgramData) {
    return path.join(
      process.env.ProgramData,
      "Excel Desktop App",
      "Backup",
    );
  }

  return getLegacyBackupPath();
}

async function copyLegacyBackups(sourcePath, targetPath) {
  if (!sourcePath || !targetPath || sourcePath === targetPath) return;

  try {
    await fs.access(sourcePath);
    await fs.mkdir(targetPath, { recursive: true });
    await fs.cp(sourcePath, targetPath, {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("Legacy backup copy skipped", error);
    }
  }
}

function getReportFolders(workspaceRoot, year = new Date().getFullYear()) {
  const reportTypes = [
    "MonthlySales",
    "CustomerErrors",
    "DuplicateChecks",
    "BackupValidation",
    "RequestPackages",
  ];

  return reportTypes.flatMap((type) => [
    path.join(workspaceRoot, "Reports", type),
    ...Array.from({ length: 12 }, (_, index) =>
      path.join(
        workspaceRoot,
        "Reports",
        type,
        String(year),
        String(index + 1).padStart(2, "0"),
      ),
    ),
  ]);
}

function getDefaultAppSettings() {
  const workspaceRoot = getWorkspaceRoot();

  return {
    databasePath: path.join(
      app.getPath("userData"),
      "excel-desktop-app.sqlite",
    ),
    settingsPath: getSettingsPath(),
    workspaceRoot,
    inboxPath: path.join(workspaceRoot, "Inbox"),
    workspacePath: path.join(workspaceRoot, "Workspace"),
    masterDataPath: path.join(workspaceRoot, "MasterData"),
    reportsPath: path.join(workspaceRoot, "Reports"),
    requestsPath: path.join(workspaceRoot, "Requests"),
    exportPath: path.join(workspaceRoot, "Exports"),
    backupPath: getCommonBackupPath(),
    tempPath: path.join(workspaceRoot, "Temp"),
    logsPath: path.join(workspaceRoot, "Logs"),
    retentionDays: 31,
    maxBackupSizeMb: 2048,
    autoBackupEnabled: true,
    performanceMode: "LIGHT",
    notificationsEnabled: true,
    desktopNotificationsEnabled: true,
    notificationSoundEnabled: true,
    notificationSoundPath: "",
    setupCompleted: false,
    setupCompletedAt: "",
    cloudApiBaseUrl: "",
    lastCloudSyncAt: "",
    gmailSenderName: "",
    gmailAddress: "",
    gmailAppPassword: "",
    gmailTestEmail: "",
    gmailReplyToEmail: "",
  };
}

async function directorySize(targetPath) {
  try {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const entryPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) total += await directorySize(entryPath);
      else if (entry.isFile()) total += (await fs.stat(entryPath)).size;
    }
    return total;
  } catch {
    return 0;
  }
}

function getCacheTargets(settings) {
  const userData = app.getPath('userData');
  return [
    { key: 'http', label: '웹 요청 캐시', path: path.join(userData, 'Cache') },
    { key: 'code', label: '코드 캐시', path: path.join(userData, 'Code Cache') },
    { key: 'gpu', label: '그래픽 캐시', path: path.join(userData, 'GPUCache') },
    { key: 'dawn', label: '렌더링 캐시', path: path.join(userData, 'DawnGraphiteCache') },
    { key: 'temp', label: '업무 임시 파일', path: settings.tempPath },
  ];
}

async function getCacheSummary(settings) {
  const entries = await Promise.all(getCacheTargets(settings).map(async (target) => ({
    ...target,
    bytes: await directorySize(target.path),
  })));
  return { entries, totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0) };
}

async function clearAppCaches(settings) {
  const browserSessions = new Set(BrowserWindow.getAllWindows().map((window) => window.webContents.session));
  await Promise.all([...browserSessions].map((browserSession) => browserSession.clearCache().catch(() => {})));
  await Promise.all(getCacheTargets(settings).map((target) => fs.rm(target.path, { recursive: true, force: true }).catch(() => {})));
  return getCacheSummary(settings);
}

async function ensureAppFolders(settings) {
  const workspaceRoot = settings.workspaceRoot || getWorkspaceRoot();
  const normalizedSettings = { ...settings };

  try {
    await fs.mkdir(normalizedSettings.backupPath, { recursive: true });
  } catch (error) {
    if (normalizedSettings.backupPath !== getCommonBackupPath()) {
      throw error;
    }

    normalizedSettings.backupPath = getLegacyBackupPath();
    await fs.mkdir(normalizedSettings.backupPath, { recursive: true });
  }

  const folders = [
    app.getPath("userData"),
    workspaceRoot,
    settings.inboxPath || path.join(workspaceRoot, "Inbox"),
    settings.workspacePath || path.join(workspaceRoot, "Workspace"),
    settings.masterDataPath || path.join(workspaceRoot, "MasterData"),
    settings.reportsPath || path.join(workspaceRoot, "Reports"),
    settings.requestsPath || path.join(workspaceRoot, "Requests"),
    settings.exportPath,
    normalizedSettings.tempPath,
    normalizedSettings.logsPath || path.join(workspaceRoot, "Logs"),
    ...getReportFolders(workspaceRoot),
  ];

  await Promise.all(
    [...new Set(folders.filter(Boolean))].map((folderPath) =>
      fs.mkdir(folderPath, { recursive: true }),
    ),
  );

  return normalizedSettings;
}

async function readAppSettings() {
  const defaults = getDefaultAppSettings();

  try {
    const saved = JSON.parse(await fs.readFile(getSettingsPath(), "utf8"));
    const legacyGmailAppPassword = String(saved.gmailAppPassword || "");
    const sanitizedSaved = { ...saved, gmailAppPassword: "" };
    let settings = { ...defaults, ...sanitizedSaved };
    const shouldCopyLegacyBackups =
      saved.backupPath === getLegacyBackupPath() &&
      defaults.backupPath !== getLegacyBackupPath();
    if (!saved.backupPath || shouldCopyLegacyBackups) {
      settings.backupPath = defaults.backupPath;
    }
    settings.retentionDays = Math.min(Math.max(Number(settings.retentionDays) || 31, 1), 31);
    settings = await ensureAppFolders(settings);
    if (shouldCopyLegacyBackups && settings.backupPath === defaults.backupPath) {
      await copyLegacyBackups(saved.backupPath, settings.backupPath);
    }
    let credentialMigrationSucceeded = true;
    if (legacyGmailAppPassword) {
      try {
        await writeGmailAppPassword(legacyGmailAppPassword);
      } catch (error) {
        credentialMigrationSucceeded = false;
        console.warn("Gmail credential migration skipped", error);
      }
    }
    if (settings.backupPath !== saved.backupPath || (credentialMigrationSucceeded && Object.hasOwn(saved, "gmailAppPassword"))) {
      await fs.writeFile(
        getSettingsPath(),
        JSON.stringify({
          ...settings,
          gmailAppPassword: credentialMigrationSucceeded ? undefined : legacyGmailAppPassword,
        }, null, 2),
        "utf8",
      );
    }
    return { ...settings, gmailAppPassword: await readGmailAppPassword() || legacyGmailAppPassword };
  } catch {
    const settings = await ensureAppFolders(defaults);
    await fs.writeFile(
      getSettingsPath(),
      JSON.stringify({ ...settings, gmailAppPassword: undefined }, null, 2),
      "utf8",
    );
    return { ...settings, gmailAppPassword: await readGmailAppPassword() };
  }
}

async function writeAppSettings(nextSettings) {
  const hasGmailAppPassword = Object.hasOwn(nextSettings || {}, "gmailAppPassword");
  const gmailAppPassword = nextSettings?.gmailAppPassword;
  let settings = {
    ...getDefaultAppSettings(),
    ...nextSettings,
    gmailAppPassword: "",
  };
  settings.retentionDays = Math.min(Math.max(Number(settings.retentionDays) || 31, 1), 31);
  settings = await ensureAppFolders(settings);
  if (hasGmailAppPassword) await writeGmailAppPassword(gmailAppPassword);
  await fs.writeFile(
    getSettingsPath(),
    JSON.stringify({ ...settings, gmailAppPassword: undefined }, null, 2),
    "utf8",
  );
  return { ...settings, gmailAppPassword: await readGmailAppPassword() };
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

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function normalizeMailAttachments(attachments = []) {
  return attachments
    .filter((attachment) => attachment?.fileName && attachment?.base64)
    .map((attachment) => ({
      filename: path.basename(String(attachment.fileName)),
      content: Buffer.from(String(attachment.base64), "base64"),
      contentType: attachment.mimeType || "application/octet-stream",
      cid: attachment.cid || undefined,
      contentDisposition: attachment.contentDisposition || undefined,
    }));
}

function normalizeGeneratedFile(file = {}) {
  const fileName = path.basename(String(file.fileName || "attachment.bin"));
  const base64 = String(file.base64 || "");
  return {
    fileName,
    buffer: Buffer.from(base64, "base64"),
  };
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

async function removeCredentialsFromBackupSettings(settingsPath) {
  try {
    const backupSettings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    if (!Object.hasOwn(backupSettings, "gmailAppPassword")) return;
    delete backupSettings.gmailAppPassword;
    await fs.writeFile(settingsPath, JSON.stringify(backupSettings, null, 2), "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") console.warn("Backup credential cleanup skipped", error);
  }
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
        const backup = normalizeBackupManifest(manifest, backupFolder);
        await removeCredentialsFromBackupSettings(backup.settingsPath);
        return backup;
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
  const id = `${type}_${formatTimestamp(now)}_${String(now.getMilliseconds()).padStart(3, "0")}`;
  const backupFolder = path.join(settings.backupPath, id);
  const databaseBackupPath = path.join(backupFolder, "database.sqlite");
  const settingsBackupPath = path.join(backupFolder, "app-settings.json");
  const retentionDays = Math.min(Math.max(Number(settings.retentionDays) || 31, 1), 31);
  const retentionUntil = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

  await fs.mkdir(backupFolder, { recursive: true });
  await backupDatabase(app, databaseBackupPath);
  const integrity = checkDatabaseIntegrity(databaseBackupPath);
  if (!integrity.ok) {
    await fs.rm(backupFolder, { recursive: true, force: true });
    throw new Error(`백업 SQLite 무결성 검사 실패: ${integrity.messages.join(" / ")}`);
  }
  const { gmailAppPassword: _excludedSecret, ...backupSettings } = settings;
  await fs.writeFile(settingsBackupPath, JSON.stringify(backupSettings, null, 2), "utf8");

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
      trigger: type === "shutdown" ? "app-quit" : type === "emergency" ? "process-error" : "manual",
      integrity: "ok",
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
  const backupIntegrity = checkDatabaseIntegrity(backup.databasePath);
  if (!backupIntegrity.ok) {
    throw new Error(`선택한 백업의 SQLite가 손상되었습니다: ${backupIntegrity.messages.join(" / ")}`);
  }

  const beforeRestore = await createBackup(app, {
    type: "restore_point",
    message: `복구 전 자동 저장 - ${toDisplayDate(new Date())}`,
    createdBy: "시스템",
  });

  closeDatabase();
  const databasePath = path.join(app.getPath("userData"), "excel-desktop-app.sqlite");
  try {
    await Promise.all([
      fs.rm(`${databasePath}-wal`, { force: true }),
      fs.rm(`${databasePath}-shm`, { force: true }),
    ]);
    await fs.copyFile(backup.databasePath, databasePath);
    initializeDatabase(app);
    const restoredIntegrity = checkDatabaseIntegrity(databasePath);
    if (!restoredIntegrity.ok) {
      throw new Error(`복원된 SQLite 무결성 검사 실패: ${restoredIntegrity.messages.join(" / ")}`);
    }

    try {
      const currentSettings = await readAppSettings();
      const restoredSettings = JSON.parse(await fs.readFile(backup.settingsPath, "utf8"));
      await writeAppSettings({
        ...currentSettings,
        ...restoredSettings,
        gmailAppPassword: currentSettings.gmailAppPassword,
      });
    } catch (error) {
      console.warn("Backup settings restore skipped", error);
    }
  } catch (error) {
    closeDatabase();
    await Promise.all([
      fs.rm(`${databasePath}-wal`, { force: true }),
      fs.rm(`${databasePath}-shm`, { force: true }),
    ]);
    await fs.copyFile(beforeRestore.databasePath, databasePath);
    initializeDatabase(app);
    throw new Error(`백업 복원에 실패하여 복원 직전 상태로 되돌렸습니다: ${error.message}`);
  }

  return {
    restored: backup,
    beforeRestore,
  };
}

let databaseReady = false;
let safetyBackupPromise = null;
let shutdownStarted = false;
let allowQuit = false;
let currentRunStartedAt = "";
let startupRecoveryNotice = null;
let currentRuntimeFailure = null;

async function createSafetyBackup(type, message) {
  if (!databaseReady) return null;
  if (safetyBackupPromise) return safetyBackupPromise;

  safetyBackupPromise = (async () => {
    const settings = await readAppSettings();
    if (!settings.autoBackupEnabled) return null;
    return createBackup(app, {
      type,
      message,
      createdBy: "시스템",
    });
  })();

  try {
    return await safetyBackupPromise;
  } finally {
    safetyBackupPromise = null;
  }
}

function requestEmergencyBackup(reason, error) {
  console.error(`Emergency backup requested: ${reason}`, error || "");
  currentRuntimeFailure = {
    failureAt: new Date().toISOString(),
    reason,
  };
  return createSafetyBackup(
    "emergency",
    `비정상 오류 긴급 백업 - ${toDisplayDate(new Date())} (${reason})`,
  ).then(async (backup) => {
    currentRuntimeFailure = {
      ...currentRuntimeFailure,
      emergencyBackupId: backup?.id || null,
    };
    await writeRuntimeState({
      clean: false,
      startedAt: currentRunStartedAt,
      runtimeFailure: currentRuntimeFailure,
    });
    return backup;
  }).catch(async (backupError) => {
    console.error("Emergency backup failed", backupError);
    currentRuntimeFailure = {
      ...currentRuntimeFailure,
      backupError: backupError?.message || String(backupError),
    };
    await writeRuntimeState({
      clean: false,
      startedAt: currentRunStartedAt,
      runtimeFailure: currentRuntimeFailure,
    }).catch(() => {});
    return null;
  });
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

  win.webContents.on("render-process-gone", (_, details) => {
    requestEmergencyBackup(`화면 프로세스 종료: ${details.reason}`);
  });
}

// 4. IPC 기능
function registerIpcHandlers() {
  ipcMain.handle("ping", () => "pong");
  ipcMain.on("workspace:changed", (event) => event.sender.send("workspace:data-changed"));

  ipcMain.handle("file:open", async () => {
    // 파일 열기
  });

  ipcMain.handle("file:save-as", async (_, { fileName, bytes, openFolder = false }) => {
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
    if (openFolder) {
      shell.showItemInFolder(filePath);
    }
    return { canceled: false, filePath };
  });

  ipcMain.handle("files:save-generated", async (_, payload = {}) => {
    const files = Array.isArray(payload.files) ? payload.files.map(normalizeGeneratedFile).filter((file) => file.buffer.length > 0) : [];
    if (files.length === 0) {
      return { ok: false, message: "저장할 파일이 없습니다." };
    }

    const settings = await readAppSettings();
    const folderName = `${payload.folderName || "closing_attachments"}_${formatTimestamp()}`;
    const targetFolder = path.join(settings.exportPath, "ClosingAttachments", folderName);
    await fs.mkdir(targetFolder, { recursive: true });

    const savedFiles = [];
    for (const file of files) {
      const filePath = path.join(targetFolder, file.fileName);
      await fs.writeFile(filePath, file.buffer);
      savedFiles.push({ fileName: file.fileName, filePath });
    }

    return {
      ok: true,
      folderPath: targetFolder,
      savedFiles,
    };
  });

  ipcMain.handle("files:open-location", async (_, filePath) => {
    if (!filePath || typeof filePath !== "string") {
      return { ok: false, message: "File path is required." };
    }

    try {
      await fs.access(filePath);
      shell.showItemInFolder(filePath);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error?.message || "Unable to open file location." };
    }
  });

  ipcMain.handle("app-settings:get", async () => ({
    ok: true,
    settings: await readAppSettings(),
  }));

  ipcMain.handle("app-settings:save", async (_, settings) => ({
    ok: true,
    settings: await writeAppSettings(settings),
  }));

  ipcMain.handle('cache:summary', async () => {
    const settings = await readAppSettings();
    return { ok: true, ...(await getCacheSummary(settings)) };
  });

  ipcMain.handle('cache:clear', async () => {
    const settings = await readAppSettings();
    return { ok: true, ...(await clearAppCaches(settings)) };
  });

  ipcMain.handle("setup:status", async () => {
    const settings = await readAppSettings();
    const database = initializeDatabase(app);
    return {
      ok: true,
      completed: Boolean(settings.setupCompleted),
      settings,
      database,
    };
  });

  ipcMain.handle("setup:complete", async (_, payload = {}) => {
    const current = await readAppSettings();
    const settings = await writeAppSettings({
      ...current,
      setupCompleted: true,
      setupCompletedAt: new Date().toISOString(),
      cloudApiBaseUrl: String(payload.cloudApiBaseUrl ?? current.cloudApiBaseUrl ?? "").trim(),
      lastCloudSyncAt: payload.lastCloudSyncAt ?? current.lastCloudSyncAt ?? "",
    });
    return { ok: true, settings };
  });

  ipcMain.handle("setup:download-cloud-data", async (_, payload = {}) => {
    const apiBaseUrl = String(payload.apiBaseUrl ?? "").trim().replace(/\/$/, "");
    if (!apiBaseUrl) {
      return { ok: false, message: "AWS API 주소를 입력해 주세요." };
    }

    let url;
    try {
      url = new URL(`${apiBaseUrl}/bootstrap`);
    } catch {
      return { ok: false, message: "올바른 AWS API 주소가 아닙니다." };
    }

    if (url.protocol !== "https:" && !isDev) {
      return { ok: false, message: "배포 앱에서는 HTTPS API만 사용할 수 있습니다." };
    }

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(payload.accessToken
            ? { Authorization: `Bearer ${String(payload.accessToken).trim()}` }
            : {}),
        },
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          message: data?.message || `AWS 데이터 요청 실패 (${response.status})`,
        };
      }

      const imported = require("../database/localDb.cjs").importBootstrapData(
        require("../database/localDb.cjs").getDatabaseForInternalUse(app),
        data,
      );
      const settings = await readAppSettings();
      await writeAppSettings({
        ...settings,
        cloudApiBaseUrl: apiBaseUrl,
        lastCloudSyncAt: new Date().toISOString(),
      });
      return { ok: true, imported };
    } catch (error) {
      return {
        ok: false,
        message: error?.name === "TimeoutError"
          ? "AWS 응답 시간이 초과되었습니다."
          : `AWS 연결 실패: ${error?.message || error}`,
      };
    }
  });

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

  ipcMain.handle("app-settings:choose-files", async (_, { title, filters }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: title ?? "파일 선택",
      properties: ["openFile", "multiSelections"],
      filters: filters ?? [{ name: "All files", extensions: ["*"] }],
    });
    if (canceled || !filePaths?.length) return { canceled: true, paths: [] };
    return { canceled: false, paths: filePaths };
  });

  ipcMain.handle("app-settings:choose-folder-files", async (_, { title, extensions = [] } = {}) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: title ?? "업로드할 폴더 선택",
      properties: ["openDirectory"],
    });
    const rootPath = filePaths?.[0];
    if (canceled || !rootPath) return { canceled: true, files: [], skippedCount: 0 };

    const allowed = new Set(extensions.map((extension) => String(extension).toLowerCase()));
    const files = [];
    let skippedCount = 0;
    const walk = async (currentPath) => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          await walk(entryPath);
          continue;
        }
        if (!entry.isFile()) continue;
        const extension = path.extname(entry.name).slice(1).toLowerCase();
        if (allowed.size && !allowed.has(extension)) {
          skippedCount += 1;
          continue;
        }
        const relativePath = path.relative(path.dirname(rootPath), entryPath).split(path.sep).join("/");
        files.push({ path: entryPath, relativePath });
      }
    };
    await walk(rootPath);
    return { canceled: false, files, skippedCount };
  });

  ipcMain.handle("files:read-base64", async (_, payload) => {
    const filePath = typeof payload === "string" ? payload : payload?.path;
    if (!filePath || typeof filePath !== "string") return { ok: false, message: "파일 경로가 필요합니다." };
    const bytes = await fs.readFile(filePath);
    const fileName = typeof payload === "object" && payload?.relativePath ? String(payload.relativePath) : path.basename(filePath);
    return { ok: true, fileName, sizeBytes: bytes.length, base64: bytes.toString("base64") };
  });

  ipcMain.handle("files:download-cloud", async (_, payload = {}) => {
    const downloadUrl = new URL(String(payload.url || ""));
    if (downloadUrl.protocol !== "https:" || !downloadUrl.hostname.endsWith("amazonaws.com")) {
      return { ok: false, message: "허용되지 않은 다운로드 주소입니다." };
    }
    const fileName = path.basename(String(payload.fileName || "download"));
    const extension = path.extname(fileName).slice(1).toLowerCase();
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "AWS 보관 파일 다운로드",
      defaultPath: path.join(app.getPath("downloads"), fileName),
      filters: extension ? [{ name: `${extension.toUpperCase()} 파일`, extensions: [extension] }] : undefined,
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    const response = await fetch(downloadUrl);
    if (!response.ok) return { ok: false, message: `S3 다운로드 실패 (${response.status})` };
    await fs.writeFile(filePath, Buffer.from(await response.arrayBuffer()));
    return { ok: true, filePath };
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

  ipcMain.handle("gmail:send-test", async (_, payload = {}) => {
    const gmailAddress = String(payload.gmailAddress ?? "").trim();
    const appPassword = String(payload.appPassword ?? "").replace(/\s+/g, "");
    const testEmail = String(payload.testEmail ?? "").trim();

    if (!isEmail(gmailAddress) || !gmailAddress.toLowerCase().endsWith("@gmail.com")) {
      return { ok: false, message: "Gmail 주소를 확인하세요." };
    }

    if (appPassword.length < 12) {
      return { ok: false, message: "Google 앱 비밀번호 16자리를 입력하세요." };
    }

    if (!isEmail(testEmail)) {
      return { ok: false, message: "테스트 수신 이메일을 확인하세요." };
    }

    const attachments = normalizeMailAttachments(payload.attachments);
    if (attachments.length === 0) {
      return { ok: false, message: "첨부할 PDF/XLSX 파일이 없습니다." };
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: gmailAddress,
        pass: appPassword,
      },
    });

    await transporter.verify();
    const info = await transporter.sendMail({
      from: `"${payload.senderName || "Excel Desktop App"}" <${gmailAddress}>`,
      to: testEmail,
      replyTo: payload.replyToEmail || gmailAddress,
      subject: payload.subject || "[마감 확인 요청] 테스트 발송",
      text: payload.text || "마감 확인 요청 테스트 메일입니다.",
      html: payload.html || undefined,
      attachments,
    });

    return {
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted ?? [],
      rejected: info.rejected ?? [],
      attachmentCount: attachments.length,
    };
  });

  ipcMain.handle("gmail:send-closing", async (_, payload = {}) => {
    const gmailAddress = String(payload.gmailAddress ?? "").trim();
    const appPassword = String(payload.appPassword ?? "").replace(/\s+/g, "");
    const messages = Array.isArray(payload.messages) ? payload.messages : [];

    if (!isEmail(gmailAddress) || !gmailAddress.toLowerCase().endsWith("@gmail.com")) {
      return { ok: false, message: "Gmail 주소를 확인하세요.", results: [] };
    }

    if (appPassword.length < 12) {
      return { ok: false, message: "Google 앱 비밀번호 16자리를 입력하세요.", results: [] };
    }

    if (messages.length === 0) {
      return { ok: false, message: "발송할 메일이 없습니다.", results: [] };
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: gmailAddress,
        pass: appPassword,
      },
    });

    await transporter.verify();
    const results = [];

    for (const message of messages) {
      const to = String(message.to ?? "").trim();
      const attachments = normalizeMailAttachments(message.attachments);

      if (!isEmail(to)) {
        results.push({
          targetId: message.targetId,
          ok: false,
          to,
          message: "수신 이메일 주소를 확인하세요.",
          attachmentCount: attachments.length,
        });
        continue;
      }

      try {
        const info = await transporter.sendMail({
          from: `"${payload.senderName || "Excel Desktop App"}" <${gmailAddress}>`,
          to,
          replyTo: payload.replyToEmail || gmailAddress,
          subject: message.subject || "[마감 확인 요청]",
          text: message.text || "마감 확인 요청드립니다.",
          html: message.html || undefined,
          attachments,
        });

        results.push({
          targetId: message.targetId,
          ok: true,
          to,
          messageId: info.messageId,
          attachmentCount: attachments.length,
        });
      } catch (error) {
        results.push({
          targetId: message.targetId,
          ok: false,
          to,
          message: error?.message || "메일 발송에 실패했습니다.",
          attachmentCount: attachments.length,
        });
      }
    }

    const successCount = results.filter((result) => result.ok).length;
    return {
      ok: successCount === results.length,
      partial: successCount > 0 && successCount < results.length,
      successCount,
      failureCount: results.length - successCount,
      results,
      message: `${successCount}건 성공, ${results.length - successCount}건 실패`,
    };
  });

  ipcMain.handle("backups:list", async () => {
    const settings = await readAppSettings();
    await pruneExpiredBackups(settings);
    return {
      ok: true,
      backups: await listBackupManifests(settings),
      settings,
      recoveryNotice: startupRecoveryNotice,
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
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.whenReady().then(async () => {
    try {
      // preload.js 메서드 가져옴
      registerIpcHandlers();
      registerDatabaseIpc(ipcMain, app);
      await readAppSettings();

      // Electron 시작 시 DB 초기화.
      initializeDatabase(app);
      databaseReady = true;
      const previousRunState = await readRuntimeState();
      if (previousRunState && (previousRunState.clean === false || previousRunState.runtimeFailure)) {
        startupRecoveryNotice = previousRunState;
      }
      currentRunStartedAt = new Date().toISOString();
      await writeRuntimeState({ clean: false, startedAt: currentRunStartedAt });

      createWindow();

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    } catch (error) {
      console.error("Application startup failed", error);
      dialog.showErrorBox(
        "Excel Desktop App 실행 오류",
        `앱을 시작하지 못했습니다.\n\n${error?.message || error}`,
      );
      app.quit();
    }
  });
}

// 6. 종료 처리
app.on("before-quit", (event) => {
  if (allowQuit || !databaseReady) return;
  event.preventDefault();
  if (shutdownStarted) return;
  shutdownStarted = true;

  void createSafetyBackup(
    "shutdown",
    `앱 종료 시 자동 백업 - ${toDisplayDate(new Date())}`,
  ).then((backup) => writeRuntimeState({
    clean: true,
    startedAt: currentRunStartedAt,
    closedAt: new Date().toISOString(),
    shutdownBackupId: backup?.id || null,
    runtimeFailure: currentRuntimeFailure,
  })).catch(async (error) => {
    console.error("Shutdown backup failed", error);
    await writeRuntimeState({
      clean: true,
      startedAt: currentRunStartedAt,
      closedAt: new Date().toISOString(),
      backupError: error?.message || String(error),
    }).catch(() => {});
  }).finally(() => {
    closeDatabase();
    databaseReady = false;
    allowQuit = true;
    app.quit();
  });
});

app.on("child-process-gone", (_, details) => {
  requestEmergencyBackup(`보조 프로세스 종료: ${details.type}/${details.reason}`);
});

process.on("uncaughtException", (error) => {
  void requestEmergencyBackup("처리되지 않은 프로세스 오류", error).finally(() => {
    closeDatabase();
    databaseReady = false;
    app.exit(1);
  });
});

process.on("unhandledRejection", (reason) => {
  requestEmergencyBackup("처리되지 않은 비동기 오류", reason);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
