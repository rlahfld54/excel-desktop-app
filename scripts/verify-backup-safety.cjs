const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  backupDatabase,
  checkDatabaseIntegrity,
  closeDatabase,
  getDatabaseForInternalUse,
  initializeDatabase,
} = require("../public/database/localDb.cjs");

async function main() {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "excel-backup-safety-"));
  const fakeApp = {
    getPath(name) {
      if (name === "userData" || name === "documents") return testRoot;
      throw new Error(`Unexpected app path: ${name}`);
    },
  };

  try {
    initializeDatabase(fakeApp);
    const database = getDatabaseForInternalUse(fakeApp);
    database.exec("CREATE TABLE IF NOT EXISTS backup_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
    database.prepare("INSERT INTO backup_probe (value) VALUES (?)").run("verified");

    const backupPath = path.join(testRoot, "verified-backup.sqlite");
    await backupDatabase(fakeApp, backupPath);
    const validResult = checkDatabaseIntegrity(backupPath);
    assert.equal(validResult.ok, true, `Expected a valid backup: ${validResult.messages.join(" / ")}`);

    const corruptedPath = path.join(testRoot, "corrupted-backup.sqlite");
    fs.writeFileSync(corruptedPath, "not-a-sqlite-database", "utf8");
    const corruptedResult = checkDatabaseIntegrity(corruptedPath);
    assert.equal(corruptedResult.ok, false, "Corrupted SQLite must fail integrity validation");

    const electronSource = fs.readFileSync(path.join(__dirname, "../public/electron/electron.cjs"), "utf8");
    assert.match(electronSource, /safeStorage\.encryptString/, "Gmail credential must use Electron safeStorage");
    assert.match(electronSource, /gmailAppPassword:\s*_excludedSecret/, "Backup settings must exclude Gmail credentials");
    assert.doesNotMatch(electronSource, /scheduleAutoBackup\(/, "Scheduled interval backup must remain disabled");

    console.log("Backup safety verification passed.");
  } finally {
    closeDatabase();
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
