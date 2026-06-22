import {
  applyValidationStatus,
  validateBeforeInsert,
} from './preInsertValidation';

function toLegacyRuleKey(type) {
  if (type.includes('중복')) return 'duplicate';
  if (type.includes('거래처')) return 'missingCustomer';
  if (type.includes('품목 코드')) return 'missingProductCode';
  if (type.includes('금액')) return 'amountMismatch';
  if (type.includes('단가')) return 'priceMismatch';
  if (type.includes('수량') || type.includes('대량')) return 'largeQuantity';
  if (type.includes('고액')) return 'highAmount';
  return 'review';
}

export function validateRows(columns, rows, options = {}) {
  const validation = validateBeforeInsert(columns, rows, options);
  const stamped = applyValidationStatus(columns, rows, validation);
  const issueMap = Object.fromEntries(
    Object.entries(validation.issuesByRow).map(([rowIndex, issues]) => [
      rowIndex,
      issues.map((issue) => issue.message),
    ]),
  );
  const ruleCounts = {};

  Object.entries(validation.counts).forEach(([type, count]) => {
    const key = toLegacyRuleKey(type);
    ruleCounts[key] = (ruleCounts[key] ?? 0) + count;
  });

  const duplicateCount = Object.values(validation.issuesByRow)
    .filter((issues) => issues.some((issue) => issue.type === '중복 의심'))
    .length;
  const reviewCount = Object.keys(validation.issuesByRow).length - duplicateCount;

  return {
    rows: stamped.rows,
    summary: {
      totalIssues: Object.keys(validation.issuesByRow).length,
      duplicateCount,
      reviewCount,
      fixedCount: rows.length - Object.keys(validation.issuesByRow).length,
      ruleCounts,
    },
    issueMap,
  };
}
