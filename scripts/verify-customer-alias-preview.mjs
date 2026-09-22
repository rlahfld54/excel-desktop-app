import assert from 'node:assert/strict';
import { previewCustomerAliasImport } from '../src/utils/customerAliasImport.js';
import { exportCustomerAliasTemplateToXlsx } from '../src/utils/spreadsheetExport.js';
import ExcelJS from 'exceljs';

const columns = [' 업로드출처 ', '원본거래처코드', '원본거래처명', '기준거래처코드', '상태', '메모'];
const customers = [
  { customerCode: 'C001', customerName: '대성산업', status: 'ACTIVE' },
  { customerCode: 'C002', customerName: '미사용', status: 'INACTIVE' },
];
const existing = [{ sourceType: 'SALES_UPLOAD', sourceCustomerCode: 'A1', sourceCustomerName: '', customerCode: 'C001', status: 'ACTIVE', memo: '' }];
const parsed = { columns, rows: [
  ['', ' A1 ', '', 'C001', '', ''],
  ['MANUAL', '', '이름만', 'C001', 'INACTIVE', ''],
  ['', 'A1', '', 'C001', '', ''],
  ['', '', '', 'C001', '', ''],
  ['', 'A5', '', 'NOPE', '', ''],
  ['', 'A6', '', 'C002', '', ''],
] };
const preview = previewCustomerAliasImport(parsed, customers, existing);
assert.equal(preview.totalCount, 6);
assert.equal(preview.existingCount, 2);
assert.equal(preview.rows[0].sourceType, 'SALES_UPLOAD');
assert.equal(preview.rows[0].status, 'ACTIVE');
assert.equal(preview.rows[0].sourceCustomerCode, 'A1');
assert.equal(preview.rows[1].errors.length, 0);
assert.match(preview.rows[2].errors.join(' '), /중복/);
assert.match(preview.rows[3].errors.join(' '), /하나를 입력/);
assert.match(preview.rows[4].errors.join(' '), /찾을 수 없습니다/);
assert.match(preview.rows[5].errors.join(' '), /사용 중인/);
assert.throws(() => previewCustomerAliasImport({ columns: ['잘못된 헤더'], rows: [['x']] }, customers, existing), /필수 컬럼/);
let workbookBytes;
globalThis.window = { api: { saveFileAs: async ({ bytes }) => { workbookBytes = bytes; return { filePath: 'mock.xlsx' }; } } };
const result = await exportCustomerAliasTemplateToXlsx(customers);
assert.equal(result.fileName, '거래처_별칭_매핑_업로드_양식.xlsx');
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(Uint8Array.from(workbookBytes));
assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['매핑입력', '기준거래처목록']);
assert.equal(workbook.getWorksheet('매핑입력').getCell('A1').value, '업로드출처');
assert.equal(workbook.getWorksheet('매핑입력').getCell('A2').dataValidation.type, 'list');
assert.equal(workbook.getWorksheet('기준거래처목록').getCell('A2').value, 'C001');
console.log('Customer alias import preview verification passed.');
