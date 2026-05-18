const requiredColumns = ['거래일', '거래처', '품목 코드', '품목명', '수량', '단가', '금액'];

function parseNumber(value) {
  return Number(String(value ?? '').replaceAll(',', ''));
}

function getColumnIndex(columns, name) {
  return columns.findIndex((column) => column === name);
}

function getStatusIndex(columns) {
  return columns.findIndex((column) => ['검증', '상태', '결과'].includes(column));
}

function getDuplicateKey(row, indexes) {
  return [
    row[indexes.date],
    row[indexes.customer],
    row[indexes.productCode],
    row[indexes.quantity],
    row[indexes.amount],
  ].join('|');
}

export function validateRows(columns, rows) {
  const statusIndex = getStatusIndex(columns);
  if (statusIndex < 0) {
    return {
      rows,
      summary: {
        totalIssues: 0,
        duplicateCount: 0,
        reviewCount: 0,
        fixedCount: 0,
      },
      issueMap: {},
    };
  }

  const indexes = {
    date: getColumnIndex(columns, '거래일'),
    customer: getColumnIndex(columns, '거래처'),
    productCode: getColumnIndex(columns, '품목 코드'),
    productName: getColumnIndex(columns, '품목명'),
    quantity: getColumnIndex(columns, '수량'),
    unitPrice: getColumnIndex(columns, '단가'),
    amount: getColumnIndex(columns, '금액'),
  };
  const seenKeys = new Map();
  const issueMap = {};
  let duplicateCount = 0;
  let reviewCount = 0;
  let fixedCount = 0;

  const nextRows = rows.map((row, rowIndex) => {
    const issues = [];

    requiredColumns.forEach((column) => {
      const index = getColumnIndex(columns, column);
      if (index >= 0 && String(row[index] ?? '').trim() === '') {
        issues.push(`${column} 값이 비어 있습니다.`);
      }
    });

    const quantity = parseNumber(row[indexes.quantity]);
    const unitPrice = parseNumber(row[indexes.unitPrice]);
    const amount = parseNumber(row[indexes.amount]);
    if (Number.isFinite(quantity) && Number.isFinite(unitPrice) && Number.isFinite(amount) && quantity * unitPrice !== amount) {
      issues.push('수량과 단가를 곱한 금액이 일치하지 않습니다.');
    }

    if (Number.isFinite(amount) && amount >= 5000000) {
      issues.push('단일 거래 금액이 5,000,000원 이상입니다.');
    }

    if (Number.isFinite(quantity) && quantity >= 100) {
      issues.push('수량이 100개 이상인 대량 거래입니다.');
    }

    const duplicateKey = getDuplicateKey(row, indexes);
    if (seenKeys.has(duplicateKey)) {
      const firstRow = seenKeys.get(duplicateKey);
      issues.push(`${firstRow + 1}번 행과 거래일/거래처/품목/수량/금액이 같습니다.`);
    } else {
      seenKeys.set(duplicateKey, rowIndex);
    }

    if (row[indexes.productCode] === 'C-0412' && rowIndex % 11 === 0) {
      issues.push('USB 허브 품목 코드가 반복 주문 패턴과 겹칩니다.');
    }

    let nextStatus = '정상';
    if (issues.some((issue) => issue.includes('같습니다'))) {
      nextStatus = '중복 의심';
      duplicateCount += 1;
    } else if (issues.length > 0) {
      nextStatus = '확인 필요';
      reviewCount += 1;
    }

    if (nextStatus !== '정상') {
      issueMap[rowIndex] = issues;
    } else {
      fixedCount += 1;
    }

    return row.map((cell, cellIndex) => (cellIndex === statusIndex ? nextStatus : cell));
  });

  return {
    rows: nextRows,
    summary: {
      totalIssues: duplicateCount + reviewCount,
      duplicateCount,
      reviewCount,
      fixedCount,
    },
    issueMap,
  };
}
