export const sampleColumns = ['거래일', '거래처', '품목 코드', '품목명', '수량', '단가', '금액', '검증', '담당자'];

export const sampleCustomers = [
  { code: 'CUST-001', name: '한빛유통', aliases: ['한빛 유통', '(주)한빛유통'], businessNumber: '101-81-00001' },
  { code: 'CUST-002', name: '세종오피스', aliases: ['세종 오피스', '세종OFC'], businessNumber: '102-82-00002' },
  { code: 'CUST-003', name: '모블상사', aliases: ['모블 상사', '모블'], businessNumber: '103-83-00003' },
  { code: 'CUST-004', name: '대원시스템', aliases: ['대원 시스템', '대원SYS'], businessNumber: '104-84-00004' },
  { code: 'CUST-005', name: '청담리테일', aliases: ['청담 리테일', '청담RT'], businessNumber: '105-85-00005' },
  { code: 'CUST-006', name: '바른테크', aliases: ['바른 테크', '바른TECH'], businessNumber: '106-86-00006' },
  { code: 'CUST-007', name: '동서문구', aliases: ['동서 문구', '동서문구사'], businessNumber: '107-87-00007' },
  { code: 'CUST-008', name: '그린물류', aliases: ['그린 물류', '그린LOG'], businessNumber: '108-88-00008' },
  { code: 'CUST-009', name: '서울컴퍼니', aliases: ['서울 컴퍼니', '서울CP'], businessNumber: '109-89-00009' },
  { code: 'CUST-010', name: '코리아비즈', aliases: ['코리아 비즈', 'Korea Biz'], businessNumber: '110-80-00010' },
  { code: 'CUST-011', name: '제이와이상사', aliases: ['JY상사', '제이와이 상사'], businessNumber: '111-81-00011' },
  { code: 'CUST-012', name: '다원문구', aliases: ['다원 문구', '다원'], businessNumber: '112-82-00012' },
];

export const sampleProducts = [
  { code: 'PAPER-A4-001', name: 'A4 복사용지', unit: 'BOX', price: 24500, aliases: ['A4 용지', '복사용지 A4'] },
  { code: 'TONER-BLK-2108', name: '흑백 토너 2108', unit: 'EA', price: 78000, aliases: ['토너 2108', '흑백토너'] },
  { code: 'USB-HUB-04', name: '4포트 USB 허브', unit: 'EA', price: 18900, aliases: ['USB 허브 4P', 'USB허브'] },
  { code: 'CABLE-MEET-01', name: '회의실 HDMI 케이블', unit: 'EA', price: 9200, aliases: ['HDMI 케이블', '회의실 케이블'] },
  { code: 'LABEL-STK-02', name: '라벨 스티커', unit: 'PACK', price: 13200, aliases: ['라벨지', '스티커 라벨'] },
  { code: 'MOUSE-WL-01', name: '무선 마우스', unit: 'EA', price: 22000, aliases: ['무선마우스', 'WL 마우스'] },
  { code: 'FILE-BOX-03', name: '문서 보관 박스', unit: 'EA', price: 3400, aliases: ['파일 박스', '보관 박스'] },
  { code: 'KEYBOARD-01', name: '업무용 키보드', unit: 'EA', price: 31000, aliases: ['키보드', '사무용 키보드'] },
  { code: 'MONITOR-STAND-01', name: '모니터 받침대', unit: 'EA', price: 27800, aliases: ['모니터 스탠드', '받침대'] },
  { code: 'NOTEBOOK-POUCH', name: '노트북 파우치', unit: 'EA', price: 18400, aliases: ['노트북 케이스', '파우치'] },
];

const owners = ['김민서', '박지훈', '이서연', '최현우', '정다은', '오수진'];

export const validationTypes = [
  '정상',
  '중복 의심',
  '금액 불일치',
  '거래처 누락',
  '품목 코드 누락',
  '단가 기준 불일치',
  '대량 거래 확인',
  '고액 거래 확인',
  '수정 필요',
  '승인 완료',
  '보류',
];

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function formatDate(index) {
  const date = new Date(2026, 4, 18);
  date.setDate(date.getDate() - (index % 45));
  return date.toISOString().slice(0, 10);
}

function getIssue(index) {
  if (index % 97 === 0) return '거래처 누락';
  if (index % 89 === 0) return '품목 코드 누락';
  if (index % 53 === 0) return '금액 불일치';
  if (index % 47 === 0) return '단가 기준 불일치';
  if (index % 41 === 0) return '고액 거래 확인';
  if (index % 37 === 0) return '대량 거래 확인';
  if (index % 29 === 0) return '중복 의심';
  return '정상';
}

function makeBaseRow(index) {
  const customer = sampleCustomers[index % sampleCustomers.length];
  const product = sampleProducts[index % sampleProducts.length];
  const issue = getIssue(index);
  const quantity = issue === '대량 거래 확인' ? 150 + (index % 25) : ((index * 7) % 95) + 1;
  const unitPrice = issue === '단가 기준 불일치' ? product.price + 1200 : product.price;
  const amount = issue === '금액 불일치' ? quantity * unitPrice + 5000 : quantity * unitPrice;

  return [
    formatDate(index),
    issue === '거래처 누락' ? '' : customer.name,
    issue === '품목 코드 누락' ? '' : product.code,
    product.name,
    formatNumber(quantity),
    formatNumber(unitPrice),
    formatNumber(amount),
    issue,
    owners[index % owners.length],
  ];
}

export function createSampleSalesRows(count = 1200) {
  const rows = Array.from({ length: count }, (_, index) => makeBaseRow(index));

  for (let index = 24; index < rows.length; index += 57) {
    const sourceIndex = Math.max(index - 3, 0);
    rows[index] = [...rows[sourceIndex]];
    rows[index][7] = '중복 의심';
    rows[index][8] = owners[index % owners.length];
  }

  return rows;
}

export function parseNumber(value) {
  return Number(String(value ?? '').replaceAll(',', ''));
}

export function buildMasterDataFromRows(rows = []) {
  const customerMap = new Map();
  const productMap = new Map();
  const priceMap = new Map();
  const suggestions = [];

  rows.forEach((row, index) => {
    const customerName = row[1];
    const productCode = row[2];
    const productName = row[3];
    const unitPrice = parseNumber(row[5]);

    const customer = sampleCustomers.find((item) => item.name === customerName);
    if (customer && !customerMap.has(customer.code)) {
      customerMap.set(customer.code, {
        customerCode: customer.code,
        customerName: customer.name,
        businessNumber: customer.businessNumber,
        taxStatus: 'ACTIVE',
        status: 'ACTIVE',
      });
    }

    const product = sampleProducts.find((item) => item.code === productCode);
    if (product && !productMap.has(product.code)) {
      productMap.set(product.code, {
        productCode: product.code,
        productName: product.name,
        unit: product.unit,
        status: 'ACTIVE',
      });
    }

    if (customer && product && !priceMap.has(`${customer.code}-${product.code}-${unitPrice}`)) {
      priceMap.set(`${customer.code}-${product.code}-${unitPrice}`, {
        priceId: priceMap.size + 1,
        customerCode: customer.code,
        customerName: customer.name,
        productCode: product.code,
        productName: product.name,
        price: unitPrice,
        currency: 'KRW',
        startDate: row[0],
        status: unitPrice === product.price ? 'ACTIVE' : 'REVIEW',
      });
    }

    if (!customerName) {
      suggestions.push({
        suggestionId: suggestions.length + 1,
        targetType: 'CUSTOMER',
        rawValue: `빈 거래처 ${index + 1}행`,
        suggestedCode: '확인 필요',
        suggestedName: '거래처명 누락',
        confidence: 0,
        status: 'PENDING',
      });
    }

    if (!productCode) {
      suggestions.push({
        suggestionId: suggestions.length + 1,
        targetType: 'PRODUCT',
        rawValue: productName,
        suggestedCode: '확인 필요',
        suggestedName: productName,
        confidence: 0.45,
        status: 'PENDING',
      });
    }
  });

  const productAliases = sampleProducts.flatMap((product, productIndex) =>
    product.aliases.map((aliasName, aliasIndex) => ({
      aliasId: productIndex * 10 + aliasIndex + 1,
      productCode: product.code,
      productName: product.name,
      aliasName,
      source: 'SAMPLE_1200',
      confidence: aliasIndex === 0 ? 0.97 : 0.91,
      status: 'ACTIVE',
    }))
  );

  return {
    ok: true,
    customers: Array.from(customerMap.values()),
    products: Array.from(productMap.values()),
    productAliases,
    prices: Array.from(priceMap.values()),
    suggestions,
    contacts: Array.from(customerMap.values()).map((customer, index) => ({
      contactId: index + 1,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      departmentName: '정산팀',
      recipientName: `${customer.customerName} 담당자`,
      recipientEmail: `settle${index + 1}@example.com`,
      preferredChannel: index % 3 === 0 ? 'KAKAO' : 'EMAIL',
      status: 'ACTIVE',
    })),
  };
}

export function findDuplicateGroups(rows = []) {
  const groups = new Map();

  rows.forEach((row, index) => {
    const key = [row[0], row[1], row[2], row[4], row[6]].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, rowIndex: index });
  });

  return Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([key, items], index) => ({
      id: `D-${String(index + 1).padStart(3, '0')}`,
      key,
      items,
      rowNumbers: items.map((item) => item.rowIndex + 1).join(', '),
      customerName: items[0].row[1],
      productName: items[0].row[3],
      amount: items[0].row[6],
      confidence: items.length > 2 ? '매우 높음' : '높음',
      status: '검토',
    }));
}
