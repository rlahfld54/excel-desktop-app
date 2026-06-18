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

  -- =========================
  -- 부서
  -- 개인 담당자 대신 부서 기준으로 추적
  -- =========================
  CREATE TABLE IF NOT EXISTS departments (
    department_code TEXT PRIMARY KEY,
    department_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- =========================
  -- 거래처 별칭
  -- 삼성 / 삼성전자 / (주)삼성전자 정리용
  -- =========================
  CREATE TABLE IF NOT EXISTS customer_aliases (
    alias_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_code TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    source TEXT DEFAULT 'MANUAL',
    confidence REAL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_code) REFERENCES customers(customer_code),
    UNIQUE(alias_name)
  );

  -- =========================
  -- 제품 마스터
  -- 실제 비교 기준은 product_code
  -- =========================
  CREATE TABLE IF NOT EXISTS products (
    product_code TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'EA',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    memo TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- =========================
  -- 제품 별칭
  -- 제품명 흔들림 정리용
  -- =========================
  CREATE TABLE IF NOT EXISTS product_aliases (
    alias_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    source TEXT DEFAULT 'MANUAL',
    confidence REAL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_code) REFERENCES products(product_code),
    UNIQUE(alias_name)
  );

  -- =========================
  -- 영업 단가
  -- UPDATE보다 version/end_date 방식 권장
  -- =========================
  CREATE TABLE IF NOT EXISTS sales_prices (
    price_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_code TEXT NOT NULL,
    product_code TEXT NOT NULL,
    price REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KRW',
    start_date TEXT NOT NULL,
    end_date TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    change_reason TEXT,
    approved_department_code TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_code) REFERENCES customers(customer_code),
    FOREIGN KEY(product_code) REFERENCES products(product_code),
    FOREIGN KEY(approved_department_code) REFERENCES departments(department_code)
  );

  CREATE INDEX IF NOT EXISTS idx_sales_prices_lookup
  ON sales_prices(customer_code, product_code, start_date, end_date, status);

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
    FOREIGN KEY(snapshot_id) REFERENCES workspace_snapshots(id) ON DELETE SET NULL,
    FOREIGN KEY(uploaded_department_code) REFERENCES departments(department_code)
  );

  -- =========================
  -- 업로드 행 데이터
  -- 엑셀 행 단위 검증용
  -- =========================
  CREATE TABLE IF NOT EXISTS sales_rows (
    row_id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER NOT NULL,
    row_no INTEGER NOT NULL,

    raw_customer_name TEXT,
    raw_product_name TEXT,

    customer_code TEXT,
    product_code TEXT,

    quantity REAL,
    unit_price REAL,
    sales_amount REAL,

    validation_status TEXT NOT NULL DEFAULT 'PENDING',
    review_status TEXT NOT NULL DEFAULT 'WAITING',

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(upload_id) REFERENCES sales_uploads(upload_id) ON DELETE CASCADE,
    FOREIGN KEY(customer_code) REFERENCES customers(customer_code),
    FOREIGN KEY(product_code) REFERENCES products(product_code)
  );

  CREATE INDEX IF NOT EXISTS idx_sales_rows_upload
  ON sales_rows(upload_id);

  CREATE INDEX IF NOT EXISTS idx_sales_rows_codes
  ON sales_rows(customer_code, product_code);

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
    FOREIGN KEY(row_id) REFERENCES sales_rows(row_id) ON DELETE SET NULL,
    FOREIGN KEY(assigned_department_code) REFERENCES departments(department_code)
  );

  CREATE INDEX IF NOT EXISTS idx_validation_issues_upload
  ON validation_issues(upload_id, status, severity);

  -- =========================
  -- 자동 추천 매핑
  -- 기존 데이터가 정리 안 된 회사 대응용
  -- =========================
  CREATE TABLE IF NOT EXISTS mapping_suggestions (
    suggestion_id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,
    raw_value TEXT NOT NULL,
    suggested_code TEXT,
    suggested_name TEXT,
    confidence REAL DEFAULT 0,
    source_upload_id INTEGER,
    status TEXT NOT NULL DEFAULT 'PENDING',
    approved_department_code TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at TEXT,

    FOREIGN KEY(source_upload_id) REFERENCES sales_uploads(upload_id),
    FOREIGN KEY(approved_department_code) REFERENCES departments(department_code)
  );

  CREATE INDEX IF NOT EXISTS idx_mapping_suggestions_status
  ON mapping_suggestions(target_type, status);

  -- =========================
  -- 최종 보고서 기록
  -- =========================
  CREATE TABLE IF NOT EXISTS closing_reports (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER NOT NULL,
    closing_month TEXT NOT NULL,
    total_quantity REAL NOT NULL DEFAULT 0,
    total_sales_amount REAL NOT NULL DEFAULT 0,
    report_file_path TEXT NOT NULL,
    generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'GENERATED',
    FOREIGN KEY(upload_id) REFERENCES sales_uploads(upload_id)
  );

  -- =========================
  -- 기준 데이터 변경 이력
  -- 단가/코드/거래처명 변경 시 필수
  -- =========================
  CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_key TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_department_code TEXT,
    change_reason TEXT NOT NULL,
    changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(changed_department_code) REFERENCES departments(department_code)
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_record
  ON audit_logs(table_name, record_key, changed_at);

  -- =========================
  -- 변경 전/후 백업 기록
  -- 최소 3년 보관
  -- =========================
  CREATE TABLE IF NOT EXISTS backup_history (
    backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,
    target_key TEXT NOT NULL,
    backup_reason TEXT NOT NULL,
    before_snapshot_path TEXT,
    after_snapshot_path TEXT,
    retention_until TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_backup_history_target
  ON backup_history(target_type, target_key);



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
-- 2. 보고서 생성 작업 목록
-- 화면의 "보고서 생성 목록"에 해당
-- =========================
CREATE TABLE IF NOT EXISTS report_jobs (
  job_id INTEGER PRIMARY KEY AUTOINCREMENT,

  template_id INTEGER,
  upload_id INTEGER,
  snapshot_id INTEGER,

  report_name TEXT NOT NULL,
  data_source_name TEXT,
  data_source_path TEXT,

  output_format TEXT NOT NULL DEFAULT 'XLSX',
  -- PDF, XLSX, PDF_XLSX

  status TEXT NOT NULL DEFAULT 'DRAFT',
  -- DRAFT, WAITING, GENERATING, COMPLETED, FAILED, CANCELED

  generated_at TEXT,
  output_file_path TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(template_id) REFERENCES report_templates(template_id),
  FOREIGN KEY(upload_id) REFERENCES sales_uploads(upload_id) ON DELETE SET NULL,
  FOREIGN KEY(snapshot_id) REFERENCES workspace_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_report_jobs_status
ON report_jobs(status, generated_at);

CREATE INDEX IF NOT EXISTS idx_report_jobs_source
ON report_jobs(data_source_name);


-- =========================
-- 3. 보고서 출력 옵션
-- 표지 포함, 오류 행 강조, 부서별 분리 등
-- =========================
CREATE TABLE IF NOT EXISTS report_output_options (
  option_id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,

  include_cover INTEGER NOT NULL DEFAULT 0,
  highlight_error_rows INTEGER NOT NULL DEFAULT 1,
  split_by_department INTEGER NOT NULL DEFAULT 0,
  attach_cloud_backup INTEGER NOT NULL DEFAULT 0,

  option_json TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(job_id) REFERENCES report_jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_output_options_job
ON report_output_options(job_id);


-- =========================
-- 4. 보고서 생성 파일
-- PDF/XLSX를 둘 다 만들 수 있으니 파일 단위로 분리
-- =========================
CREATE TABLE IF NOT EXISTS report_files (
  file_id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,

  file_format TEXT NOT NULL,
  -- PDF, XLSX

  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(job_id) REFERENCES report_jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_files_job
ON report_files(job_id);


-- =========================
-- 5. 보고서 검색/필터용 태그
-- 예: 매출마감, 오류, 백업, 거래처별
-- =========================
CREATE TABLE IF NOT EXISTS report_tags (
  tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS report_job_tags (
  job_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,

  PRIMARY KEY(job_id, tag_id),

  FOREIGN KEY(job_id) REFERENCES report_jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES report_tags(tag_id) ON DELETE CASCADE
);


-- =========================
-- 6. 보고서 생성 로그
-- 실패 원인, 생성 단계 추적
-- =========================
CREATE TABLE IF NOT EXISTS report_job_logs (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,

  level TEXT NOT NULL DEFAULT 'INFO',
  message TEXT NOT NULL,
  meta_json TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(job_id) REFERENCES report_jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_job_logs_job
ON report_job_logs(job_id, created_at);


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

  department_code TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  last_login_at TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(department_code) REFERENCES departments(department_code)
);

CREATE INDEX IF NOT EXISTS idx_users_department
ON users(department_code, status);


-- =========================
-- 2. 로그인 기록
-- =========================
CREATE TABLE IF NOT EXISTS login_logs (
  login_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  login_result TEXT NOT NULL,
  -- SUCCESS, FAILED, LOGOUT

  message TEXT,
  logged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE SET NULL
);


-- =========================
-- 3. 기본 부서 데이터
-- =========================
INSERT OR IGNORE INTO departments (
  department_code,
  department_name,
  status
)
VALUES
  ('GENERAL_AFFAIRS', '총무팀', 'ACTIVE'),
  ('LOGISTICS', '물류팀', 'ACTIVE');


-- =========================
-- 4. 기본 관리자 계정
-- 최초 개발용
-- 실제 배포 전에는 password_hash 교체 필요
-- =========================
INSERT OR IGNORE INTO users (
  username,
  display_name,
  password_hash,
  role,
  department_code,
  status
)
VALUES (
  '황주은',
  '황주은',
  '0000',
  'ADMIN',
  'GENERAL_AFFAIRS',
  'ACTIVE'
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


CREATE TABLE IF NOT EXISTS send_packages (
  package_id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_name TEXT NOT NULL,
  upload_id INTEGER,
  closing_month TEXT,
  output_folder_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(upload_id) REFERENCES sales_uploads(upload_id)
);

CREATE TABLE IF NOT EXISTS send_package_items (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id INTEGER NOT NULL,
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
  -- READY, COPIED, OPENED, SENT, REPLIED, CLOSED, FAILED

  sent_checked_at TEXT,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(package_id) REFERENCES send_packages(package_id) ON DELETE CASCADE,
  FOREIGN KEY(customer_code) REFERENCES customers(customer_code),
  FOREIGN KEY(contact_id) REFERENCES contacts(contact_id)
);

CREATE INDEX IF NOT EXISTS idx_send_package_items_package
ON send_package_items(package_id, status);

CREATE TABLE IF NOT EXISTS send_exports (
  export_id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id INTEGER NOT NULL,
  export_type TEXT NOT NULL,
  -- CSV, EXCEL_MACRO, PYTHON_SCRIPT, OUTLOOK, MANUAL

  export_file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(package_id) REFERENCES send_packages(package_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS department_requests (
  request_id TEXT PRIMARY KEY,
  department TEXT NOT NULL,
  title TEXT NOT NULL,
  due TEXT,
  owner TEXT,
  priority TEXT NOT NULL DEFAULT 'LOW',
  status TEXT NOT NULL DEFAULT '접수',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_department_requests_priority
ON department_requests(priority, status, due);

CREATE TABLE IF NOT EXISTS closing_companies (
  closing_id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  owner TEXT,
  deadline TEXT,
  contact_name TEXT,
  contact_department TEXT,
  contact_title TEXT,
  email TEXT,
  phone TEXT,
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  sales_amount REAL NOT NULL DEFAULT 0,
  confirmed_amount REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  contact_confirmed INTEGER NOT NULL DEFAULT 0,
  amount_confirmed INTEGER NOT NULL DEFAULT 0,
  tax_matched INTEGER NOT NULL DEFAULT 0,
  tax_issued INTEGER NOT NULL DEFAULT 0,
  request_ready INTEGER NOT NULL DEFAULT 0,
  request_sent INTEGER NOT NULL DEFAULT 0,
  closing_sheet_sent INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  memo TEXT,
  last_contact_at TEXT,
  contact_count INTEGER NOT NULL DEFAULT 0,
  history_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_closing_companies_status
ON closing_companies(owner, deadline, contact_confirmed, amount_confirmed, tax_matched, request_sent);

`);

  ensureColumn(db, "sales_rows", "transaction_date", "TEXT");
  ensureColumn(db, "sales_rows", "owner_name", "TEXT");

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
      FROM sales_rows
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
        source: "sales_rows",
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
      .prepare(`SELECT COUNT(*) AS count FROM sales_rows WHERE ${where}`)
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
      FROM sales_rows
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
  console.log("[debug:data-query:sql] rows sample", rows.slice(0, 3));

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
      FROM sales_rows
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

const seedDepartmentRequests = [
  {
    id: "REQ-001",
    department: "영업팀",
    title: "6월 거래처 마감 금액 확인 요청",
    due: "오늘 14:00",
    owner: "김민서",
    priority: "HIGH",
    status: "확인 필요",
  },
  {
    id: "REQ-002",
    department: "물류팀",
    title: "반품 처리 기준 자료 공유 요청",
    due: "오늘 16:00",
    owner: "박정우",
    priority: "MEDIUM",
    status: "진행 중",
  },
  {
    id: "REQ-003",
    department: "구매팀",
    title: "세금계산서 공급가액 차이 재확인",
    due: "내일 10:00",
    owner: "이서연",
    priority: "HIGH",
    status: "대기",
  },
  {
    id: "REQ-004",
    department: "CS팀",
    title: "거래처 담당자 연락처 변경 반영",
    due: "06-13",
    owner: "최현우",
    priority: "LOW",
    status: "접수",
  },
];

const seedClosingCompanies = [
  {
    id: "CLOSING-001",
    company: "한빛유통",
    owner: "김민서",
    deadline: "10일",
    contactName: "오민지",
    contactDepartment: "정산팀",
    contactTitle: "담당자",
    email: "settle@hanbit.example",
    phone: "010-4210-1842",
    channel: "EMAIL",
    salesAmount: 28450000,
    confirmedAmount: 28450000,
    taxAmount: 28450000,
    contactConfirmed: true,
    amountConfirmed: true,
    taxMatched: true,
    taxIssued: true,
    requestReady: true,
    requestSent: true,
    closingSheetSent: true,
    reason: "미확정 없음",
    memo: "5월 마감 확정 완료. 요청서 발송 완료.",
    lastContactAt: "2026-06-08 11:00",
    contactCount: 1,
    history: [
      "06-07 거래처 확인 완료",
      "06-08 세금계산서 대조 완료",
      "06-08 요청서 발송",
    ],
  },
  {
    id: "CLOSING-002",
    company: "모블상사",
    owner: "김민서",
    deadline: "10일",
    contactName: "강소영",
    contactDepartment: "관리팀",
    contactTitle: "대리",
    email: "admin@moble.example",
    phone: "010-3188-5502",
    channel: "EMAIL",
    salesAmount: 19720000,
    confirmedAmount: 19650000,
    taxAmount: 19720000,
    contactConfirmed: false,
    amountConfirmed: false,
    taxMatched: false,
    taxIssued: false,
    requestReady: false,
    requestSent: false,
    closingSheetSent: true,
    reason: "회신 대기",
    memo: "거래처 담당자 금액 확인 회신 대기.",
    lastContactAt: "2026-06-08 10:30",
    contactCount: 2,
    history: ["06-06 1차 확인 메일 발송", "06-08 전화 연결 실패"],
  },
  {
    id: "CLOSING-003",
    company: "그린물류",
    owner: "박정우",
    deadline: "25일",
    contactName: "서가은",
    contactDepartment: "정산팀",
    contactTitle: "팀장",
    email: "tax@greenlog.example",
    phone: "010-9402-6620",
    channel: "EMAIL",
    salesAmount: 43180000,
    confirmedAmount: 43180000,
    taxAmount: 43010000,
    contactConfirmed: true,
    amountConfirmed: true,
    taxMatched: false,
    taxIssued: true,
    requestReady: false,
    requestSent: false,
    closingSheetSent: true,
    reason: "세금계산서 차이",
    memo: "세금계산서 공급가액 170,000원 차이 확인 필요.",
    lastContactAt: "2026-06-09 14:00",
    contactCount: 1,
    history: ["06-05 금액 확정", "06-09 세금계산서 차이 발견"],
  },
  {
    id: "CLOSING-004",
    company: "청담리테일",
    owner: "이서연",
    deadline: "25일",
    contactName: "윤나래",
    contactDepartment: "관리팀",
    contactTitle: "과장",
    email: "closing@cheongdam.example",
    phone: "010-6104-0931",
    channel: "KAKAO",
    salesAmount: 12690000,
    confirmedAmount: 12400000,
    taxAmount: 12400000,
    contactConfirmed: true,
    amountConfirmed: false,
    taxMatched: true,
    taxIssued: false,
    requestReady: false,
    requestSent: false,
    closingSheetSent: true,
    reason: "금액 조율",
    memo: "반품 2건 반영 여부 조율 중.",
    lastContactAt: "2026-06-08 16:10",
    contactCount: 3,
    history: ["06-04 거래처 확인 완료", "06-08 반품 건 내부 검토 요청"],
  },
  {
    id: "CLOSING-005",
    company: "서울컴퍼니",
    owner: "최현우",
    deadline: "30일",
    contactName: "문하린",
    contactDepartment: "회계팀",
    contactTitle: "차장",
    email: "finance@seoulcp.example",
    phone: "010-8890-7311",
    channel: "EMAIL",
    salesAmount: 35860000,
    confirmedAmount: 35860000,
    taxAmount: 35860000,
    contactConfirmed: true,
    amountConfirmed: true,
    taxMatched: true,
    taxIssued: false,
    requestReady: true,
    requestSent: false,
    closingSheetSent: false,
    reason: "미확정 없음",
    memo: "발송 패키지 준비 완료. 발송 승인만 남음.",
    lastContactAt: "-",
    contactCount: 0,
    history: ["06-08 금액 확정", "06-09 패키지 생성"],
  },
  {
    id: "CLOSING-006",
    company: "다원문구",
    owner: "박정우",
    deadline: "10일",
    contactName: "이지현",
    contactDepartment: "구매팀",
    contactTitle: "대리",
    email: "purchase@dawon.example",
    phone: "010-2048-2701",
    channel: "EMAIL",
    salesAmount: 9870000,
    confirmedAmount: 9870000,
    taxAmount: 10010000,
    contactConfirmed: false,
    amountConfirmed: true,
    taxMatched: false,
    taxIssued: true,
    requestReady: false,
    requestSent: false,
    closingSheetSent: true,
    reason: "세금계산서 차이",
    memo: "담당자 확인 전이며 세금계산서 금액 차이.",
    lastContactAt: "2026-06-09 09:20",
    contactCount: 1,
    history: ["06-07 세금계산서 업로드", "06-09 연락 필요 표시"],
  },
  {
    id: "CLOSING-007",
    company: "바른테크",
    owner: "이서연",
    deadline: "30일",
    contactName: "최도윤",
    contactDepartment: "정산팀",
    contactTitle: "담당자",
    email: "settlement@baruntech.example",
    phone: "010-5211-4299",
    channel: "EMAIL",
    salesAmount: 22140000,
    confirmedAmount: 22140000,
    taxAmount: 22140000,
    contactConfirmed: true,
    amountConfirmed: true,
    taxMatched: true,
    taxIssued: true,
    requestReady: true,
    requestSent: true,
    closingSheetSent: true,
    reason: "미확정 없음",
    memo: "마감 완료.",
    lastContactAt: "2026-06-06 12:00",
    contactCount: 1,
    history: ["06-06 최종 확정", "06-06 발송 완료"],
  },
  {
    id: "CLOSING-008",
    company: "코리아비즈",
    owner: "최현우",
    deadline: "25일",
    contactName: "손우진",
    contactDepartment: "회계팀",
    contactTitle: "대리",
    email: "account@koreabiz.example",
    phone: "010-3900-1187",
    channel: "KAKAO",
    salesAmount: 48750000,
    confirmedAmount: 48200000,
    taxAmount: 48200000,
    contactConfirmed: true,
    amountConfirmed: false,
    taxMatched: true,
    taxIssued: false,
    requestReady: false,
    requestSent: false,
    closingSheetSent: true,
    reason: "내부 검토",
    memo: "대량 거래 할인 반영 여부 내부 승인 필요.",
    lastContactAt: "2026-06-09 15:30",
    contactCount: 2,
    history: ["06-08 거래처 확인 완료", "06-09 내부 승인 요청"],
  },
];

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

function ensureOperationalSeedData(database) {
  const insertRequest = database.prepare(`
    INSERT OR IGNORE INTO department_requests (
      request_id, department, title, due, owner, priority, status
    )
    VALUES (@id, @department, @title, @due, @owner, @priority, @status)
  `);
  const insertClosing = database.prepare(`
    INSERT OR IGNORE INTO closing_companies (
      closing_id,
      company,
      owner,
      deadline,
      contact_name,
      contact_department,
      contact_title,
      email,
      phone,
      channel,
      sales_amount,
      confirmed_amount,
      tax_amount,
      contact_confirmed,
      amount_confirmed,
      tax_matched,
      tax_issued,
      request_ready,
      request_sent,
      closing_sheet_sent,
      reason,
      memo,
      last_contact_at,
      contact_count,
      history_json
    )
    VALUES (
      @id,
      @company,
      @owner,
      @deadline,
      @contactName,
      @contactDepartment,
      @contactTitle,
      @email,
      @phone,
      @channel,
      @salesAmount,
      @confirmedAmount,
      @taxAmount,
      @contactConfirmed,
      @amountConfirmed,
      @taxMatched,
      @taxIssued,
      @requestReady,
      @requestSent,
      @closingSheetSent,
      @reason,
      @memo,
      @lastContactAt,
      @contactCount,
      @historyJson
    )
  `);

  database.transaction(() => {
    seedDepartmentRequests.forEach((request) => insertRequest.run(request));
    seedClosingCompanies.forEach((row) =>
      insertClosing.run({
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
    );
  })();
}

function getDepartmentRequests(database) {
  ensureOperationalSeedData(database);
  return database
    .prepare(
      `
    SELECT
      request_id AS id,
      department,
      title,
      due,
      owner,
      priority,
      status,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM department_requests
    ORDER BY
      CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
      request_id ASC
  `,
    )
    .all();
}

function getClosingCompanies(database) {
  ensureOperationalSeedData(database);
  return database
    .prepare(
      `
    SELECT
      closing_id AS closingId,
      company,
      owner,
      deadline,
      contact_name AS contactName,
      contact_department AS contactDepartment,
      contact_title AS contactTitle,
      email,
      phone,
      channel,
      sales_amount AS salesAmount,
      confirmed_amount AS confirmedAmount,
      tax_amount AS taxAmount,
      contact_confirmed AS contactConfirmed,
      amount_confirmed AS amountConfirmed,
      tax_matched AS taxMatched,
      tax_issued AS taxIssued,
      request_ready AS requestReady,
      request_sent AS requestSent,
      closing_sheet_sent AS closingSheetSent,
      reason,
      memo,
      last_contact_at AS lastContactAt,
      contact_count AS contactCount,
      history_json AS historyJson,
      updated_at AS updatedAt
    FROM closing_companies
    ORDER BY closing_id ASC
  `,
    )
    .all()
    .map(normalizeClosingCompany);
}

function saveClosingCompanies(database, rows = []) {
  ensureOperationalSeedData(database);

  const upsert = database.prepare(`
    INSERT INTO closing_companies (
      closing_id,
      company,
      owner,
      deadline,
      contact_name,
      contact_department,
      contact_title,
      email,
      phone,
      channel,
      sales_amount,
      confirmed_amount,
      tax_amount,
      contact_confirmed,
      amount_confirmed,
      tax_matched,
      tax_issued,
      request_ready,
      request_sent,
      closing_sheet_sent,
      reason,
      memo,
      last_contact_at,
      contact_count,
      history_json,
      updated_at
    )
    VALUES (
      @id,
      @company,
      @owner,
      @deadline,
      @contactName,
      @contactDepartment,
      @contactTitle,
      @email,
      @phone,
      @channel,
      @salesAmount,
      @confirmedAmount,
      @taxAmount,
      @contactConfirmed,
      @amountConfirmed,
      @taxMatched,
      @taxIssued,
      @requestReady,
      @requestSent,
      @closingSheetSent,
      @reason,
      @memo,
      @lastContactAt,
      @contactCount,
      @historyJson,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(closing_id) DO UPDATE SET
      company = excluded.company,
      owner = excluded.owner,
      deadline = excluded.deadline,
      contact_name = excluded.contact_name,
      contact_department = excluded.contact_department,
      contact_title = excluded.contact_title,
      email = excluded.email,
      phone = excluded.phone,
      channel = excluded.channel,
      sales_amount = excluded.sales_amount,
      confirmed_amount = excluded.confirmed_amount,
      tax_amount = excluded.tax_amount,
      contact_confirmed = excluded.contact_confirmed,
      amount_confirmed = excluded.amount_confirmed,
      tax_matched = excluded.tax_matched,
      tax_issued = excluded.tax_issued,
      request_ready = excluded.request_ready,
      request_sent = excluded.request_sent,
      closing_sheet_sent = excluded.closing_sheet_sent,
      reason = excluded.reason,
      memo = excluded.memo,
      last_contact_at = excluded.last_contact_at,
      contact_count = excluded.contact_count,
      history_json = excluded.history_json,
      updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = database.transaction(() => {
    rows.forEach((row) => {
      upsert.run({
        id: row.id,
        company: row.company ?? "",
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
        contactConfirmed: toBooleanNumber(row.contactConfirmed),
        amountConfirmed: toBooleanNumber(row.amountConfirmed),
        taxMatched: toBooleanNumber(row.taxMatched),
        taxIssued: toBooleanNumber(row.taxIssued),
        requestReady: toBooleanNumber(row.requestReady),
        requestSent: toBooleanNumber(row.requestSent),
        closingSheetSent: toBooleanNumber(row.closingSheetSent),
        reason: row.reason ?? "",
        memo: row.memo ?? "",
        lastContactAt: row.lastContactAt ?? "",
        contactCount: Number(row.contactCount) || 0,
        historyJson: JSON.stringify(row.history ?? []),
      });
    });
  });

  transaction();
  return getClosingCompanies(database);
}

const seedDepartments = [
  { departmentCode: "GENERAL_AFFAIRS", departmentName: "총무팀" },
  { departmentCode: "SALES", departmentName: "영업팀" },
  { departmentCode: "LOGISTICS", departmentName: "물류팀" },
];

const seedCustomers = [
  {
    customerCode: "CUST-001",
    customerName: "한빛유통",
    businessNumber: "101-81-00001",
    taxStatus: "ACTIVE",
    memo: "월마감 검수 대상",
  },
  {
    customerCode: "CUST-002",
    customerName: "세종오피스",
    businessNumber: "102-82-00002",
    taxStatus: "ACTIVE",
    memo: "사무용품 정기 거래처",
  },
  {
    customerCode: "CUST-003",
    customerName: "모블상사",
    businessNumber: "103-83-00003",
    taxStatus: "ACTIVE",
    memo: "제품명 별칭 확인 필요",
  },
  {
    customerCode: "CUST-004",
    customerName: "대원시스템",
    businessNumber: "104-84-00004",
    taxStatus: "ACTIVE",
    memo: "단가 기준 변경 이력 관리",
  },
  {
    customerCode: "CUST-005",
    customerName: "청담리테일",
    businessNumber: "105-85-00005",
    taxStatus: "ACTIVE",
    memo: "신규 거래처",
  },
];

const seedCustomerAliases = [
  {
    customerCode: "CUST-001",
    aliasName: "한빛 유통",
    source: "SEED",
    confidence: 0.98,
  },
  {
    customerCode: "CUST-001",
    aliasName: "(주)한빛유통",
    source: "SEED",
    confidence: 0.96,
  },
  {
    customerCode: "CUST-002",
    aliasName: "세종 오피스",
    source: "SEED",
    confidence: 0.97,
  },
  {
    customerCode: "CUST-003",
    aliasName: "모블상사 주식회사",
    source: "SEED",
    confidence: 0.94,
  },
  {
    customerCode: "CUST-004",
    aliasName: "대원 시스템",
    source: "SEED",
    confidence: 0.95,
  },
];

const seedProducts = [
  {
    productCode: "PAPER-A4-001",
    productName: "A4 복사용지",
    unit: "BOX",
    memo: "박스 단위",
  },
  {
    productCode: "TONER-BLK-2108",
    productName: "흑백 토너 2108",
    unit: "EA",
    memo: "프린터 소모품",
  },
  {
    productCode: "USB-HUB-04",
    productName: "4포트 USB 허브",
    unit: "EA",
    memo: "전산 비품",
  },
  {
    productCode: "CABLE-MEET-01",
    productName: "회의실 HDMI 케이블",
    unit: "EA",
    memo: "회의실 소모품",
  },
  {
    productCode: "LABEL-STK-02",
    productName: "라벨 스티커",
    unit: "PACK",
    memo: "물류 라벨",
  },
];

const seedProductAliases = [
  {
    productCode: "PAPER-A4-001",
    aliasName: "A4 용지",
    source: "SEED",
    confidence: 0.98,
  },
  {
    productCode: "PAPER-A4-001",
    aliasName: "복사용지 A4",
    source: "SEED",
    confidence: 0.97,
  },
  {
    productCode: "TONER-BLK-2108",
    aliasName: "토너 2108",
    source: "SEED",
    confidence: 0.96,
  },
  {
    productCode: "USB-HUB-04",
    aliasName: "USB 허브 4P",
    source: "SEED",
    confidence: 0.95,
  },
  {
    productCode: "CABLE-MEET-01",
    aliasName: "HDMI 케이블",
    source: "SEED",
    confidence: 0.93,
  },
];

const seedPrices = [
  {
    priceId: 90001,
    customerCode: "CUST-001",
    productCode: "PAPER-A4-001",
    price: 24500,
    startDate: "2026-01-01",
    changeReason: "기본 샘플 단가",
  },
  {
    priceId: 90002,
    customerCode: "CUST-001",
    productCode: "TONER-BLK-2108",
    price: 78000,
    startDate: "2026-01-01",
    changeReason: "기본 샘플 단가",
  },
  {
    priceId: 90003,
    customerCode: "CUST-002",
    productCode: "USB-HUB-04",
    price: 18900,
    startDate: "2026-01-01",
    changeReason: "기본 샘플 단가",
  },
  {
    priceId: 90004,
    customerCode: "CUST-003",
    productCode: "CABLE-MEET-01",
    price: 9200,
    startDate: "2026-01-01",
    changeReason: "기본 샘플 단가",
  },
  {
    priceId: 90005,
    customerCode: "CUST-004",
    productCode: "LABEL-STK-02",
    price: 13200,
    startDate: "2026-01-01",
    changeReason: "기본 샘플 단가",
  },
];

const supplementalSeedCustomers = [
  {
    customerCode: "CUST-006",
    customerName: "그린물류",
    businessNumber: "106-86-43180",
    taxStatus: "ACTIVE",
    memo: "물류 라벨 정산 거래처",
  },
  {
    customerCode: "CUST-007",
    customerName: "다원문구",
    businessNumber: "107-87-09870",
    taxStatus: "ACTIVE",
    memo: "사무소모품 월마감 거래처",
  },
  {
    customerCode: "CUST-008",
    customerName: "브릿지오피스",
    businessNumber: "108-88-51042",
    taxStatus: "ACTIVE",
    memo: "분기 단가 검토 대상",
  },
  {
    customerCode: "CUST-009",
    customerName: "라온테크",
    businessNumber: "109-89-77310",
    taxStatus: "ACTIVE",
    memo: "전산 비품 거래처",
  },
  {
    customerCode: "CUST-010",
    customerName: "서린패키지",
    businessNumber: "110-80-66421",
    taxStatus: "ACTIVE",
    memo: "포장재 정기 거래처",
  },
  {
    customerCode: "CUST-011",
    customerName: "누리프린트",
    businessNumber: "111-81-42012",
    taxStatus: "ACTIVE",
    memo: "프린터 소모품 거래처",
  },
  {
    customerCode: "CUST-012",
    customerName: "오름비즈",
    businessNumber: "112-82-53098",
    taxStatus: "ACTIVE",
    memo: "신규 코드 매핑 대상",
  },
  {
    customerCode: "CUST-013",
    customerName: "에이원솔루션",
    businessNumber: "113-83-74520",
    taxStatus: "ACTIVE",
    memo: "대량 구매 거래처",
  },
  {
    customerCode: "CUST-014",
    customerName: "피움상사",
    businessNumber: "114-84-22617",
    taxStatus: "ACTIVE",
    memo: "마감 회신 확인 필요",
  },
  {
    customerCode: "CUST-015",
    customerName: "케이엘유통",
    businessNumber: "115-85-90441",
    taxStatus: "ACTIVE",
    memo: "고액 거래 검토 대상",
  },
  {
    customerCode: "CUST-016",
    customerName: "더봄리테일",
    businessNumber: "116-86-21076",
    taxStatus: "ACTIVE",
    memo: "월말 세금계산서 확인",
  },
  {
    customerCode: "CUST-017",
    customerName: "제이앤파트너스",
    businessNumber: "117-87-68103",
    taxStatus: "ACTIVE",
    memo: "담당자 복수 등록 대상",
  },
];

const supplementalSeedProducts = [
  {
    productCode: "PEN-GEL-05",
    productName: "젤펜 0.5mm",
    unit: "BOX",
    memo: "필기구 박스 단가",
  },
  {
    productCode: "FILE-LVR-03",
    productName: "레버 파일",
    unit: "BOX",
    memo: "문서 보관용",
  },
  {
    productCode: "TAPE-OPP-48",
    productName: "OPP 박스테이프",
    unit: "ROLL",
    memo: "포장 소모품",
  },
  {
    productCode: "BATT-AA-20",
    productName: "AA 건전지 20입",
    unit: "PACK",
    memo: "비품 소모품",
  },
  {
    productCode: "CHAIR-MESH-01",
    productName: "메쉬 사무용 의자",
    unit: "EA",
    memo: "사무가구",
  },
  {
    productCode: "DESK-MAT-01",
    productName: "데스크 매트",
    unit: "EA",
    memo: "책상 보호 매트",
  },
  {
    productCode: "BOX-KRAFT-05",
    productName: "크라프트 택배박스 5호",
    unit: "BUNDLE",
    memo: "물류 포장재",
  },
  {
    productCode: "INK-COLOR-330",
    productName: "컬러 잉크 330",
    unit: "EA",
    memo: "프린터 소모품",
  },
  {
    productCode: "MONITOR-ARM-02",
    productName: "듀얼 모니터암",
    unit: "EA",
    memo: "전산 비품",
  },
  {
    productCode: "SANITIZER-500",
    productName: "손소독제 500ml",
    unit: "BOX",
    memo: "공용 비품",
  },
];

const supplementalSeedPrices = supplementalSeedCustomers.flatMap(
  (customer, customerIndex) =>
    supplementalSeedProducts.slice(0, 5).map((product, productIndex) => ({
      priceId: 91000 + customerIndex * 10 + productIndex,
      customerCode: customer.customerCode,
      productCode: product.productCode,
      price:
        [12600, 18900, 4200, 8500, 129000][productIndex] + customerIndex * 300,
      startDate: "2026-01-01",
      changeReason: "코드 매핑 화면 검토용 기준 단가",
    })),
);

const seedContacts = [
  {
    contactId: 90001,
    customerCode: "CUST-001",
    departmentName: "정산팀",
    recipientName: "한빛 정산담당",
    recipientEmail: "settle@hanbit.example",
    preferredChannel: "EMAIL",
    memo: "샘플 연락처",
  },
  {
    contactId: 90002,
    customerCode: "CUST-002",
    departmentName: "영업지원",
    recipientName: "세종 영업지원",
    recipientEmail: "sales@sejong.example",
    preferredChannel: "EMAIL",
    memo: "샘플 연락처",
  },
  {
    contactId: 90003,
    customerCode: "CUST-003",
    departmentName: "관리팀",
    recipientName: "모블 관리담당",
    recipientEmail: "admin@moble.example",
    preferredChannel: "KAKAO",
    memo: "카카오 공유 대상",
  },
  {
    contactId: 90004,
    customerCode: "CUST-004",
    departmentName: "총무팀",
    recipientName: "대원 총무담당",
    recipientEmail: "admin@daewon.example",
    preferredChannel: "EMAIL",
    memo: "샘플 연락처",
  },
];

const supplementalSeedContacts = supplementalSeedCustomers.map(
  (customer, index) => ({
    contactId: 91001 + index,
    customerCode: customer.customerCode,
    departmentName:
      index % 3 === 0 ? "정산팀" : index % 3 === 1 ? "구매팀" : "관리팀",
    recipientName: [
      "김도윤",
      "이하린",
      "박서준",
      "최유나",
      "정민재",
      "오지안",
      "윤태오",
      "강소율",
      "문하준",
      "신예린",
      "한지우",
      "서도현",
    ][index],
    recipientEmail: `closing${String(index + 1).padStart(2, "0")}@${customer.customerCode.toLowerCase().replace("-", "")}.example`,
    preferredChannel: index % 4 === 0 ? "KAKAO" : "EMAIL",
    memo: "담당자 관리 페이지 검토용 연락처",
  }),
);

const seedSuggestions = [
  {
    suggestionId: 90001,
    targetType: "CUSTOMER",
    rawValue: "한빛 유통",
    suggestedCode: "CUST-001",
    suggestedName: "한빛유통",
    confidence: 0.98,
  },
  {
    suggestionId: 90002,
    targetType: "PRODUCT",
    rawValue: "USB 허브 4P",
    suggestedCode: "USB-HUB-04",
    suggestedName: "4포트 USB 허브",
    confidence: 0.95,
  },
  {
    suggestionId: 90003,
    targetType: "PRODUCT",
    rawValue: "A4 용지",
    suggestedCode: "PAPER-A4-001",
    suggestedName: "A4 복사용지",
    confidence: 0.98,
  },
];

const sampleOwners = ["김민서", "박지훈", "이서연", "최현우", "정다은", "오수진"];

function formatSampleDate(index) {
  const date = new Date(2026, 4, 18);
  date.setDate(date.getDate() - (index % 45));
  return date.toISOString().slice(0, 10);
}

function getSampleIssue(index) {
  if (index % 97 === 0) return "거래처 누락";
  if (index % 89 === 0) return "품목 코드 누락";
  if (index % 53 === 0) return "금액 불일치";
  if (index % 47 === 0) return "단가 기준 불일치";
  if (index % 41 === 0) return "고액 거래 확인";
  if (index % 37 === 0) return "대량 거래 확인";
  if (index % 29 === 0) return "중복 의심";
  return "정상";
}

function buildSeedSalesRows(count = 1200) {
  const customers = [...seedCustomers, ...supplementalSeedCustomers];
  const products = [...seedProducts, ...supplementalSeedProducts];
  const pricesByProductCode = new Map(
    [...seedPrices, ...supplementalSeedPrices].map((price) => [price.productCode, price.price]),
  );
  const rows = Array.from({ length: count }, (_, index) => {
    const customer = customers[index % customers.length];
    const product = products[index % products.length];
    const issue = getSampleIssue(index);
    const basePrice = pricesByProductCode.get(product.productCode) ?? 10000;
    const quantity = issue === "대량 거래 확인" ? 150 + (index % 25) : ((index * 7) % 95) + 1;
    const unitPrice = issue === "단가 기준 불일치" ? basePrice + 1200 : basePrice;
    const salesAmount = issue === "금액 불일치" ? quantity * unitPrice + 5000 : quantity * unitPrice;

    return {
      rowNo: index + 1,
      transactionDate: formatSampleDate(index),
      rawCustomerName: issue === "거래처 누락" ? "" : customer.customerName,
      rawProductName: product.productName,
      customerCode: issue === "거래처 누락" ? null : customer.customerCode,
      productCode: issue === "품목 코드 누락" ? null : product.productCode,
      quantity,
      unitPrice,
      salesAmount,
      validationStatus: issue,
      reviewStatus: issue === "정상" ? "DONE" : "WAITING",
      ownerName: sampleOwners[index % sampleOwners.length],
    };
  });

  for (let index = 24; index < rows.length; index += 57) {
    const sourceIndex = Math.max(index - 3, 0);
    rows[index] = {
      ...rows[sourceIndex],
      rowNo: index + 1,
      validationStatus: "중복 의심",
      reviewStatus: "WAITING",
      ownerName: sampleOwners[index % sampleOwners.length],
    };
  }

  return rows;
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
  const packages = database
    .prepare(
      `
    SELECT
      package_id AS packageId,
      package_name AS packageName,
      closing_month AS closingMonth,
      output_folder_path AS outputFolderPath,
      status,
      created_at AS createdAt
    FROM send_packages
    ORDER BY package_id DESC
    LIMIT 20
  `,
    )
    .all();

  const getItems = database.prepare(`
    SELECT
      item_id AS itemId,
      package_id AS packageId,
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
    FROM send_package_items
    WHERE package_id = @packageId
    ORDER BY item_id
  `);

  return packages.map((sendPackage) => {
    const items = getItems.all({ packageId: sendPackage.packageId });
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
    FROM send_packages
    WHERE package_id = @packageId
  `,
    )
    .get({ packageId });

  if (!sendPackage) {
    throw new Error("발송 패키지를 찾을 수 없습니다.");
  }

  const items = database
    .prepare(
      `
    SELECT item_id AS itemId, customer_code AS customerCode
    FROM send_package_items
    WHERE package_id = @packageId
    ORDER BY item_id
  `,
    )
    .all({ packageId });

  const updateItem = database.prepare(`
    UPDATE send_package_items
    SET
      attachment_pdf_path = @attachmentPdfPath,
      attachment_xlsx_path = @attachmentXlsxPath,
      status = CASE
        WHEN status IN ('READY', 'CREATED') THEN 'READY'
        ELSE status
      END
    WHERE item_id = @itemId
  `);
  const insertEvent = database.prepare(`
    INSERT INTO app_events (level, message, meta_json)
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
    UPDATE send_package_items
    SET
      status = @status,
      sent_checked_at = CASE
        WHEN @status IN ('SENT', 'REPLIED', 'CLOSED') THEN CURRENT_TIMESTAMP
        ELSE sent_checked_at
      END,
      memo = @memo
    WHERE item_id = @itemId
  `);
  const insertEvent = database.prepare(`
    INSERT INTO app_events (level, message, meta_json)
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

function createSampleSendPackage(database) {
  seedMasterData(database);
  const templates = getMessageTemplates(database);
  const template = templates[0];
  const contacts = getMasterData(database).contacts.slice(0, 4);
  const closingMonth = getClosingMonth();
  const packageName = `REQ-${closingMonth.replace("-", "")}-SAMPLE`;
  const outputFolderPath = `exports/request/${closingMonth.replace("-", "")}`;

  const insertPackage = database.prepare(`
    INSERT INTO send_packages (package_name, closing_month, output_folder_path, status)
    VALUES (@packageName, @closingMonth, @outputFolderPath, 'CREATED')
  `);
  const insertItem = database.prepare(`
    INSERT INTO send_package_items (
      package_id,
      customer_code,
      contact_id,
      customer_name,
      recipient_email,
      recipient_phone,
      channel,
      subject,
      body,
      attachment_pdf_path,
      attachment_xlsx_path,
      status,
      memo
    )
    VALUES (
      @packageId,
      @customerCode,
      @contactId,
      @customerName,
      @recipientEmail,
      @recipientPhone,
      @channel,
      @subject,
      @body,
      @attachmentPdfPath,
      @attachmentXlsxPath,
      'READY',
      @memo
    )
  `);
  const insertEvent = database.prepare(`
    INSERT INTO app_events (level, message, meta_json)
    VALUES ('INFO', @message, @metaJson)
  `);

  const applyTemplate = (text, contact) =>
    String(text ?? "")
      .replaceAll("{{closing_month}}", closingMonth)
      .replaceAll(
        "{{customer_name}}",
        contact.customerName ?? contact.customerCode ?? "거래처",
      );

  const transaction = database.transaction(() => {
    const packageResult = insertPackage.run({
      packageName,
      closingMonth,
      outputFolderPath,
    });
    const packageId = packageResult.lastInsertRowid;

    contacts.forEach((contact) => {
      insertItem.run({
        packageId,
        customerCode: contact.customerCode,
        contactId: contact.contactId,
        customerName: contact.customerName,
        recipientEmail: contact.recipientEmail,
        recipientPhone: contact.recipientPhone,
        channel: contact.preferredChannel ?? "EMAIL",
        subject: applyTemplate(template.subjectTemplate, contact),
        body: applyTemplate(template.bodyTemplate, contact),
        attachmentPdfPath: `${outputFolderPath}/${contact.customerCode}.pdf`,
        attachmentXlsxPath: `${outputFolderPath}/${contact.customerCode}.xlsx`,
        memo: "샘플 발송 패키지 항목",
      });
    });

    insertEvent.run({
      message: "샘플 발송 패키지를 준비했습니다.",
      metaJson: toJson({ packageId, itemCount: contacts.length }),
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
    customerAliases: database
      .prepare(
        `
      SELECT customer_aliases.alias_id AS aliasId, customer_aliases.customer_code AS customerCode, customers.customer_name AS customerName, customer_aliases.alias_name AS aliasName, customer_aliases.source, customer_aliases.confidence, customer_aliases.status
      FROM customer_aliases
      LEFT JOIN customers ON customers.customer_code = customer_aliases.customer_code
      ORDER BY customer_aliases.alias_id DESC
      LIMIT 50
    `,
      )
      .all(),
    products: database
      .prepare(
        `
      SELECT product_code AS productCode, product_name AS productName, unit, status, memo
      FROM products
      ORDER BY product_name
    `,
      )
      .all(),
    productAliases: database
      .prepare(
        `
      SELECT product_aliases.alias_id AS aliasId, product_aliases.product_code AS productCode, products.product_name AS productName, product_aliases.alias_name AS aliasName, product_aliases.source, product_aliases.confidence, product_aliases.status
      FROM product_aliases
      LEFT JOIN products ON products.product_code = product_aliases.product_code
      ORDER BY product_aliases.alias_id DESC
      LIMIT 50
    `,
      )
      .all(),
    prices: database
      .prepare(
        `
      SELECT sales_prices.price_id AS priceId, sales_prices.customer_code AS customerCode, customers.customer_name AS customerName, sales_prices.product_code AS productCode, products.product_name AS productName, sales_prices.price, sales_prices.currency, sales_prices.start_date AS startDate, sales_prices.status, sales_prices.change_reason AS changeReason
      FROM sales_prices
      LEFT JOIN customers ON customers.customer_code = sales_prices.customer_code
      LEFT JOIN products ON products.product_code = sales_prices.product_code
      ORDER BY sales_prices.price_id DESC
      LIMIT 50
    `,
      )
      .all(),
    suggestions: database
      .prepare(
        `
      SELECT suggestion_id AS suggestionId, target_type AS targetType, raw_value AS rawValue, suggested_code AS suggestedCode, suggested_name AS suggestedName, confidence, status
      FROM mapping_suggestions
      ORDER BY suggestion_id DESC
      LIMIT 50
    `,
      )
      .all(),
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
    INSERT INTO app_events (level, message, meta_json)
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

function seedMasterData(database) {
  const insertDepartment = database.prepare(`
    INSERT OR IGNORE INTO departments (department_code, department_name, status)
    VALUES (@departmentCode, @departmentName, 'ACTIVE')
  `);
  const insertCustomer = database.prepare(`
    INSERT OR IGNORE INTO customers (customer_code, customer_name, business_number, tax_status, memo)
    VALUES (@customerCode, @customerName, @businessNumber, @taxStatus, @memo)
  `);
  const insertCustomerAlias = database.prepare(`
    INSERT OR IGNORE INTO customer_aliases (customer_code, alias_name, source, confidence)
    VALUES (@customerCode, @aliasName, @source, @confidence)
  `);
  const insertProduct = database.prepare(`
    INSERT OR IGNORE INTO products (product_code, product_name, unit, memo)
    VALUES (@productCode, @productName, @unit, @memo)
  `);
  const insertProductAlias = database.prepare(`
    INSERT OR IGNORE INTO product_aliases (product_code, alias_name, source, confidence)
    VALUES (@productCode, @aliasName, @source, @confidence)
  `);
  const insertPrice = database.prepare(`
    INSERT OR IGNORE INTO sales_prices (price_id, customer_code, product_code, price, currency, start_date, version, status, change_reason, approved_department_code)
    VALUES (@priceId, @customerCode, @productCode, @price, 'KRW', @startDate, 1, 'ACTIVE', @changeReason, 'GENERAL_AFFAIRS')
  `);
  const insertContact = database.prepare(`
    INSERT OR IGNORE INTO contacts (contact_id, customer_code, department_name, recipient_name, recipient_email, preferred_channel, memo)
    VALUES (@contactId, @customerCode, @departmentName, @recipientName, @recipientEmail, @preferredChannel, @memo)
  `);
  const insertSuggestion = database.prepare(`
    INSERT OR IGNORE INTO mapping_suggestions (suggestion_id, target_type, raw_value, suggested_code, suggested_name, confidence, status, approved_department_code)
    VALUES (@suggestionId, @targetType, @rawValue, @suggestedCode, @suggestedName, @confidence, 'PENDING', 'GENERAL_AFFAIRS')
  `);
  const insertEvent = database.prepare(`
    INSERT INTO app_events (level, message, meta_json)
    VALUES ('INFO', @message, @metaJson)
  `);

  const transaction = database.transaction(() => {
    seedDepartments.forEach((item) => insertDepartment.run(item));
    [...seedCustomers, ...supplementalSeedCustomers].forEach((item) =>
      insertCustomer.run(item),
    );
    seedCustomerAliases.forEach((item) => insertCustomerAlias.run(item));
    [...seedProducts, ...supplementalSeedProducts].forEach((item) =>
      insertProduct.run(item),
    );
    seedProductAliases.forEach((item) => insertProductAlias.run(item));
    [...seedPrices, ...supplementalSeedPrices].forEach((item) =>
      insertPrice.run(item),
    );
    [...seedContacts, ...supplementalSeedContacts].forEach((item) =>
      insertContact.run(item),
    );
    seedSuggestions.forEach((item) => insertSuggestion.run(item));
    insertEvent.run({
      message: "기준 데이터 샘플을 SQLite에 준비했습니다.",
      metaJson: toJson({
        customers: seedCustomers.length + supplementalSeedCustomers.length,
        products: seedProducts.length + supplementalSeedProducts.length,
        prices: seedPrices.length + supplementalSeedPrices.length,
      }),
    });
  });

  transaction();
  return getMasterData(database);
}

function ensureCoreBusinessData(database) {
  const countTable = (tableName) => database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
  const insertEvent = database.prepare(`
    INSERT INTO app_events (level, message, meta_json)
    VALUES ('INFO', @message, @metaJson)
  `);

  seedMasterData(database);

  const transaction = database.transaction(() => {
    if (countTable("users") === 0) {
      database.prepare(`
        INSERT INTO users (username, display_name, password_hash, role, department_code, status)
        VALUES ('황주은', '황주은', '0000', 'ADMIN', 'GENERAL_AFFAIRS', 'ACTIVE')
      `).run();
    }

    if (countTable("sales_uploads") > 0 && countTable("sales_rows") > 0) {
      return;
    }

    const savedAt = new Date().toISOString();
    const salesRows = buildSeedSalesRows(1200);
    const columns = ["거래일", "거래처", "품목 코드", "품목명", "수량", "단가", "금액", "검증", "담당자"];
    const payload = {
      fileName: "sample_sales_1200.xlsx",
      columns,
      rows: salesRows.map((row) => [
        row.transactionDate,
        row.rawCustomerName,
        row.productCode ?? "",
        row.rawProductName,
        formatNumber(row.quantity),
        formatNumber(row.unitPrice),
        formatNumber(row.salesAmount),
        row.validationStatus,
        row.ownerName,
      ]),
      savedAt,
      source: "seed",
    };
    const snapshot = database.prepare(`
      INSERT INTO workspace_snapshots (file_name, payload_json, saved_at)
      VALUES (@fileName, @payloadJson, @savedAt)
    `).run({
      fileName: payload.fileName,
      payloadJson: toJson(payload),
      savedAt,
    });
    const upload = database.prepare(`
      INSERT INTO sales_uploads (snapshot_id, file_name, closing_month, uploaded_department_code, uploaded_at, status, memo)
      VALUES (@snapshotId, @fileName, @closingMonth, 'GENERAL_AFFAIRS', @uploadedAt, 'SEEDED', @memo)
    `).run({
      snapshotId: snapshot.lastInsertRowid,
      fileName: payload.fileName,
      closingMonth: "2026-05",
      uploadedAt: savedAt,
      memo: "초기 원본 매출 데이터",
    });
    const insertSalesRow = database.prepare(`
      INSERT INTO sales_rows (
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

    salesRows.forEach((row) => insertSalesRow.run({
      ...row,
      uploadId: upload.lastInsertRowid,
    }));
    database.prepare(`
      INSERT INTO recent_files (file_name, row_count, column_count, opened_at)
      VALUES (@fileName, @rowCount, @columnCount, @openedAt)
    `).run({
      fileName: payload.fileName,
      rowCount: salesRows.length,
      columnCount: columns.length,
      openedAt: savedAt,
    });
    insertEvent.run({
      message: "핵심 업무 테이블 초기 데이터를 준비했습니다.",
      metaJson: toJson({
        users: countTable("users"),
        customers: countTable("customers"),
        products: countTable("products"),
        salesUploads: countTable("sales_uploads"),
        salesRows: countTable("sales_rows"),
      }),
    });
  });

  transaction();
  return {
    users: countTable("users"),
    customers: countTable("customers"),
    products: countTable("products"),
    salesUploads: countTable("sales_uploads"),
    salesRows: countTable("sales_rows"),
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
      .prepare("SELECT COUNT(*) AS count FROM app_events")
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
      "customers",
      "products",
      "sales_prices",
      "sales_uploads",
      "sales_rows",
      "validation_issues",
      "workspace_snapshots",
      "recent_files",
      "send_packages",
      "send_package_items",
      "message_templates",
      "contacts",
      "department_requests",
      "closing_companies",
      "app_events",
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
        FROM app_events
        ORDER BY id DESC
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
      INSERT INTO app_events (level, message, meta_json)
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
      SELECT id, level, message, meta_json AS metaJson, created_at AS createdAt
      FROM app_events
      ORDER BY id DESC
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
      SELECT id, file_name AS fileName, file_path AS filePath, row_count AS rowCount, column_count AS columnCount, opened_at AS openedAt
      FROM recent_files
      ORDER BY opened_at DESC, id DESC
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

  ipcMain.handle("master-data:seed", () => {
    const database = getDatabase(app);
    return {
      ok: true,
      ...seedMasterData(database),
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

  ipcMain.handle("send-packages:create-sample", () => {
    const database = getDatabase(app);
    return {
      ok: true,
      packages: createSampleSendPackage(database),
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
    console.log("[debug:data-query:main] rows sample", result?.data?.rows?.slice(0, 3));
    return result;
  });

  ipcMain.handle("dashboard:sales-daily", (_, options) => {
    const database = getDatabase(app);
    return getDailySalesTrend(database, options?.limit);
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
    const insertUpload = database.prepare(`
      INSERT INTO sales_uploads (snapshot_id, file_name, closing_month, uploaded_department_code, uploaded_at, status)
      VALUES (@snapshotId, @fileName, @closingMonth, @departmentCode, @uploadedAt, @status)
    `);
    const insertRow = database.prepare(`
      INSERT INTO sales_rows (
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
    const insertValidationSummary = database.prepare(`
      INSERT INTO validation_results (snapshot_id, issue_count, duplicate_count, review_count)
      VALUES (@snapshotId, @issueCount, @duplicateCount, @reviewCount)
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

      insertValidationSummary.run({
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
