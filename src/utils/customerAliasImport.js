const headers = {
  sourceType: ['업로드출처', 'sourceType'],
  sourceCustomerCode: ['원본거래처코드', 'sourceCustomerCode'],
  sourceCustomerName: ['원본거래처명', 'sourceCustomerName'],
  customerCode: ['기준거래처코드', 'customerCode'],
  status: ['상태', 'status'],
  memo: ['메모', 'memo'],
};

const clean = (value) => String(value ?? '').trim();
const identity = (row) => JSON.stringify([row.sourceType, row.sourceCustomerCode, row.sourceCustomerName]);

export function previewCustomerAliasImport(parsed, customers = [], existingMappings = []) {
  const columns = parsed.columns.map((column) => clean(column).toLowerCase());
  const indexes = Object.fromEntries(Object.entries(headers).map(([key, names]) => [
    key, columns.findIndex((column) => names.some((name) => name.toLowerCase() === column)),
  ]));
  const missing = ['sourceType', 'sourceCustomerCode', 'sourceCustomerName', 'customerCode']
    .filter((key) => indexes[key] < 0);
  if (missing.length) throw new Error(`필수 컬럼이 없습니다: ${missing.map((key) => headers[key][0]).join(', ')}`);
  if (!parsed.rows.length) throw new Error('등록할 매핑 데이터가 없습니다.');

  const customersByCode = new Map(customers.map((customer) => [clean(customer.customerCode), customer]));
  const existingByIdentity = new Map(existingMappings.map((mapping) => [identity(mapping), mapping]));
  const seen = new Set();
  const rows = parsed.rows.map((values, index) => {
    const value = (key) => indexes[key] < 0 ? '' : clean(values[indexes[key]]);
    const row = {
      rowNumber: index + 2,
      sourceType: value('sourceType') || 'SALES_UPLOAD',
      sourceCustomerCode: value('sourceCustomerCode'),
      sourceCustomerName: value('sourceCustomerName'),
      customerCode: value('customerCode'),
      status: value('status') || 'ACTIVE',
      memo: value('memo'),
    };
    const errors = [];
    const warnings = [];
    if (!['SALES_UPLOAD', 'CONTACT_UPLOAD', 'MANUAL'].includes(row.sourceType)) errors.push('업로드출처가 허용값이 아닙니다.');
    if (!row.sourceCustomerCode && !row.sourceCustomerName) errors.push('원본 거래처코드 또는 거래처명 중 하나를 입력해주세요.');
    if (!row.customerCode) errors.push('기준거래처코드를 입력해주세요.');
    const customer = customersByCode.get(row.customerCode);
    if (row.customerCode && !customer) errors.push(`기준거래처코드 ${row.customerCode}를 찾을 수 없습니다.`);
    if (customer && customer.status !== 'ACTIVE') errors.push('사용 중인 기준 거래처만 선택할 수 있습니다.');
    if (!['ACTIVE', 'INACTIVE'].includes(row.status)) errors.push('상태는 ACTIVE 또는 INACTIVE여야 합니다.');
    const key = identity(row);
    if (seen.has(key)) errors.push('같은 원본 거래처 정보가 파일 안에 중복되어 있습니다.');
    seen.add(key);
    const existing = existingByIdentity.get(key);
    if (existing?.customerCode !== undefined && existing.customerCode !== row.customerCode) warnings.push('기존 매핑과 기준 거래처코드가 다릅니다.');
    if (existing && (existing.status !== row.status || clean(existing.memo) !== row.memo)) warnings.push('기존 매핑과 상태 또는 메모가 다릅니다.');
    return { ...row, customerName: customer?.customerName ?? '', existing, errors, warnings };
  });
  return { rows, totalCount: rows.length, newCount: rows.filter((row) => !row.existing).length,
    existingCount: rows.filter((row) => row.existing).length,
    warningCount: rows.filter((row) => row.warnings.length).length,
    errorCount: rows.filter((row) => row.errors.length).length };
}
