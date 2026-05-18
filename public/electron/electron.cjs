const { app, BrowserWindow, ipcMain, dialog } = require("electron/main");
const fs = require("node:fs/promises");
const path = require("node:path");
const { closeDatabase, initializeDatabase, registerDatabaseIpc } = require("../database/localDb.cjs");
// 2. 설정값 / 환경 구분
const isDev = !app.isPackaged;

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
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "샘플 엑셀 데이터 저장",
      defaultPath: path.join(app.getPath("downloads"), fileName),
      filters: [
        { name: "Excel Workbook", extensions: ["xlsx"] },
      ],
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    await fs.writeFile(filePath, Buffer.from(bytes));
    return { canceled: false, filePath };
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
