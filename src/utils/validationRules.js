import { parseNumber, sampleProducts } from '../data/sampleSalesData';

const requiredColumns = ['거래일', '거래처', '품목 코드', '품목명', '수량', '단가', '금액'];

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

function getRuleType(message) {
  if (message.includes('중복')) return 'duplicate';
  if (message.includes('거래처')) return 'missingCustomer';
  if (message.includes('품목 코드')) return 'missingProductCode';
  if (message.includes('금액')) return 'amountMismatch';
  if (message.includes('단가')) return 'priceMismatch';
  if (message.includes('수량')) return 'largeQuantity';
  if (message.includes('고액')) return 'highAmount';
  return 'review';
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
        fixedCount: rows.length,
        ruleCounts: {},
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
  const ruleCounts = {};
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
    const product = sampleProducts.find((item) => item.code === row[indexes.productCode]);

    if (Number.isFinite(quantity) && Number.isFinite(unitPrice) && Number.isFinite(amount) && quantity * unitPrice !== amount) {
      issues.push('수량과 단가를 곱한 금액이 실제 금액과 일치하지 않습니다.');
    }

    if (product && Number.isFinite(unitPrice) && product.price !== unitPrice) {
      issues.push(`단가 기준 불일치: 기준 ${product.price.toLocaleString('ko-KR')}원 / 실제 ${unitPrice.toLocaleString('ko-KR')}원`);
    }

    if (Number.isFinite(amount) && amount >= 3000000) {
      issues.push('고액 거래 확인이 필요합니다.');
    }

    if (Number.isFinite(quantity) && quantity >= 100) {
      issues.push('수량이 100개 이상인 대량 거래입니다.');
    }

    const duplicateKey = getDuplicateKey(row, indexes);
    if (seenKeys.has(duplicateKey)) {
      const firstRow = seenKeys.get(duplicateKey);
      issues.push(`${firstRow + 1}번 행과 거래일/거래처/품목/수량/금액이 같습니다. 중복 의심 항목입니다.`);
    } else {
      seenKeys.set(duplicateKey, rowIndex);
    }

    issues.forEach((message) => {
      const type = getRuleType(message);
      ruleCounts[type] = (ruleCounts[type] ?? 0) + 1;
    });

    let nextStatus = '정상';
    if (issues.some((issue) => issue.includes('중복'))) {
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
      ruleCounts,
    },
    issueMap,
  };
}
