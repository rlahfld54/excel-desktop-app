import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(outputDir, '매출_업로드_테스트_최근45일.xlsx');
const workbook = Workbook.create();
const sheet = workbook.worksheets.add('매출 마감 원본');
sheet.showGridLines = false;

const headers = [
  '거래일', '거래처명', '거래처코드', '품목명', '품목코드',
  '수량', '단가', '금액', '담당자', '부서',
  '비고', '증빙번호', '세금계산서번호', '승인상태',
];
const masters = [
  ['한빛유통', 'CUST-001', 'A4 복사용지', 'PAPER-A4-001', 24500, '박지훈', '총무팀'],
  ['세종오피스', 'CUST-002', '흑백 토너 2108', 'TONER-BLK-2108', 78000, '이서연', '정산팀'],
  ['바른테크', 'CUST-006', '4포트 USB 허브', 'USB-HUB-04', 18900, '최현우', '물류팀'],
  ['동서문구', 'CUST-007', '문서 보관 박스', 'FILE-BOX-03', 3400, '박지훈', '총무팀'],
  ['그린물류', 'CUST-008', '모니터 받침대', 'MONITOR-STAND-01', 27800, '정다은', '총무팀'],
];
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const end = new Date(2026, 6, 28);
const rows = Array.from({ length: 45 }, (_, index) => {
  const date = new Date(end);
  date.setDate(end.getDate() - (44 - index));
  const [customerName, customerCode, productName, productCode, unitPrice, owner, department] = masters[index % masters.length];
  const quantity = 2 + ((index * 3) % 18);
  const amount = quantity * unitPrice;
  return [
    formatDate(date), customerName, customerCode, productName, productCode,
    quantity, unitPrice, amount, owner, department,
    '포트폴리오 동기화 테스트용 정상 거래', `TEST-${String(index + 1).padStart(3, '0')}`,
    `TAX-${String(index + 1).padStart(4, '0')}`, '승인',
  ];
});

sheet.getRange('A1:N1').values = [headers];
sheet.getRange(`A2:N${rows.length + 1}`).values = rows;
sheet.getRange('A1:N1').format = {
  fill: '#0F766E',
  font: { bold: true, color: '#FFFFFF' },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
  wrapText: true,
};
sheet.getRange(`A2:N${rows.length + 1}`).format = { verticalAlignment: 'center' };
sheet.getRange(`A2:A${rows.length + 1}`).format.numberFormat = 'yyyy-mm-dd';
sheet.getRange(`F2:H${rows.length + 1}`).format.numberFormat = '#,##0';
sheet.getRange(`A1:N${rows.length + 1}`).format.borders = { preset: 'inside', style: 'thin', color: '#DDE7E5' };
sheet.getRange('A1:N1').format.borders = { preset: 'outside', style: 'thin', color: '#0F766E' };
sheet.getRange('A1').format.columnWidth = 13;
sheet.getRange('B1').format.columnWidth = 15;
sheet.getRange('C1').format.columnWidth = 15;
sheet.getRange('D1').format.columnWidth = 19;
sheet.getRange('E1').format.columnWidth = 19;
sheet.getRange('F1:H1').format.columnWidth = 12;
sheet.getRange('I1:J1').format.columnWidth = 12;
sheet.getRange('K1').format.columnWidth = 36;
sheet.getRange('L1:M1').format.columnWidth = 18;
sheet.getRange('L1:M1').format.columnWidth = 16;
sheet.getRange('N1').format.columnWidth = 12;
sheet.getRange('A1:N1').format.rowHeight = 26;
sheet.freezePanes.freezeRows(1);
sheet.tables.add(`A1:N${rows.length + 1}`, true, 'SalesUploadSample');

const inspection = await workbook.inspect({
  kind: 'table',
  range: `매출 마감 원본!A1:N8`,
  include: 'values,formulas',
  tableMaxRows: 8,
  tableMaxCols: 14,
});
if (!inspection.ndjson.includes('거래일') || !inspection.ndjson.includes('2026-06-14')) {
  throw new Error('생성된 매출 업로드 데이터 검증에 실패했습니다.');
}
const preview = await workbook.render({ sheetName: '매출 마감 원본', range: 'A1:N12', scale: 1.2, format: 'png' });
await fs.writeFile(path.join(outputDir, '매출_업로드_테스트_최근45일_preview.png'), new Uint8Array(await preview.arrayBuffer()));
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(JSON.stringify({ outputPath, rows: rows.length }));
