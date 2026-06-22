import { parseNumber } from './dataFormat';

export const blockingValidationTypes = [
  '거래처명 누락',
  '거래처 코드 누락',
  '중복 의심',
  '금액 불일치',
  '단가 불일치',
  '품목 코드 누락',
  '품목명 누락',
];

export const reviewValidationTypes = [
  '거래처 검토 필요',
  '품목 검토 필요',
  '대량 거래 확인',
  '고액 거래 확인',
  '기타 확인',
];

const columnAliases = {
  date: ['거래일', '일자', '매출일', '마감일'],
  customerName: ['거래처', '거래처명', '업체명', '고객사', '고객사명'],
  customerCode: ['거래처 코드', '거래처코드', '고객코드', '업체코드'],
  productCode: ['품목 코드', '품목코드', '상품코드', '제품코드'],
  productName: ['품목명', '상품명', '제품명'],
  quantity: ['수량', '거래수량', '판매수량'],
  unitPrice: ['단가', '판매단가', '기준단가'],
  amount: ['금액', '매출금액', '합계금액', '요청금액'],
  status: ['검증', '상태', '결과', '승인상태'],
  note: ['비고', '메모', '기타', '확인사항'],
};

function normalizeHeader(value) {
  return String(value ?? '').replace(/\s+/g, '').toLowerCase();
}

function findColumnIndex(columns, key) {
  const normalizedColumns = columns.map(normalizeHeader);
  const aliases = columnAliases[key].map(normalizeHeader);
  return normalizedColumns.findIndex((column) => aliases.includes(column));
}

function getCell(row, indexes, key) {
  const index = indexes[key];
  return index >= 0 ? String(row[index] ?? '').trim() : '';
}

function addIssue(map, rowIndex, type, message, severity) {
  map[rowIndex] = [
    ...(map[rowIndex] ?? []),
    {
      rowIndex,
      rowNumber: rowIndex + 1,
      type,
      message,
      severity,
    },
  ];
}

function getDuplicateKey(row, indexes) {
  return [
    getCell(row, indexes, 'date'),
    getCell(row, indexes, 'customerCode') || getCell(row, indexes, 'customerName'),
    getCell(row, indexes, 'productCode') || getCell(row, indexes, 'productName'),
    getCell(row, indexes, 'quantity'),
    getCell(row, indexes, 'amount'),
  ].join('|');
}

function findReferenceProduct(row, indexes, referenceData) {
  const customerCode = getCell(row, indexes, 'customerCode');
  const customerName = getCell(row, indexes, 'customerName');
  const productCode = getCell(row, indexes, 'productCode');
  const productName = getCell(row, indexes, 'productName');
  const prices = referenceData?.prices ?? [];
  const matchedPrice = prices.find((price) => (
    (!customerCode || price.customerCode === customerCode)
    && (!customerName || price.customerName === customerName)
    && (!productCode || price.productCode === productCode)
    && (!productName || price.productName === productName)
  ));

  if (matchedPrice) {
    return {
      code: matchedPrice.productCode,
      name: matchedPrice.productName,
      price: Number(matchedPrice.price),
    };
  }

  return null;
}

export function validateBeforeInsert(columns, rows, options = {}) {
  const thresholds = {
    bulkQuantity: options.bulkQuantity ?? 100,
    highAmount: options.highAmount ?? 3000000,
  };
  const indexes = Object.fromEntries(
    Object.keys(columnAliases).map((key) => [key, findColumnIndex(columns, key)])
  );
  const issuesByRow = {};
  const counts = Object.fromEntries([...blockingValidationTypes, ...reviewValidationTypes].map((type) => [type, 0]));
  const seenRows = new Map();

  rows.forEach((row, rowIndex) => {
    const customerName = getCell(row, indexes, 'customerName');
    const customerCode = getCell(row, indexes, 'customerCode');
    const productCode = getCell(row, indexes, 'productCode');
    const productName = getCell(row, indexes, 'productName');
    const quantity = parseNumber(getCell(row, indexes, 'quantity'));
    const unitPrice = parseNumber(getCell(row, indexes, 'unitPrice'));
    const amount = parseNumber(getCell(row, indexes, 'amount'));
    const status = getCell(row, indexes, 'status');
    const note = getCell(row, indexes, 'note');

    if (!customerName && !customerCode) {
      addIssue(issuesByRow, rowIndex, '거래처 검토 필요', '거래처명과 거래처코드가 모두 비어 있어 담당자 검토가 필요합니다.', 'review');
    } else {
      if (!customerName) addIssue(issuesByRow, rowIndex, '거래처명 누락', '거래처명이 비어 있습니다. 거래처코드로 기준정보를 매칭합니다.', 'block');
      if (!customerCode) addIssue(issuesByRow, rowIndex, '거래처 코드 누락', '거래처코드가 비어 있습니다. 거래처명으로 기준정보를 매칭합니다.', 'block');
    }

    if (!productName && !productCode) {
      addIssue(issuesByRow, rowIndex, '품목 검토 필요', '품목명과 품목코드가 모두 비어 있어 담당자 검토가 필요합니다.', 'review');
    } else {
      if (!productCode) addIssue(issuesByRow, rowIndex, '품목 코드 누락', '품목코드가 비어 있습니다. 품목명으로 기준정보를 매칭합니다.', 'block');
      if (!productName) addIssue(issuesByRow, rowIndex, '품목명 누락', '품목명이 비어 있습니다. 품목코드로 기준정보를 매칭합니다.', 'block');
    }

    if (Number.isFinite(quantity) && Number.isFinite(unitPrice) && Number.isFinite(amount) && quantity * unitPrice !== amount) {
      addIssue(issuesByRow, rowIndex, '금액 불일치', `수량 x 단가 계산값 ${Number(quantity * unitPrice).toLocaleString('ko-KR')}원과 금액이 다릅니다.`, 'block');
    }

    const product = findReferenceProduct(row, indexes, options.referenceData);
    if (product && Number.isFinite(unitPrice) && product.price !== unitPrice) {
      addIssue(issuesByRow, rowIndex, '단가 불일치', `기준 단가 ${product.price.toLocaleString('ko-KR')}원과 업로드 단가 ${unitPrice.toLocaleString('ko-KR')}원이 다릅니다.`, 'block');
    }

    const duplicateKey = getDuplicateKey(row, indexes);
    if (duplicateKey.replaceAll('|', '') !== '') {
      if (seenRows.has(duplicateKey)) {
        addIssue(issuesByRow, rowIndex, '중복 의심', `${seenRows.get(duplicateKey) + 1}번 행과 거래일, 거래처, 품목, 수량, 금액이 같습니다.`, 'block');
      } else {
        seenRows.set(duplicateKey, rowIndex);
      }
    }

    if (Number.isFinite(quantity) && quantity >= thresholds.bulkQuantity) {
      addIssue(issuesByRow, rowIndex, '대량 거래 확인', `수량 ${quantity.toLocaleString('ko-KR')}건으로 대량 거래 기준을 넘었습니다.`, 'review');
    }

    if (Number.isFinite(amount) && amount >= thresholds.highAmount) {
      addIssue(issuesByRow, rowIndex, '고액 거래 확인', `금액 ${amount.toLocaleString('ko-KR')}원으로 고액 거래 기준을 넘었습니다.`, 'review');
    }

    if ([status, note].some((value) => /기타|확인|검토|보류/.test(value))) {
      addIssue(issuesByRow, rowIndex, '기타 확인', '상태 또는 비고에 담당자 확인이 필요한 문구가 있습니다.', 'review');
    }
  });

  Object.values(issuesByRow).flat().forEach((issue) => {
    counts[issue.type] = (counts[issue.type] ?? 0) + 1;
  });

  const blockerCount = blockingValidationTypes.reduce((sum, type) => sum + (counts[type] ?? 0), 0);
  const reviewCount = reviewValidationTypes.reduce((sum, type) => sum + (counts[type] ?? 0), 0);

  return {
    indexes,
    issuesByRow,
    counts,
    blockerCount,
    reviewCount,
    passed: blockerCount === 0,
    totalIssues: blockerCount + reviewCount,
  };
}

export function applyValidationStatus(columns, rows, validation) {
  const statusIndex = findColumnIndex(columns, 'status');
  const nextColumns = statusIndex >= 0 ? columns : [...columns, '검증'];
  const nextStatusIndex = statusIndex >= 0 ? statusIndex : nextColumns.length - 1;

  const nextRows = rows.map((row, rowIndex) => {
    const issues = validation.issuesByRow[rowIndex] ?? [];
    const hasBlocker = issues.some((issue) => issue.severity === 'block');
    const hasReview = issues.some((issue) => issue.severity === 'review');
    const status = hasBlocker ? '반려' : hasReview ? '확인 필요' : '정상';
    const nextRow = nextColumns.map((_, index) => row[index] ?? '');
    nextRow[nextStatusIndex] = status;
    return nextRow;
  });

  return {
    columns: nextColumns,
    rows: nextRows,
  };
}
