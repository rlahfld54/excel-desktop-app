const { app, BrowserWindow, ipcMain, dialog } = require("electron/main");
const fs = require("node:fs/promises");
const path = require("node:path");
const { closeDatabase, initializeDatabase, registerDatabaseIpc } = require("../database/localDb.cjs");
// 2. 설정값 / 환경 구분
const isDev = !app.isPackaged;

function getSettingsPath() {
  return path.join(app.getPath("userData"), "app-settings.json");
}

function getDefaultAppSettings() {
  const workspaceRoot = path.join(app.getPath("documents"), "ExcelDesktopApp");

  return {
    databasePath: path.join(app.getPath("userData"), "excel-desktop-app.sqlite"),
    settingsPath: getSettingsPath(),
    exportPath: path.join(workspaceRoot, "Exports"),
    backupPath: path.join(workspaceRoot, "Backups"),
    tempPath: path.join(workspaceRoot, "Temp"),
    retentionDays: 30,
    maxBackupSizeMb: 2048,
    autoBackupEnabled: true,
    autoBackupIntervalMinutes: 30,
    performanceMode: "LIGHT",
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
    await ensureAppFolders(settings);
    return settings;
  } catch {
    await ensureAppFolders(defaults);
    await fs.writeFile(getSettingsPath(), JSON.stringify(defaults, null, 2), "utf8");
    return defaults;
  }
}

async function writeAppSettings(nextSettings) {
  const settings = {
    ...getDefaultAppSettings(),
    ...nextSettings,
  };
  await ensureAppFolders(settings);
  await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
  return settings;
}

// 3. BrowserWindow 생성 관련 기능
function createWindow() {
  const iconPath = path.join(__dirname, "../icon.svg");

  const win = new BrowserWindow({
    width: 800,
    height: 600,
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

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // 빌드 시 사용되는 경로..ㅇㅋ?
    win.loadFile(path.join(__dirname, "../dist/index.html"));
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
    const filters = extension === "csv"
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
}

// 5. 앱 생명주기
app.whenReady().then(() => {
  // preload.js 메서드 가져옴
  registerIpcHandlers();
  registerDatabaseIpc(ipcMain, app);

  //Electron 시작 시 DB 초기화.
  initializeDatabase(app);

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
