PRAGMA foreign_keys = ON;

-- 이전 실행이 중간에 멈췄거나 재실행된 경우 시드 데이터만 정리
DELETE FROM validation_issues
WHERE upload_id IN (1001, 2003, 2004, 2005, 2006);

DELETE FROM sales
WHERE upload_id IN (1001, 2003, 2004, 2005, 2006);

DELETE FROM email_history
WHERE email_id BETWEEN 1001 AND 1099
   OR upload_id IN (1001, 2003, 2004, 2005, 2006);

DELETE FROM reports WHERE report_id BETWEEN 1001 AND 1099;
DELETE FROM sales_uploads WHERE upload_id IN (1001, 2003, 2004, 2005, 2006);
DELETE FROM workspace_snapshots WHERE id IN (1001, 2003, 2004, 2005, 2006);
DELETE FROM contacts WHERE contact_id BETWEEN 1001 AND 1099;
DELETE FROM activity_logs WHERE target_id IN ('1001', '2003', '2004', '2005', '2006');
DELETE FROM notifications WHERE client_id LIKE 'seed-notice-%';

INSERT OR REPLACE INTO products
  (product_code, product_name, unit, unit_price, currency, status, memo)
VALUES
  ('PAPER-A4-001', 'A4 복사용지', 'BOX', 24500, 'KRW', 'ACTIVE', '박스 단위'),
  ('TONER-BLK-2108', '흑백 토너 2108', 'EA', 78000, 'KRW', 'ACTIVE', '프린터 소모품'),
  ('USB-HUB-04', '4포트 USB 허브', 'EA', 18900, 'KRW', 'ACTIVE', '전산 비품'),
  ('CABLE-HDMI-01', 'HDMI 케이블', 'EA', 9200, 'KRW', 'ACTIVE', '회의실 비품'),
  ('LABEL-STK-02', '라벨 스티커', 'PACK', 13200, 'KRW', 'ACTIVE', '물류 라벨'),
  ('PEN-GEL-05', '젤펜 0.5mm', 'BOX', 12600, 'KRW', 'ACTIVE', '필기구'),
  ('FILE-LVR-03', '레버 파일', 'BOX', 18900, 'KRW', 'ACTIVE', '문서 보관용'),
  ('TAPE-OPP-48', 'OPP 박스테이프', 'ROLL', 4200, 'KRW', 'ACTIVE', '포장 소모품');

INSERT OR REPLACE INTO customers
  (customer_code, customer_name, business_number, tax_status, status, memo)
VALUES
  ('CUST-001', '한빛유통', '101-81-00001', 'ACTIVE', 'ACTIVE', '월 마감 거래처'),
  ('CUST-002', '세종오피스', '102-82-00002', 'ACTIVE', 'ACTIVE', '사무용품 정기 거래처'),
  ('CUST-003', '모블상사', '103-83-00003', 'ACTIVE', 'ACTIVE', '제품 코드 확인 필요'),
  ('CUST-004', '대원시스템', '104-84-00004', 'ACTIVE', 'ACTIVE', '전산 비품 거래처'),
  ('CUST-005', '청담리테일', '105-85-00005', 'ACTIVE', 'ACTIVE', '신규 거래처');

INSERT OR REPLACE INTO users
  (user_id, username, display_name, password_hash, role, department_name, status)
VALUES
  (1, 'admin', '황주은', '0000', 'ADMIN', '총무팀', 'ACTIVE'),
  (2, 'sales01', '김민서', '0000', 'MANAGER', '영업팀', 'ACTIVE');

INSERT INTO workspace_snapshots
  (id, file_name, file_path, payload_json, row_count, column_count,
   issue_count, duplicate_count, review_count, saved_at)
VALUES
  (1001, '2026년_6월_매출.xlsx', 'C:\test\2026년_6월_매출.xlsx',
   '{"source":"TEST_SEED","description":"화면 테스트용 매출 자료"}',
   15, 9, 4, 1, 3, '2026-06-18 09:00:00');

INSERT INTO sales_uploads
  (upload_id, snapshot_id, file_name, file_path, closing_month,
   uploaded_department_code, uploaded_at, status, memo)
VALUES
  (1001, 1001, '2026년_6월_매출.xlsx', 'C:\test\2026년_6월_매출.xlsx',
   '2026-06', '영업팀', '2026-06-18 09:00:00', 'UPLOADED', '테스트 데이터');

INSERT INTO sales
  (row_id, upload_id, row_no, transaction_date, raw_customer_name,
   raw_product_name, customer_code, product_code, quantity, unit_price,
   sales_amount, validation_status, review_status, owner_name)
VALUES
  (1001, 1001, 1, '2026-06-01', '한빛유통', 'A4 복사용지', 'CUST-001', 'PAPER-A4-001', 20, 24500, 490000, '정상', 'DONE', '김민서'),
  (1002, 1001, 2, '2026-06-02', '세종오피스', '흑백 토너 2108', 'CUST-002', 'TONER-BLK-2108', 5, 78000, 390000, '정상', 'DONE', '김민서'),
  (1003, 1001, 3, '2026-06-03', '모블상사', '4포트 USB 허브', 'CUST-003', 'USB-HUB-04', 30, 18900, 567000, '정상', 'DONE', '김민서'),
  (1004, 1001, 4, '2026-06-04', '대원시스템', 'HDMI 케이블', 'CUST-004', 'CABLE-HDMI-01', 12, 9200, 110400, '정상', 'DONE', '김민서'),
  (1005, 1001, 5, '2026-06-05', '청담리테일', '라벨 스티커', 'CUST-005', 'LABEL-STK-02', 50, 13200, 660000, '정상', 'DONE', '김민서'),
  (1006, 1001, 6, '2026-06-06', '한빛유통', '젤펜 0.5mm', 'CUST-001', 'PEN-GEL-05', 25, 12600, 315000, '정상', 'DONE', '김민서'),
  (1007, 1001, 7, '2026-06-07', '세종오피스', '레버 파일', 'CUST-002', 'FILE-LVR-03', 15, 18900, 283500, '정상', 'DONE', '김민서'),
  (1008, 1001, 8, '2026-06-08', '모블상사', 'OPP 박스테이프', 'CUST-003', 'TAPE-OPP-48', 100, 4200, 420000, '대량 거래 확인', 'WAITING', '김민서'),
  (1009, 1001, 9, '2026-06-09', '대원시스템', 'A4 복사용지', 'CUST-004', 'PAPER-A4-001', 10, 25000, 250000, '단가 불일치', 'WAITING', '김민서'),
  (1010, 1001, 10, '2026-06-10', '청담리테일', '흑백 토너 2108', 'CUST-005', 'TONER-BLK-2108', 3, 78000, 230000, '금액 불일치', 'WAITING', '김민서'),
  (1011, 1001, 11, '2026-06-11', '한빛유통', '4포트 USB 허브', 'CUST-001', 'USB-HUB-04', 150, 18900, 2835000, '대량 거래 확인', 'WAITING', '김민서'),
  (1012, 1001, 12, '2026-06-12', '세종오피스', 'HDMI 케이블', 'CUST-002', 'CABLE-HDMI-01', 8, 9200, 73600, '정상', 'DONE', '김민서'),
  (1013, 1001, 13, '2026-06-13', '모블상사', '라벨 스티커', 'CUST-003', 'LABEL-STK-02', 40, 13200, 528000, '정상', 'DONE', '김민서'),
  (1014, 1001, 14, '2026-06-14', '대원시스템', '젤펜 0.5mm', 'CUST-004', 'PEN-GEL-05', 20, 12600, 252000, '정상', 'DONE', '김민서'),
  (1015, 1001, 15, '2026-06-14', '대원시스템', '젤펜 0.5mm', 'CUST-004', 'PEN-GEL-05', 20, 12600, 252000, '중복 의심', 'WAITING', '김민서');

INSERT INTO validation_issues
  (upload_id, row_id, error_type, severity, message,
   expected_value, actual_value, assigned_department_code, status)
VALUES
  (1001, 1009, 'PRICE_MISMATCH', 'WARNING', '등록된 제품 단가와 다릅니다.', '24500', '25000', '영업팀', 'OPEN'),
  (1001, 1010, 'AMOUNT_MISMATCH', 'ERROR', '수량과 단가를 곱한 금액이 실제 금액과 다릅니다.', '234000', '230000', '영업팀', 'OPEN'),
  (1001, 1011, 'BULK_QUANTITY', 'WARNING', '대량 거래 확인이 필요합니다.', '100 미만', '150', '영업팀', 'OPEN'),
  (1001, 1015, 'DUPLICATE', 'WARNING', '14번 행과 중복된 거래입니다.', NULL, NULL, '영업팀', 'OPEN');

INSERT INTO contacts
  (contact_id, customer_code, department_name, recipient_name,
   recipient_email, recipient_phone, preferred_channel, status, memo)
VALUES
  (1001, 'CUST-001', '정산팀', '오민지', 'settle@hanbit.example', '010-4210-1842', 'EMAIL', 'ACTIVE', NULL),
  (1002, 'CUST-002', '관리팀', '강소영', 'admin@sejong.example', '010-3188-5502', 'EMAIL', 'ACTIVE', NULL),
  (1003, 'CUST-003', '정산팀', '서가은', 'tax@moble.example', '010-9402-6620', 'EMAIL', 'ACTIVE', NULL),
  (1004, 'CUST-004', '관리팀', '윤나래', 'closing@daewon.example', '010-6104-0931', 'EMAIL', 'ACTIVE', NULL),
  (1005, 'CUST-005', '회계팀', '문하린', 'finance@cheongdam.example', '010-8890-7311', 'EMAIL', 'ACTIVE', NULL);

INSERT OR REPLACE INTO message_templates
  (template_id, template_name, channel, subject_template, body_template, tone, status)
VALUES
  (1, '거래처 검수 협조 요청', 'EMAIL',
   '[확인 요청] {{closing_month}} 매출 자료 검수 협조 요청드립니다',
   '{{customer_name}} 담당자님, 첨부드린 매출 자료 확인 부탁드립니다.',
   'COOPERATIVE', 'ACTIVE'),
  (2, '미회신 재요청', 'EMAIL',
   '[재확인 요청] {{closing_month}} 매출 자료',
   '이전에 전달드린 자료의 확인 결과를 회신 부탁드립니다.',
   'POLITE', 'ACTIVE');

INSERT INTO email_history
  (email_id, package_id, package_name, upload_id, closing_month,
   output_folder_path, customer_code, contact_id, customer_name,
   recipient_email, channel, subject, body, attachment_pdf_path,
   attachment_xlsx_path, status, sent_checked_at, memo)
VALUES
  (1001, 1001, 'REQ-202606-001', 1001, '2026-06', 'C:\test\exports\202606',
   'CUST-001', 1001, '한빛유통', 'settle@hanbit.example', 'EMAIL',
   '6월 매출 자료 확인 요청', '첨부 자료 확인 부탁드립니다.',
   'C:\test\exports\202606\CUST-001.pdf', 'C:\test\exports\202606\CUST-001.xlsx',
   'SENT', '2026-06-18 10:30:00', '1차 발송 완료'),
  (1002, 1001, 'REQ-202606-001', 1001, '2026-06', 'C:\test\exports\202606',
   'CUST-003', 1003, '모블상사', 'tax@moble.example', 'EMAIL',
   '6월 매출 자료 확인 요청', '첨부 자료 확인 부탁드립니다.',
   'C:\test\exports\202606\CUST-003.pdf', 'C:\test\exports\202606\CUST-003.xlsx',
   'READY', NULL, '발송 대기');

INSERT OR REPLACE INTO report_templates
  (template_id, report_name, report_type, description, default_format, status, version)
VALUES
  (1, '월간 매출 보고서', 'MONTHLY_SALES', '월별 매출 집계', 'XLSX', 'ACTIVE', 1),
  (2, '검증 오류 보고서', 'VALIDATION_ERRORS', '오류 행 상세 목록', 'PDF_XLSX', 'ACTIVE', 1);

INSERT INTO reports
  (report_id, template_id, upload_id, snapshot_id, report_name,
   report_type, closing_month, total_quantity, total_sales_amount,
   output_format, output_file_path, files_json, tags_json,
   options_json, status)
VALUES
  (1001, 1, 1001, 1001, '2026년 6월 매출 보고서',
   'MONTHLY_SALES', '2026-06', 488, 7623500,
   'XLSX', 'C:\test\reports\sales-202606.xlsx',
   '["sales-202606.xlsx"]', '["매출","6월"]',
   '{"highlightErrors":true}', 'GENERATED');

INSERT INTO activity_logs
  (log_type, level, user_id, action, target_type, target_id,
   message, result, meta_json, created_at)
VALUES
  ('LOGIN', 'INFO', 1, 'LOGIN', 'USER', '1', '황주은 로그인 성공', 'SUCCESS', '{}', '2026-06-18 08:55:00'),
  ('APP', 'INFO', 1, 'SALES_UPLOAD', 'UPLOAD', '1001', '6월 매출 자료를 등록했습니다.', 'SUCCESS', '{"rows":15}', '2026-06-18 09:00:00'),
  ('AUDIT', 'INFO', 2, 'UPDATE', 'PRODUCT', 'PAPER-A4-001', '제품 단가를 확인했습니다.', 'SUCCESS', '{"price":24500}', '2026-06-18 09:10:00'),
  ('EMAIL', 'INFO', 1, 'SEND', 'EMAIL', '1001', '한빛유통 매출 확인 메일을 발송했습니다.', 'SUCCESS', '{}', '2026-06-18 10:30:00'),
  ('REPORT', 'INFO', 1, 'GENERATE', 'REPORT', '1001', '월간 매출 보고서를 생성했습니다.', 'SUCCESS', '{}', '2026-06-18 11:00:00');

INSERT INTO notifications
  (client_id, title, message, level, target, href, read_status, created_at)
VALUES
  ('seed-notice-001', '매출 등록 완료', '15건의 매출 데이터가 등록되었습니다.', 'SUCCESS', '매출', '/results/data-table', 0, '2026-06-18 09:00:00'),
  ('seed-notice-002', '검증 확인 필요', '4건의 검증 항목을 확인해 주세요.', 'WARN', '검증', '/validate/upload-validation', 0, '2026-06-18 09:01:00'),
  ('seed-notice-003', '메일 발송 완료', '한빛유통 메일 발송이 완료되었습니다.', 'SUCCESS', '발송', '/request/send-history', 1, '2026-06-18 10:30:00');

-- 기존 CUST-005 다음으로 이어지는 거래처 100건
WITH
company_prefix(id, name) AS (
  VALUES
    (0, '가온'), (1, '누리'), (2, '다온'), (3, '라온'), (4, '마루'),
    (5, '바른'), (6, '새롬'), (7, '아람'), (8, '이룸'), (9, '한결'),
    (10, '한울'), (11, '해든'), (12, '온누리'), (13, '더원'), (14, '에이스'),
    (15, '미래'), (16, '우리'), (17, '중앙'), (18, '동양'), (19, '세진')
),
company_suffix(id, name) AS (
  VALUES
    (0, '유통'), (1, '상사'), (2, '오피스'), (3, '물류'), (4, '솔루션')
),
numbers(value) AS (
  SELECT 1
  UNION ALL
  SELECT value + 1 FROM numbers WHERE value < 100
)
INSERT OR REPLACE INTO customers (
  customer_code, customer_name, business_number, tax_status, status, memo
)
SELECT
  printf('CUST-%03d', value + 5),
  prefix.name || suffix.name,
  printf('%03d-%02d-%05d', 210 + ((value - 1) % 70), 80 + ((value - 1) % 10), 10000 + value),
  'ACTIVE',
  'ACTIVE',
  CASE suffix.id
    WHEN 0 THEN '정기 납품 거래처'
    WHEN 1 THEN '월 마감 거래처'
    WHEN 2 THEN '사무용품 거래처'
    WHEN 3 THEN '물류 소모품 거래처'
    ELSE '전산 비품 거래처'
  END
FROM numbers
JOIN company_prefix prefix ON prefix.id = ((value - 1) / 5)
JOIN company_suffix suffix ON suffix.id = ((value - 1) % 5);

-- 기존 제품 다음으로 이어지는 실무형 제품 100건
WITH
product_category(id, code, name, unit, base_price) AS (
  VALUES
    (0, 'PAPER', '복사용지', 'BOX', 22000),
    (1, 'PEN', '중성펜', 'BOX', 12000),
    (2, 'FILE', '문서파일', 'BOX', 18000),
    (3, 'TAPE', '포장테이프', 'ROLL', 4200),
    (4, 'LABEL', '라벨지', 'PACK', 13500),
    (5, 'TONER', '레이저 토너', 'EA', 76000),
    (6, 'INK', '컬러 잉크', 'EA', 39000),
    (7, 'CABLE', '데이터 케이블', 'EA', 9500),
    (8, 'HUB', 'USB 허브', 'EA', 21000),
    (9, 'BOX', '택배 박스', 'BUNDLE', 28000),
    (10, 'BATTERY', '알카라인 건전지', 'PACK', 14500),
    (11, 'CLEAN', '사무실 세정제', 'BOX', 32000),
    (12, 'MOUSE', '무선 마우스', 'EA', 26000),
    (13, 'KEYBOARD', '무선 키보드', 'EA', 48000),
    (14, 'STAND', '노트북 거치대', 'EA', 35000),
    (15, 'CHAIR', '사무용 의자', 'EA', 168000),
    (16, 'DESK', '데스크 매트', 'EA', 24000),
    (17, 'NOTE', '업무용 노트', 'BOX', 19500),
    (18, 'ENVELOPE', '서류 봉투', 'BOX', 16000),
    (19, 'SANITIZER', '손소독제', 'BOX', 42000)
),
product_variant(id, name) AS (
  VALUES
    (0, '스탠다드'), (1, '프리미엄'), (2, '대용량'), (3, '친환경'), (4, '업무용')
),
numbers(value) AS (
  SELECT 1
  UNION ALL
  SELECT value + 1 FROM numbers WHERE value < 100
)
INSERT OR REPLACE INTO products (
  product_code, product_name, unit, unit_price, currency, status, memo
)
SELECT
  category.code || '-' || printf('%03d', value + 100),
  variant.name || ' ' || category.name,
  category.unit,
  category.base_price + (variant.id * 1800) + (((value - 1) / 20) * 500),
  'KRW',
  'ACTIVE',
  category.name || ' 정규 품목'
FROM numbers
JOIN product_category category ON category.id = ((value - 1) % 20)
JOIN product_variant variant ON variant.id = ((value - 1) / 20);

-- 2026년 3월~6월 월별 업로드 및 스냅샷
INSERT OR REPLACE INTO workspace_snapshots (
  id, file_name, file_path, payload_json, row_count, column_count,
  issue_count, duplicate_count, review_count, saved_at
)
VALUES
  (2003, '2026년_3월_매출_300건.xlsx', 'C:\test\2026년_3월_매출_300건.xlsx', '{"source":"BULK_TEST_SEED","month":"2026-03"}', 300, 9, 0, 0, 0, '2026-03-31 18:00:00'),
  (2004, '2026년_4월_매출_300건.xlsx', 'C:\test\2026년_4월_매출_300건.xlsx', '{"source":"BULK_TEST_SEED","month":"2026-04"}', 300, 9, 0, 0, 0, '2026-04-30 18:00:00'),
  (2005, '2026년_5월_매출_300건.xlsx', 'C:\test\2026년_5월_매출_300건.xlsx', '{"source":"BULK_TEST_SEED","month":"2026-05"}', 300, 9, 0, 0, 0, '2026-05-31 18:00:00'),
  (2006, '2026년_6월_추가매출_285건.xlsx', 'C:\test\2026년_6월_추가매출_285건.xlsx', '{"source":"BULK_TEST_SEED","month":"2026-06"}', 285, 9, 0, 0, 0, '2026-06-30 18:00:00');

INSERT OR REPLACE INTO sales_uploads (
  upload_id, snapshot_id, file_name, file_path, closing_month,
  uploaded_department_code, uploaded_at, status, memo
)
VALUES
  (2003, 2003, '2026년_3월_매출_300건.xlsx', 'C:\test\2026년_3월_매출_300건.xlsx', '2026-03', '영업팀', '2026-03-31 18:00:00', 'UPLOADED', '월별 대량 테스트'),
  (2004, 2004, '2026년_4월_매출_300건.xlsx', 'C:\test\2026년_4월_매출_300건.xlsx', '2026-04', '영업팀', '2026-04-30 18:00:00', 'UPLOADED', '월별 대량 테스트'),
  (2005, 2005, '2026년_5월_매출_300건.xlsx', 'C:\test\2026년_5월_매출_300건.xlsx', '2026-05', '영업팀', '2026-05-31 18:00:00', 'UPLOADED', '월별 대량 테스트'),
  (2006, 2006, '2026년_6월_추가매출_285건.xlsx', 'C:\test\2026년_6월_추가매출_285건.xlsx', '2026-06', '영업팀', '2026-06-30 18:00:00', 'UPLOADED', '기존 15건에 이어지는 6월 추가 매출');

-- 3월부터 6월까지 월별 매출 300건, 총 1,200건
WITH RECURSIVE
months(month_number, upload_id) AS (
  VALUES (3, 2003), (4, 2004), (5, 2005), (6, 2006)
),
numbers(value) AS (
  SELECT 1
  UNION ALL
  SELECT value + 1 FROM numbers WHERE value < 300
),
product_ranked AS (
  SELECT
    product_code,
    product_name,
    unit_price,
    ROW_NUMBER() OVER (ORDER BY rowid) AS product_number
  FROM products
  WHERE memo LIKE '%정규 품목'
),
generated AS (
  SELECT
    month_number,
    upload_id,
    value,
    ((value * 11 + month_number * 7) % 100) + 6 AS customer_number,
    ((value * 7 + month_number * 3) % 100) + 1 AS product_number,
    ((value * 3) % 25) + 1 AS quantity
  FROM months
  CROSS JOIN numbers
  WHERE value <= CASE WHEN month_number = 6 THEN 285 ELSE 300 END
)
INSERT OR REPLACE INTO sales (
  row_id, upload_id, row_no, transaction_date, raw_customer_name,
  raw_product_name, customer_code, product_code, quantity,
  unit_price, sales_amount, validation_status, review_status, owner_name
)
SELECT
  (upload_id * 1000) + value,
  upload_id,
  value,
  printf('2026-%02d-%02d', month_number, ((value - 1) % 28) + 1),
  customer.customer_name,
  product.product_name,
  customer.customer_code,
  product.product_code,
  quantity,
  product.unit_price,
  quantity * product.unit_price,
  CASE
    WHEN value % 97 = 0 THEN '고액 거래 확인'
    WHEN value % 83 = 0 THEN '대량 거래 확인'
    ELSE '정상'
  END,
  CASE
    WHEN value % 97 = 0 OR value % 83 = 0 THEN 'WAITING'
    ELSE 'DONE'
  END,
  CASE value % 4
    WHEN 0 THEN '김민서'
    WHEN 1 THEN '박지훈'
    WHEN 2 THEN '이서연'
    ELSE '최현우'
  END
FROM generated
JOIN customers customer
  ON customer.customer_code = printf('CUST-%03d', customer_number)
JOIN product_ranked product
  ON product.product_number = generated.product_number;
