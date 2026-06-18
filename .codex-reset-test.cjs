const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const Database = require("better-sqlite3");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "excel-reset-"));
const databasePath = path.join(directory, "test.sqlite");
const database = new Database(databasePath);
database.exec(fs.readFileSync("./public/database/reset-and-seed.sql", "utf8"));

const result = {
  tables: database.prepare(`
    SELECT COUNT(*) AS count FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  `).get().count,
  customers: database.prepare("SELECT COUNT(*) AS count FROM customers").get().count,
  products: database.prepare("SELECT COUNT(*) AS count FROM products").get().count,
  sales: database.prepare("SELECT COUNT(*) AS count FROM sales").get().count,
};

database.close();
fs.rmSync(directory, { recursive: true, force: true });
console.log(JSON.stringify(result));
