import React, { useMemo, useState } from 'react';

import PageShell from './PageShell';
import { addActivityLog } from '../utils/authSession';
import { createSampleSalesRows, parseNumber } from '../data/sampleSalesData';

const currentRows = createSampleSalesRows(1200);
const previousRows = createSampleSalesRows(1200).map((row, index) => {
  const amount = Math.round(parseNumber(row[6]) * (index % 5 === 0 ? 0.92 : index % 7 === 0 ? 1.08 : 0.98));
  const quantity = Math.max(1, parseNumber(row[4]) - (index % 6 === 0 ? 2 : 0));

  return [
    row[0].replace('2026-05', '2026-04'),
    row[1],
    row[2],
    row[3],
    quantity.toLocaleString('ko-KR'),
    row[5],
    amount.toLocaleString('ko-KR'),
    row[7],
    row[8],
  ];
});

function toCurrency(value) {
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function groupByCustomer(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = row[1] || '거래처 미확인';
    const current = map.get(key) ?? {
      customer: key,
      amount: 0,
      quantity: 0,
      count: 0,
      errors: 0,
      owners: new Set(),
    };
    current.amount += parseNumber(row[6]);
    current.quantity += parseNumber(row[4]);
    current.count += 1;
    current.errors += row[7] === '정상' ? 0 : 1;
    current.owners.add(row[8] || '담당자 미확인');
    map.set(key, current);
  });

  return map;
}

function compareClosingData(currentData, previousData) {
  const currentMap = groupByCustomer(currentData);
  const previousMap = groupByCustomer(previousData);
  const keys = Array.from(new Set([...currentMap.keys(), ...previousMap.keys()]));

  return keys.map((key) => {
    const current = currentMap.get(key) ?? { customer: key, amount: 0, quantity: 0, count: 0, errors: 0, owners: new Set() };
    const previous = previousMap.get(key) ?? { customer: key, amount: 0, quantity: 0, count: 0, errors: 0, owners: new Set() };
    const amountDiff = current.amount - previous.amount;
    const quantityDiff = current.quantity - previous.quantity;
    const rate = previous.amount === 0 ? 1 : amountDiff / previous.amount;
    const absRate = Math.abs(rate);
    const missingType = current.count === 0 ? '당월 누락' : previous.count === 0 ? '전월 누락' : '';
    const status = missingType || absRate >= 0.08 || current.errors > 0 ? '확인 필요' : amountDiff > 0 ? '증가' : amountDiff < 0 ? '감소' : '동일';
    const priority = missingType || absRate >= 0.15 ? '높음' : absRate >= 0.08 || current.errors > 0 ? '보통' : '낮음';

    return {
      customer: key,
      currentAmount: current.amount,
      previousAmount: previous.amount,
      amountDiff,
      quantityDiff,
      currentCount: current.count,
      previousCount: previous.count,
      errorCount: current.errors,
      owners: Array.from(current.owners).join(', ') || Array.from(previous.owners).join(', '),
      rate,
      priority,
      status,
      reason: missingType || (current.errors > 0 ? '검증 오류 포함' : absRate >= 0.08 ? '증감률 기준 초과' : '정상 범위'),
    };
  }).sort((a, b) => {
    const priorityWeight = { 높음: 3, 보통: 2, 낮음: 1 };
    return priorityWeight[b.priority] - priorityWeight[a.priority] || Math.abs(b.amountDiff) - Math.abs(a.amountDiff);
  });
}

export default function SalesClosingComparePage() {
  const [filter, setFilter] = useState('전체');
  const [confirmed, setConfirmed] = useState({});
  const [memoMap, setMemoMap] = useState({});
  const comparisons = useMemo(() => compareClosingData(currentRows, previousRows), []);
  const rowsWithAction = comparisons.map((row) => ({
    ...row,
    actionStatus: confirmed[row.customer] ?? '미확정',
    memo: memoMap[row.customer] ?? '',
  }));
  const filteredRows = filter === '전체'
    ? rowsWithAction
    : rowsWithAction.filter((row) => row.status === filter || row.priority === filter || row.actionStatus === filter);
  const totalCurrent = currentRows.reduce((sum, row) => sum + parseNumber(row[6]), 0);
  const totalPrevious = previousRows.reduce((sum, row) => sum + parseNumber(row[6]), 0);
  const totalDiff = totalCurrent - totalPrevious;
  const issueCount = comparisons.filter((row) => row.status === '확인 필요').length;
  const confirmedCount = Object.values(confirmed).filter((value) => value === '확정').length;
  const progressRate = issueCount === 0 ? 100 : Math.round((confirmedCount / issueCount) * 100);

  const handleConfirm = (customer, actionStatus) => {
    setConfirmed((current) => ({ ...current, [customer]: actionStatus }));
    addActivityLog('INFO', '매출 마감 비교 처리', `${customer} ${actionStatus}`);
  };

  const handleMemo = (customer, memo) => {
    setMemoMap((current) => ({ ...current, [customer]: memo }));
  };

  return (
    <PageShell title="매출 마감 비교" description="당월 매출 마감 자료와 전월 기준 자료를 비교해 거래처별 차이, 누락, 급증 항목을 확인합니다.">
      <div className="mb-4 grid gap-4 md:grid-cols-5">
        {[
          ['당월 매출', toCurrency(totalCurrent), '2026년 5월 기준'],
          ['전월 매출', toCurrency(totalPrevious), '2026년 4월 기준'],
          ['증감액', toCurrency(totalDiff), `${totalDiff >= 0 ? '증가' : '감소'} 항목 확인`],
          ['확인 필요', `${issueCount.toLocaleString('ko-KR')}건`, '증감률 8% 초과/오류 포함'],
          ['확정률', `${progressRate}%`, `${confirmedCount.toLocaleString('ko-KR')}건 확정`],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {['전체', '확인 필요', '높음', '보통', '확정', '보류'].map((item) => (
          <button
            key={item}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${filter === item ? 'bg-teal-600 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
            type="button"
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">거래처별 마감 차이</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">거래처</th>
                <th className="px-4 py-3">당월 매출</th>
                <th className="px-4 py-3">전월 매출</th>
                <th className="px-4 py-3">증감액</th>
                <th className="px-4 py-3">증감률</th>
                <th className="px-4 py-3">사유</th>
                <th className="px-4 py-3">담당</th>
                <th className="px-4 py-3">메모</th>
                <th className="px-4 py-3">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filteredRows.map((row) => (
                <tr key={row.customer}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    <div>{row.customer}</div>
                    <span className={`mt-1 inline-flex rounded px-2 py-0.5 text-xs font-semibold ${row.priority === '높음' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : row.priority === '보통' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{toCurrency(row.currentAmount)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{toCurrency(row.previousAmount)}</td>
                  <td className={`px-4 py-3 font-semibold ${row.amountDiff >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-rose-600 dark:text-rose-300'}`}>
                    {toCurrency(row.amountDiff)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{(row.rate * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.reason}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.owners}</td>
                  <td className="px-4 py-3">
                    <input
                      className="form-input min-w-48"
                      value={row.memo}
                      onChange={(event) => handleMemo(row.customer, event.target.value)}
                      placeholder="확인 메모"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="rounded bg-teal-600 px-2 py-1 text-xs font-semibold text-white" type="button" onClick={() => handleConfirm(row.customer, '확정')}>확정</button>
                      <button className="rounded border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300" type="button" onClick={() => handleConfirm(row.customer, '보류')}>보류</button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{row.actionStatus}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
