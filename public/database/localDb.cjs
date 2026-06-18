const path = require("node:path");
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
  return Boolean(database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName));
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

INSERT OR IGNORE INTO message_templates (
  template_id,
  template_name,
  channel,
  subject_template,
  body_template,
  tone,
  status
)
VALUES (
  1,
  '거래처 검수 협조 요청',
  'EMAIL',
  '[확인 요청] {{closing_month}} 매출 자료 검수 협조 요청드립니다',
  '안녕하세요. 바쁘신 와중에 확인 요청드립니다.\n\n첨부드린 {{customer_name}} 매출 자료 중 확인이 필요한 항목이 있어 공유드립니다. 혹시 저희 쪽에서 추가로 맞춰드릴 내용이 있다면 편하게 알려주시면 감사하겠습니다.\n\n확인 부탁드립니다.\n감사합니다.',
  'COOPERATIVE',
  'ACTIVE'
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
  ensureColumn(db, "workspace_snapshots", "row_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "workspace_snapshots", "column_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "workspace_snapshots", "issue_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "workspace_snapshots", "duplicate_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "workspace_snapshots", "review_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "sales", "transaction_date", "TEXT");
  ensureColumn(db, "sales", "owner_name", "TEXT");
  if (tableExists(db, "sales_rows")) {
    ensureColumn(db, "sales_rows", "transaction_date", "TEXT");
    ensureColumn(db, "sales_rows", "owner_name", "TEXT");
  }

  if (tableExists(db, "departments")) {
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

  db.prepare(`
    INSERT OR IGNORE INTO users (
      username, display_name, password_hash, role, department_name, status
    )
    VALUES ('황주은', '황주은', '0000', 'ADMIN', '총무팀', 'ACTIVE')
  `).run();

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

  if (tableExists(db, "send_packages") && tableExists(db, "send_package_items")) {
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

  db.pragma("foreign_keys = ON");

  return db;
}

function toJson(value) {
  return JSON.stringify(value ?? null);
}

function getColumnIndex(columns, name) {
  return Array.isArray(columns)
    ? columns.findIndex((column) => column === name)
    : -1;
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
    uploadId: upload.uploadId,
    startDate: String(options.startDate ?? ""),
    endDate: String(options.endDate ?? ""),
    status: String(options.status ?? "전체"),
    query: `%${String(options.query ?? "")
      .trim()
      .toLowerCase()}%`,
    limit: pageSize,
    offset,
  };
  const where = [
    "upload_id = @uploadId",
    "(@startDate = '' OR transaction_date >= @startDate)",
    "(@endDate = '' OR transaction_date <= @endDate)",
    "(@status = '전체' OR validation_status = @status)",
    `(
      @query = '%%'
      OR lower(COALESCE(raw_customer_name, '')) LIKE @query
      OR lower(COALESCE(raw_product_name, '')) LIKE @query
      OR lower(COALESCE(customer_code, '')) LIKE @query
      OR lower(COALESCE(product_code, '')) LIKE @query
      OR lower(COALESCE(owner_name, '')) LIKE @query
    )`,
  ].join(" AND ");

  const total =
    database
      .prepare(`SELECT COUNT(*) AS count FROM sales WHERE ${where}`)
      .get(params)?.count ?? 0;
  console.log("[debug:data-query:sql] params", params);
  console.log("[debug:data-query:sql] where", where);
  console.log("[debug:data-query:sql] total", total);
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
  console.log("[debug:data-query:sql] rows preview", rows.slice(0, 3));

  return {
    ok: true,
    data: {
      id: upload.uploadId,
      fileName: upload.fileName,
      savedAt: upload.uploadedAt,
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

function getClosingCompanies(database) {
  return database
    .prepare(
      `
    SELECT
      customer_code AS closingId,
      customer_name AS company,
      closing_json AS closingJson,
      updated_at AS updatedAt
    FROM customers
    WHERE closing_json IS NOT NULL
    ORDER BY customer_code ASC
  `,
    )
    .all()
    .map((row) => {
      const data = JSON.parse(row.closingJson || "{}");
      return normalizeClosingCompany({
        ...data,
        closingId: row.closingId,
        company: row.company,
        historyJson: data.historyJson ?? JSON.stringify(data.history ?? []),
        updatedAt: row.updatedAt,
      });
    });
}

function saveClosingCompanies(database, rows = []) {
  const upsert = database.prepare(`
    INSERT INTO customers (
      customer_code, customer_name, status, memo, closing_json, updated_at
    )
    VALUES (@id, @company, 'ACTIVE', @memo, @closingJson, CURRENT_TIMESTAMP)
    ON CONFLICT(customer_code) DO UPDATE SET
      customer_name = excluded.customer_name,
      memo = excluded.memo,
      closing_json = excluded.closing_json,
      updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = database.transaction(() => {
    rows.forEach((row) => {
      upsert.run({
        id: row.id,
        company: row.company ?? "",
        memo: row.memo ?? "",
        closingJson: JSON.stringify({
          ...row,
          contactConfirmed: toBooleanNumber(row.contactConfirmed),
          amountConfirmed: toBooleanNumber(row.amountConfirmed),
          taxMatched: toBooleanNumber(row.taxMatched),
          taxIssued: toBooleanNumber(row.taxIssued),
          requestReady: toBooleanNumber(row.requestReady),
          requestSent: toBooleanNumber(row.requestSent),
          closingSheetSent: toBooleanNumber(row.closingSheetSent),
          historyJson: JSON.stringify(row.history ?? []),
        }),
      });
    });
  });

  transaction();
  return getClosingCompanies(database);
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

function getSendPackages(database) {
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
      created_at AS createdAt
    FROM email_history
    ORDER BY package_id DESC, email_id ASC
  `,
    )
    .all();

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

function prepareSendPackageAttachments(database, packageId) {
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
    LIMIT 1
  `,
    )
    .get({ packageId });

  if (!sendPackage) {
    throw new Error("발송 패키지를 찾을 수 없습니다.");
  }

  const items = database
    .prepare(
      `
    SELECT email_id AS itemId, customer_code AS customerCode
    FROM email_history
    WHERE package_id = @packageId
    ORDER BY email_id
  `,
    )
    .all({ packageId });

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
  return getSendPackages(database);
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
  return getSendPackages(database);
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

function ensureCoreBusinessData(database) {
  const countTable = (tableName) => database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
  return {
    users: countTable("users"),
    customers: countTable("customers"),
    products: countTable("products"),
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

function getDatabasePath(app) {
  return getDatabase(app).name;
}

function backupDatabase(app, destinationPath) {
  const database = getDatabase(app);
  return database.backup(destinationPath);
}

function registerDatabaseIpc(ipcMain, app) {
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

  ipcMain.handle("send-packages:get", () => {
    const database = getDatabase(app);
    return {
      ok: true,
      packages: getSendPackages(database),
    };
  });

  ipcMain.handle("send-packages:prepare-attachments", (_, packageId) => {
    const database = getDatabase(app);
    return {
      ok: true,
      packages: prepareSendPackageAttachments(database, packageId),
    };
  });

  ipcMain.handle("send-package-items:update-status", (_, payload) => {
    const database = getDatabase(app);
    return {
      ok: true,
      packages: updateSendPackageItemStatus(database, payload),
    };
  });

  ipcMain.handle("department-requests:list", () => {
    const database = getDatabase(app);
    return {
      ok: true,
      requests: getDepartmentRequests(database),
    };
  });

  ipcMain.handle("closing-companies:list", () => {
    const database = getDatabase(app);
    return {
      ok: true,
      rows: getClosingCompanies(database),
    };
  });

  ipcMain.handle("closing-companies:save", (_, rows) => {
    const database = getDatabase(app);
    return {
      ok: true,
      rows: saveClosingCompanies(database, rows ?? []),
    };
  });

  ipcMain.handle("data:latest", () => {
    const database = getDatabase(app);
    return getLatestSalesData(database);
  });

  ipcMain.handle("data:query", (_, options) => {
    const database = getDatabase(app);
    console.log("[debug:data-query:main] options", options);
    console.log("[debug:data-query:main] database open", Boolean(database));
    const result = getFilteredSalesData(database, options);
    console.log("[debug:data-query:main] total", result?.data?.total);
    console.log("[debug:data-query:main] rows preview", result?.data?.rows?.slice(0, 3));
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
        customerName: getColumnIndex(columns, "거래처"),
        productName: getColumnIndex(columns, "품목명"),
        customerCode: getColumnIndex(columns, "거래처 코드"),
        productCode: getColumnIndex(columns, "품목 코드"),
        quantity: getColumnIndex(columns, "수량"),
        unitPrice: getColumnIndex(columns, "단가"),
        amount: getColumnIndex(columns, "금액"),
        status: getColumnIndex(columns, "검증"),
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
          transactionDate: getCell(row, 0),
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
          ownerName: getCell(row, 8),
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
  backupDatabase,
  closeDatabase,
  getDatabasePath,
  initializeDatabase,
  registerDatabaseIpc,
};
