import React, { useEffect, useState } from 'react';

import { Modal } from '../components/common';
import PageShell from './PageShell';
import { excelUploadTemplates, uploadValidationTestData } from '../data/excelUploadTemplates';
import { addActivityLog } from '../utils/authSession';
import { parseSpreadsheetFile } from '../utils/fileParsers';
import {
  applyValidationStatus,
  blockingValidationTypes,
  reviewValidationTypes,
  validateBeforeInsert,
} from '../utils/preInsertValidation';
import {
  exportAllUploadTemplatesToXlsx,
  exportRowsToXlsx,
  exportUploadTemplateToXlsx,
  exportValidationWorkbookToXlsx,
} from '../utils/spreadsheetExport';

const defaultColumns = ['거래일', '거래처', '품목 코드', '품목명', '수량', '단가', '금액', '검증', '담당자'];
const emptyMasterData = {
  customers: [],
  products: [],
  productAliases: [],
  prices: [],
  suggestions: [],
  contacts: [],
};

function IssueList({ title, types, counts, tone, onSelectType }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <h2 className="font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {types.map((type) => (
          <button key={type} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-left transition-colors hover:border-accent-200 hover:bg-accent-50 dark:border-gray-700/60 dark:hover:border-accent-500/40 dark:hover:bg-accent-500/10" type="button" onClick={() => onSelectType(type)}>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{type}</span>
            <span className={`rounded px-2 py-1 text-xs font-bold ${tone === 'danger' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-200'}`}>
              {(counts[type] ?? 0).toLocaleString('ko-KR')}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TemplateMiniCard({ template, onDownload }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">{template.targetMenu}</p>
          <h2 className="mt-1 text-base font-bold text-gray-900 dark:text-gray-100">{template.title}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">{template.description}</p>
        </div>
        <button className="btn btn-secondary shrink-0" type="button" onClick={() => onDownload(template)}>양식 다운로드</button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">필수 컬럼</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {template.requiredColumns.map((column) => (
              <span key={column} className="rounded bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">{column}</span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function getCell(row, index) {
  return index >= 0 ? String(row[index] ?? '') : '';
}

function toNumber(value) {
  return Number(String(value ?? '').replaceAll(',', ''));
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, '').toLowerCase();
}

function similarity(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.82;

  const leftChars = new Set(left);
  const overlap = [...new Set(right)].filter((char) => leftChars.has(char)).length;
  return overlap / Math.max(left.length, right.length);
}

function readLocalMasterData() {
  return emptyMasterData;
}

function getLatestRowsFallback() {
  return { columns: defaultColumns, rows: [] };
}

function findRecentColumnIndex(columns, names) {
  const normalizedNames = names.map(normalizeText);
  return columns.findIndex((column) => normalizedNames.includes(normalizeText(column)));
}

function getRecentValue(row, indexes, key) {
  const index = indexes[key];
  return index >= 0 ? row[index] : '';
}

function findRecentRowCandidate(row, indexes, recentData) {
  const recentColumns = recentData.columns ?? defaultColumns;
  const recentIndexes = {
    customerName: findRecentColumnIndex(recentColumns, ['거래처', '거래처명']),
    productCode: findRecentColumnIndex(recentColumns, ['품목 코드', '품목코드']),
    productName: findRecentColumnIndex(recentColumns, ['품목명']),
    quantity: findRecentColumnIndex(recentColumns, ['수량']),
    unitPrice: findRecentColumnIndex(recentColumns, ['단가']),
    amount: findRecentColumnIndex(recentColumns, ['금액']),
  };
  const productName = getCell(row, indexes.productName);
  const productCode = getCell(row, indexes.productCode);
  const quantity = toNumber(getCell(row, indexes.quantity));
  const unitPrice = toNumber(getCell(row, indexes.unitPrice));
  const amount = toNumber(getCell(row, indexes.amount));

  return (recentData.rows ?? []).reduce((best, recentRow) => {
    const recentProductName = getRecentValue(recentRow, recentIndexes, 'productName');
    const recentProductCode = getRecentValue(recentRow, recentIndexes, 'productCode');
    const recentQuantity = toNumber(getRecentValue(recentRow, recentIndexes, 'quantity'));
    const recentUnitPrice = toNumber(getRecentValue(recentRow, recentIndexes, 'unitPrice'));
    const recentAmount = toNumber(getRecentValue(recentRow, recentIndexes, 'amount'));
    let score = similarity(productName, recentProductName) * 50;

    if (productCode && productCode === recentProductCode) score += 30;
    if (Number.isFinite(unitPrice) && unitPrice === recentUnitPrice) score += 15;
    if (Number.isFinite(quantity) && quantity === recentQuantity) score += 8;
    if (Number.isFinite(amount) && amount === recentAmount) score += 8;

    if (!best || score > best.score) {
      return { score, recentRow, recentIndexes };
    }
    return best;
  }, null);
}

function findProductCandidate(row, indexes, referenceData) {
  const customerName = getCell(row, indexes.customerName);
  const productName = getCell(row, indexes.productName);
  const productCode = getCell(row, indexes.productCode);
  const unitPrice = toNumber(getCell(row, indexes.unitPrice));
  const quantity = toNumber(getCell(row, indexes.quantity));
  const amount = toNumber(getCell(row, indexes.amount));
  const inferredUnitPrice = Number.isFinite(amount) && Number.isFinite(quantity) && quantity !== 0 ? amount / quantity : NaN;
  const aliases = referenceData.productAliases ?? [];
  const prices = referenceData.prices ?? [];

  return (referenceData.products ?? []).reduce((best, product) => {
    const aliasScore = aliases
      .filter((alias) => alias.productCode === product.productCode)
      .reduce((max, alias) => Math.max(max, similarity(productName, alias.aliasName) * 0.96), 0);
    const nameScore = Math.max(similarity(productName, product.productName), aliasScore);
    const priceMatches = prices.filter((price) => price.productCode === product.productCode);
    const priceScore = priceMatches.some((price) => Number(price.price) === unitPrice || Number(price.price) === inferredUnitPrice) ? 0.18 : 0;
    const customerScore = priceMatches.some((price) => price.customerName === customerName) ? 0.08 : 0;
    const score = nameScore + priceScore + customerScore + (productCode === product.productCode ? 0.3 : 0);

    if (!best || score > best.score) return { score, product, price: priceMatches[0] };
    return best;
  }, null);
}

function findCustomerCandidate(row, indexes, referenceData, productCandidate) {
  const customerName = getCell(row, indexes.customerName);
  const productCode = getCell(row, indexes.productCode) || productCandidate?.product?.productCode;
  const unitPrice = toNumber(getCell(row, indexes.unitPrice));
  const prices = referenceData.prices ?? [];

  return (referenceData.customers ?? []).reduce((best, customer) => {
    const nameScore = similarity(customerName, customer.customerName);
    const priceScore = prices.some((price) => (
      price.customerCode === customer.customerCode
      && (!productCode || price.productCode === productCode)
      && (!Number.isFinite(unitPrice) || Number(price.price) === unitPrice)
    )) ? 0.16 : 0;
    const score = nameScore + priceScore;

    if (!best || score > best.score) return { score, customer };
    return best;
  }, null);
}

function getCustomerCode(customer) {
  return customer?.customerCode ?? customer?.code ?? '';
}

function getCustomerName(customer) {
  return customer?.customerName ?? customer?.name ?? '';
}

function getProductCode(product) {
  return product?.productCode ?? product?.code ?? '';
}

function getProductName(product) {
  return product?.productName ?? product?.name ?? '';
}

function findExactCustomer({ customerCode, customerName, referenceData }) {
  const normalizedName = normalizeText(customerName);
  const customer = (referenceData.customers ?? []).find((item) => (
    (customerCode && getCustomerCode(item) === customerCode)
    || (normalizedName && normalizeText(getCustomerName(item)) === normalizedName)
  ));
  if (customer) {
    return {
      customerCode: getCustomerCode(customer),
      customerName: getCustomerName(customer),
    };
  }

  return null;
}

function findExactProduct({ productCode, productName, referenceData }) {
  const normalizedName = normalizeText(productName);
  const product = (referenceData.products ?? []).find((item) => (
    (productCode && getProductCode(item) === productCode)
    || (normalizedName && normalizeText(getProductName(item)) === normalizedName)
  ));
  if (product) {
    return {
      productCode: getProductCode(product),
      productName: getProductName(product),
    };
  }

  const alias = (referenceData.productAliases ?? []).find((item) => (
    normalizedName && normalizeText(item.aliasName) === normalizedName
  ));
  if (alias) {
    const aliasProduct = (referenceData.products ?? []).find((item) => getProductCode(item) === alias.productCode);
    return {
      productCode: alias.productCode,
      productName: getProductName(aliasProduct) || productName,
    };
  }

  return null;
}

function findSuggestion(issueType, row, indexes, referenceData, recentData) {
  const customerName = getCell(row, indexes.customerName);
  const productName = getCell(row, indexes.productName);
  const productCode = getCell(row, indexes.productCode);
  const quantity = toNumber(getCell(row, indexes.quantity));
  const unitPrice = toNumber(getCell(row, indexes.unitPrice));
  const amount = toNumber(getCell(row, indexes.amount));
  const inferredUnitPrice = Number.isFinite(amount) && Number.isFinite(quantity) && quantity !== 0 ? amount / quantity : NaN;
  const productCandidate = findProductCandidate(row, indexes, referenceData);
  const customerCandidate = findCustomerCandidate(row, indexes, referenceData, productCandidate);
  const recentCandidate = findRecentRowCandidate(row, indexes, recentData);

  if (issueType === '거래처명 누락') {
    const exactCustomer = findExactCustomer({ customerCode: getCell(row, indexes.customerCode), customerName, referenceData });
    if (exactCustomer?.customerName) {
      return { label: `같은 코드: ${exactCustomer.customerName} / ${exactCustomer.customerCode}`, patch: exactCustomer };
    }

    const customer = customerCandidate?.customer;
    if (customer && customerCandidate.score >= 0.4) {
      return { label: `기준정보: ${customer.customerName} / ${customer.customerCode}`, patch: { customerName: customer.customerName, customerCode: customer.customerCode } };
    }
  }

  if (issueType === '거래처 코드 누락') {
    const exactCustomer = findExactCustomer({ customerCode: getCell(row, indexes.customerCode), customerName, referenceData });
    if (exactCustomer?.customerCode) {
      return { label: `같은 거래처명: ${exactCustomer.customerName} / ${exactCustomer.customerCode}`, patch: exactCustomer };
    }

    const customer = customerCandidate?.customer;
    if (customer && customerCandidate.score >= 0.4) {
      return { label: `기준정보: ${customer.customerName} / ${customer.customerCode}`, patch: { customerCode: customer.customerCode } };
    }
  }

  if (issueType === '품목 코드 누락') {
    const exactProduct = findExactProduct({ productCode, productName, referenceData });
    if (exactProduct?.productCode) {
      return { label: `같은 품목명: ${exactProduct.productName} / ${exactProduct.productCode}`, patch: exactProduct };
    }

    const product = productCandidate?.product;
    if (product && productCandidate.score >= 0.55) {
      return { label: `기준정보: ${product.productName} / ${product.productCode}`, patch: { productCode: product.productCode } };
    }
  }

  if (issueType === '품목명 누락') {
    const exactProduct = findExactProduct({ productCode, productName, referenceData });
    if (exactProduct?.productName) {
      return { label: `같은 품목코드: ${exactProduct.productName} / ${exactProduct.productCode}`, patch: exactProduct };
    }
  }

  if (issueType === '단가 불일치' || issueType === '기타 확인') {
    if (Number.isFinite(inferredUnitPrice)) {
      return { label: `계산식: 금액 ÷ 수량 = ${inferredUnitPrice.toLocaleString('ko-KR')}원`, patch: { unitPrice: inferredUnitPrice } };
    }
    const price = (referenceData.prices ?? []).find((item) => (
      (!productCode || item.productCode === productCode)
      || (productCandidate?.product?.productCode && item.productCode === productCandidate.product.productCode)
    ));
    if (price) {
      return { label: `기준정보: ${price.productName} ${Number(price.price).toLocaleString('ko-KR')}원`, patch: { unitPrice: price.price } };
    }
  }

  if (issueType === '금액 불일치') {
    if (Number.isFinite(quantity) && Number.isFinite(unitPrice)) {
      return { label: `계산 금액 ${(quantity * unitPrice).toLocaleString('ko-KR')}원`, patch: { amount: quantity * unitPrice } };
    }
  }

  if (!['거래처명 누락', '거래처 코드 누락', '품목 코드 누락', '품목명 누락'].includes(issueType) && recentCandidate?.score >= 45) {
    const recentRow = recentCandidate.recentRow;
    const recentIndexes = recentCandidate.recentIndexes;
    return {
      label: `기존 데이터: ${getRecentValue(recentRow, recentIndexes, 'productName')} / ${getRecentValue(recentRow, recentIndexes, 'productCode')}`,
      patch: {
        customerName: customerName || getRecentValue(recentRow, recentIndexes, 'customerName'),
        productCode: productCode || getRecentValue(recentRow, recentIndexes, 'productCode'),
        productName: productName || getRecentValue(recentRow, recentIndexes, 'productName'),
        unitPrice: Number.isFinite(unitPrice) ? undefined : getRecentValue(recentRow, recentIndexes, 'unitPrice'),
      },
    };
  }

  return null;
}

function IssueEditModal({
  draft,
  issueType,
  rows,
  validation,
  onClose,
  onCellChange,
  onApplySuggestion,
  onDownload,
  referenceData,
  recentData,
}) {
  if (!draft || !issueType || !validation) return null;

  const editableKeys = [
    ['customerName', '거래처명'],
    ['customerCode', '거래처코드'],
    ['productName', '품목명'],
    ['productCode', '품목코드'],
    ['quantity', '수량'],
    ['unitPrice', '단가'],
    ['amount', '금액'],
    ['note', '비고'],
  ].filter(([key]) => validation.indexes[key] >= 0);

  return (
    <Modal
      open
      eyebrow="Temporary review"
      title={issueType}
      description={`${rows.length.toLocaleString('ko-KR')}개 행을 검토 중입니다. 수정 내용은 임시 검토본에만 반영됩니다.`}
      size="4xl"
      onClose={onClose}
      showCloseButton={false}
      bodyClassName="min-h-0 flex-1 overflow-auto p-5"
      headerActions={(
        <>
            <button className="btn btn-secondary" type="button" onClick={() => onDownload(issueType)}>이 항목 엑셀 다운로드</button>
            <button className="btn btn-primary" type="button" onClick={onClose}>검토 완료</button>
        </>
      )}
    >
          <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-950 dark:text-gray-400">행</th>
                <th className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-950 dark:text-gray-400">DB 매칭 후보</th>
                {editableKeys.map(([, label]) => (
                  <th key={label} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-950 dark:text-gray-400">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((item) => {
                const row = draft.rows[item.rowIndex] ?? [];
                const suggestion = findSuggestion(issueType, row, validation.indexes, referenceData, recentData);

                return (
                  <tr key={`${issueType}-${item.rowIndex}`}>
                    <td className="border-b border-r border-gray-200 px-3 py-2 font-semibold text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{item.rowNumber}</td>
                    <td className="min-w-56 border-b border-r border-gray-200 px-3 py-2 dark:border-gray-700/60">
                      {suggestion ? (
                        <button className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200" type="button" onClick={() => onApplySuggestion(item.rowIndex, suggestion.patch)}>
                          {suggestion.label}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">직접 확인</span>
                      )}
                    </td>
                    {editableKeys.map(([key, label]) => {
                      const columnIndex = validation.indexes[key];
                      return (
                        <td key={`${item.rowIndex}-${key}`} className="min-w-36 border-b border-r border-gray-200 px-2 py-1.5 dark:border-gray-700/60">
                          <input
                            className="form-input h-9 w-full text-sm"
                            value={row[columnIndex] ?? ''}
                            aria-label={`${item.rowNumber}행 ${label}`}
                            onChange={(event) => onCellChange(item.rowIndex, columnIndex, event.target.value)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              }) : (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={editableKeys.length + 2}>이 항목에 해당하는 행이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
    </Modal>
  );
}

function formatPatchValue(value) {
  return typeof value === 'number' ? value.toLocaleString('ko-KR') : value;
}

function buildAutoFixPatch(row, indexes, issues, referenceData, recentData) {
  const patch = {};
  const summaries = [];
  const customerName = getCell(row, indexes.customerName);
  const customerCode = getCell(row, indexes.customerCode);
  const productName = getCell(row, indexes.productName);
  const productCode = getCell(row, indexes.productCode);

  if ((issues.some((issue) => issue.type === '거래처명 누락') && customerCode)
    || (issues.some((issue) => issue.type === '거래처 코드 누락') && customerName)) {
    const exactCustomer = findExactCustomer({ customerCode, customerName, referenceData });
    if (exactCustomer) {
      if (!customerName && exactCustomer.customerName) {
        patch.customerName = exactCustomer.customerName;
        summaries.push(`거래처명 ${exactCustomer.customerName}`);
      }
      if (!customerCode && exactCustomer.customerCode) {
        patch.customerCode = exactCustomer.customerCode;
        summaries.push(`거래처코드 ${exactCustomer.customerCode}`);
      }
    }
  }

  if ((issues.some((issue) => issue.type === '품목명 누락') && productCode)
    || (issues.some((issue) => issue.type === '품목 코드 누락') && productName)) {
    const exactProduct = findExactProduct({ productCode, productName, referenceData });
    if (exactProduct) {
      if (!productName && exactProduct.productName) {
        patch.productName = exactProduct.productName;
        summaries.push(`품목명 ${exactProduct.productName}`);
      }
      if (!productCode && exactProduct.productCode) {
        patch.productCode = exactProduct.productCode;
        summaries.push(`품목코드 ${exactProduct.productCode}`);
      }
    }
  }

  if (issues.some((issue) => issue.type === '금액 불일치')) {
    const quantity = toNumber(getCell(row, indexes.quantity));
    const unitPrice = toNumber(getCell(row, indexes.unitPrice));
    if (Number.isFinite(quantity) && Number.isFinite(unitPrice)) {
      patch.amount = quantity * unitPrice;
      summaries.push(`금액 ${Number(quantity * unitPrice).toLocaleString('ko-KR')}`);
    }
  }

  return summaries.length > 0 ? { patch, summary: summaries.join(', ') } : null;
}

function applyAutoFixesToDraft(draft, validation, referenceData, recentData) {
  const autoFixes = {};
  const rows = draft.rows.map((row, rowIndex) => {
    const issues = validation.issuesByRow[rowIndex] ?? [];
    if (issues.length === 0) return row;

    const fix = buildAutoFixPatch(row, validation.indexes, issues, referenceData, recentData);
    if (!fix) return row;

    const nextRow = [...row];
    Object.entries(fix.patch).forEach(([key, value]) => {
      const columnIndex = validation.indexes[key];
      if (columnIndex >= 0 && value !== undefined && value !== null && value !== '') {
        nextRow[columnIndex] = formatPatchValue(value);
      }
    });
    autoFixes[rowIndex] = fix;
    return nextRow;
  });

  return {
    draft: { ...draft, rows },
    autoFixes,
  };
}

export default function UploadValidationPage() {
  const [draft, setDraft] = useState(null);
  const [validation, setValidation] = useState(null);
  const [activeIssueType, setActiveIssueType] = useState('');
  const [statusText, setStatusText] = useState('파일을 선택하면 SQL 저장 전에 반려 항목과 담당자 확인 항목을 먼저 검사합니다.');
  const [templateStatus, setTemplateStatus] = useState('필요한 표준 양식 2개만 제공합니다.');
  const [referenceData, setReferenceData] = useState(() => readLocalMasterData());
  const [recentData, setRecentData] = useState(() => getLatestRowsFallback());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadReferenceSources() {
      let nextMasterData = readLocalMasterData();
      let nextRecentData = getLatestRowsFallback();

      if (window.api?.getMasterData) {
        try {
          const data = await window.api.getMasterData();
          if (data?.customers?.length || data?.products?.length) {
            nextMasterData = data;
          }
        } catch {
          // SQLite unavailable: keep the screen empty.
        }
      }

      if (window.api?.getLatestData) {
        try {
          const result = await window.api.getLatestData();
          const payload = result?.data?.payload;
          if (Array.isArray(payload?.rows)) {
            nextRecentData = {
              columns: Array.isArray(payload.columns) ? payload.columns : defaultColumns,
              rows: payload.rows,
            };
          }
        } catch {
          // SQLite unavailable: keep the screen empty.
        }
      }

      if (!active) return;
      setReferenceData(nextMasterData);
      setRecentData(nextRecentData);
    }

    loadReferenceSources();

    return () => {
      active = false;
    };
  }, []);

  const getIssuesForType = (type) => {
    if (!validation) return [];
    return Object.values(validation.issuesByRow)
      .flat()
      .filter((issue) => issue.type === type);
  };

  const runValidation = (nextDraft, message, options = {}) => {
    const baseDraft = {
      ...nextDraft,
      originalColumns: nextDraft.originalColumns ?? (options.initializeOriginal ? [...nextDraft.columns] : draft?.originalColumns),
      originalRows: nextDraft.originalRows ?? (options.initializeOriginal ? nextDraft.rows.map((row) => [...row]) : draft?.originalRows),
      originalValidation: options.initializeOriginal ? undefined : (nextDraft.originalValidation ?? draft?.originalValidation),
      autoFixes: options.initializeOriginal ? {} : (nextDraft.autoFixes ?? draft?.autoFixes ?? {}),
    };
    const validationOptions = { referenceData };
    const firstResult = validateBeforeInsert(baseDraft.columns, baseDraft.rows, validationOptions);
    const shouldAutoFix = options.autoFix && firstResult.totalIssues > 0;
    const fixed = shouldAutoFix
      ? applyAutoFixesToDraft(baseDraft, firstResult, referenceData, recentData)
      : { draft: baseDraft, autoFixes: baseDraft.autoFixes ?? {} };
    const result = validateBeforeInsert(fixed.draft.columns, fixed.draft.rows, validationOptions);
    const stamped = applyValidationStatus(fixed.draft.columns, fixed.draft.rows, result);
    const validationIssues = Object.fromEntries(
      Object.entries(result.issuesByRow).map(([rowIndex, issues]) => [rowIndex, issues.map((issue) => `${issue.type}: ${issue.message}`)])
    );
    const autoFixCount = Object.keys(fixed.autoFixes).length;

    setDraft({
      ...fixed.draft,
      ...stamped,
      originalColumns: baseDraft.originalColumns,
      originalRows: baseDraft.originalRows,
      originalValidation: baseDraft.originalValidation ?? firstResult,
      autoFixes: { ...(baseDraft.autoFixes ?? {}), ...fixed.autoFixes },
      validationIssues,
    });
    setValidation(result);
    setStatusText(message || (result.passed
      ? `반려 항목 없이 검증했습니다. 자동 보정 ${autoFixCount.toLocaleString('ko-KR')}행, 담당자 재확인 ${result.reviewCount.toLocaleString('ko-KR')}건을 확인한 뒤 다음 단계로 넘길 수 있습니다.`
      : `자동 보정 ${autoFixCount.toLocaleString('ko-KR')}행 반영 후 반려 ${result.blockerCount.toLocaleString('ko-KR')}건이 남아 SQL 저장 전 수정이 필요합니다.`));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setStatusText(`${file.name} 파일을 읽는 중입니다.`);
    try {
      const parsed = await parseSpreadsheetFile(file);
      runValidation(parsed, null, { initializeOriginal: true, autoFix: true });
    } catch (error) {
      setStatusText(`파일 검증 실패: ${error.message}`);
    }
  };

  const handleTemplateDownload = async (template) => {
    setTemplateStatus(`${template.title} 양식을 생성하는 중입니다.`);
    try {
      const result = await exportUploadTemplateToXlsx(template);
      addActivityLog('INFO', '엑셀 양식 다운로드', template.title);
      setTemplateStatus(`${result.fileName} 파일을 생성했습니다.`);
    } catch (error) {
      setTemplateStatus(error.name === 'AbortError' ? '양식 저장이 취소되었습니다.' : error.message);
    }
  };

  const handleTemplateDownloadAll = async () => {
    setTemplateStatus('매출 마감 표준 양식 2개를 생성하는 중입니다.');
    try {
      const result = await exportAllUploadTemplatesToXlsx(excelUploadTemplates);
      addActivityLog('INFO', '엑셀 양식 전체 다운로드', '매출 마감 표준 양식');
      setTemplateStatus(`${result.fileName} 파일을 생성했습니다.`);
    } catch (error) {
      setTemplateStatus(error.name === 'AbortError' ? '양식 저장이 취소되었습니다.' : error.message);
    }
  };

  const handleSave = async () => {
    if (!draft || isSaving) return;

    const nextValidation = validateBeforeInsert(draft.columns, draft.rows, { referenceData });
    const stamped = applyValidationStatus(draft.columns, draft.rows, nextValidation);
    const validationIssues = Object.fromEntries(
      Object.entries(nextValidation.issuesByRow).map(([rowIndex, issues]) => [
        rowIndex,
        issues.map((issue) => `${issue.type}: ${issue.message}`),
      ])
    );

    setValidation(nextValidation);
    setDraft((current) => ({ ...current, ...stamped, validationIssues }));

    if (nextValidation.blockerCount > 0) {
      setStatusText(`반려 ${nextValidation.blockerCount.toLocaleString('ko-KR')}건이 남아 있습니다. 수정 후 다시 저장해주세요.`);
      return;
    }

    if (!window.api?.saveData) {
      setStatusText('매출 테이블 저장은 Electron 데스크톱 앱에서 사용할 수 있습니다.');
      return;
    }

    setIsSaving(true);
    setStatusText(`${draft.fileName} 데이터를 매출 테이블에 저장하는 중입니다.`);

    try {
      const result = await window.api.saveData({
        fileName: draft.fileName,
        columns: stamped.columns,
        rows: stamped.rows,
        rowActions: {},
        validationIssues,
        savedAt: new Date().toISOString(),
      });

      if (!result?.ok) throw new Error(result?.message || 'SQLite 저장에 실패했습니다.');

      addActivityLog('INFO', '업로드 검증 데이터 저장', `${draft.fileName} / ${stamped.rows.length}건`);
      setStatusText(
        `${stamped.rows.length.toLocaleString('ko-KR')}건을 매출 테이블에 저장했습니다.`
        + (nextValidation.reviewCount > 0 ? ` 담당자 재확인 ${nextValidation.reviewCount.toLocaleString('ko-KR')}건도 함께 기록했습니다.` : '')
      );
    } catch (error) {
      setStatusText(`매출 테이블 저장 실패: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCellChange = (rowIndex, columnIndex, value) => {
    if (!draft) return;
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row, index) => (
        index === rowIndex
          ? row.map((cell, cellIndex) => (cellIndex === columnIndex ? value : cell))
          : row
      )),
    }));
    setStatusText('수정 내용을 임시 검토본에 반영했습니다.');
  };

  const handleApplySuggestion = (rowIndex, patch) => {
    if (!draft || !validation) return;
    const nextRows = draft.rows.map((row, index) => {
      if (index !== rowIndex) return row;
      const nextRow = [...row];
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        const columnIndex = validation.indexes[key];
        if (columnIndex >= 0) nextRow[columnIndex] = typeof value === 'number' ? value.toLocaleString('ko-KR') : value;
      });
      return nextRow;
    });

    runValidation({ ...draft, rows: nextRows }, 'DB 기준정보 매칭 후보를 임시 검토본에 반영하고 검증 결과를 갱신했습니다.');
  };

  const buildExportRows = (issues) => {
    if (!draft) return [];
    return issues.map((issue) => [
      ...draft.rows[issue.rowIndex],
      issue.type,
      issue.message,
      issue.severity === 'block' ? '반려' : '재확인',
    ]);
  };

  const handleDownloadIssues = async (type = '') => {
    if (!draft || !validation) return;

    if (!type) {
      try {
        const result = await exportValidationWorkbookToXlsx({
          title: `${draft.fileName.replace(/\.[^.]+$/, '')}_검증결과`,
          originalColumns: draft.originalColumns ?? draft.columns,
          originalRows: draft.originalRows ?? draft.rows,
          editedColumns: draft.columns,
          editedRows: draft.rows,
          validation,
          originalValidation: draft.originalValidation,
          autoFixes: draft.autoFixes,
        });
        setStatusText(`${result.fileName} 파일을 생성했습니다.`);
      } catch (error) {
        setStatusText(error.name === 'AbortError' ? '엑셀 다운로드를 취소했습니다.' : `엑셀 다운로드 실패: ${error.message}`);
      }
      return;
    }

    const issues = type === '반려 데이터'
      ? Object.values(validation.issuesByRow).flat().filter((issue) => issue.severity === 'block')
      : getIssuesForType(type);
    const rows = buildExportRows(issues);

    if (rows.length === 0) {
      setStatusText(`${type}에 해당하는 행이 없습니다.`);
      return;
    }

    try {
      const result = await exportRowsToXlsx({
        columns: [...draft.columns, '검증항목', '검증내용', '처리'],
        rows,
        title: `${draft.fileName.replace(/\.[^.]+$/, '')}_${type}`,
        sheetName: '검증 데이터',
      });
      setStatusText(`${result.fileName} 파일을 생성했습니다.`);
    } catch (error) {
      setStatusText(error.name === 'AbortError' ? '엑셀 다운로드를 취소했습니다.' : `엑셀 다운로드 실패: ${error.message}`);
    }
  };

  const activeIssueRows = activeIssueType ? getIssuesForType(activeIssueType) : [];

  return (
    <PageShell title="업로드 전 검증" description="담당자가 받은 엑셀 파일을 SQL에 넣기 전에 반려해야 할 데이터와 한 번 더 확인할 데이터를 분리해서 검토합니다.">
      <IssueEditModal
        draft={draft}
        issueType={activeIssueType}
        rows={activeIssueRows}
        validation={validation}
        onClose={() => setActiveIssueType('')}
        onCellChange={handleCellChange}
        onApplySuggestion={handleApplySuggestion}
        onDownload={handleDownloadIssues}
        referenceData={referenceData}
        recentData={recentData}
      />

      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Pre-insert validation</p>
            <p className="mt-1 truncate text-lg font-bold text-gray-900 dark:text-gray-100">{draft?.fileName ?? '검증할 파일 없음'}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{statusText}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn btn-primary cursor-pointer">
              파일 업로드
              <input className="sr-only" type="file" accept=".csv,.xlsx" onChange={handleFileUpload} />
            </label>
            <button className="btn btn-secondary" type="button" onClick={() => handleDownloadIssues()} disabled={!draft}>검증 결과 엑셀 다운로드</button>
            <button className="btn btn-secondary" type="button" onClick={handleSave} disabled={!draft || isSaving}>
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </section>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <IssueList title="SQL 저장 전 반려" types={blockingValidationTypes} counts={validation?.counts ?? {}} tone="danger" onSelectType={setActiveIssueType} />
        <IssueList title="담당자 재확인" types={reviewValidationTypes} counts={validation?.counts ?? {}} tone="warning" onSelectType={setActiveIssueType} />
      </div>

      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Upload templates</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">표준 엑셀 양식</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{templateStatus}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" type="button" onClick={handleTemplateDownloadAll}>두 양식 한 번에 다운로드</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {excelUploadTemplates.map((template) => (
            <TemplateMiniCard key={template.id} template={template} onDownload={handleTemplateDownload} />
          ))}
        </div>
      </section>

    </PageShell>
  );
}
