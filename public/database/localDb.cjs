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
  'admin',
  '관리자',
  NULL,
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

`);

  return db;
}

function toJson(value) {
  return JSON.stringify(value ?? null);
}

function getColumnIndex(columns, name) {
  return Array.isArray(columns) ? columns.findIndex((column) => column === name) : -1;
}

function getCell(row, index) {
  return index >= 0 ? row[index] : undefined;
}

function parseNumber(value) {
  const number = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(number) ? number : null;
}

function getClosingMonth() {
  return new Date().toISOString().slice(0, 7);
}

const seedDepartments = [
  { departmentCode: "GENERAL_AFFAIRS", departmentName: "총무팀" },
  { departmentCode: "SALES", departmentName: "영업팀" },
  { departmentCode: "LOGISTICS", departmentName: "물류팀" },
];

const seedCustomers = [
  { customerCode: "CUST-001", customerName: "한빛유통", businessNumber: "101-81-00001", taxStatus: "ACTIVE", memo: "월마감 검수 대상" },
  { customerCode: "CUST-002", customerName: "세종오피스", businessNumber: "102-82-00002", taxStatus: "ACTIVE", memo: "사무용품 정기 거래처" },
  { customerCode: "CUST-003", customerName: "모블상사", businessNumber: "103-83-00003", taxStatus: "ACTIVE", memo: "제품명 별칭 확인 필요" },
  { customerCode: "CUST-004", customerName: "대원시스템", businessNumber: "104-84-00004", taxStatus: "ACTIVE", memo: "단가 기준 변경 이력 관리" },
  { customerCode: "CUST-005", customerName: "청담리테일", businessNumber: "105-85-00005", taxStatus: "ACTIVE", memo: "신규 거래처" },
];

const seedCustomerAliases = [
  { customerCode: "CUST-001", aliasName: "한빛 유통", source: "SEED", confidence: 0.98 },
  { customerCode: "CUST-001", aliasName: "(주)한빛유통", source: "SEED", confidence: 0.96 },
  { customerCode: "CUST-002", aliasName: "세종 오피스", source: "SEED", confidence: 0.97 },
  { customerCode: "CUST-003", aliasName: "모블상사 주식회사", source: "SEED", confidence: 0.94 },
  { customerCode: "CUST-004", aliasName: "대원 시스템", source: "SEED", confidence: 0.95 },
];

const seedProducts = [
  { productCode: "PAPER-A4-001", productName: "A4 복사용지", unit: "BOX", memo: "박스 단위" },
  { productCode: "TONER-BLK-2108", productName: "흑백 토너 2108", unit: "EA", memo: "프린터 소모품" },
  { productCode: "USB-HUB-04", productName: "4포트 USB 허브", unit: "EA", memo: "전산 비품" },
  { productCode: "CABLE-MEET-01", productName: "회의실 HDMI 케이블", unit: "EA", memo: "회의실 소모품" },
  { productCode: "LABEL-STK-02", productName: "라벨 스티커", unit: "PACK", memo: "물류 라벨" },
];

const seedProductAliases = [
  { productCode: "PAPER-A4-001", aliasName: "A4 용지", source: "SEED", confidence: 0.98 },
  { productCode: "PAPER-A4-001", aliasName: "복사용지 A4", source: "SEED", confidence: 0.97 },
  { productCode: "TONER-BLK-2108", aliasName: "토너 2108", source: "SEED", confidence: 0.96 },
  { productCode: "USB-HUB-04", aliasName: "USB 허브 4P", source: "SEED", confidence: 0.95 },
  { productCode: "CABLE-MEET-01", aliasName: "HDMI 케이블", source: "SEED", confidence: 0.93 },
];

const seedPrices = [
  { priceId: 90001, customerCode: "CUST-001", productCode: "PAPER-A4-001", price: 24500, startDate: "2026-01-01", changeReason: "기본 샘플 단가" },
  { priceId: 90002, customerCode: "CUST-001", productCode: "TONER-BLK-2108", price: 78000, startDate: "2026-01-01", changeReason: "기본 샘플 단가" },
  { priceId: 90003, customerCode: "CUST-002", productCode: "USB-HUB-04", price: 18900, startDate: "2026-01-01", changeReason: "기본 샘플 단가" },
  { priceId: 90004, customerCode: "CUST-003", productCode: "CABLE-MEET-01", price: 9200, startDate: "2026-01-01", changeReason: "기본 샘플 단가" },
  { priceId: 90005, customerCode: "CUST-004", productCode: "LABEL-STK-02", price: 13200, startDate: "2026-01-01", changeReason: "기본 샘플 단가" },
];

const seedContacts = [
  { contactId: 90001, customerCode: "CUST-001", departmentName: "정산팀", recipientName: "한빛 정산담당", recipientEmail: "settle@hanbit.example", preferredChannel: "EMAIL", memo: "샘플 연락처" },
  { contactId: 90002, customerCode: "CUST-002", departmentName: "영업지원", recipientName: "세종 영업지원", recipientEmail: "sales@sejong.example", preferredChannel: "EMAIL", memo: "샘플 연락처" },
  { contactId: 90003, customerCode: "CUST-003", departmentName: "관리팀", recipientName: "모블 관리담당", recipientEmail: "admin@moble.example", preferredChannel: "KAKAO", memo: "카카오 공유 대상" },
  { contactId: 90004, customerCode: "CUST-004", departmentName: "총무팀", recipientName: "대원 총무담당", recipientEmail: "admin@daewon.example", preferredChannel: "EMAIL", memo: "샘플 연락처" },
];

const seedSuggestions = [
  { suggestionId: 90001, targetType: "CUSTOMER", rawValue: "한빛 유통", suggestedCode: "CUST-001", suggestedName: "한빛유통", confidence: 0.98 },
  { suggestionId: 90002, targetType: "PRODUCT", rawValue: "USB 허브 4P", suggestedCode: "USB-HUB-04", suggestedName: "4포트 USB 허브", confidence: 0.95 },
  { suggestionId: 90003, targetType: "PRODUCT", rawValue: "A4 용지", suggestedCode: "PAPER-A4-001", suggestedName: "A4 복사용지", confidence: 0.98 },
];

const defaultMessageTemplates = [
  {
    templateId: 1,
    templateName: "거래처 검수 협조 요청",
    channel: "EMAIL",
    subjectTemplate: "[확인 요청] {{closing_month}} 매출 자료 검수 협조 요청드립니다",
    bodyTemplate: "안녕하세요. {{customer_name}} 담당자님.\n\n첨부드린 {{closing_month}} 매출 자료 중 확인이 필요한 항목이 있어 공유드립니다. 바쁘시겠지만 첨부 파일을 확인하신 뒤 수정이 필요한 내용이나 추가로 맞춰야 할 기준이 있다면 회신 부탁드립니다.\n\n확인 부탁드립니다.\n감사합니다.",
    tone: "COOPERATIVE",
    status: "ACTIVE",
  },
  {
    templateId: 2,
    templateName: "첨부 파일 재확인 요청",
    channel: "EMAIL",
    subjectTemplate: "[재확인 요청] {{customer_name}} 첨부 자료 확인 부탁드립니다",
    bodyTemplate: "안녕하세요. {{customer_name}} 담당자님.\n\n공유드린 자료 중 일부 항목의 기준값이 맞지 않아 재확인을 요청드립니다. 첨부 파일의 표시된 행을 확인하신 뒤, 실제 적용해야 할 거래처 코드와 품목 기준을 알려주시면 마감 자료에 반영하겠습니다.\n\n감사합니다.",
    tone: "POLITE",
    status: "ACTIVE",
  },
  {
    templateId: 3,
    templateName: "마감 확인 완료 안내",
    channel: "EMAIL",
    subjectTemplate: "[확인 완료] {{closing_month}} 매출 자료 검수 완료 안내",
    bodyTemplate: "안녕하세요. {{customer_name}} 담당자님.\n\n{{closing_month}} 매출 자료 검수가 완료되어 안내드립니다. 추가 확인이 필요한 항목은 현재 없으며, 이후 마감 기준 변경이나 정정 요청이 발생하면 별도로 공유드리겠습니다.\n\n협조해주셔서 감사합니다.",
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
  return database.prepare(`
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
  `).all();
}

function getMasterData(database) {
  return {
    customers: database.prepare(`
      SELECT customer_code AS customerCode, customer_name AS customerName, business_number AS businessNumber, tax_status AS taxStatus, status, memo
      FROM customers
      ORDER BY customer_name
    `).all(),
    customerAliases: database.prepare(`
      SELECT customer_aliases.alias_id AS aliasId, customer_aliases.customer_code AS customerCode, customers.customer_name AS customerName, customer_aliases.alias_name AS aliasName, customer_aliases.source, customer_aliases.confidence, customer_aliases.status
      FROM customer_aliases
      LEFT JOIN customers ON customers.customer_code = customer_aliases.customer_code
      ORDER BY customer_aliases.alias_id DESC
      LIMIT 50
    `).all(),
    products: database.prepare(`
      SELECT product_code AS productCode, product_name AS productName, unit, status, memo
      FROM products
      ORDER BY product_name
    `).all(),
    productAliases: database.prepare(`
      SELECT product_aliases.alias_id AS aliasId, product_aliases.product_code AS productCode, products.product_name AS productName, product_aliases.alias_name AS aliasName, product_aliases.source, product_aliases.confidence, product_aliases.status
      FROM product_aliases
      LEFT JOIN products ON products.product_code = product_aliases.product_code
      ORDER BY product_aliases.alias_id DESC
      LIMIT 50
    `).all(),
    prices: database.prepare(`
      SELECT sales_prices.price_id AS priceId, sales_prices.customer_code AS customerCode, customers.customer_name AS customerName, sales_prices.product_code AS productCode, products.product_name AS productName, sales_prices.price, sales_prices.currency, sales_prices.start_date AS startDate, sales_prices.status, sales_prices.change_reason AS changeReason
      FROM sales_prices
      LEFT JOIN customers ON customers.customer_code = sales_prices.customer_code
      LEFT JOIN products ON products.product_code = sales_prices.product_code
      ORDER BY sales_prices.price_id DESC
      LIMIT 50
    `).all(),
    suggestions: database.prepare(`
      SELECT suggestion_id AS suggestionId, target_type AS targetType, raw_value AS rawValue, suggested_code AS suggestedCode, suggested_name AS suggestedName, confidence, status
      FROM mapping_suggestions
      ORDER BY suggestion_id DESC
      LIMIT 50
    `).all(),
    contacts: database.prepare(`
      SELECT contacts.contact_id AS contactId, contacts.customer_code AS customerCode, customers.customer_name AS customerName, contacts.department_name AS departmentName, contacts.recipient_name AS recipientName, contacts.recipient_email AS recipientEmail, contacts.preferred_channel AS preferredChannel, contacts.status
      FROM contacts
      LEFT JOIN customers ON customers.customer_code = contacts.customer_code
      ORDER BY contacts.contact_id DESC
      LIMIT 50
    `).all(),
  };
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
    seedCustomers.forEach((item) => insertCustomer.run(item));
    seedCustomerAliases.forEach((item) => insertCustomerAlias.run(item));
    seedProducts.forEach((item) => insertProduct.run(item));
    seedProductAliases.forEach((item) => insertProductAlias.run(item));
    seedPrices.forEach((item) => insertPrice.run(item));
    seedContacts.forEach((item) => insertContact.run(item));
    seedSuggestions.forEach((item) => insertSuggestion.run(item));
    insertEvent.run({
      message: "기준 데이터 샘플을 SQLite에 준비했습니다.",
      metaJson: toJson({ customers: seedCustomers.length, products: seedProducts.length, prices: seedPrices.length }),
    });
  });

  transaction();
  return getMasterData(database);
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
      "app_events",
    ];

    const counts = tables.map((tableName) => {
      const row = database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get();
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

  ipcMain.handle("message-templates:get", () => {
    const database = getDatabase(app);
    return {
      ok: true,
      templates: getMessageTemplates(database),
    };
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
        raw_customer_name,
        raw_product_name,
        customer_code,
        product_code,
        quantity,
        unit_price,
        sales_amount,
        validation_status,
        review_status
      )
      VALUES (
        @uploadId,
        @rowNo,
        @rawCustomerName,
        @rawProductName,
        @customerCode,
        @productCode,
        @quantity,
        @unitPrice,
        @salesAmount,
        @validationStatus,
        @reviewStatus
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
          rawCustomerName: getCell(row, indexes.customerName),
          rawProductName: getCell(row, indexes.productName),
          customerCode: getCell(row, indexes.customerCode),
          productCode: getCell(row, indexes.productCode),
          quantity: parseNumber(getCell(row, indexes.quantity)),
          unitPrice: parseNumber(getCell(row, indexes.unitPrice)),
          salesAmount: parseNumber(getCell(row, indexes.amount)),
          validationStatus: status,
          reviewStatus,
        });

        const issues = data?.validationIssues?.[rowIndex] ?? [];
        issues.forEach((message) => {
          issueCount += 1;
          if (String(message).includes("중복") || String(message).includes("같습니다")) {
            duplicateCount += 1;
          } else {
            reviewCount += 1;
          }
          insertIssue.run({
            uploadId: upload.lastInsertRowid,
            rowId: rowResult.lastInsertRowid,
            errorType: String(message).includes("중복") || String(message).includes("같습니다") ? "DUPLICATE" : "VALIDATION",
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
        metaJson: toJson({ snapshotId: snapshot.lastInsertRowid, uploadId: upload.lastInsertRowid }),
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
