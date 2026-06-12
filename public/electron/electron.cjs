const { app, BrowserWindow, ipcMain, dialog, Notification } = require("electron/main");
const { shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const nodemailer = require("nodemailer");
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

function getWorkspaceRoot() {
  return path.join(app.getPath("documents"), "ExcelDesktopApp");
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
    backupPath: path.join(workspaceRoot, "Backups"),
    tempPath: path.join(workspaceRoot, "Temp"),
    logsPath: path.join(workspaceRoot, "Logs"),
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
  const workspaceRoot = settings.workspaceRoot || getWorkspaceRoot();
  const folders = [
    app.getPath("userData"),
    workspaceRoot,
    settings.inboxPath || path.join(workspaceRoot, "Inbox"),
    settings.workspacePath || path.join(workspaceRoot, "Workspace"),
    settings.masterDataPath || path.join(workspaceRoot, "MasterData"),
    settings.reportsPath || path.join(workspaceRoot, "Reports"),
    settings.requestsPath || path.join(workspaceRoot, "Requests"),
    settings.exportPath,
    settings.backupPath,
    settings.tempPath,
    settings.logsPath || path.join(workspaceRoot, "Logs"),
    ...getReportFolders(workspaceRoot),
  ];

  await Promise.all(
    [...new Set(folders.filter(Boolean))].map((folderPath) =>
      fs.mkdir(folderPath, { recursive: true }),
    ),
  );
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
app.whenReady().then(async () => {
  // preload.js 메서드 가져옴
  registerIpcHandlers();
  registerDatabaseIpc(ipcMain, app);
  await readAppSettings();

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
