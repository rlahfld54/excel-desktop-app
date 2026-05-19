import React, { useMemo, useState } from 'react';

import PageShell from './PageShell';
import { addActivityLog, getCurrentUser } from '../utils/authSession';
import {
  createSampleSalesRows,
  findDuplicateGroups,
  parseNumber,
  sampleCustomers,
  sampleProducts,
} from '../data/sampleSalesData';

const sampleRows = createSampleSalesRows(1200);

const defaultSettings = {
  highAmount: 1000000,
  bulkQuantity: 120,
  priceTolerance: 0,
  requiredColumns: ['거래일', '거래처명', '품목명', '수량', '단가', '금액', '담당자'],
  duplicateKeys: ['거래일', '거래처명', '품목코드', '수량', '금액'],
};

function toNumberText(value) {
  return Number(value).toLocaleString('ko-KR');
}

function toCurrency(value) {
  return `${toNumberText(value)}원`;
}

function getProductByCode(code) {
  return sampleProducts.find((product) => product.code === code);
}

function getCustomerByName(name) {
  return sampleCustomers.find((customer) => customer.name === name || customer.aliases.includes(name));
}

function runEmptyValueCheck(rows) {
  const targets = [
    { label: '거래일', index: 0 },
    { label: '거래처명', index: 1 },
    { label: '품목코드', index: 2 },
    { label: '품목명', index: 3 },
    { label: '수량', index: 4 },
    { label: '단가', index: 5 },
    { label: '금액', index: 6 },
    { label: '담당자', index: 8 },
  ];
  const issues = rows.flatMap((row, rowIndex) =>
    targets
      .filter((target) => String(row[target.index] ?? '').trim() === '')
      .map((target) => ({
        rowNumber: rowIndex + 1,
        type: '빈값',
        message: `${target.label} 값이 비어 있습니다.`,
      }))
  );

  return {
    processed: rows.length,
    issueCount: issues.length,
    fixedCount: 0,
    issues,
  };
}

function runAmountCheck(rows) {
  const issues = rows.flatMap((row, rowIndex) => {
    const quantity = parseNumber(row[4]);
    const unitPrice = parseNumber(row[5]);
    const amount = parseNumber(row[6]);
    const expected = quantity * unitPrice;

    if (amount === expected) return [];

    return [{
      rowNumber: rowIndex + 1,
      type: '금액 불일치',
      message: `금액 ${toCurrency(amount)} → 계산값 ${toCurrency(expected)}`,
    }];
  });

  return {
    processed: rows.length,
    issueCount: issues.length,
    fixedCount: issues.length,
    issues,
  };
}

function runDuplicateCheck(rows) {
  const groups = findDuplicateGroups(rows);
  const issues = groups.flatMap((group) =>
    group.items.map((item) => ({
      rowNumber: item.rowIndex + 1,
      type: '중복 의심',
      message: `${group.customerName || '거래처 미확인'} / ${group.productName} / ${group.amount}`,
    }))
  );

  return {
    processed: rows.length,
    issueCount: issues.length,
    fixedCount: 0,
    issues,
  };
}

function runCustomerStandardCheck(rows) {
  const issues = rows.flatMap((row, rowIndex) => {
    const name = row[1];
    if (!name) {
      return [{
        rowNumber: rowIndex + 1,
        type: '거래처 누락',
        message: '거래처명이 비어 있어 표준화할 수 없습니다.',
      }];
    }
    const customer = getCustomerByName(name);
    if (!customer) {
      return [{
        rowNumber: rowIndex + 1,
        type: '거래처 미등록',
        message: `${name} 거래처가 기준정보에 없습니다.`,
      }];
    }
    if (customer.name !== name) {
      return [{
        rowNumber: rowIndex + 1,
        type: '거래처 별칭',
        message: `${name} → ${customer.name} 표준화 후보`,
      }];
    }
    return [];
  });

  return {
    processed: rows.length,
    issueCount: issues.length,
    fixedCount: issues.filter((issue) => issue.type === '거래처 별칭').length,
    issues,
  };
}

function runProductMappingCheck(rows) {
  const issues = rows.flatMap((row, rowIndex) => {
    const code = row[2];
    const name = row[3];
    if (!code) {
      const candidate = sampleProducts.find((product) => product.name === name || product.aliases.includes(name));
      return [{
        rowNumber: rowIndex + 1,
        type: '품목코드 누락',
        message: candidate ? `${name} → ${candidate.code} 추천` : `${name} 품목 코드 후보 없음`,
      }];
    }
    const product = getProductByCode(code);
    if (!product) {
      return [{
        rowNumber: rowIndex + 1,
        type: '품목코드 미등록',
        message: `${code} 코드가 기준정보에 없습니다.`,
      }];
    }
    if (product.name !== name) {
      return [{
        rowNumber: rowIndex + 1,
        type: '품목명 불일치',
        message: `${code} 기준 품목명은 ${product.name}입니다.`,
      }];
    }
    return [];
  });

  return {
    processed: rows.length,
    issueCount: issues.length,
    fixedCount: issues.filter((issue) => issue.type === '품목코드 누락').length,
    issues,
  };
}

function runPriceCheck(rows, settings) {
  const issues = rows.flatMap((row, rowIndex) => {
    const product = getProductByCode(row[2]);
    if (!product) return [];
    const actualPrice = parseNumber(row[5]);
    const diff = Math.abs(actualPrice - product.price);
    if (diff <= settings.priceTolerance) return [];

    return [{
      rowNumber: rowIndex + 1,
      type: '단가 기준 불일치',
      message: `${row[3]} 단가 ${toCurrency(actualPrice)} / 기준 ${toCurrency(product.price)}`,
    }];
  });

  return {
    processed: rows.length,
    issueCount: issues.length,
    fixedCount: 0,
    issues,
  };
}

function runClosingPreflight(rows, settings) {
  const issues = rows.flatMap((row, rowIndex) => {
    const amount = parseNumber(row[6]);
    const quantity = parseNumber(row[4]);
    const rowIssues = [];

    if (amount >= settings.highAmount) {
      rowIssues.push({
        rowNumber: rowIndex + 1,
        type: '고액 거래',
        message: `${toCurrency(amount)} 거래는 승인 확인이 필요합니다.`,
      });
    }
    if (quantity >= settings.bulkQuantity) {
      rowIssues.push({
        rowNumber: rowIndex + 1,
        type: '대량 구매',
        message: `${toNumberText(quantity)}개 거래는 구매 사유 확인이 필요합니다.`,
      });
    }

    return rowIssues;
  });

  return {
    processed: rows.length,
    issueCount: issues.length,
    fixedCount: 0,
    issues,
  };
}

const automationDefinitions = [
  {
    id: 'empty-values',
    title: '빈값 검사',
    description: '필수 컬럼의 공백, 누락 값을 찾아 업로드 차단 후보로 표시합니다.',
    category: '업로드 전',
    run: runEmptyValueCheck,
  },
  {
    id: 'amount-recalc',
    title: '금액 재계산',
    description: '수량 × 단가와 금액이 맞는지 확인하고 보정 후보를 계산합니다.',
    category: '정산 검증',
    run: runAmountCheck,
  },
  {
    id: 'duplicates',
    title: '중복 거래 탐지',
    description: '거래일, 거래처, 품목, 수량, 금액 기준으로 중복 의심 거래를 묶습니다.',
    category: '정산 검증',
    run: runDuplicateCheck,
  },
  {
    id: 'customer-standard',
    title: '거래처명 표준화',
    description: '거래처 별칭과 미등록 거래처를 기준정보와 비교합니다.',
    category: '기준정보',
    run: runCustomerStandardCheck,
  },
  {
    id: 'product-mapping',
    title: '품목 코드 매핑',
    description: '품목명과 품목코드가 기준정보와 맞는지 확인합니다.',
    category: '기준정보',
    run: runProductMappingCheck,
  },
  {
    id: 'price-standard',
    title: '단가 기준 검증',
    description: '품목별 기준 단가와 실제 단가를 비교합니다.',
    category: '기준정보',
    run: runPriceCheck,
  },
  {
    id: 'closing-preflight',
    title: '마감 전 사전 점검',
    description: '고액 거래, 대량 구매 등 마감 전에 승인 확인이 필요한 항목을 찾습니다.',
    category: '마감',
    run: runClosingPreflight,
  },
];

function summarizeResults(results) {
  const values = Object.values(results);
  return {
    executed: values.length,
    processed: values.reduce((sum, result) => sum + result.processed, 0),
    issues: values.reduce((sum, result) => sum + result.issueCount, 0),
    fixed: values.reduce((sum, result) => sum + result.fixedCount, 0),
  };
}

export default function AutomationPage() {
  const currentUser = getCurrentUser();
  const [settings, setSettings] = useState(defaultSettings);
  const [selectedIds, setSelectedIds] = useState(automationDefinitions.map((item) => item.id));
  const [results, setResults] = useState({});
  const [lastRun, setLastRun] = useState(null);
  const [statusText, setStatusText] = useState('자동화 항목을 선택하고 실행하면 결과가 활동 로그에 남습니다.');
  const summary = useMemo(() => summarizeResults(results), [results]);
  const recentIssues = Object.entries(results)
    .flatMap(([id, result]) => {
      const definition = automationDefinitions.find((item) => item.id === id);
      return result.issues.slice(0, 3).map((issue) => ({
        ...issue,
        automationTitle: definition?.title ?? id,
      }));
    })
    .slice(0, 10);

  const runAutomation = (definition) => {
    const result = definition.run(sampleRows, settings);
    setResults((current) => ({ ...current, [definition.id]: result }));
    setLastRun(new Date().toLocaleString('ko-KR', { hour12: false }));
    setStatusText(`${definition.title} 실행 완료: 확인 필요 ${result.issueCount.toLocaleString('ko-KR')}건`);
    addActivityLog('INFO', '자동화 실행', `${definition.title} / 확인 필요 ${result.issueCount.toLocaleString('ko-KR')}건`);
  };

  const runSelectedAutomations = () => {
    const selectedDefinitions = automationDefinitions.filter((definition) => selectedIds.includes(definition.id));
    const nextResults = Object.fromEntries(selectedDefinitions.map((definition) => [definition.id, definition.run(sampleRows, settings)]));
    const nextSummary = summarizeResults(nextResults);

    setResults(nextResults);
    setLastRun(new Date().toLocaleString('ko-KR', { hour12: false }));
    setStatusText(`선택 자동화 ${selectedDefinitions.length.toLocaleString('ko-KR')}개 실행 완료`);
    addActivityLog('INFO', '자동화 일괄 실행', `확인 필요 ${nextSummary.issues.toLocaleString('ko-KR')}건 / 보정 후보 ${nextSummary.fixed.toLocaleString('ko-KR')}건`);
  };

  const toggleSelected = (id) => {
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  };

  const updateSetting = (field, value) => {
    setSettings((current) => ({ ...current, [field]: Number(value) || 0 }));
  };

  return (
    <PageShell title="자동화 작업" description="마감 전에 반복 확인해야 하는 빈값, 금액, 중복, 기준정보, 단가, 승인 항목을 자동으로 점검합니다.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" type="button" onClick={runSelectedAutomations}>
          선택 자동화 실행
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => setSelectedIds(automationDefinitions.map((item) => item.id))}>
          전체 선택
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => setSelectedIds([])}>
          선택 해제
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400">{statusText}</span>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-4">
        {[
          ['실행 항목', `${summary.executed.toLocaleString('ko-KR')}개`, lastRun ? `최근 실행 ${lastRun}` : '아직 실행 전'],
          ['처리 행 수', `${summary.processed.toLocaleString('ko-KR')}행`, '1,200건 샘플 기준'],
          ['확인 필요', `${summary.issues.toLocaleString('ko-KR')}건`, '마감 전 검토 대상'],
          ['보정 후보', `${summary.fixed.toLocaleString('ko-KR')}건`, '자동 보정 가능 후보'],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="grid gap-4 lg:grid-cols-2">
          {automationDefinitions.map((definition) => {
            const result = results[definition.id];
            const selected = selectedIds.includes(definition.id);

            return (
              <article key={definition.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">{definition.category}</p>
                    <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{definition.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{definition.description}</p>
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                    <input
                      className="form-checkbox"
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelected(definition.id)}
                    />
                    선택
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-900/30">
                    <p className="text-xs text-gray-500 dark:text-gray-400">처리</p>
                    <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">{result ? result.processed.toLocaleString('ko-KR') : '-'}</p>
                  </div>
                  <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-500/10">
                    <p className="text-xs text-amber-700 dark:text-amber-300">확인</p>
                    <p className="mt-1 font-bold text-amber-800 dark:text-amber-200">{result ? result.issueCount.toLocaleString('ko-KR') : '-'}</p>
                  </div>
                  <div className="rounded-md bg-teal-50 p-3 dark:bg-teal-500/10">
                    <p className="text-xs text-teal-700 dark:text-teal-300">보정</p>
                    <p className="mt-1 font-bold text-teal-800 dark:text-teal-200">{result ? result.fixedCount.toLocaleString('ko-KR') : '-'}</p>
                  </div>
                </div>

                <button className="btn btn-secondary mt-4 w-full" type="button" onClick={() => runAutomation(definition)}>
                  이 자동화만 실행
                </button>
              </article>
            );
          })}
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">자동화 기준 설정</h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">고액 거래 기준</span>
                <input className="form-input w-full" type="number" value={settings.highAmount} onChange={(event) => updateSetting('highAmount', event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">대량 구매 기준 수량</span>
                <input className="form-input w-full" type="number" value={settings.bulkQuantity} onChange={(event) => updateSetting('bulkQuantity', event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">단가 허용 오차</span>
                <input className="form-input w-full" type="number" value={settings.priceTolerance} onChange={(event) => updateSetting('priceTolerance', event.target.value)} />
              </label>
            </div>
            <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
              실행자: <span className="font-semibold text-gray-800 dark:text-gray-100">{currentUser.name}</span>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">최근 확인 필요 항목</h2>
            <div className="mt-4 space-y-2">
              {recentIssues.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">자동화를 실행하면 확인 필요 항목이 표시됩니다.</p>
              ) : recentIssues.map((issue) => (
                <div key={`${issue.automationTitle}-${issue.rowNumber}-${issue.message}`} className="rounded-md border border-gray-200 p-3 dark:border-gray-700/60">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{issue.automationTitle}</p>
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">#{issue.rowNumber}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{issue.message}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
