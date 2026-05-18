const path = require("node:path");
const Database = require("better-sqlite3");

let db;

function getDatabase(app) {
  if (db) return db;

  const dbPath = path.join(app.getPath("userData"), "excel-desktop-app.sqlite");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      meta_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recent_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_path TEXT,
      row_count INTEGER DEFAULT 0,
      column_count INTEGER DEFAULT 0,
      opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workspace_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS validation_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER,
      issue_count INTEGER DEFAULT 0,
      duplicate_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(snapshot_id) REFERENCES workspace_snapshots(id) ON DELETE SET NULL
    );
  `);

  return db;
}

function toJson(value) {
  return JSON.stringify(value ?? null);
}

function initializeDatabase(app) {
  const database = getDatabase(app);
  return {
    ok: true,
    path: database.name,
  };
}

function registerDatabaseIpc(ipcMain, app) {
  ipcMain.handle("db:health", () => {
    const database = getDatabase(app);
    const result = database.prepare("SELECT COUNT(*) AS count FROM app_events").get();
    return {
      ok: true,
      path: database.name,
      eventCount: result.count,
    };
  });

  ipcMain.handle("events:add", (_, event) => {
    const database = getDatabase(app);
    const info = database.prepare(`
      INSERT INTO app_events (level, message, meta_json)
      VALUES (@level, @message, @metaJson)
    `).run({
      level: event?.level ?? "INFO",
      message: event?.message ?? "",
      metaJson: toJson(event?.meta),
    });

    return { ok: true, id: info.lastInsertRowid };
  });

  ipcMain.handle("events:list", () => {
    const database = getDatabase(app);
    return database.prepare(`
      SELECT id, level, message, meta_json AS metaJson, created_at AS createdAt
      FROM app_events
      ORDER BY id DESC
      LIMIT 50
    `).all();
  });

  ipcMain.handle("recent-files:get", () => {
    const database = getDatabase(app);
    return database.prepare(`
      SELECT id, file_name AS fileName, file_path AS filePath, row_count AS rowCount, column_count AS columnCount, opened_at AS openedAt
      FROM recent_files
      ORDER BY opened_at DESC, id DESC
      LIMIT 20
    `).all();
  });

  ipcMain.handle("data:save", (_, data) => {
    const database = getDatabase(app);
    const insertSnapshot = database.prepare(`
      INSERT INTO workspace_snapshots (file_name, payload_json, saved_at)
      VALUES (@fileName, @payloadJson, @savedAt)
    `);
    const insertRecentFile = database.prepare(`
      INSERT INTO recent_files (file_name, row_count, column_count, opened_at)
      VALUES (@fileName, @rowCount, @columnCount, @openedAt)
    `);
    const insertEvent = database.prepare(`
      INSERT INTO app_events (level, message, meta_json)
      VALUES (@level, @message, @metaJson)
    `);

    const transaction = database.transaction(() => {
      const savedAt = data?.savedAt ?? new Date().toISOString();
      const snapshot = insertSnapshot.run({
        fileName: data?.fileName ?? "untitled.xlsx",
        payloadJson: toJson(data),
        savedAt,
      });

      insertRecentFile.run({
        fileName: data?.fileName ?? "untitled.xlsx",
        rowCount: data?.rows?.length ?? 0,
        columnCount: data?.columns?.length ?? 0,
        openedAt: savedAt,
      });

      insertEvent.run({
        level: "INFO",
        message: `${data?.fileName ?? "작업"} 스냅샷을 SQLite에 저장했습니다.`,
        metaJson: toJson({ snapshotId: snapshot.lastInsertRowid }),
      });

      return snapshot.lastInsertRowid;
    });

    const snapshotId = transaction();
    return { ok: true, snapshotId };
  });
}

function closeDatabase() {
  if (!db) return;
  db.close();
  db = undefined;
}

module.exports = {
  closeDatabase,
  initializeDatabase,
  registerDatabaseIpc,
};
