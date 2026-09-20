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
  const [showErrorRows, setShowErrorRows] = useState(false);
  const [saveValidOnly, setSaveValidOnly] = useState(false);
  const [needsRevalidation, setNeedsRevalidation] = useState(false);
  const [selectedFixes, setSelectedFixes] = useState({});
  const [expandedFixGroup, setExpandedFixGroup] = useState('');
  const [mappingSelections, setMappingSelections] = useState({});
  const [rememberMappings, setRememberMappings] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [customerMappings, setCustomerMappings] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('upload-customer-mappings') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    const handleCloudSynced = () => {
      setStatusText((current) => current.includes('매출 테이블에 저장') || current.includes('AWS 동기화 대기')
        ? '매출 데이터의 AWS 동기화까지 완료했습니다.'
        : current);
    };
    window.addEventListener('excel-workspace:data-synced', handleCloudSynced);
    return () => window.removeEventListener('excel-workspace:data-synced', handleCloudSynced);
  }, []);

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
    setNeedsRevalidation(false);
    setStatusText(message || (result.passed
      ? `반려 항목 없이 검증했습니다. 자동 보정 ${autoFixCount.toLocaleString('ko-KR')}행, 담당자 재확인 ${result.reviewCount.toLocaleString('ko-KR')}건을 확인한 뒤 다음 단계로 넘길 수 있습니다.`
      : `자동 보정 ${autoFixCount.toLocaleString('ko-KR')}행 반영 후 반려 ${result.blockerCount.toLocaleString('ko-KR')}건이 남아 SQL 저장 전 수정이 필요합니다.`));
  };

  const loadFile = async (file) => {
    if (!file) return;

    setFileError(null);
  setStatusText(`${file.name} 파일을 읽는 중입니다.`);

    try {
      const parsed = await parseSpreadsheetFile(file);
      const parsedIndexes = validateBeforeInsert(parsed.columns, [], { referenceData }).indexes;
      const mappedRows = parsed.rows.map((row) => {
        const key = JSON.stringify([
          getCell(row, parsedIndexes.customerCode).trim(),
          getCell(row, parsedIndexes.customerName).trim(),
        ]);
        const customer = (referenceData.customers ?? []).find((item) => getCustomerCode(item) === customerMappings[key]);
        if (!customer) return row;
        const next = [...row];
        if (parsedIndexes.customerCode >= 0) next[parsedIndexes.customerCode] = getCustomerCode(customer);
        if (parsedIndexes.customerName >= 0) next[parsedIndexes.customerName] = getCustomerName(customer);
        return next;
      });
      setSelectedFixes({});
      setMappingSelections({});
      setExpandedFixGroup('');
      setShowErrorRows(false);
      setSaveValidOnly(false);
      runValidation({ ...parsed, rows: mappedRows, originalRows: parsed.rows.map((row) => [...row]) }, null, { initializeOriginal: true });
    } catch (error) {
  console.error('업로드 파일 검증 실패:', error);

  if (error.code === 'INCOMPATIBLE_XLSX') {
    setFileError({
      title: '엑셀 파일 형식을 변환해주세요',
      message:
        '선택한 파일은 현재 프로그램에서 읽을 수 없는 XLSX 구조입니다.',
      fileName: file.name,
      showConversionGuide: true,
    });

    setStatusText('엑셀 파일 형식을 변환한 후 다시 업로드해주세요.');
    return;
  }

  if (error.code === 'SHEET_NOT_FOUND') {
    setFileError({
      title: '시트를 찾을 수 없습니다',
      message:
        '업로드한 엑셀 파일에 읽을 수 있는 시트가 없습니다.',
      fileName: file.name,
      showConversionGuide: false,
    });

    setStatusText('엑셀 파일에서 시트를 찾지 못했습니다.');
    return;
  }

  if (error.code === 'EMPTY_SPREADSHEET') {
    setFileError({
      title: '업로드할 데이터가 없습니다',
      message:
        '첫 번째 시트에서 컬럼과 데이터를 찾지 못했습니다.',
      fileName: file.name,
      showConversionGuide: false,
    });

    setStatusText('엑셀 파일에서 데이터를 찾지 못했습니다.');
    return;
  }

  setFileError({
    title: '파일을 읽지 못했습니다',
    message:
      error.message || '파일을 확인한 후 다시 업로드해주세요.',
    fileName: file.name,
    showConversionGuide: false,
  });

  setStatusText(
    `파일 검증 실패: ${error.message || '알 수 없는 오류'}`
  );
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

    if (nextValidation.blockerCount > 0 && !saveValidOnly) {
      setStatusText(`반려 ${nextValidation.blockerCount.toLocaleString('ko-KR')}건이 남아 있습니다. 수정 후 다시 저장해주세요.`);
      return;
    }

    if (!window.api?.saveData) {
      setStatusText('매출 테이블 저장은 Electron 데스크톱 앱에서 사용할 수 있습니다.');
      return;
    }

    const rowsToSave = saveValidOnly
      ? stamped.rows.filter((_, index) => !(nextValidation.issuesByRow[index] ?? []).some((issue) => issue.severity === 'block'))
      : stamped.rows;
    const issuesToSave = saveValidOnly
      ? Object.fromEntries(stamped.rows.flatMap((_, index) => {
        if ((nextValidation.issuesByRow[index] ?? []).some((issue) => issue.severity === 'block')) return [];
        const savedIndex = stamped.rows.slice(0, index).filter((__, prior) =>
          !(nextValidation.issuesByRow[prior] ?? []).some((issue) => issue.severity === 'block')).length;
        return validationIssues[index] ? [[savedIndex, validationIssues[index]]] : [];
      }))
      : validationIssues;
    if (rowsToSave.length === 0) {
      setStatusText('저장 가능한 행이 없습니다. 오류를 수정하고 재검증해주세요.');
      return;
    }

    setIsSaving(true);
    setStatusText(`${draft.fileName} 데이터를 매출 테이블에 저장하는 중입니다.`);

    try {
      const result = await window.api.saveData({
        fileName: draft.fileName,
        columns: stamped.columns,
        rows: rowsToSave,
        rowActions: {},
        validationIssues: issuesToSave,
        savedAt: new Date().toISOString(),
      });

      if (!result?.ok) throw new Error(result?.message || 'SQLite 저장에 실패했습니다.');

      addActivityLog('INFO', '업로드 검증 데이터 저장', `${draft.fileName} / ${rowsToSave.length}건`);
      setStatusText(
        `${rowsToSave.length.toLocaleString('ko-KR')}건을 매출 테이블에 저장했습니다. AWS 동기화를 대기합니다.`
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
    setNeedsRevalidation(true);
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
  const proposedFixes = draft && validation ? draft.rows.flatMap((row, rowIndex) => {
    const fix = buildAutoFixPatch(row, validation.indexes, validation.issuesByRow[rowIndex] ?? [], referenceData, recentData);
    return fix ? [{ rowIndex, ...fix }] : [];
  }) : [];
  const errorRowIndexes = validation ? Object.keys(validation.issuesByRow)
    .map(Number).filter((index) => validation.issuesByRow[index].some((issue) => issue.severity === 'block')) : [];
  const customerGroups = draft && validation && validation.indexes.customerName >= 0
    ? [...new Map(draft.rows.map((row, index) => {
      const code = getCell(row, validation.indexes.customerCode).trim();
      const name = getCell(row, validation.indexes.customerName).trim();
      return [JSON.stringify([code, name]), { code, name, index }];
    }).filter(([, item]) => item.code || item.name)).values()]
      .filter((item) => !(referenceData.customers ?? []).some((customer) =>
        item.code && item.name && getCustomerCode(customer) === item.code && getCustomerName(customer) === item.name))
    : [];
  const applySelectedMappings = () => {
    if (!draft || !validation) return;
    const selections = customerGroups.filter((group) => mappingSelections[JSON.stringify([group.code, group.name])]);
    if (!selections.length) return;
    const nextRows = draft.rows.map((row) => {
      const key = JSON.stringify([getCell(row, validation.indexes.customerCode).trim(), getCell(row, validation.indexes.customerName).trim()]);
      const customer = (referenceData.customers ?? []).find((item) => getCustomerCode(item) === mappingSelections[key]);
      if (!customer) return row;
      const next = [...row];
      if (validation.indexes.customerCode >= 0) next[validation.indexes.customerCode] = getCustomerCode(customer);
      if (validation.indexes.customerName >= 0) next[validation.indexes.customerName] = getCustomerName(customer);
      return next;
    });
    if (rememberMappings) {
      const mappings = { ...customerMappings, ...mappingSelections };
      setCustomerMappings(mappings);
      window.localStorage.setItem('upload-customer-mappings', JSON.stringify(mappings));
    }
    setMappingSelections({});
    runValidation({ ...draft, rows: nextRows }, `${selections.length}개 거래처 매핑을 적용하고 재검증했습니다.`);
  };

  const fixGroups = Object.values(proposedFixes.flatMap((fix) => Object.entries(fix.patch).map(([key, value]) => ({
    key,
    rowIndex: fix.rowIndex,
    original: draft.rows[fix.rowIndex][validation.indexes[key]],
    value,
  }))).reduce((groups, item) => {
    (groups[item.key] ??= { key: item.key, items: [] }).items.push(item);
    return groups;
  }, {}));
  const warningRows = draft && validation ? draft.rows.filter((_, index) => !errorRowIndexes.includes(index) && (validation.issuesByRow[index] ?? []).length > 0).length : 0;
  const normalRows = draft ? draft.rows.length - errorRowIndexes.length - warningRows : 0;
  const wizardStep = !draft ? 0 : proposedFixes.length || customerGroups.length || errorRowIndexes.length || needsRevalidation ? 2 : 3;
  const issueValue = (issue) => {
    const key = issue.type.includes('거래처명') ? 'customerName'
      : issue.type.includes('거래처 코드') ? 'customerCode'
        : issue.type.includes('품목명') ? 'productName'
          : issue.type.includes('품목 코드') ? 'productCode'
            : issue.type.includes('단가') ? 'unitPrice'
              : issue.type.includes('금액') ? 'amount' : '';
    return key && validation.indexes[key] >= 0 ? getCell(draft.rows[issue.rowIndex], validation.indexes[key]) || '—' : '—';
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    loadFile(file);
  };

  return (
    <PageShell title="업로드 전 검증" description="파일을 선택하고, 수정과 거래처 매핑을 확인한 뒤 DB에 저장합니다.">
      <Modal
  open={Boolean(fileError)}
  eyebrow="Excel upload"
  title={fileError?.title ?? '파일 업로드 오류'}
  description={fileError?.message ?? ''}
  size="lg"
  onClose={() => setFileError(null)}
  showCloseButton
  headerActions={(
    <button
      className="btn btn-primary"
      type="button"
      onClick={() => setFileError(null)}
    >
      확인
    </button>
  )}
>
  <div className="space-y-5 p-5">
    {fileError?.fileName && (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/60">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
          선택한 파일
        </p>

        <p className="mt-1 break-all text-sm font-semibold text-gray-900 dark:text-gray-100">
          {fileError.fileName}
        </p>
      </div>
    )}

    {fileError?.showConversionGuide && (
      <>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-gray-100">
            Microsoft Excel에서 변환하기
          </h3>

          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-gray-600 dark:text-gray-300">
            <li>해당 파일을 Microsoft Excel에서 엽니다.</li>
            <li>
              상단 메뉴에서
              <strong className="mx-1 text-gray-900 dark:text-gray-100">
                파일 → 다른 이름으로 저장
              </strong>
              을 선택합니다.
            </li>
            <li>
              파일 형식을
              <strong className="mx-1 text-gray-900 dark:text-gray-100">
                Excel 통합 문서 (*.xlsx)
              </strong>
              로 선택합니다.
            </li>
            <li>새 파일로 저장한 뒤 다시 업로드합니다.</li>
          </ol>
        </div>

        <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">
            Google 스프레드시트에서 변환하기
          </h3>

          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-gray-600 dark:text-gray-300">
            <li>Google 스프레드시트에서 파일을 엽니다.</li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">
                파일 → 다운로드
              </strong>
              를 선택합니다.
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">
                Microsoft Excel(.xlsx)
              </strong>
              을 선택합니다.
            </li>
            <li>다운로드한 파일을 다시 업로드합니다.</li>
          </ol>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          파일의 확장자만 직접 변경하지 마세요.
          실제 파일 형식은 변환되지 않으므로 반드시 Excel이나
          Google 스프레드시트에서 다시 저장해야 합니다.
        </div>
      </>
    )}
  </div>
</Modal>
      
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

      <nav aria-label="업로드 진행 단계" className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700/60 dark:bg-gray-800 sm:grid-cols-4">
        {['파일 업로드', '데이터 검증', '수정 · 매핑', '최종 확인'].map((label, index) => <div key={label} className={`rounded-md px-3 py-2 text-sm font-semibold ${index === wizardStep ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/20 dark:text-accent-200' : index < wizardStep ? 'text-teal-700 dark:text-teal-300' : 'text-gray-400'}`}>{index < wizardStep ? '✓' : index + 1} {label}</div>)}
      </nav>

      {!draft && <section className={`mb-4 rounded-lg border-2 border-dashed bg-white px-6 py-14 text-center dark:bg-gray-800 ${isDragging ? 'border-accent-500 bg-accent-50 dark:bg-accent-500/10' : 'border-gray-300 dark:border-gray-600'}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); loadFile(event.dataTransfer.files?.[0]); }}>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">엑셀 파일을 업로드하세요</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">매출 데이터를 DB에 저장하기 전에 검사합니다.</p>
        <label className="btn btn-primary mt-6 inline-flex cursor-pointer">파일 선택<input className="sr-only" type="file" accept=".csv,.xlsx" onChange={handleFileUpload} /></label>
        <p className="mt-3 text-xs text-gray-500">또는 파일을 이곳에 끌어다 놓으세요 · .xlsx / .csv</p>
        <p role="status" className="mt-3 text-sm text-gray-500">{statusText}</p>
      </section>}

      {draft && <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">업로드한 파일</p>
            <p className="mt-1 truncate text-lg font-bold text-gray-900 dark:text-gray-100">{draft.fileName}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{statusText}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn btn-primary cursor-pointer">
              다른 파일 선택
              <input className="sr-only" type="file" accept=".csv,.xlsx" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </section>}

      {draft && validation && (
        <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">데이터 검증 결과</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[['총 행', draft.rows.length, 'text-gray-900 dark:text-gray-100'], ['정상', normalRows, 'text-teal-700 dark:text-teal-300'], ['확인 필요', warningRows, 'text-amber-700 dark:text-amber-300'], ['오류', errorRowIndexes.length, 'text-red-700 dark:text-red-300']].map(([label, count, tone]) => <div key={label} className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/50"><p className="text-xs text-gray-500">{label}</p><p className={`text-xl font-bold ${tone}`}>{count.toLocaleString('ko-KR')}</p></div>)}
          </div>
          {proposedFixes.length > 0 && <p className="mt-2 text-sm text-accent-700 dark:text-accent-300">자동 수정 제안 {proposedFixes.length.toLocaleString('ko-KR')}행</p>}
          {needsRevalidation && <p className="mt-2 text-sm font-semibold text-amber-700">수정한 값이 있습니다. 저장 전에 재검증하세요.</p>}
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={showErrorRows} onChange={(event) => setShowErrorRows(event.target.checked)} />오류 행만 보기</label>
          </div>
          {showErrorRows && <div className="mt-3 max-h-44 overflow-auto text-sm">{errorRowIndexes.length ? errorRowIndexes.map((index) => <p key={index} className="border-t border-gray-100 py-1">{index + 2}행 · {(validation.issuesByRow[index] ?? []).filter((issue) => issue.severity === 'block').map((issue) => issue.message).join(' / ')}</p>) : '오류 행이 없습니다.'}</div>}
        </section>
      )}

      {fixGroups.length > 0 && <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex items-center justify-between"><h2 className="font-bold">자동 수정 제안</h2><span className="text-sm text-accent-700 dark:text-accent-300">{proposedFixes.length}행</span></div>
        <p className="mt-1 text-sm text-gray-500">수정할 항목을 컬럼별로 선택하세요. 상세보기에서 원본과 수정값을 비교할 수 있습니다.</p>
        <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">{fixGroups.map((group) => <div key={group.key} className="py-2">
          <div className="flex flex-wrap items-center gap-3 text-sm"><label className="flex flex-1 items-center gap-2 font-semibold"><input type="checkbox" checked={selectedFixes[group.key] !== false} onChange={(event) => setSelectedFixes((current) => ({ ...current, [group.key]: event.target.checked }))} />{draft.columns[validation.indexes[group.key]]} 수정</label><button type="button" className="text-accent-700 underline dark:text-accent-300" onClick={() => setExpandedFixGroup(expandedFixGroup === group.key ? '' : group.key)}>{group.items.length}건 상세보기</button></div>
          <p className="mt-1 pl-6 text-xs text-gray-500">{String(group.items[0].original ?? '')} → {String(group.items[0].value)}</p>
          {expandedFixGroup === group.key && <div className="mt-2 max-h-40 overflow-auto rounded-md bg-gray-50 p-2 text-xs dark:bg-gray-900/50">{group.items.map((item) => <p key={item.rowIndex} className="py-1">{item.rowIndex + 2}행 · {String(item.original ?? '')} → {String(item.value)}</p>)}</div>}
        </div>)}</div>
        <button className="btn btn-secondary mt-3" type="button" onClick={() => {
          const rows = draft.rows.map((row) => [...row]);
          fixGroups.forEach((group) => { if (selectedFixes[group.key] !== false) group.items.forEach((item) => { rows[item.rowIndex][validation.indexes[group.key]] = formatPatchValue(item.value); }); });
          setSelectedFixes({});
          runValidation({ ...draft, rows }, '선택한 수정 제안을 반영하고 재검증했습니다.');
        }} disabled={!fixGroups.some((group) => selectedFixes[group.key] !== false)}>선택한 수정 적용</button>
      </section>}

      {customerGroups.length > 0 && (referenceData.customers ?? []).length > 0 && <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex items-center justify-between"><h2 className="font-bold">거래처 매핑</h2><span className="text-sm text-amber-700 dark:text-amber-300">{customerGroups.length}개 확인 필요</span></div>
        <p className="mt-1 text-sm text-gray-500">원본 코드와 이름을 확인하고 DB 기준 거래처를 직접 선택하세요. 추천은 자동 확정되지 않습니다.</p>
        <div className="mt-3 max-h-48 overflow-auto">{customerGroups.map((group) => <div key={JSON.stringify([group.code, group.name])} className="flex flex-wrap items-center gap-3 border-t border-gray-100 py-2 text-sm">
          <span className="min-w-48 font-medium">{group.code || '코드 없음'} · {group.name || '이름 없음'}</span><span aria-hidden="true">→</span>
          <select className="form-select" aria-label={`${group.code} ${group.name} 기준 거래처`} value={mappingSelections[JSON.stringify([group.code, group.name])] ?? ''} onChange={(event) => setMappingSelections((current) => ({ ...current, [JSON.stringify([group.code, group.name])]: event.target.value }))}><option value="">거래처 선택</option>{(referenceData.customers ?? []).map((customer) => <option key={getCustomerCode(customer)} value={getCustomerCode(customer)}>{getCustomerName(customer)} ({getCustomerCode(customer)})</option>)}</select>
          {(() => { const candidate = findCustomerCandidate(draft.rows[group.index], validation.indexes, referenceData, null); return candidate?.score >= 0.4 ? <button type="button" className="text-xs text-accent-700 underline dark:text-accent-300" onClick={() => setMappingSelections((current) => ({ ...current, [JSON.stringify([group.code, group.name])]: getCustomerCode(candidate.customer) }))}>추천: {getCustomerName(candidate.customer)}</button> : null; })()}
        </div>)}</div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rememberMappings} onChange={(event) => setRememberMappings(event.target.checked)} />이 매핑을 저장하고 다음 업로드부터 자동 적용</label><button type="button" className="btn btn-secondary" onClick={applySelectedMappings} disabled={!Object.values(mappingSelections).some(Boolean)}>매핑 적용</button></div>
      </section>}

      {draft && validation && <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex items-center justify-between"><h2 className="font-bold">직접 수정이 필요한 데이터</h2><span className="text-sm text-red-700 dark:text-red-300">{errorRowIndexes.length}행</span></div>
        {errorRowIndexes.length ? <div className="mt-3 max-h-64 overflow-auto"><table className="min-w-full text-sm"><thead><tr>{['행', '검증 항목', '현재 값', '문제', '수정'].map((heading) => <th key={heading} className="border-b px-3 py-2 text-left">{heading}</th>)}</tr></thead><tbody>{errorRowIndexes.flatMap((index) => (validation.issuesByRow[index] ?? []).filter((issue) => issue.severity === 'block').map((issue) => <tr key={`${index}-${issue.type}`} className="border-b border-gray-100 dark:border-gray-700"><td className="px-3 py-2">{index + 2}</td><td className="px-3 py-2">{issue.type}</td><td className="px-3 py-2">{issueValue(issue)}</td><td className="px-3 py-2">{issue.message}</td><td className="px-3 py-2"><button type="button" className="text-accent-700 underline dark:text-accent-300" onClick={() => setActiveIssueType(issue.type)}>직접 수정</button></td></tr>))}</tbody></table></div> : <p className="mt-3 text-sm text-teal-700 dark:text-teal-300">필수 검증 오류가 없습니다.</p>}
      </section>}

      {draft && validation && <details className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800"><summary className="cursor-pointer font-bold">최종 데이터 미리보기</summary><p className="mt-2 text-sm text-gray-500">현재 검토본의 첫 20행입니다.</p><div className="mt-3 max-h-80 overflow-auto"><table className="min-w-full text-sm"><thead><tr>{['행', ...draft.columns, '결과'].map((column, index) => <th key={`${column}-${index}`} className="whitespace-nowrap border-b px-3 py-2 text-left">{column}</th>)}</tr></thead><tbody>{draft.rows.slice(0, 20).map((row, index) => <tr key={index} className="border-b border-gray-100"><td className="px-3 py-2">{index + 2}</td>{draft.columns.map((_, columnIndex) => <td key={columnIndex} className="whitespace-nowrap px-3 py-2">{String(row[columnIndex] ?? '')}</td>)}<td className="whitespace-nowrap px-3 py-2">{(validation.issuesByRow[index] ?? []).some((issue) => issue.severity === 'block') ? '오류' : (validation.issuesByRow[index] ?? []).length ? '경고' : '정상'}</td></tr>)}</tbody></table></div></details>}

      {draft && <details className="mb-4"><summary className="cursor-pointer text-sm font-semibold text-gray-600 dark:text-gray-300">검증 항목별 상세 보기</summary><div className="mt-3 grid gap-4 xl:grid-cols-2"><IssueList title="SQL 저장 전 반려" types={blockingValidationTypes} counts={validation?.counts ?? {}} tone="danger" onSelectType={setActiveIssueType} /><IssueList title="담당자 재확인" types={reviewValidationTypes} counts={validation?.counts ?? {}} tone="warning" onSelectType={setActiveIssueType} /></div></details>}

      {!draft && <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">처음 사용하시나요? 표준 양식을 이용하면 오류를 줄일 수 있습니다.</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{templateStatus}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" type="button" onClick={handleTemplateDownloadAll}>두 양식 한 번에 다운로드</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{excelUploadTemplates.map((template) => <button key={template.id} className="btn btn-secondary" type="button" onClick={() => handleTemplateDownload(template)}>{template.title} ↓</button>)}</div>
        <details className="mt-3"><summary className="cursor-pointer text-sm text-accent-700 dark:text-accent-300">양식 자세히 보기</summary><div className="mt-3 grid gap-3 xl:grid-cols-2">{excelUploadTemplates.map((template) => <TemplateMiniCard key={template.id} template={template} onDownload={handleTemplateDownload} />)}</div></details>
      </section>}

      {draft && validation && <div className="sticky bottom-0 z-20 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:mx-0 sm:rounded-t-lg">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className={`text-sm font-semibold ${validation.blockerCount || customerGroups.length || needsRevalidation ? 'text-amber-700 dark:text-amber-300' : 'text-teal-700 dark:text-teal-300'}`}>{needsRevalidation ? '수정한 내용이 있습니다. 재검증하세요.' : customerGroups.length ? `거래처 ${customerGroups.length}개를 확인해주세요.` : validation.blockerCount ? `오류 ${errorRowIndexes.length}행이 남아 있어 DB에 저장할 수 없습니다.` : `모든 필수 검증을 통과했습니다. ${draft.rows.length.toLocaleString('ko-KR')}행을 저장할 수 있습니다.`}</p><div className="flex flex-wrap gap-2"><button className="btn btn-secondary" type="button" onClick={() => handleDownloadIssues()}>검증 결과 Excel 다운로드</button><button className="btn btn-secondary" type="button" onClick={() => runValidation(draft)}>재검증</button><button className="btn btn-primary" type="button" onClick={handleSave} disabled={isSaving || needsRevalidation || validation.blockerCount > 0 || customerGroups.length > 0}>{isSaving ? '저장 중...' : `DB에 ${draft.rows.length.toLocaleString('ko-KR')}행 저장`}</button></div></div>
      </div>}

    </PageShell>
  );
}
