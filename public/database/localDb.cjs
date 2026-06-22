const path = require("node:path");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");

let db;

function ensureColumn(database, tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) return;
  database.exec(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
  );
}

function tableExists(database, tableName) {
  return Boolean(
    database
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName),
  );
}

function columnExists(database, tableName, columnName) {
  if (!tableExists(database, tableName)) return false;
  return database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

function hasForeignKeyTo(database, tableName, referencedTable) {
  if (!tableExists(database, tableName)) return false;
  return database
    .prepare(`PRAGMA foreign_key_list(${tableName})`)
    .all()
    .some((foreignKey) => foreignKey.table === referencedTable);
}

function getDatabase(app) {
  if (db) return db;

  const dbPath = path.join(app.getPath("userData"), "excel-desktop-app.sqlite");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
  CREATE TABLE IF NOT EXISTS activity_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_type TEXT NOT NULL DEFAULT 'APP',
    level TEXT NOT NULL DEFAULT 'INFO',
    user_id INTEGER,
    action TEXT,
    target_type TEXT,
    target_id TEXT,
    message TEXT NOT NULL,
    result TEXT,
    old_value TEXT,
    new_value TEXT,
    meta_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT UNIQUE,
    title TEXT NOT NULL,
    message TEXT,
    level TEXT NOT NULL DEFAULT 'INFO',
    target TEXT,
    href TEXT,
    read_status INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON notifications(read_status, created_at DESC);

  CREATE TABLE IF NOT EXISTS workspace_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_path TEXT,
    payload_json TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    column_count INTEGER NOT NULL DEFAULT 0,
    issue_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- =========================
  -- 거래처 마스터
  -- 실제 비교 기준은 customer_code
  -- =========================
  CREATE TABLE IF NOT EXISTS customers (
    customer_code TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    business_number TEXT UNIQUE,
    tax_status TEXT DEFAULT 'UNKNOWN',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    memo TEXT,
    closing_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- =========================
  -- 제품 마스터
  -- 실제 비교 기준은 product_code
  -- =========================
  CREATE TABLE IF NOT EXISTS products (
    product_code TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'EA',
    unit_price REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'KRW',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    memo TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- =========================
  -- 업로드 파일 기록
  -- =========================
  CREATE TABLE IF NOT EXISTS sales_uploads (
    upload_id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER,
    file_name TEXT NOT NULL,
    file_path TEXT,
    normalized_json_path TEXT,
    closing_month TEXT NOT NULL,
    uploaded_department_code TEXT,
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'UPLOADED',
    memo TEXT,
    FOREIGN KEY(snapshot_id) REFERENCES workspace_snapshots(id) ON DELETE SET NULL
  );

  -- =========================
  -- 업로드 행 데이터
  -- 엑셀 행 단위 검증용
  -- =========================
  CREATE TABLE IF NOT EXISTS sales (
    row_id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER NOT NULL,
    row_no INTEGER NOT NULL,
    transaction_date TEXT,

    raw_customer_name TEXT,
    raw_product_name TEXT,

    customer_code TEXT,
    product_code TEXT,

    quantity REAL,
    unit_price REAL,
    sales_amount REAL,

    validation_status TEXT NOT NULL DEFAULT 'PENDING',
    review_status TEXT NOT NULL DEFAULT 'WAITING',
    owner_name TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(upload_id) REFERENCES sales_uploads(upload_id) ON DELETE CASCADE,
    FOREIGN KEY(customer_code) REFERENCES customers(customer_code),
    FOREIGN KEY(product_code) REFERENCES products(product_code)
  );

  CREATE INDEX IF NOT EXISTS idx_sales_upload
  ON sales(upload_id);

  CREATE INDEX IF NOT EXISTS idx_sales_codes
  ON sales(customer_code, product_code);

  -- =========================
  -- 상세 검증 결과
  -- 기존 validation_results는 요약용,
  -- 이 테이블은 행별 상세 오류용
  -- =========================
  CREATE TABLE IF NOT EXISTS validation_issues (
    issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER NOT NULL,
    row_id INTEGER,

    error_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'WARNING',
    message TEXT NOT NULL,

    expected_value TEXT,
    actual_value TEXT,

    assigned_department_code TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT,

    FOREIGN KEY(upload_id) REFERENCES sales_uploads(upload_id) ON DELETE CASCADE,
    FOREIGN KEY(row_id) REFERENCES sales(row_id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_validation_issues_upload
  ON validation_issues(upload_id, status, severity);

  -- =========================
  -- 최종 보고서 기록
  -- =========================
  CREATE TABLE IF NOT EXISTS reports (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    upload_id INTEGER,
    snapshot_id INTEGER,
    report_name TEXT NOT NULL,
    report_type TEXT,
    closing_month TEXT,
    total_quantity REAL NOT NULL DEFAULT 0,
    total_sales_amount REAL NOT NULL DEFAULT 0,
    output_format TEXT NOT NULL DEFAULT 'XLSX',
    output_file_path TEXT,
    files_json TEXT,
    tags_json TEXT,
    options_json TEXT,
    generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'GENERATED',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(template_id) REFERENCES report_templates(template_id),
    FOREIGN KEY(upload_id) REFERENCES sales_uploads(upload_id),
    FOREIGN KEY(snapshot_id) REFERENCES workspace_snapshots(id)
  );

  -- =========================
-- 1. 보고서 템플릿
-- 월간 매출 요약, 거래처별 오류 목록 등
-- =========================
CREATE TABLE IF NOT EXISTS report_templates (
  template_id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  -- MONTHLY_SALES_SUMMARY, CUSTOMER_ERROR_LIST,
  -- DUPLICATE_CHECK_REPORT, BACKUP_VALIDATION_REPORT

  description TEXT,
  default_format TEXT NOT NULL DEFAULT 'XLSX',
  -- PDF, XLSX, PDF_XLSX

  template_file_path TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  version INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_templates_type
ON report_templates(report_type, status);


-- =========================
-- 1. 사용자 계정
-- 로컬 관리자 모드 기준
-- 비밀번호는 실제 값 저장 X, hash 저장
-- =========================
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'ADMIN',
  -- ADMIN, MANAGER, VIEWER

  department_name TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  last_login_at TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_department
ON users(department_name, status);

CREATE TABLE IF NOT EXISTS user_todo_state (
  username TEXT PRIMARY KEY,
  todos_json TEXT NOT NULL DEFAULT '[]',
  history_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS contacts (
  contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_code TEXT,
  department_name TEXT,
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  preferred_channel TEXT NOT NULL DEFAULT 'EMAIL',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(customer_code) REFERENCES customers(customer_code)
);

CREATE INDEX IF NOT EXISTS idx_contacts_customer
ON contacts(customer_code, status);

CREATE TABLE IF NOT EXISTS closing_status (
  closing_status_id INTEGER PRIMARY KEY AUTOINCREMENT,
  closing_month TEXT NOT NULL,
  customer_code TEXT NOT NULL,
  owner_name TEXT,
  deadline TEXT NOT NULL DEFAULT '30일',
  contact_confirmed INTEGER NOT NULL DEFAULT 0,
  amount_confirmed INTEGER NOT NULL DEFAULT 0,
  confirmed_amount REAL NOT NULL DEFAULT 0,
  tax_issued INTEGER NOT NULL DEFAULT 0,
  tax_matched INTEGER NOT NULL DEFAULT 0,
  request_ready INTEGER NOT NULL DEFAULT 0,
  request_sent INTEGER NOT NULL DEFAULT 0,
  closing_sheet_sent INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '회신 대기',
  memo TEXT,
  history_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(closing_month, customer_code),
  FOREIGN KEY(customer_code) REFERENCES customers(customer_code)
);

CREATE INDEX IF NOT EXISTS idx_closing_status_month
ON closing_status(closing_month, customer_code);

CREATE TABLE IF NOT EXISTS message_templates (
  template_id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  subject_template TEXT,
  body_template TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'COOPERATIVE',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_history (
  email_id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id INTEGER,
  package_name TEXT NOT NULL,
  upload_id INTEGER,
  closing_month TEXT,
  output_folder_path TEXT NOT NULL,
  customer_code TEXT,
  contact_id INTEGER,
  customer_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  subject TEXT,
  body TEXT NOT NULL,
  attachment_pdf_path TEXT,
  attachment_xlsx_path TEXT,
  status TEXT NOT NULL DEFAULT 'READY',
  sent_checked_at TEXT,
  memo TEXT,
  export_type TEXT,
  export_file_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(upload_id) REFERENCES sales_uploads(upload_id),
  FOREIGN KEY(customer_code) REFERENCES customers(customer_code),
  FOREIGN KEY(contact_id) REFERENCES contacts(contact_id)
);

CREATE INDEX IF NOT EXISTS idx_email_history_package
ON email_history(package_id, status);

`);

  db.pragma("foreign_keys = OFF");
  db.exec("DROP TABLE IF EXISTS product_aliases");
  db.exec("DROP TABLE IF EXISTS customer_aliases");

  ensureColumn(db, "products", "unit_price", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "products", "currency", "TEXT NOT NULL DEFAULT 'KRW'");
  ensureColumn(db, "customers", "closing_json", "TEXT");
  ensureColumn(db, "users", "department_name", "TEXT");
  ensureColumn(db, "workspace_snapshots", "file_path", "TEXT");
  ensureColumn(
    db,
    "workspace_snapshots",
    "row_count",
    "INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    db,
    "workspace_snapshots",
    "column_count",
    "INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    db,
    "workspace_snapshots",
    "issue_count",
    "INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    db,
    "workspace_snapshots",
    "duplicate_count",
    "INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    db,
    "workspace_snapshots",
    "review_count",
    "INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(db, "sales", "transaction_date", "TEXT");
  ensureColumn(db, "sales", "owner_name", "TEXT");
  ensureColumn(db, "email_history", "created_by", "TEXT");
  ensureColumn(db, "users", "title", "TEXT");
  ensureColumn(db, "users", "email", "TEXT");
  ensureColumn(db, "users", "phone", "TEXT");
  if (tableExists(db, "sales_rows")) {
    ensureColumn(db, "sales_rows", "transaction_date", "TEXT");
    ensureColumn(db, "sales_rows", "owner_name", "TEXT");
  }

  if (
    tableExists(db, "departments") &&
    columnExists(db, "users", "department_code")
  ) {
    db.exec(`
      UPDATE users
      SET department_name = COALESCE(
        department_name,
        (SELECT department_name FROM departments WHERE department_code = users.department_code)
      );
    `);
  }

  if (hasForeignKeyTo(db, "users", "departments")) {
    db.exec(`
      CREATE TABLE users_rebuilt (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'ADMIN',
        department_name TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        last_login_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users_rebuilt
      SELECT user_id, username, display_name, password_hash, role,
             department_name, status, last_login_at, created_at, updated_at
      FROM users;
      DROP TABLE users;
      ALTER TABLE users_rebuilt RENAME TO users;
      CREATE INDEX idx_users_department ON users(department_name, status);
    `);
  }

  if (hasForeignKeyTo(db, "sales_uploads", "departments")) {
    db.exec(`
      CREATE TABLE sales_uploads_rebuilt (
        upload_id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER,
        file_name TEXT NOT NULL,
        file_path TEXT,
        normalized_json_path TEXT,
        closing_month TEXT NOT NULL,
        uploaded_department_code TEXT,
        uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'UPLOADED',
        memo TEXT,
        FOREIGN KEY(snapshot_id) REFERENCES workspace_snapshots(id) ON DELETE SET NULL
      );
      INSERT INTO sales_uploads_rebuilt SELECT * FROM sales_uploads;
      DROP TABLE sales_uploads;
      ALTER TABLE sales_uploads_rebuilt RENAME TO sales_uploads;
    `);
  }

  if (hasForeignKeyTo(db, "validation_issues", "departments")) {
    db.exec(`
      CREATE TABLE validation_issues_rebuilt (
        issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
        upload_id INTEGER NOT NULL,
        row_id INTEGER,
        error_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'WARNING',
        message TEXT NOT NULL,
        expected_value TEXT,
        actual_value TEXT,
        assigned_department_code TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT,
        FOREIGN KEY(upload_id) REFERENCES sales_uploads(upload_id) ON DELETE CASCADE,
        FOREIGN KEY(row_id) REFERENCES sales(row_id) ON DELETE SET NULL
      );
      INSERT INTO validation_issues_rebuilt SELECT * FROM validation_issues;
      DROP TABLE validation_issues;
      ALTER TABLE validation_issues_rebuilt RENAME TO validation_issues;
      CREATE INDEX idx_validation_issues_upload
      ON validation_issues(upload_id, status, severity);
    `);
  }

  db.exec("DROP TABLE IF EXISTS departments");

  if (tableExists(db, "sales_prices")) {
    db.exec(`
      UPDATE products
      SET
        unit_price = COALESCE((
          SELECT price FROM sales_prices
          WHERE product_code = products.product_code
          ORDER BY start_date DESC, price_id DESC
          LIMIT 1
        ), unit_price),
        currency = COALESCE((
          SELECT currency FROM sales_prices
          WHERE product_code = products.product_code
          ORDER BY start_date DESC, price_id DESC
          LIMIT 1
        ), currency);
      DROP TABLE sales_prices;
    `);
  }

  if (tableExists(db, "sales_rows")) {
    db.exec(`
      INSERT OR IGNORE INTO sales (
        row_id, upload_id, row_no, transaction_date,
        raw_customer_name, raw_product_name, customer_code, product_code,
        quantity, unit_price, sales_amount, validation_status,
        review_status, owner_name, created_at
      )
      SELECT
        row_id, upload_id, row_no, transaction_date,
        raw_customer_name, raw_product_name, customer_code, product_code,
        quantity, unit_price, sales_amount, validation_status,
        review_status, owner_name, created_at
      FROM sales_rows;
      DROP TABLE sales_rows;
    `);
  }

  if (tableExists(db, "recent_files")) {
    db.exec(`
      INSERT INTO workspace_snapshots (
        file_name, file_path, payload_json, row_count, column_count, saved_at
      )
      SELECT file_name, file_path, '{}', row_count, column_count, opened_at
      FROM recent_files
      WHERE NOT EXISTS (
        SELECT 1 FROM workspace_snapshots
        WHERE workspace_snapshots.file_name = recent_files.file_name
          AND workspace_snapshots.saved_at = recent_files.opened_at
      );
      DROP TABLE recent_files;
    `);
  }

  if (tableExists(db, "validation_results")) {
    db.exec(`
      UPDATE workspace_snapshots
      SET
        issue_count = COALESCE((SELECT issue_count FROM validation_results WHERE snapshot_id = workspace_snapshots.id ORDER BY id DESC LIMIT 1), issue_count),
        duplicate_count = COALESCE((SELECT duplicate_count FROM validation_results WHERE snapshot_id = workspace_snapshots.id ORDER BY id DESC LIMIT 1), duplicate_count),
        review_count = COALESCE((SELECT review_count FROM validation_results WHERE snapshot_id = workspace_snapshots.id ORDER BY id DESC LIMIT 1), review_count);
      DROP TABLE validation_results;
    `);
  }

  if (tableExists(db, "report_jobs")) {
    db.exec(`
      INSERT OR IGNORE INTO reports (
        report_id, template_id, upload_id, snapshot_id, report_name,
        output_format, output_file_path, generated_at, status, created_at, updated_at
      )
      SELECT
        job_id, template_id, upload_id, snapshot_id, report_name,
        output_format, output_file_path, COALESCE(generated_at, created_at),
        status, created_at, updated_at
      FROM report_jobs;
      DROP TABLE report_jobs;
    `);
  }

  if (tableExists(db, "closing_reports")) {
    db.exec(`
      INSERT OR IGNORE INTO reports (
        report_id, upload_id, report_name, report_type, closing_month,
        total_quantity, total_sales_amount, output_file_path,
        generated_at, status, created_at, updated_at
      )
      SELECT
        report_id, upload_id, '마감 보고서', 'CLOSING', closing_month,
        total_quantity, total_sales_amount, report_file_path,
        generated_at, status, generated_at, generated_at
      FROM closing_reports;
      DROP TABLE closing_reports;
    `);
  }

  db.exec(`
    DROP TABLE IF EXISTS report_output_options;
    DROP TABLE IF EXISTS report_files;
    DROP TABLE IF EXISTS report_job_tags;
    DROP TABLE IF EXISTS report_tags;
  `);

  if (tableExists(db, "app_events")) {
    db.exec(`
      INSERT INTO activity_logs (log_type, level, action, message, meta_json, created_at)
      SELECT 'APP', level, 'APP_EVENT', message, meta_json, created_at FROM app_events;
      DROP TABLE app_events;
    `);
  }

  if (tableExists(db, "audit_logs")) {
    db.exec(`
      INSERT INTO activity_logs (
        log_type, level, action, target_type, target_id,
        message, old_value, new_value, created_at
      )
      SELECT
        'AUDIT', 'INFO', field_name, table_name, record_key,
        change_reason, old_value, new_value, changed_at
      FROM audit_logs;
      DROP TABLE audit_logs;
    `);
  }

  if (tableExists(db, "login_logs")) {
    db.exec(`
      INSERT INTO activity_logs (
        log_type, level, user_id, action, result, message, created_at
      )
      SELECT
        'LOGIN',
        CASE WHEN login_result = 'FAILED' THEN 'WARN' ELSE 'INFO' END,
        user_id, 'LOGIN', login_result, COALESCE(message, username), logged_at
      FROM login_logs;
      DROP TABLE login_logs;
    `);
  }

  if (tableExists(db, "backup_history")) {
    db.exec(`
      INSERT INTO activity_logs (
        log_type, level, action, target_type, target_id, message, meta_json, created_at
      )
      SELECT
        'BACKUP', 'INFO', 'BACKUP', target_type, target_key, backup_reason,
        json_object(
          'beforeSnapshotPath', before_snapshot_path,
          'afterSnapshotPath', after_snapshot_path,
          'retentionUntil', retention_until
        ),
        created_at
      FROM backup_history;
      DROP TABLE backup_history;
    `);
  }

  if (tableExists(db, "report_job_logs")) {
    db.exec(`
      INSERT INTO activity_logs (
        log_type, level, action, target_type, target_id, message, meta_json, created_at
      )
      SELECT
        'REPORT', level, 'REPORT_JOB', 'REPORT_JOB', CAST(job_id AS TEXT),
        message, meta_json, created_at
      FROM report_job_logs;
      DROP TABLE report_job_logs;
    `);
  }

  if (
    tableExists(db, "send_packages") &&
    tableExists(db, "send_package_items")
  ) {
    db.exec(`
      INSERT INTO email_history (
        email_id, package_id, package_name, upload_id, closing_month,
        output_folder_path, customer_code, contact_id, customer_name,
        recipient_email, recipient_phone, channel, subject, body,
        attachment_pdf_path, attachment_xlsx_path, status,
        sent_checked_at, memo, created_at
      )
      SELECT
        i.item_id, p.package_id, p.package_name, p.upload_id, p.closing_month,
        p.output_folder_path, i.customer_code, i.contact_id, i.customer_name,
        i.recipient_email, i.recipient_phone, i.channel, i.subject, i.body,
        i.attachment_pdf_path, i.attachment_xlsx_path, i.status,
        i.sent_checked_at, i.memo, i.created_at
      FROM send_package_items i
      JOIN send_packages p ON p.package_id = i.package_id;
      DROP TABLE send_package_items;
      DROP TABLE send_packages;
      DROP TABLE IF EXISTS send_exports;
    `);
  }

  if (tableExists(db, "mapping_suggestions")) {
    db.exec(`
      INSERT INTO activity_logs (
        log_type, level, action, target_type, target_id, message, meta_json, created_at
      )
      SELECT
        'MAPPING', 'INFO', 'SUGGEST', target_type, CAST(suggestion_id AS TEXT),
        raw_value,
        json_object(
          'suggestedCode', suggested_code,
          'suggestedName', suggested_name,
          'confidence', confidence,
          'status', status
        ),
        created_at
      FROM mapping_suggestions;
      DROP TABLE mapping_suggestions;
    `);
  }

  if (tableExists(db, "department_requests")) {
    db.exec(`
      INSERT INTO activity_logs (
        log_type, level, action, target_type, target_id, message, meta_json, created_at
      )
      SELECT
        'REQUEST', 'INFO', 'DEPARTMENT_REQUEST', 'DEPARTMENT', request_id, title,
        json_object(
          'department', department, 'due', due, 'owner', owner,
          'priority', priority, 'status', status
        ),
        created_at
      FROM department_requests;
      DROP TABLE department_requests;
    `);
  }

  if (tableExists(db, "closing_companies")) {
    db.exec(`
      INSERT OR IGNORE INTO customers (
        customer_code, customer_name, status, memo, closing_json, created_at, updated_at
      )
      SELECT
        closing_id, company, 'ACTIVE', memo,
        json_object(
          'id', closing_id, 'company', company, 'owner', owner,
          'deadline', deadline, 'contactName', contact_name,
          'contactDepartment', contact_department, 'contactTitle', contact_title,
          'email', email, 'phone', phone, 'channel', channel,
          'salesAmount', sales_amount, 'confirmedAmount', confirmed_amount,
          'taxAmount', tax_amount, 'contactConfirmed', contact_confirmed,
          'amountConfirmed', amount_confirmed, 'taxMatched', tax_matched,
          'taxIssued', tax_issued, 'requestReady', request_ready,
          'requestSent', request_sent, 'closingSheetSent', closing_sheet_sent,
          'reason', reason, 'memo', memo, 'lastContactAt', last_contact_at,
          'contactCount', contact_count, 'historyJson', history_json
        ),
        created_at, updated_at
      FROM closing_companies;
      DROP TABLE closing_companies;
    `);
  }

  ensureColumn(db, "users", "title", "TEXT");
  ensureColumn(db, "users", "email", "TEXT");
  ensureColumn(db, "users", "phone", "TEXT");

  db.pragma("foreign_keys = ON");

  return db;
}

function toJson(value) {
  return JSON.stringify(value ?? null);
}

function fromJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getColumnIndex(columns, names) {
  if (!Array.isArray(columns)) return -1;
  const aliases = (Array.isArray(names) ? names : [names])
    .map((name) => String(name ?? "").replace(/\s+/g, "").toLowerCase());

  return columns.findIndex((column) =>
    aliases.includes(String(column ?? "").replace(/\s+/g, "").toLowerCase())
  );
}

function getCell(row, index) {
  return index >= 0 ? row[index] : undefined;
}

function getCellOr(row, index, fallbackIndex) {
  const value = getCell(row, index);
  return value !== undefined && value !== null && value !== ""
    ? value
    : getCell(row, fallbackIndex);
}

function parseNumber(value) {
  const number = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
  if (value === null || value === undefined) return "";
  return Number(value).toLocaleString("ko-KR");
}

function getClosingMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getLatestSalesData(database) {
  const upload = database
    .prepare(
      `
      SELECT upload_id AS uploadId, file_name AS fileName, uploaded_at AS uploadedAt
      FROM sales_uploads
      ORDER BY uploaded_at DESC, upload_id DESC
      LIMIT 1
    `,
    )
    .get();

  if (!upload) {
    return { ok: true, data: null };
  }

  const rows = database
    .prepare(
      `
      SELECT
        transaction_date AS transactionDate,
        raw_customer_name AS rawCustomerName,
        raw_product_name AS rawProductName,
        product_code AS productCode,
        quantity,
        unit_price AS unitPrice,
        sales_amount AS salesAmount,
        validation_status AS validationStatus,
        owner_name AS ownerName
      FROM sales
      WHERE upload_id = @uploadId
      ORDER BY row_no ASC
    `,
    )
    .all({ uploadId: upload.uploadId })
    .map((row) => [
      row.transactionDate ?? "",
      row.rawCustomerName ?? "",
      row.productCode ?? "",
      row.rawProductName ?? "",
      formatNumber(row.quantity),
      formatNumber(row.unitPrice),
      formatNumber(row.salesAmount),
      row.validationStatus ?? "",
      row.ownerName ?? "",
    ]);

  return {
    ok: true,
    data: {
      id: upload.uploadId,
      fileName: upload.fileName,
      savedAt: upload.uploadedAt,
      payload: {
        fileName: upload.fileName,
        columns: [
          "거래일",
          "거래처",
          "품목 코드",
          "품목명",
          "수량",
          "단가",
          "금액",
          "검증",
          "담당자",
        ],
        rows,
        savedAt: upload.uploadedAt,
        source: "sales",
      },
    },
  };
}

function getFilteredSalesData(database, options = {}) {
  const isValidDateValue = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  };
  const startDate = String(options.startDate ?? "");
  const endDate = String(options.endDate ?? "");
  const customerSearch = String(options.customer ?? "").trim();
  const productSearch = String(options.product ?? "").trim();

  if (!startDate || !isValidDateValue(startDate)) {
    throw new Error("시작일은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.");
  }
  if (!endDate || !isValidDateValue(endDate)) {
    throw new Error("마지막일은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.");
  }
  if (startDate > endDate) {
    throw new Error("마지막일은 시작일보다 빠를 수 없습니다.");
  }
  if (customerSearch.length > 100 || productSearch.length > 100) {
    throw new Error("검색어는 100자 이하로 입력해 주세요.");
  }

  const latestUpload = database
    .prepare(
      `SELECT upload_id AS uploadId, file_name AS fileName, uploaded_at AS uploadedAt
       FROM sales_uploads
       ORDER BY uploaded_at DESC, upload_id DESC
       LIMIT 1`,
    )
    .get();

  if (!latestUpload) {
    return {
      ok: true,
      data: {
        fileName: "workspace-data.xlsx",
        savedAt: null,
        columns: [
          "거래일",
          "거래처",
          "품목 코드",
          "품목명",
          "수량",
          "단가",
          "금액",
          "검증",
          "담당자",
        ],
        rows: [],
        ownerOptions: [],
        total: 0,
        page: 1,
        pageSize: Number(options.pageSize) || 50,
      },
    };
  }

  const pageSize = Math.min(Math.max(Number(options.pageSize) || 50, 1), 200);
  const page = Math.max(Number(options.page) || 1, 1);
  const offset = (page - 1) * pageSize;
  const params = {
    startDate,
    endDate,
    status: String(options.status ?? "전체"),
    customer: `%${customerSearch.toLowerCase()}%`,
    product: `%${productSearch.toLowerCase()}%`,
    owner: String(options.owner ?? "전체"),
    limit: pageSize,
    offset,
  };
  const where = [
    "(@startDate = '' OR transaction_date >= @startDate)",
    "(@endDate = '' OR transaction_date <= @endDate)",
    "(@status = '전체' OR validation_status = @status)",
    `(
      @customer = '%%'
      OR lower(COALESCE(raw_customer_name, '')) LIKE @customer
      OR lower(COALESCE(customer_code, '')) LIKE @customer
    )`,
    `(
      @product = '%%'
      OR lower(COALESCE(raw_product_name, '')) LIKE @product
      OR lower(COALESCE(product_code, '')) LIKE @product
    )`,
    "(@owner = '전체' OR COALESCE(owner_name, '') = @owner)",
  ].join(" AND ");

  const total =
    database
      .prepare(`SELECT COUNT(*) AS count FROM sales WHERE ${where}`)
      .get(params)?.count ?? 0;
  const rows = database
    .prepare(
      `
      SELECT
        row_no AS rowNo,
        transaction_date AS transactionDate,
        raw_customer_name AS rawCustomerName,
        raw_product_name AS rawProductName,
        product_code AS productCode,
        quantity,
        unit_price AS unitPrice,
        sales_amount AS salesAmount,
        validation_status AS validationStatus,
        owner_name AS ownerName
      FROM sales
      WHERE ${where}
      ORDER BY row_no ASC
      LIMIT @limit OFFSET @offset
    `,
    )
    .all(params)
    .map((row) => [
      row.transactionDate ?? "",
      row.rawCustomerName ?? "",
      row.productCode ?? "",
      row.rawProductName ?? "",
      formatNumber(row.quantity),
      formatNumber(row.unitPrice),
      formatNumber(row.salesAmount),
      row.validationStatus ?? "",
      row.ownerName ?? "",
    ]);
  const ownerOptions = database
    .prepare(
      `SELECT DISTINCT owner_name AS ownerName
       FROM sales
       WHERE (@startDate = '' OR transaction_date >= @startDate)
         AND (@endDate = '' OR transaction_date <= @endDate)
         AND TRIM(COALESCE(owner_name, '')) <> ''
       ORDER BY owner_name ASC`,
    )
    .all(params)
    .map((row) => row.ownerName);
  const source = database
    .prepare(
      `SELECT
         COUNT(DISTINCT sales.upload_id) AS uploadCount,
         MIN(sales.transaction_date) AS firstDate,
         MAX(sales.transaction_date) AS lastDate,
         MAX(uploads.file_name) AS fileName,
         MAX(uploads.uploaded_at) AS savedAt
       FROM sales
       JOIN sales_uploads uploads ON uploads.upload_id = sales.upload_id
       WHERE (@startDate = '' OR sales.transaction_date >= @startDate)
         AND (@endDate = '' OR sales.transaction_date <= @endDate)`,
    )
    .get(params);

  return {
    ok: true,
    data: {
      id: latestUpload.uploadId,
      fileName: source?.uploadCount > 1
        ? `${source.firstDate ?? ""}~${source.lastDate ?? ""} 매출 조회`
        : source?.fileName ?? latestUpload.fileName,
      savedAt: source?.savedAt ?? latestUpload.uploadedAt,
      columns: [
        "거래일",
        "거래처",
        "품목 코드",
        "품목명",
        "수량",
        "단가",
        "금액",
        "검증",
        "담당자",
      ],
      rows,
      ownerOptions,
      total,
      page,
      pageSize,
    },
  };
}

function getDailySalesTrend(database, limit = 45) {
  const upload = database
    .prepare(
      `
      SELECT upload_id AS uploadId, file_name AS fileName, uploaded_at AS uploadedAt
      FROM sales_uploads
      ORDER BY uploaded_at DESC, upload_id DESC
      LIMIT 1
    `,
    )
    .get();

  if (!upload) {
    return { ok: true, items: [], maxValue: 0, source: null };
  }

  const items = database
    .prepare(
      `
      SELECT
        substr(transaction_date, 1, 10) AS date,
        substr(transaction_date, 6, 5) AS day,
        COALESCE(SUM(sales_amount), 0) AS amount
      FROM sales
      WHERE upload_id = @uploadId
        AND transaction_date IS NOT NULL
        AND transaction_date <> ''
      GROUP BY substr(transaction_date, 1, 10)
      ORDER BY date DESC
      LIMIT @limit
    `,
    )
    .all({
      uploadId: upload.uploadId,
      limit: Math.max(Number(limit) || 45, 1),
    })
    .reverse()
    .map((item) => ({
      date: item.date,
      day: item.day || item.date,
      amount: Number(item.amount) || 0,
    }));

  return {
    ok: true,
    items,
    maxValue: Math.max(0, ...items.map((item) => item.amount)),
    source: {
      uploadId: upload.uploadId,
      fileName: upload.fileName,
      uploadedAt: upload.uploadedAt,
    },
  };
}

function toBooleanNumber(value) {
  return value ? 1 : 0;
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeClosingCompany(row) {
  return {
    id: row.closingId,
    company: row.company,
    owner: row.owner ?? "",
    deadline: row.deadline ?? "",
    contactName: row.contactName ?? "",
    contactDepartment: row.contactDepartment ?? "",
    contactTitle: row.contactTitle ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    channel: row.channel ?? "EMAIL",
    salesAmount: Number(row.salesAmount) || 0,
    confirmedAmount: Number(row.confirmedAmount) || 0,
    taxAmount: Number(row.taxAmount) || 0,
    contactConfirmed: row.contactConfirmed === 1,
    amountConfirmed: row.amountConfirmed === 1,
    taxMatched: row.taxMatched === 1,
    taxIssued: row.taxIssued === 1,
    requestReady: row.requestReady === 1,
    requestSent: row.requestSent === 1,
    closingSheetSent: row.closingSheetSent === 1,
    reason: row.reason ?? "",
    memo: row.memo ?? "",
    lastContactAt: row.lastContactAt ?? "",
    contactCount: Number(row.contactCount) || 0,
    history: parseJsonArray(row.historyJson),
    updatedAt: row.updatedAt,
  };
}

function migrateLegacyClosingStatus(database) {
  const rows = database
    .prepare(
      `SELECT customer_code AS customerCode, closing_json AS closingJson, updated_at AS updatedAt
       FROM customers
       WHERE closing_json IS NOT NULL AND closing_json <> ''`,
    )
    .all();
  const insert = database.prepare(
    `INSERT OR IGNORE INTO closing_status (
       closing_month, customer_code, owner_name, deadline,
       contact_confirmed, amount_confirmed, confirmed_amount,
       tax_issued, tax_matched, request_ready, request_sent,
       closing_sheet_sent, reason, memo, history_json, updated_at
     )
     VALUES (
       @closingMonth, @customerCode, @ownerName, @deadline,
       @contactConfirmed, @amountConfirmed, @confirmedAmount,
       @taxIssued, @taxMatched, @requestReady, @requestSent,
       @closingSheetSent, @reason, @memo, @historyJson, @updatedAt
     )`,
  );

  return database.transaction(() => {
    let inserted = 0;
    rows.forEach((row) => {
      let data = {};
      try {
        data = JSON.parse(row.closingJson || "{}");
      } catch {
        data = {};
      }
      const closingMonth = /^\d{4}-\d{2}/.test(row.updatedAt || "")
        ? row.updatedAt.slice(0, 7)
        : new Date().toISOString().slice(0, 7);
      const result = insert.run({
        closingMonth,
        customerCode: row.customerCode,
        ownerName: data.owner ?? "",
        deadline: data.deadline ?? "30일",
        contactConfirmed: toBooleanNumber(data.contactConfirmed),
        amountConfirmed: toBooleanNumber(data.amountConfirmed),
        confirmedAmount: Number(data.confirmedAmount) || 0,
        taxIssued: toBooleanNumber(data.taxIssued),
        taxMatched: toBooleanNumber(data.taxMatched),
        requestReady: toBooleanNumber(data.requestReady),
        requestSent: toBooleanNumber(data.requestSent),
        closingSheetSent: toBooleanNumber(data.closingSheetSent),
        reason: data.reason ?? "회신 대기",
        memo: data.memo ?? "",
        historyJson: JSON.stringify(
          data.history ?? parseJsonArray(data.historyJson),
        ),
        updatedAt: row.updatedAt ?? new Date().toISOString(),
      });
      inserted += result.changes;
    });
    return inserted;
  })();
}

function getDepartmentRequests(database) {
  return database
    .prepare(
      `
    SELECT
      target_id AS id,
      message AS title,
      meta_json AS metaJson,
      created_at AS createdAt
    FROM activity_logs
    WHERE log_type = 'REQUEST'
    ORDER BY log_id DESC
  `,
    )
    .all()
    .map((row) => {
      const meta = JSON.parse(row.metaJson || "{}");
      return {
        id: row.id,
        title: row.title,
        department: meta.department ?? "",
        due: meta.due ?? "",
        owner: meta.owner ?? "",
        priority: meta.priority ?? "LOW",
        status: meta.status ?? "접수",
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
      };
    });
}

function getClosingCompanies(database, options = {}) {
  const params = {
    month: String(options.month ?? options.closingMonth ?? ""),
    startDate: String(options.startDate ?? ""),
    endDate: String(options.endDate ?? ""),
    excludeCompleted: options.excludeCompleted ? 1 : 0,
    emailOnly: options.emailOnly ? 1 : 0,
  };

  return database
    .prepare(
      `
      WITH selected_upload AS (
        SELECT uploads.upload_id
        FROM sales_uploads uploads
        WHERE EXISTS (
          SELECT 1
          FROM sales source_rows
          WHERE source_rows.upload_id = uploads.upload_id
            AND (@startDate = '' OR source_rows.transaction_date >= @startDate)
            AND (@endDate = '' OR source_rows.transaction_date <= @endDate)
        )
        ORDER BY
          CASE WHEN @month <> '' AND uploads.closing_month = @month THEN 0 ELSE 1 END,
          uploads.uploaded_at DESC,
          uploads.upload_id DESC
        LIMIT 1
      ),
      sales_summary AS (
        SELECT
          sales.customer_code AS customerCode,
          SUM(COALESCE(sales.sales_amount, 0)) AS salesAmount,
          MAX(COALESCE(sales.owner_name, '')) AS ownerName
        FROM sales
        WHERE sales.upload_id = (SELECT upload_id FROM selected_upload)
          AND sales.customer_code IS NOT NULL
          AND (@startDate = '' OR sales.transaction_date >= @startDate)
          AND (@endDate = '' OR sales.transaction_date <= @endDate)
        GROUP BY sales.customer_code
      ),
      issue_summary AS (
        SELECT sales.customer_code AS customerCode, COUNT(*) AS issueCount
        FROM validation_issues issues
        JOIN sales ON sales.row_id = issues.row_id
        WHERE sales.upload_id = (SELECT upload_id FROM selected_upload)
          AND issues.status = 'OPEN'
        GROUP BY sales.customer_code
      ),
      email_summary AS (
        SELECT
          customer_code AS customerCode,
          SUM(CASE WHEN status IN ('SENT', 'SUCCESS', 'COMPLETED', 'REPLIED', 'CLOSED') THEN 1 ELSE 0 END) AS contactCount,
          MAX(CASE WHEN status IN ('SENT', 'SUCCESS', 'COMPLETED', 'REPLIED', 'CLOSED') THEN created_at END) AS lastContactAt,
          MAX(CASE WHEN status IN ('SENT', 'SUCCESS', 'COMPLETED', 'REPLIED', 'CLOSED') THEN 1 ELSE 0 END) AS requestSent,
          MAX(CASE WHEN attachment_xlsx_path IS NOT NULL AND attachment_xlsx_path <> '' THEN 1 ELSE 0 END) AS closingSheetSent
        FROM email_history
        WHERE (@month = '' OR closing_month = @month)
        GROUP BY customer_code
      )
      SELECT
        customers.customer_code AS closingId,
        customers.customer_name AS company,
        COALESCE(status.owner_name, sales_summary.ownerName, '') AS owner,
        COALESCE(
          status.deadline,
          CASE customers.rowid % 3 WHEN 1 THEN '10일' WHEN 2 THEN '25일' ELSE '30일' END
        ) AS deadline,
        COALESCE((
          SELECT contacts.recipient_name FROM contacts
          WHERE contacts.customer_code = customers.customer_code
          ORDER BY CASE WHEN contacts.status = 'ACTIVE' THEN 0 ELSE 1 END, contacts.contact_id
          LIMIT 1
        ), '') AS contactName,
        COALESCE((
          SELECT contacts.department_name FROM contacts
          WHERE contacts.customer_code = customers.customer_code
          ORDER BY CASE WHEN contacts.status = 'ACTIVE' THEN 0 ELSE 1 END, contacts.contact_id
          LIMIT 1
        ), '') AS contactDepartment,
        '' AS contactTitle,
        COALESCE((
          SELECT contacts.recipient_email FROM contacts
          WHERE contacts.customer_code = customers.customer_code
          ORDER BY CASE WHEN contacts.status = 'ACTIVE' THEN 0 ELSE 1 END, contacts.contact_id
          LIMIT 1
        ), '') AS email,
        COALESCE((
          SELECT contacts.recipient_phone FROM contacts
          WHERE contacts.customer_code = customers.customer_code
          ORDER BY CASE WHEN contacts.status = 'ACTIVE' THEN 0 ELSE 1 END, contacts.contact_id
          LIMIT 1
        ), '') AS phone,
        COALESCE((
          SELECT contacts.preferred_channel FROM contacts
          WHERE contacts.customer_code = customers.customer_code
          ORDER BY CASE WHEN contacts.status = 'ACTIVE' THEN 0 ELSE 1 END, contacts.contact_id
          LIMIT 1
        ), 'EMAIL') AS channel,
        sales_summary.salesAmount,
        COALESCE(NULLIF(status.confirmed_amount, 0), sales_summary.salesAmount) AS confirmedAmount,
        ROUND(sales_summary.salesAmount * 0.1) AS taxAmount,
        COALESCE(status.contact_confirmed, 0) AS contactConfirmed,
        COALESCE(status.amount_confirmed, 0) AS amountConfirmed,
        COALESCE(status.tax_matched, 0) AS taxMatched,
        COALESCE(status.tax_issued, 0) AS taxIssued,
        COALESCE(status.request_ready, 0) AS requestReady,
        MAX(COALESCE(status.request_sent, 0), COALESCE(email_summary.requestSent, 0)) AS requestSent,
        MAX(COALESCE(status.closing_sheet_sent, 0), COALESCE(email_summary.closingSheetSent, 0)) AS closingSheetSent,
        COALESCE(
          status.reason,
          CASE WHEN COALESCE(issue_summary.issueCount, 0) > 0 THEN '내부 검토' ELSE '회신 대기' END
        ) AS reason,
        COALESCE(status.memo, '') AS memo,
        COALESCE(email_summary.lastContactAt, '') AS lastContactAt,
        COALESCE(email_summary.contactCount, 0) AS contactCount,
        COALESCE(status.history_json, '[]') AS historyJson,
        COALESCE(status.updated_at, customers.updated_at) AS updatedAt
      FROM sales_summary
      JOIN customers ON customers.customer_code = sales_summary.customerCode
      LEFT JOIN closing_status status
        ON status.customer_code = customers.customer_code
       AND status.closing_month = @month
      LEFT JOIN issue_summary ON issue_summary.customerCode = customers.customer_code
      LEFT JOIN email_summary ON email_summary.customerCode = customers.customer_code
      WHERE (
        @excludeCompleted = 0
        OR COALESCE(status.amount_confirmed, 0) = 0
      )
      AND (
        @emailOnly = 0
        OR COALESCE((
          SELECT contacts.preferred_channel FROM contacts
          WHERE contacts.customer_code = customers.customer_code
          ORDER BY CASE WHEN contacts.status = 'ACTIVE' THEN 0 ELSE 1 END, contacts.contact_id
          LIMIT 1
        ), 'EMAIL') = 'EMAIL'
      )
      ORDER BY customers.customer_code ASC
    `,
    )
    .all(params)
    .map(normalizeClosingCompany);
}

function saveClosingCompanies(database, rows = [], options = {}) {
  const closingMonth = String(
    options.month ??
      options.closingMonth ??
      new Date().toISOString().slice(0, 7),
  );
  const upsert = database.prepare(`
    INSERT INTO closing_status (
      closing_month, customer_code, owner_name, deadline,
      contact_confirmed, amount_confirmed, confirmed_amount,
      tax_issued, tax_matched, request_ready, request_sent,
      closing_sheet_sent, reason, memo, history_json, updated_at
    )
    VALUES (
      @closingMonth, @id, @owner, @deadline,
      @contactConfirmed, @amountConfirmed, @confirmedAmount,
      @taxIssued, @taxMatched, @requestReady, @requestSent,
      @closingSheetSent, @reason, @memo, @historyJson, CURRENT_TIMESTAMP
    )
    ON CONFLICT(closing_month, customer_code) DO UPDATE SET
      owner_name = excluded.owner_name,
      deadline = excluded.deadline,
      contact_confirmed = excluded.contact_confirmed,
      amount_confirmed = excluded.amount_confirmed,
      confirmed_amount = excluded.confirmed_amount,
      tax_issued = excluded.tax_issued,
      tax_matched = excluded.tax_matched,
      request_ready = excluded.request_ready,
      request_sent = excluded.request_sent,
      closing_sheet_sent = excluded.closing_sheet_sent,
      reason = excluded.reason,
      memo = excluded.memo,
      history_json = excluded.history_json,
      updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = database.transaction(() => {
    rows.forEach((row) => {
      upsert.run({
        closingMonth,
        id: row.id,
        owner: row.owner ?? "",
        deadline: row.deadline ?? "30일",
        contactConfirmed: toBooleanNumber(row.contactConfirmed),
        amountConfirmed: toBooleanNumber(row.amountConfirmed),
        confirmedAmount: Number(row.confirmedAmount) || 0,
        taxIssued: toBooleanNumber(row.taxIssued),
        taxMatched: toBooleanNumber(row.taxMatched),
        requestReady: toBooleanNumber(row.requestReady),
        requestSent: toBooleanNumber(row.requestSent),
        closingSheetSent: toBooleanNumber(row.closingSheetSent),
        reason: row.reason ?? "회신 대기",
        memo: row.memo ?? "",
        historyJson: JSON.stringify(row.history ?? []),
      });
    });
  });

  transaction();
  return getClosingCompanies(database, options);
}

const defaultMessageTemplates = [
  {
    templateId: 1,
    templateName: "거래처 검수 협조 요청",
    channel: "EMAIL",
    subjectTemplate:
      "[확인 요청] {{closing_month}} 매출 자료 검수 협조 요청드립니다",
    bodyTemplate:
      "안녕하세요. {{customer_name}} 담당자님.\n\n첨부드린 {{closing_month}} 매출 자료 중 확인이 필요한 항목이 있어 공유드립니다. 바쁘시겠지만 첨부 파일을 확인하신 뒤 수정이 필요한 내용이나 추가로 맞춰야 할 기준이 있다면 회신 부탁드립니다.\n\n확인 부탁드립니다.\n감사합니다.",
    tone: "COOPERATIVE",
    status: "ACTIVE",
  },
  {
    templateId: 2,
    templateName: "첨부 파일 재확인 요청",
    channel: "EMAIL",
    subjectTemplate:
      "[재확인 요청] {{customer_name}} 첨부 자료 확인 부탁드립니다",
    bodyTemplate:
      "안녕하세요. {{customer_name}} 담당자님.\n\n공유드린 자료 중 일부 항목의 기준값이 맞지 않아 재확인을 요청드립니다. 첨부 파일의 표시된 행을 확인하신 뒤, 실제 적용해야 할 거래처 코드와 품목 기준을 알려주시면 마감 자료에 반영하겠습니다.\n\n감사합니다.",
    tone: "POLITE",
    status: "ACTIVE",
  },
  {
    templateId: 3,
    templateName: "마감 확인 완료 안내",
    channel: "EMAIL",
    subjectTemplate: "[확인 완료] {{closing_month}} 매출 자료 검수 완료 안내",
    bodyTemplate:
      "안녕하세요. {{customer_name}} 담당자님.\n\n{{closing_month}} 매출 자료 검수가 완료되어 안내드립니다. 추가 확인이 필요한 항목은 현재 없으며, 이후 마감 기준 변경이나 정정 요청이 발생하면 별도로 공유드리겠습니다.\n\n협조해주셔서 감사합니다.",
    tone: "THANKS",
    status: "ACTIVE",
  },
];

function ensureMessageTemplates(database) {
  const upsertTemplate = database.prepare(`
    INSERT INTO message_templates (
      template_id,
      template_name,
      channel,
      subject_template,
      body_template,
      tone,
      status,
      updated_at
    )
    VALUES (
      @templateId,
      @templateName,
      @channel,
      @subjectTemplate,
      @bodyTemplate,
      @tone,
      @status,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(template_id) DO UPDATE SET
      template_name = excluded.template_name,
      channel = excluded.channel,
      subject_template = excluded.subject_template,
      body_template = excluded.body_template,
      tone = excluded.tone,
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = database.transaction(() => {
    defaultMessageTemplates.forEach((template) => upsertTemplate.run(template));
  });

  transaction();
}

function getMessageTemplates(database) {
  ensureMessageTemplates(database);
  return database
    .prepare(
      `
    SELECT
      template_id AS templateId,
      template_name AS templateName,
      channel,
      subject_template AS subjectTemplate,
      body_template AS bodyTemplate,
      tone,
      status,
      updated_at AS updatedAt
    FROM message_templates
    ORDER BY template_id
  `,
    )
    .all();
}

function getSendPackages(database, options = {}) {
  const createdBy = String(options.createdBy ?? "");
  const isAdmin = Boolean(options.isAdmin);
  const rows = database
    .prepare(
      `
    SELECT
      package_id AS packageId,
      package_name AS packageName,
      closing_month AS closingMonth,
      output_folder_path AS outputFolderPath,
      email_id AS itemId,
      customer_code AS customerCode,
      customer_name AS customerName,
      recipient_email AS recipientEmail,
      recipient_phone AS recipientPhone,
      channel,
      subject,
      body,
      attachment_pdf_path AS attachmentPdfPath,
      attachment_xlsx_path AS attachmentXlsxPath,
      status,
      memo,
      created_by AS createdBy,
      created_at AS createdAt
    FROM email_history
    WHERE (@isAdmin = 1 OR created_by = @createdBy)
    ORDER BY package_id DESC, email_id ASC
  `,
    )
    .all({ createdBy, isAdmin: isAdmin ? 1 : 0 });

  const grouped = new Map();
  rows.forEach((row) => {
    if (!grouped.has(row.packageId)) {
      grouped.set(row.packageId, {
        packageId: row.packageId,
        packageName: row.packageName,
        closingMonth: row.closingMonth,
        outputFolderPath: row.outputFolderPath,
        status: row.status,
        createdAt: row.createdAt,
        items: [],
      });
    }
    grouped.get(row.packageId).items.push(row);
  });

  return [...grouped.values()].map((sendPackage) => {
    const items = sendPackage.items;
    const readyCount = items.filter((item) => item.status === "READY").length;
    const missingEmailCount = items.filter(
      (item) => item.channel === "EMAIL" && !item.recipientEmail,
    ).length;
    const missingAttachmentCount = items.filter(
      (item) => !item.attachmentPdfPath || !item.attachmentXlsxPath,
    ).length;

    return {
      ...sendPackage,
      items: items.map((item) => ({
        ...item,
        attachmentStatus:
          item.attachmentPdfPath && item.attachmentXlsxPath
            ? "READY"
            : "MISSING",
      })),
      itemCount: items.length,
      readyCount,
      missingEmailCount,
      missingAttachmentCount,
    };
  });
}

function prepareSendPackageAttachments(database, packageId, options = {}) {
  const sendPackage = database
    .prepare(
      `
    SELECT
      package_id AS packageId,
      package_name AS packageName,
      closing_month AS closingMonth,
      output_folder_path AS outputFolderPath
    FROM email_history
    WHERE package_id = @packageId
      AND (@isAdmin = 1 OR created_by = @createdBy)
    LIMIT 1
  `,
    )
    .get({
      packageId,
      createdBy: String(options.createdBy ?? ""),
      isAdmin: options.isAdmin ? 1 : 0,
    });

  if (!sendPackage) {
    throw new Error("발송 패키지를 찾을 수 없습니다.");
  }

  const items = database
    .prepare(
      `
    SELECT email_id AS itemId, customer_code AS customerCode
    FROM email_history
    WHERE package_id = @packageId
      AND (@isAdmin = 1 OR created_by = @createdBy)
    ORDER BY email_id
  `,
    )
    .all({
      packageId,
      createdBy: String(options.createdBy ?? ""),
      isAdmin: options.isAdmin ? 1 : 0,
    });

  const updateItem = database.prepare(`
    UPDATE email_history
    SET
      attachment_pdf_path = @attachmentPdfPath,
      attachment_xlsx_path = @attachmentXlsxPath,
      status = CASE
        WHEN status IN ('READY', 'CREATED') THEN 'READY'
        ELSE status
      END
    WHERE email_id = @itemId
      AND (@isAdmin = 1 OR created_by = @createdBy)
  `);
  const insertEvent = database.prepare(`
    INSERT INTO activity_logs (level, message, meta_json)
    VALUES ('INFO', @message, @metaJson)
  `);

  const transaction = database.transaction(() => {
    items.forEach((item) => {
      const key = item.customerCode || `ITEM-${item.itemId}`;
      updateItem.run({
        itemId: item.itemId,
        attachmentPdfPath: `${sendPackage.outputFolderPath}/${key}.pdf`,
        attachmentXlsxPath: `${sendPackage.outputFolderPath}/${key}.xlsx`,
      });
    });

    insertEvent.run({
      message: "발송 패키지 첨부 파일 경로를 준비했습니다.",
      metaJson: toJson({ packageId, itemCount: items.length }),
    });
  });

  transaction();
  return getSendPackages(database, options);
}

function updateSendPackageItemStatus(database, payload) {
  const allowedStatuses = new Set([
    "READY",
    "SENT",
    "REPLIED",
    "CLOSED",
    "FAILED",
  ]);
  const status = String(payload?.status ?? "").toUpperCase();

  if (!allowedStatuses.has(status)) {
    throw new Error("지원하지 않는 발송 상태입니다.");
  }

  const itemId = Number(payload?.itemId);
  if (!Number.isFinite(itemId)) {
    throw new Error("발송 항목 ID가 올바르지 않습니다.");
  }

  const updateItem = database.prepare(`
    UPDATE email_history
    SET
      status = @status,
      sent_checked_at = CASE
        WHEN @status IN ('SENT', 'REPLIED', 'CLOSED') THEN CURRENT_TIMESTAMP
        ELSE sent_checked_at
      END,
      memo = @memo
    WHERE email_id = @itemId
  `);
  const insertEvent = database.prepare(`
    INSERT INTO activity_logs (level, message, meta_json)
    VALUES ('INFO', @message, @metaJson)
  `);

  const transaction = database.transaction(() => {
    const result = updateItem.run({
      itemId,
      status,
      memo: payload?.memo ?? null,
      createdBy: String(payload?.createdBy ?? ""),
      isAdmin: payload?.isAdmin ? 1 : 0,
    });

    if (result.changes === 0) {
      throw new Error("발송 항목을 찾을 수 없습니다.");
    }

    insertEvent.run({
      message: "발송 항목 상태를 변경했습니다.",
      metaJson: toJson({ itemId, status }),
    });
  });

  transaction();
  return getSendPackages(database, {
    createdBy: payload?.createdBy,
    isAdmin: payload?.isAdmin,
  });
}

function recordClosingSendHistory(database, payload = {}) {
  const records = Array.isArray(payload.records) ? payload.records : [];
  if (records.length === 0) {
    throw new Error("저장할 발송 기록이 없습니다.");
  }

  const packageId = Number(payload.packageId) || Date.now();
  const packageName = String(payload.packageName || "마감 발송 큐");
  const closingMonth = String(payload.closingMonth || "");
  const outputFolderPath = String(payload.outputFolderPath || "");
  const createdBy = String(payload.createdBy || "");
  const insertHistory = database.prepare(`
    INSERT INTO email_history (
      package_id, package_name, closing_month, output_folder_path,
      customer_code, customer_name, recipient_email, recipient_phone,
      channel, subject, body, attachment_pdf_path, attachment_xlsx_path,
      status, sent_checked_at, memo, created_by, created_at
    )
    VALUES (
      @packageId, @packageName, @closingMonth, @outputFolderPath,
      @customerCode, @customerName, @recipientEmail, @recipientPhone,
      @channel, @subject, @body, @attachmentPdfPath, @attachmentXlsxPath,
      @status, CURRENT_TIMESTAMP, @memo, @createdBy, CURRENT_TIMESTAMP
    )
  `);
  const insertEvent = database.prepare(`
    INSERT INTO activity_logs (level, message, meta_json)
    VALUES ('INFO', @message, @metaJson)
  `);

  const transaction = database.transaction(() => {
    const savedRecords = records.map((record) => {
      const result = insertHistory.run({
        packageId,
        packageName,
        closingMonth,
        outputFolderPath,
        customerCode: record.customerCode || null,
        customerName: record.customerName || "",
        recipientEmail: record.recipientEmail || "",
        recipientPhone: record.recipientPhone || "",
        channel: record.channel || "EMAIL",
        subject: record.subject || "",
        body: record.body || "",
        attachmentPdfPath: record.attachmentPdfPath || null,
        attachmentXlsxPath: record.attachmentXlsxPath || null,
        status: record.status || "SENT",
        memo: record.memo || null,
        createdBy,
      });

      return {
        emailId: Number(result.lastInsertRowid),
        ...record,
        status: record.status || "SENT",
      };
    });

    insertEvent.run({
      message: "마감 발송 큐의 업체별 발송 기록을 저장했습니다.",
      metaJson: toJson({ packageId, recordCount: savedRecords.length, closingMonth }),
    });

    return savedRecords;
  });

  return {
    packageId,
    records: transaction(),
  };
}

function getMasterData(database) {
  return {
    customers: database
      .prepare(
        `
      SELECT customer_code AS customerCode, customer_name AS customerName, business_number AS businessNumber, tax_status AS taxStatus, status, memo
      FROM customers
      ORDER BY customer_name
    `,
      )
      .all(),
    customerAliases: [],
    products: database
      .prepare(
        `
      SELECT product_code AS productCode, product_name AS productName, unit, status, memo
      FROM products
      ORDER BY product_name
    `,
      )
      .all(),
    productAliases: [],
    prices: database
      .prepare(
        `
      SELECT product_code AS productCode, product_name AS productName,
             unit_price AS price, currency, status
      FROM products
      ORDER BY product_name
      LIMIT 50
    `,
      )
      .all(),
    suggestions: [],
    contacts: database
      .prepare(
        `
      SELECT contacts.contact_id AS contactId, contacts.customer_code AS customerCode, customers.customer_name AS customerName, contacts.department_name AS departmentName, contacts.recipient_name AS recipientName, contacts.recipient_email AS recipientEmail, contacts.preferred_channel AS preferredChannel, contacts.status
      FROM contacts
      LEFT JOIN customers ON customers.customer_code = contacts.customer_code
      ORDER BY contacts.contact_id DESC
      LIMIT 50
    `,
      )
      .all(),
  };
}

function getFilteredContacts(database, options = {}) {
  const pageSize = Math.min(Math.max(Number(options.pageSize) || 8, 1), 100);
  const page = Math.max(Number(options.page) || 1, 1);
  const offset = (page - 1) * pageSize;
  const params = {
    customer: `%${String(options.customer ?? "")
      .trim()
      .toLowerCase()}%`,
    contact: `%${String(options.contact ?? "")
      .trim()
      .toLowerCase()}%`,
    email: `%${String(options.email ?? "")
      .trim()
      .toLowerCase()}%`,
    phone: `%${String(options.phone ?? "")
      .trim()
      .toLowerCase()}%`,
    channel: String(options.channel ?? "ALL"),
    status: String(options.status ?? "ALL"),
    limit: pageSize,
    offset,
  };
  const where = [
    `(
      @customer = '%%'
      OR lower(COALESCE(customers.customer_name, '')) LIKE @customer
      OR lower(COALESCE(contacts.customer_code, '')) LIKE @customer
    )`,
    "(@contact = '%%' OR lower(COALESCE(contacts.recipient_name, '')) LIKE @contact)",
    "(@email = '%%' OR lower(COALESCE(contacts.recipient_email, '')) LIKE @email)",
    "(@phone = '%%' OR lower(COALESCE(contacts.recipient_phone, '')) LIKE @phone)",
    "(@channel = 'ALL' OR contacts.preferred_channel = @channel)",
    "(@status = 'ALL' OR contacts.status = @status)",
  ].join(" AND ");

  const total =
    database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM contacts
         LEFT JOIN customers ON customers.customer_code = contacts.customer_code
         WHERE ${where}`,
      )
      .get(params)?.count ?? 0;

  const rows = database
    .prepare(
      `SELECT
         contacts.contact_id AS contactId,
         contacts.customer_code AS customerCode,
         customers.customer_name AS customerName,
         customers.business_number AS businessNumber,
         contacts.department_name AS departmentName,
         contacts.recipient_name AS recipientName,
         contacts.recipient_email AS recipientEmail,
         contacts.recipient_phone AS recipientPhone,
         contacts.preferred_channel AS preferredChannel,
         contacts.status,
         contacts.memo
       FROM contacts
       LEFT JOIN customers ON customers.customer_code = contacts.customer_code
       WHERE ${where}
       ORDER BY contacts.contact_id DESC
       LIMIT @limit OFFSET @offset`,
    )
    .all(params);

  return {
    ok: true,
    data: {
      rows,
      total,
      page,
      pageSize,
    },
  };
}

function importContacts(database, contacts) {
  const insertCustomer = database.prepare(`
    INSERT OR IGNORE INTO customers (customer_code, customer_name, tax_status, memo)
    VALUES (@customerCode, @customerName, 'UNKNOWN', '연락처 CSV 가져오기에서 생성')
  `);
  const findContact = database.prepare(`
    SELECT contact_id AS contactId
    FROM contacts
    WHERE COALESCE(customer_code, '') = COALESCE(@customerCode, '')
      AND COALESCE(recipient_email, '') = COALESCE(@recipientEmail, '')
      AND COALESCE(recipient_name, '') = COALESCE(@recipientName, '')
    LIMIT 1
  `);
  const insertContact = database.prepare(`
    INSERT INTO contacts (
      customer_code,
      department_name,
      recipient_name,
      recipient_email,
      recipient_phone,
      preferred_channel,
      status,
      memo
    )
    VALUES (
      @customerCode,
      @departmentName,
      @recipientName,
      @recipientEmail,
      @recipientPhone,
      @preferredChannel,
      @status,
      @memo
    )
  `);
  const updateContact = database.prepare(`
    UPDATE contacts
    SET
      department_name = @departmentName,
      recipient_email = @recipientEmail,
      recipient_phone = @recipientPhone,
      preferred_channel = @preferredChannel,
      status = @status,
      memo = @memo,
      updated_at = CURRENT_TIMESTAMP
    WHERE contact_id = @contactId
  `);
  const insertEvent = database.prepare(`
    INSERT INTO activity_logs (level, message, meta_json)
    VALUES ('INFO', @message, @metaJson)
  `);

  const transaction = database.transaction(() => {
    let inserted = 0;
    let updated = 0;

    contacts.forEach((contact) => {
      const normalized = {
        customerCode: contact.customerCode || null,
        customerName: contact.customerName || null,
        departmentName: contact.departmentName || null,
        recipientName: contact.recipientName || null,
        recipientEmail: contact.recipientEmail || null,
        recipientPhone: contact.recipientPhone || null,
        preferredChannel: contact.preferredChannel || "EMAIL",
        status: contact.status || "ACTIVE",
        memo: contact.memo || null,
      };

      if (normalized.customerCode && normalized.customerName) {
        insertCustomer.run(normalized);
      }

      const existing = findContact.get(normalized);
      if (existing?.contactId) {
        updateContact.run({
          ...normalized,
          contactId: existing.contactId,
        });
        updated += 1;
        return;
      }

      insertContact.run(normalized);
      inserted += 1;
    });

    insertEvent.run({
      message: "연락처 CSV 데이터를 가져왔습니다.",
      metaJson: toJson({ inserted, updated, total: contacts.length }),
    });

    return { inserted, updated };
  });

  return transaction();
}

function ensureContactsForCustomers(database) {
  const generatedMemo = "거래처 기준 자동 생성 연락처";
  const departments = [
    "정산팀",
    "회계팀",
    "재무팀",
    "경영지원팀",
    "구매관리팀",
    "영업지원팀",
    "운영관리팀",
    "총무팀",
  ];
  const recipientNames = [
    "김서연",
    "이도윤",
    "박지우",
    "최민준",
    "정하은",
    "강현우",
    "조수빈",
    "윤지호",
    "장예린",
    "임준서",
    "한채원",
    "오시우",
    "서유진",
    "신도현",
    "권나연",
    "황민재",
    "안서윤",
    "송재현",
    "류가은",
    "홍우진",
    "문하린",
    "배건우",
    "백소연",
    "허지훈",
    "남예진",
    "심준영",
    "노다은",
    "하승민",
    "곽유나",
    "성태윤",
  ];
  const initials = [
    "g",
    "kk",
    "n",
    "d",
    "tt",
    "r",
    "m",
    "b",
    "pp",
    "s",
    "ss",
    "",
    "j",
    "jj",
    "ch",
    "k",
    "t",
    "p",
    "h",
  ];
  const vowels = [
    "a",
    "ae",
    "ya",
    "yae",
    "eo",
    "e",
    "yeo",
    "ye",
    "o",
    "wa",
    "wae",
    "oe",
    "yo",
    "u",
    "wo",
    "we",
    "wi",
    "yu",
    "eu",
    "ui",
    "i",
  ];
  const finals = [
    "",
    "k",
    "k",
    "ks",
    "n",
    "nj",
    "nh",
    "t",
    "l",
    "lk",
    "lm",
    "lb",
    "ls",
    "lt",
    "lp",
    "lh",
    "m",
    "p",
    "ps",
    "t",
    "t",
    "ng",
    "t",
    "t",
    "k",
    "t",
    "p",
    "h",
  ];
  const englishCompanyTerms = {
    솔루션: "solution",
    시스템: "system",
    유통: "distribution",
    오피스: "office",
    상사: "trading",
    리테일: "retail",
    테크: "tech",
    물류: "logistics",
    문구: "stationery",
    컴퍼니: "company",
    비즈: "biz",
    산업: "industry",
    전자: "electronics",
    네트웍스: "networks",
  };
  const romanize = (value) => {
    let normalized = String(value ?? "");
    Object.entries(englishCompanyTerms).forEach(([korean, english]) => {
      normalized = normalized.replaceAll(korean, ` ${english} `);
    });

    return normalized
      .split("")
      .map((character) => {
        const code = character.charCodeAt(0) - 0xac00;
        if (code < 0 || code > 11171) return character;
        const initialIndex = Math.floor(code / 588);
        const vowelIndex = Math.floor((code % 588) / 28);
        const finalIndex = code % 28;
        return `${initials[initialIndex]}${vowels[vowelIndex]}${finals[finalIndex]}`;
      })
      .join("")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .replace(/^_+|_+$/g, "");
  };
  const makeContact = (customer, index) => {
    const recipientName = recipientNames[index % recipientNames.length];
    const seed = Number(customer.customerId) || index + 1;
    const middle = String(2100 + ((seed * 137) % 7600)).padStart(4, "0");
    const last = String(1000 + ((seed * 389) % 9000)).padStart(4, "0");

    return {
      customerCode: customer.customerCode,
      departmentName: departments[index % departments.length],
      recipientName,
      recipientEmail: `${romanize(customer.customerName)}_${romanize(recipientName)}@example.com`,
      recipientPhone: `010-${middle}-${last}`,
      preferredChannel: index % 7 === 0 ? "KAKAO" : "EMAIL",
      status: "ACTIVE",
      memo: generatedMemo,
    };
  };
  const customers = database
    .prepare(
      `SELECT rowid AS customerId, customer_code AS customerCode, customer_name AS customerName
       FROM customers
       ORDER BY customer_code`,
    )
    .all();
  const findContact = database.prepare(
    `SELECT contact_id AS contactId, memo
     FROM contacts
     WHERE customer_code = ?
     ORDER BY contact_id
     LIMIT 1`,
  );
  const insertContact = database.prepare(
    `INSERT INTO contacts (
       customer_code, department_name, recipient_name, recipient_email,
       recipient_phone, preferred_channel, status, memo
     )
     VALUES (
       @customerCode, @departmentName, @recipientName, @recipientEmail,
       @recipientPhone, @preferredChannel, @status, @memo
     )`,
  );
  const updateGeneratedContact = database.prepare(
    `UPDATE contacts
     SET department_name = @departmentName,
         recipient_name = @recipientName,
         recipient_email = @recipientEmail,
         recipient_phone = @recipientPhone,
         preferred_channel = @preferredChannel,
         status = @status,
         updated_at = CURRENT_TIMESTAMP
     WHERE contact_id = @contactId`,
  );
  const result = database.transaction(() => {
    let inserted = 0;
    let updated = 0;

    customers.forEach((customer, index) => {
      const contact = findContact.get(customer.customerCode);
      const generated = makeContact(customer, index);

      if (!contact) {
        insertContact.run(generated);
        inserted += 1;
        return;
      }

      if (contact.memo === generatedMemo) {
        updateGeneratedContact.run({
          ...generated,
          contactId: contact.contactId,
        });
        updated += 1;
      }
    });

    return { inserted, updated };
  })();

  return result;
}

function ensureCoreBusinessData(database) {
  const countTable = (tableName) =>
    database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
  const contactSync = ensureContactsForCustomers(database);
  const migratedClosingStatuses = migrateLegacyClosingStatus(database);
  return {
    users: countTable("users"),
    customers: countTable("customers"),
    products: countTable("products"),
    contacts: countTable("contacts"),
    insertedContacts: contactSync.inserted,
    updatedContacts: contactSync.updated,
    closingStatuses: countTable("closing_status"),
    migratedClosingStatuses,
    salesUploads: countTable("sales_uploads"),
    salesRows: countTable("sales"),
  };
}

function initializeDatabase(app) {
  const database = getDatabase(app);
  const coreCounts = ensureCoreBusinessData(database);
  return {
    ok: true,
    path: database.name,
    coreCounts,
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const value = String(storedHash ?? "");
  if (!value.startsWith("scrypt:")) {
    return value === String(password);
  }

  const [, salt, expectedHex] = value.split(":");
  if (!salt || !expectedHex) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function listLocalUsers(database) {
  return database.prepare(`
    SELECT
      username AS id,
      display_name AS name,
      role,
      department_name AS department,
      title,
      email,
      phone,
      status
    FROM users
    ORDER BY user_id
  `).all();
}

function registerLocalUser(database, payload = {}) {
  const username = String(payload.username ?? "").trim();
  const displayName = String(payload.displayName ?? username).trim();
  const password = String(payload.password ?? "");
  const departmentName = String(payload.departmentName ?? "").trim();

  if (username.length < 2) throw new Error("아이디를 2자 이상 입력해 주세요.");
  if (displayName.length < 2) throw new Error("이름을 2자 이상 입력해 주세요.");
  if (password.length < 6) throw new Error("비밀번호를 6자 이상 입력해 주세요.");
  if (database.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
    throw new Error("이미 사용 중인 아이디입니다.");
  }

  const userCount = database.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  const role = userCount === 0 ? "ADMIN" : "VIEWER";

  database.prepare(`
    INSERT INTO users (
      username, display_name, password_hash, role, department_name, status
    )
    VALUES (@username, @displayName, @passwordHash, @role, @departmentName, 'ACTIVE')
  `).run({
    username,
    displayName,
    passwordHash: hashPassword(password),
    role,
    departmentName: departmentName || "미지정",
  });

  return listLocalUsers(database).find((user) => user.id === username);
}

function authenticateLocalUser(database, payload = {}) {
  const username = String(payload.username ?? "").trim();
  const user = database.prepare(`
    SELECT
      username AS id,
      display_name AS name,
      password_hash AS passwordHash,
      role,
      department_name AS department,
      status
    FROM users
    WHERE username = ?
  `).get(username);

  if (!user || user.status === "INACTIVE" || !verifyPassword(payload.password, user.passwordHash)) {
    return { ok: false, message: "사용자 또는 비밀번호를 확인해 주세요." };
  }

  database.prepare(`
    UPDATE users
    SET last_login_at = CURRENT_TIMESTAMP
    WHERE username = ?
  `).run(username);

  delete user.passwordHash;
  return { ok: true, user };
}

function updateLocalUser(database, payload = {}) {
  const username = String(payload.username ?? "").trim();
  const current = database.prepare(`
    SELECT username, role, status
    FROM users
    WHERE username = ?
  `).get(username);
  if (!current) throw new Error("사용자를 찾을 수 없습니다.");

  const nextRole = ["ADMIN", "MANAGER", "VIEWER"].includes(payload.role)
    ? payload.role
    : current.role;
  const nextStatus = ["ACTIVE", "INACTIVE"].includes(payload.status)
    ? payload.status
    : current.status;

  if (current.role === "ADMIN" && (nextRole !== "ADMIN" || nextStatus === "INACTIVE")) {
    const adminCount = database.prepare(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE role = 'ADMIN' AND status = 'ACTIVE'
    `).get().count;
    if (adminCount <= 1) {
      throw new Error("마지막 활성 관리자 계정의 권한이나 상태는 변경할 수 없습니다.");
    }
  }

  database.prepare(`
    UPDATE users
    SET
      display_name = @displayName,
      role = @role,
      department_name = @departmentName,
      title = @title,
      email = @email,
      phone = @phone,
      status = @status,
      updated_at = CURRENT_TIMESTAMP
    WHERE username = @username
  `).run({
    username,
    displayName: String(payload.displayName ?? username).trim() || username,
    role: nextRole,
    departmentName: String(payload.departmentName ?? "").trim() || "미지정",
    title: String(payload.title ?? "").trim(),
    email: String(payload.email ?? "").trim(),
    phone: String(payload.phone ?? "").trim(),
    status: nextStatus,
  });

  return listLocalUsers(database).find((user) => user.id === username);
}

function deleteLocalUser(database, username) {
  const normalizedUsername = String(username ?? "").trim();
  const user = database.prepare(`
    SELECT username, role, status
    FROM users
    WHERE username = ?
  `).get(normalizedUsername);
  if (!user) throw new Error("사용자를 찾을 수 없습니다.");

  if (user.role === "ADMIN" && user.status === "ACTIVE") {
    const adminCount = database.prepare(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE role = 'ADMIN' AND status = 'ACTIVE'
    `).get().count;
    if (adminCount <= 1) {
      throw new Error("마지막 활성 관리자 계정은 탈퇴할 수 없습니다.");
    }
  }

  database.prepare("DELETE FROM users WHERE username = ?").run(normalizedUsername);
  return { username: normalizedUsername };
}

function changeLocalUserPassword(database, payload = {}) {
  const username = String(payload.username ?? "").trim();
  const user = database.prepare(`
    SELECT password_hash AS passwordHash
    FROM users
    WHERE username = ?
  `).get(username);
  if (!user || !verifyPassword(payload.currentPassword, user.passwordHash)) {
    throw new Error("현재 비밀번호가 맞지 않습니다.");
  }

  const nextPassword = String(payload.nextPassword ?? "");
  if (nextPassword.length < 6) {
    throw new Error("새 비밀번호는 6자 이상 입력해 주세요.");
  }

  database.prepare(`
    UPDATE users
    SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE username = ?
  `).run(hashPassword(nextPassword), username);
  return { username };
}

function getUserTodoState(database, username) {
  const normalizedUsername = String(username ?? "").trim();
  const row = database.prepare(`
    SELECT todos_json AS todosJson, history_json AS historyJson, updated_at AS updatedAt
    FROM user_todo_state
    WHERE username = ?
  `).get(normalizedUsername);

  return {
    username: normalizedUsername,
    todos: fromJson(row?.todosJson, []),
    history: fromJson(row?.historyJson, []),
    updatedAt: row?.updatedAt ?? null,
  };
}

function saveUserTodoState(database, payload = {}) {
  const username = String(payload.username ?? "").trim();
  if (!database.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
    throw new Error("투두를 저장할 사용자를 찾을 수 없습니다.");
  }

  const current = getUserTodoState(database, username);
  const todos = Array.isArray(payload.todos) ? payload.todos : current.todos;
  const history = Array.isArray(payload.history) ? payload.history : current.history;

  database.prepare(`
    INSERT INTO user_todo_state (username, todos_json, history_json, updated_at)
    VALUES (@username, @todosJson, @historyJson, CURRENT_TIMESTAMP)
    ON CONFLICT(username) DO UPDATE SET
      todos_json = excluded.todos_json,
      history_json = excluded.history_json,
      updated_at = CURRENT_TIMESTAMP
  `).run({
    username,
    todosJson: toJson(todos),
    historyJson: toJson(history),
  });

  return getUserTodoState(database, username);
}

function importBootstrapData(database, payload = {}) {
  const customers = Array.isArray(payload.customers) ? payload.customers : [];
  const products = Array.isArray(payload.products) ? payload.products : [];
  const contacts = Array.isArray(payload.contacts) ? payload.contacts : [];

  const upsertCustomer = database.prepare(`
    INSERT INTO customers (
      customer_code, customer_name, business_number, tax_status, status, memo, updated_at
    )
    VALUES (
      @customerCode, @customerName, @businessNumber, @taxStatus, @status, @memo,
      COALESCE(@updatedAt, CURRENT_TIMESTAMP)
    )
    ON CONFLICT(customer_code) DO UPDATE SET
      customer_name = excluded.customer_name,
      business_number = excluded.business_number,
      tax_status = excluded.tax_status,
      status = excluded.status,
      memo = excluded.memo,
      updated_at = excluded.updated_at
  `);
  const upsertProduct = database.prepare(`
    INSERT INTO products (
      product_code, product_name, unit, unit_price, currency, status, memo, updated_at
    )
    VALUES (
      @productCode, @productName, @unit, @unitPrice, @currency, @status, @memo,
      COALESCE(@updatedAt, CURRENT_TIMESTAMP)
    )
    ON CONFLICT(product_code) DO UPDATE SET
      product_name = excluded.product_name,
      unit = excluded.unit,
      unit_price = excluded.unit_price,
      currency = excluded.currency,
      status = excluded.status,
      memo = excluded.memo,
      updated_at = excluded.updated_at
  `);
  const insertContact = database.prepare(`
    INSERT INTO contacts (
      customer_code, department_name, recipient_name, recipient_email,
      recipient_phone, preferred_channel, status, memo
    )
    VALUES (
      @customerCode, @departmentName, @recipientName, @recipientEmail,
      @recipientPhone, @preferredChannel, @status, @memo
    )
  `);

  database.transaction(() => {
    customers.forEach((row) => upsertCustomer.run({
      customerCode: row.customerCode,
      customerName: row.customerName,
      businessNumber: row.businessNumber ?? null,
      taxStatus: row.taxStatus ?? "UNKNOWN",
      status: row.status ?? "ACTIVE",
      memo: row.memo ?? null,
      updatedAt: row.updatedAt ?? null,
    }));
    products.forEach((row) => upsertProduct.run({
      productCode: row.productCode,
      productName: row.productName,
      unit: row.unit ?? "EA",
      unitPrice: Number(row.unitPrice) || 0,
      currency: row.currency ?? "KRW",
      status: row.status ?? "ACTIVE",
      memo: row.memo ?? null,
      updatedAt: row.updatedAt ?? null,
    }));
    contacts.forEach((row) => insertContact.run({
      customerCode: row.customerCode ?? null,
      departmentName: row.departmentName ?? null,
      recipientName: row.recipientName ?? null,
      recipientEmail: row.recipientEmail ?? null,
      recipientPhone: row.recipientPhone ?? null,
      preferredChannel: row.preferredChannel ?? "EMAIL",
      status: row.status ?? "ACTIVE",
      memo: row.memo ?? "AWS 초기 동기화",
    }));
  })();

  return {
    customers: customers.length,
    products: products.length,
    contacts: contacts.length,
  };
}

function getDatabasePath(app) {
  return getDatabase(app).name;
}

function backupDatabase(app, destinationPath) {
  const database = getDatabase(app);
  return database.backup(destinationPath);
}

function registerDatabaseIpc(ipcMain, app) {
  ipcMain.handle("users:list", () => ({
    ok: true,
    users: listLocalUsers(getDatabase(app)),
  }));

  ipcMain.handle("users:register", (_, payload) => ({
    ok: true,
    user: registerLocalUser(getDatabase(app), payload),
  }));

  ipcMain.handle("users:authenticate", (_, payload) =>
    authenticateLocalUser(getDatabase(app), payload),
  );

  ipcMain.handle("users:update", (_, payload) => ({
    ok: true,
    user: updateLocalUser(getDatabase(app), payload),
  }));

  ipcMain.handle("users:delete", (_, payload) => ({
    ok: true,
    deleted: deleteLocalUser(getDatabase(app), payload?.username),
  }));

  ipcMain.handle("users:change-password", (_, payload) => ({
    ok: true,
    changed: changeLocalUserPassword(getDatabase(app), payload),
  }));

  ipcMain.handle("todos:get-personal", (_, payload) => ({
    ok: true,
    state: getUserTodoState(getDatabase(app), payload?.username),
  }));

  ipcMain.handle("todos:save-personal", (_, payload) => ({
    ok: true,
    state: saveUserTodoState(getDatabase(app), payload),
  }));

  ipcMain.handle("sync:import-bootstrap", (_, payload) => ({
    ok: true,
    imported: importBootstrapData(getDatabase(app), payload),
  }));

  ipcMain.handle("db:health", () => {
    const database = getDatabase(app);
    const result = database
      .prepare("SELECT COUNT(*) AS count FROM activity_logs")
      .get();
    return {
      ok: true,
      path: database.name,
      eventCount: result.count,
    };
  });

  ipcMain.handle("db:summary", () => {
    const database = getDatabase(app);
    const tables = [
      "products",
      "customers",
      "users",
      "sales_uploads",
      "sales",
      "validation_issues",
      "workspace_snapshots",
      "contacts",
      "message_templates",
      "email_history",
      "reports",
      "report_templates",
      "activity_logs",
      "notifications",
    ];

    const counts = tables.map((tableName) => {
      const row = database
        .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
        .get();
      return {
        tableName,
        count: row.count,
      };
    });
    const recentEvents = database
      .prepare(
        `
        SELECT level, message, created_at AS createdAt
        FROM activity_logs
        ORDER BY log_id DESC
        LIMIT 5
      `,
      )
      .all();

    return {
      ok: true,
      path: database.name,
      counts,
      recentEvents,
    };
  });

  ipcMain.handle("events:add", (_, event) => {
    const database = getDatabase(app);
    const info = database
      .prepare(
        `
      INSERT INTO activity_logs (level, message, meta_json)
      VALUES (@level, @message, @metaJson)
    `,
      )
      .run({
        level: event?.level ?? "INFO",
        message: event?.message ?? "",
        metaJson: toJson(event?.meta),
      });

    return { ok: true, id: info.lastInsertRowid };
  });

  ipcMain.handle("events:list", () => {
    const database = getDatabase(app);
    return database
      .prepare(
        `
      SELECT log_id AS id, level, message, meta_json AS metaJson, created_at AS createdAt
      FROM activity_logs
      ORDER BY log_id DESC
      LIMIT 50
    `,
      )
      .all();
  });

  ipcMain.handle("notifications:list", (_, options = {}) => {
    const database = getDatabase(app);
    const limit = Math.min(Math.max(Number(options?.limit ?? 80), 1), 200);
    return database
      .prepare(
        `
      SELECT
        notification_id AS dbId,
        client_id AS clientId,
        title,
        message,
        level,
        target,
        href,
        read_status AS readStatus,
        created_at AS createdAt,
        read_at AS readAt
      FROM notifications
      ORDER BY datetime(created_at) DESC, notification_id DESC
      LIMIT @limit
    `,
      )
      .all({ limit })
      .map((notification) => ({
        id: notification.clientId || String(notification.dbId),
        dbId: notification.dbId,
        title: notification.title,
        message: notification.message ?? "",
        level: notification.level ?? "INFO",
        target: notification.target ?? "",
        href: notification.href ?? "",
        read: notification.readStatus === 1,
        createdAt: notification.createdAt,
        readAt: notification.readAt,
      }));
  });

  ipcMain.handle("notifications:add", (_, payload = {}) => {
    const database = getDatabase(app);
    const clientId =
      payload?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdAt = payload?.createdAt || new Date().toISOString();

    database
      .prepare(
        `
      INSERT INTO notifications (
        client_id,
        title,
        message,
        level,
        target,
        href,
        read_status,
        created_at,
        read_at
      )
      VALUES (
        @clientId,
        @title,
        @message,
        @level,
        @target,
        @href,
        @readStatus,
        @createdAt,
        @readAt
      )
      ON CONFLICT(client_id) DO UPDATE SET
        title = excluded.title,
        message = excluded.message,
        level = excluded.level,
        target = excluded.target,
        href = excluded.href,
        read_status = excluded.read_status,
        created_at = excluded.created_at,
        read_at = excluded.read_at
    `,
      )
      .run({
        clientId,
        title: payload?.title ?? "알림",
        message: payload?.message ?? "",
        level: payload?.level ?? "INFO",
        target: payload?.target ?? "",
        href: payload?.href ?? "",
        readStatus: payload?.read ? 1 : 0,
        createdAt,
        readAt: payload?.readAt ?? null,
      });

    return {
      ok: true,
      notification: {
        id: clientId,
        title: payload?.title ?? "알림",
        message: payload?.message ?? "",
        level: payload?.level ?? "INFO",
        target: payload?.target ?? "",
        href: payload?.href ?? "",
        read: Boolean(payload?.read),
        createdAt,
      },
    };
  });

  ipcMain.handle("notifications:mark-read", (_, notificationId) => {
    const database = getDatabase(app);
    database
      .prepare(
        `
      UPDATE notifications
      SET read_status = 1,
          read_at = CURRENT_TIMESTAMP
      WHERE client_id = @notificationId
         OR notification_id = @numericId
    `,
      )
      .run({
        notificationId: String(notificationId ?? ""),
        numericId: Number(notificationId) || -1,
      });

    return { ok: true };
  });

  ipcMain.handle("notifications:clear", () => {
    const database = getDatabase(app);
    database.prepare("DELETE FROM notifications").run();
    return { ok: true };
  });

  ipcMain.handle("recent-files:get", () => {
    const database = getDatabase(app);
    return database
      .prepare(
        `
      SELECT id, file_name AS fileName, file_path AS filePath,
             row_count AS rowCount, column_count AS columnCount,
             saved_at AS openedAt
      FROM workspace_snapshots
      ORDER BY saved_at DESC, id DESC
      LIMIT 20
    `,
      )
      .all();
  });

  ipcMain.handle("master-data:get", () => {
    const database = getDatabase(app);
    return {
      ok: true,
      ...getMasterData(database),
    };
  });

  ipcMain.handle("contacts:query", (_, options) => {
    const database = getDatabase(app);
    return getFilteredContacts(database, options);
  });

  ipcMain.handle("contacts:import", (_, contacts) => {
    const database = getDatabase(app);
    const summary = importContacts(database, contacts ?? []);
    return {
      ok: true,
      summary,
      ...getMasterData(database),
    };
  });

  ipcMain.handle("message-templates:get", () => {
    const database = getDatabase(app);
    return {
      ok: true,
      templates: getMessageTemplates(database),
    };
  });

  ipcMain.handle("send-packages:get", (_, options) => {
    const database = getDatabase(app);
    return {
      ok: true,
      packages: getSendPackages(database, options),
    };
  });

  ipcMain.handle("send-packages:prepare-attachments", (_, payload) => {
    const database = getDatabase(app);
    const packageId = typeof payload === "object" ? payload.packageId : payload;
    const options = typeof payload === "object" ? payload : {};
    return {
      ok: true,
      packages: prepareSendPackageAttachments(database, packageId, options),
    };
  });

  ipcMain.handle("send-package-items:update-status", (_, payload) => {
    const database = getDatabase(app);
    return {
      ok: true,
      packages: updateSendPackageItemStatus(database, payload),
    };
  });

  ipcMain.handle("closing-send-history:record", (_, payload) => {
    const database = getDatabase(app);
    return {
      ok: true,
      ...recordClosingSendHistory(database, payload),
    };
  });

  ipcMain.handle("department-requests:list", () => {
    const database = getDatabase(app);
    return {
      ok: true,
      requests: getDepartmentRequests(database),
    };
  });

  ipcMain.handle("closing-companies:list", (_, options) => {
    const database = getDatabase(app);
    return {
      ok: true,
      rows: getClosingCompanies(database, options),
    };
  });

  ipcMain.handle("closing-companies:save", (_, payload) => {
    const database = getDatabase(app);
    const rows = Array.isArray(payload) ? payload : payload?.rows;
    const options = Array.isArray(payload) ? {} : payload?.options;
    return {
      ok: true,
      rows: saveClosingCompanies(database, rows ?? [], options ?? {}),
    };
  });

  ipcMain.handle("data:latest", () => {
    const database = getDatabase(app);
    return getLatestSalesData(database);
  });

  ipcMain.handle("data:query", (_, options) => {
    const database = getDatabase(app);
    const result = getFilteredSalesData(database, options);
    return result;
  });

  ipcMain.handle("dashboard:sales-daily", (_, options) => {
    const database = getDatabase(app);
    return getDailySalesTrend(database, options?.limit);
  });

  ipcMain.handle("data:save", (_, data) => {
    const database = getDatabase(app);
    const insertSnapshot = database.prepare(`
      INSERT INTO workspace_snapshots (
        file_name, payload_json, row_count, column_count, saved_at
      )
      VALUES (@fileName, @payloadJson, @rowCount, @columnCount, @savedAt)
    `);
    const insertEvent = database.prepare(`
      INSERT INTO activity_logs (level, message, meta_json)
      VALUES (@level, @message, @metaJson)
    `);
    const insertUpload = database.prepare(`
      INSERT INTO sales_uploads (snapshot_id, file_name, closing_month, uploaded_department_code, uploaded_at, status)
      VALUES (@snapshotId, @fileName, @closingMonth, @departmentCode, @uploadedAt, @status)
    `);
    const insertRow = database.prepare(`
      INSERT INTO sales (
        upload_id,
        row_no,
        transaction_date,
        raw_customer_name,
        raw_product_name,
        customer_code,
        product_code,
        quantity,
        unit_price,
        sales_amount,
        validation_status,
        review_status,
        owner_name
      )
      VALUES (
        @uploadId,
        @rowNo,
        @transactionDate,
        @rawCustomerName,
        @rawProductName,
        @customerCode,
        @productCode,
        @quantity,
        @unitPrice,
        @salesAmount,
        @validationStatus,
        @reviewStatus,
        @ownerName
      )
    `);
    const insertIssue = database.prepare(`
      INSERT INTO validation_issues (
        upload_id,
        row_id,
        error_type,
        severity,
        message,
        assigned_department_code,
        status
      )
      VALUES (
        @uploadId,
        @rowId,
        @errorType,
        @severity,
        @message,
        @assignedDepartmentCode,
        @status
      )
    `);
    const updateValidationSummary = database.prepare(`
      UPDATE workspace_snapshots
      SET issue_count = @issueCount,
          duplicate_count = @duplicateCount,
          review_count = @reviewCount
      WHERE id = @snapshotId
    `);

    const transaction = database.transaction(() => {
      const savedAt = data?.savedAt ?? new Date().toISOString();
      const snapshot = insertSnapshot.run({
        fileName: data?.fileName ?? "untitled.xlsx",
        payloadJson: toJson(data),
        rowCount: data?.rows?.length ?? 0,
        columnCount: data?.columns?.length ?? 0,
        savedAt,
      });

      const upload = insertUpload.run({
        snapshotId: snapshot.lastInsertRowid,
        fileName: data?.fileName ?? "untitled.xlsx",
        closingMonth: data?.closingMonth ?? getClosingMonth(),
        departmentCode: data?.departmentCode ?? "GENERAL_AFFAIRS",
        uploadedAt: savedAt,
        status: "SAVED",
      });

      const columns = data?.columns ?? [];
      const indexes = {
        date: getColumnIndex(columns, ["거래일", "일자", "날짜"]),
        customerName: getColumnIndex(columns, ["거래처", "거래처명", "고객명"]),
        productName: getColumnIndex(columns, "품목명"),
        customerCode: getColumnIndex(columns, ["거래처 코드", "거래처코드", "고객코드"]),
        productCode: getColumnIndex(columns, ["품목 코드", "품목코드", "상품코드", "제품코드"]),
        quantity: getColumnIndex(columns, "수량"),
        unitPrice: getColumnIndex(columns, "단가"),
        amount: getColumnIndex(columns, "금액"),
        status: getColumnIndex(columns, ["검증", "상태", "결과"]),
        owner: getColumnIndex(columns, ["담당자", "담당자명"]),
      };
      let issueCount = 0;
      let duplicateCount = 0;
      let reviewCount = 0;

      (data?.rows ?? []).forEach((row, rowIndex) => {
        const status = getCell(row, indexes.status) ?? "PENDING";
        const reviewStatus = data?.rowActions?.[rowIndex] ?? "WAITING";
        const rowResult = insertRow.run({
          uploadId: upload.lastInsertRowid,
          rowNo: rowIndex + 1,
          transactionDate: getCellOr(row, indexes.date, 0),
          rawCustomerName: getCellOr(row, indexes.customerName, 1),
          rawProductName: getCellOr(row, indexes.productName, 3),
          customerCode: getCell(row, indexes.customerCode),
          productCode: getCellOr(row, indexes.productCode, 2),
          quantity: parseNumber(getCellOr(row, indexes.quantity, 4)),
          unitPrice: parseNumber(getCellOr(row, indexes.unitPrice, 5)),
          salesAmount: parseNumber(getCellOr(row, indexes.amount, 6)),
          validationStatus:
            status === "PENDING" ? (getCell(row, 7) ?? status) : status,
          reviewStatus,
          ownerName: getCellOr(row, indexes.owner, 8),
        });

        const issues = data?.validationIssues?.[rowIndex] ?? [];
        issues.forEach((message) => {
          issueCount += 1;
          if (
            String(message).includes("중복") ||
            String(message).includes("같습니다")
          ) {
            duplicateCount += 1;
          } else {
            reviewCount += 1;
          }
          insertIssue.run({
            uploadId: upload.lastInsertRowid,
            rowId: rowResult.lastInsertRowid,
            errorType:
              String(message).includes("중복") ||
              String(message).includes("같습니다")
                ? "DUPLICATE"
                : "VALIDATION",
            severity: String(message).includes("금액") ? "ERROR" : "WARNING",
            message,
            assignedDepartmentCode: "GENERAL_AFFAIRS",
            status: reviewStatus === "approved" ? "RESOLVED" : "OPEN",
          });
        });
      });

      updateValidationSummary.run({
        snapshotId: snapshot.lastInsertRowid,
        issueCount,
        duplicateCount,
        reviewCount,
      });

      insertEvent.run({
        level: "INFO",
        message: `${data?.fileName ?? "작업"} 스냅샷을 SQLite에 저장했습니다.`,
        metaJson: toJson({
          snapshotId: snapshot.lastInsertRowid,
          uploadId: upload.lastInsertRowid,
        }),
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
  authenticateLocalUser,
  backupDatabase,
  closeDatabase,
  changeLocalUserPassword,
  getDatabaseForInternalUse: getDatabase,
  getFilteredSalesData,
  getDatabasePath,
  getUserTodoState,
  importBootstrapData,
  initializeDatabase,
  listLocalUsers,
  registerLocalUser,
  registerDatabaseIpc,
  saveUserTodoState,
  updateLocalUser,
  deleteLocalUser,
};
