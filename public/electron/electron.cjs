const { app, BrowserWindow, ipcMain } = require("electron/main");
const path = require("node:path");
// const { initializeDatabase } = require("../database/schema.cjs");
// const { registerRecentFileIpc } = require("../database/recentFileIpc.js");
// 2. 설정값 / 환경 구분
const isDev = !app.isPackaged;

// 3. BrowserWindow 생성 관련 기능
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 480,
    minHeight: 360,
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

  ipcMain.handle("data:save", async (_, data) => {
    // sqlite 저장
  });
}

// 5. 앱 생명주기
app.whenReady().then(() => {
  // preload.js 메서드 가져옴
  registerIpcHandlers();

  //Electron 시작 시 DB 초기화.
  // initializeDatabase();
  // registerRecentFileIpc();

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
    app.quit();
  }
});
