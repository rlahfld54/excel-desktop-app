import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';
import { addActivityLog } from '../utils/authSession';
import { parseNumber } from '../data/sampleSalesData';
import { useWorkspaceDataStore } from '../stores/workspaceDataStore';

const closingDays = [10, 25, 30];
const contactNames = ['정산담당', '영업지원', '회계담당', '관리담당'];

function buildPreviousRows(rows) {
  return rows.map((row, index) => {
    const amount = Math.round(parseNumber(row[6]) * (index % 5 === 0 ? 0.92 : index % 7 === 0 ? 1.08 : 0.98));
    const quantity = Math.max(1, parseNumber(row[4]) - (index % 6 === 0 ? 2 : 0));

    return [
      String(row[0] ?? '').replace('2026-05', '2026-04'),
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
}

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

  return keys.map((key, index) => {
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
      id: `closing-${index + 1}`,
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

function getDefaultWorkflow(row, index) {
  const deadlineDay = closingDays[index % closingDays.length];
  const hasIssue = row.status === '확인 필요';
  const hasTaxGap = index % 4 === 0 || Math.abs(row.amountDiff) > 1500000;
  const contactDone = !hasIssue || index % 3 === 0;
  const amountDone = contactDone && !hasTaxGap;
  const taxDone = amountDone && index % 5 !== 0;
  const taxAmount = row.currentAmount + (hasTaxGap ? (index % 2 === 0 ? 120000 : -85000) : 0);
  const doneCount = [contactDone, amountDone, taxDone].filter(Boolean).length;

  return {
    deadlineDay,
    contactName: `${row.customer} ${contactNames[index % contactNames.length]}`,
    contactChannel: index % 3 === 0 ? 'KAKAO' : 'EMAIL',
    contactStatus: contactDone ? '확인 완료' : '연락 필요',
    settledAmount: amountDone ? row.currentAmount : Math.max(row.currentAmount + row.amountDiff * 0.2, 0),
    amountStatus: amountDone ? '금액 확정' : '금액 조율',
    taxInvoiceAmount: taxAmount,
    taxInvoiceStatus: taxDone ? '일치' : hasTaxGap ? '차이 확인' : '대기',
    progress: Math.round((doneCount / 3) * 100),
  };
}

function ProgressBar({ value }) {
  return (
    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
      <div className="h-2 rounded-full bg-teal-600 dark:bg-teal-400" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}

export default function SalesClosingComparePage() {
  const { rows: currentRows, loadLatest } = useWorkspaceDataStore((state) => ({
    rows: state.rows,
    loadLatest: state.loadLatest,
  }));
  const [filter, setFilter] = useState('전체');
  const [confirmed, setConfirmed] = useState({});
  const [memoMap, setMemoMap] = useState({});
  const [workflowMap, setWorkflowMap] = useState({});
  const previousRows = useMemo(() => buildPreviousRows(currentRows), [currentRows]);
  const comparisons = useMemo(() => compareClosingData(currentRows, previousRows), [currentRows, previousRows]);

  useEffect(() => {
    loadLatest().catch(() => {
      // Browser-only development keeps the workspace store fallback data.
    });
  }, [loadLatest]);
  const rowsWithAction = comparisons.map((row, index) => {
    const workflow = {
      ...getDefaultWorkflow(row, index),
      ...(workflowMap[row.customer] ?? {}),
    };
    const progress = Math.round(([
      workflow.contactStatus === '확인 완료',
      workflow.amountStatus === '금액 확정',
      workflow.taxInvoiceStatus === '일치',
    ].filter(Boolean).length / 3) * 100);

    return {
      ...row,
      workflow: { ...workflow, progress },
      actionStatus: confirmed[row.customer] ?? (progress === 100 ? '확정' : '미확정'),
      memo: memoMap[row.customer] ?? '',
    };
  });
  const filteredRows = filter === '전체'
    ? rowsWithAction
    : rowsWithAction.filter((row) => row.status === filter || row.priority === filter || row.actionStatus === filter);
  const totalCurrent = currentRows.reduce((sum, row) => sum + parseNumber(row[6]), 0);
  const totalPrevious = previousRows.reduce((sum, row) => sum + parseNumber(row[6]), 0);
  const totalDiff = totalCurrent - totalPrevious;
  const issueCount = comparisons.filter((row) => row.status === '확인 필요').length;
  const confirmedCount = rowsWithAction.filter((row) => row.actionStatus === '확정').length;
  const contactDoneCount = rowsWithAction.filter((row) => row.workflow.contactStatus === '확인 완료').length;
  const taxMatchCount = rowsWithAction.filter((row) => row.workflow.taxInvoiceStatus === '일치').length;
  const progressRate = rowsWithAction.length === 0 ? 100 : Math.round((confirmedCount / rowsWithAction.length) * 100);

  const handleConfirm = (customer, actionStatus) => {
    setConfirmed((current) => ({ ...current, [customer]: actionStatus }));
    addActivityLog('INFO', '매출 마감 비교 처리', `${customer} ${actionStatus}`);
  };

  const handleMemo = (customer, memo) => {
    setMemoMap((current) => ({ ...current, [customer]: memo }));
  };

  const handleWorkflowChange = (customer, field, value) => {
    setWorkflowMap((current) => ({
      ...current,
      [customer]: {
        ...(current[customer] ?? {}),
        [field]: field.includes('Amount') ? Number(value) : value,
      },
    }));
  };

  return (
    <PageShell title="매출 마감 비교" description="거래처 담당자 확인, 마감 금액 확정, 세금계산서 대조까지 거래처별로 마감 상태를 체크합니다.">
      <div className="mb-4 grid gap-4 md:grid-cols-5">
        {[
          ['당월 매출', toCurrency(totalCurrent), '2026년 5월 기준'],
          ['전월 매출', toCurrency(totalPrevious), '2026년 4월 기준'],
          ['증감액', toCurrency(totalDiff), `${totalDiff >= 0 ? '증가' : '감소'} 항목 확인`],
          ['거래처 확인', `${contactDoneCount.toLocaleString('ko-KR')}건`, '담당자 소통 완료'],
          ['세금계산서 일치', `${taxMatchCount.toLocaleString('ko-KR')}건`, `전체 확정률 ${progressRate}%`],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
          </div>
        ))}
      </div>

      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-gray-100">마감 확정 체크 흐름</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">거래처 담당자 확인, 확정 금액, 세금계산서 금액이 모두 맞아야 마감 확정으로 봅니다.</p>
          </div>
          <div className="grid min-w-0 gap-2 text-sm sm:grid-cols-3 lg:min-w-[520px]">
            {['거래처 소통', '마감 금액 확정', '세금계산서 대조'].map((step, index) => (
              <div key={step} className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700/60">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">STEP {index + 1}</p>
                <p className="mt-1 font-semibold text-gray-800 dark:text-gray-100">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
                <th className="px-4 py-3">거래처 확인</th>
                <th className="px-4 py-3">마감 금액</th>
                <th className="px-4 py-3">세금계산서</th>
                <th className="px-4 py-3">진척</th>
                <th className="px-4 py-3">증감액</th>
                <th className="px-4 py-3">증감률</th>
                <th className="px-4 py-3">사유</th>
                <th className="px-4 py-3">메모</th>
                <th className="px-4 py-3">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filteredRows.map((row) => (
                <tr key={row.customer}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    <div>{row.customer}</div>
                    <div className="mt-1 text-xs font-normal text-gray-500 dark:text-gray-400">{row.owners} · {row.workflow.deadlineDay}일 마감</div>
                    <span className={`mt-1 inline-flex rounded px-2 py-0.5 text-xs font-semibold ${row.priority === '높음' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : row.priority === '보통' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="min-w-40 text-gray-700 dark:text-gray-200">{row.workflow.contactName}</p>
                    <select className="form-select mt-2 h-8 min-w-32" value={row.workflow.contactStatus} onChange={(event) => handleWorkflowChange(row.customer, 'contactStatus', event.target.value)}>
                      {['연락 필요', '확인 완료'].map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="form-input h-8 min-w-36"
                      type="number"
                      value={Math.round(row.workflow.settledAmount)}
                      onChange={(event) => handleWorkflowChange(row.customer, 'settledAmount', event.target.value)}
                    />
                    <select className="form-select mt-2 h-8 min-w-32" value={row.workflow.amountStatus} onChange={(event) => handleWorkflowChange(row.customer, 'amountStatus', event.target.value)}>
                      {['금액 조율', '금액 확정'].map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <p className="min-w-36 text-gray-700 dark:text-gray-200">{toCurrency(row.workflow.taxInvoiceAmount)}</p>
                    <select className="form-select mt-2 h-8 min-w-32" value={row.workflow.taxInvoiceStatus} onChange={(event) => handleWorkflowChange(row.customer, 'taxInvoiceStatus', event.target.value)}>
                      {['대기', '차이 확인', '일치'].map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="min-w-28">
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
                        <span>{row.workflow.progress}%</span>
                        <span>{row.actionStatus}</span>
                      </div>
                      <ProgressBar value={row.workflow.progress} />
                    </div>
                  </td>
                  <td className={`px-4 py-3 font-semibold ${row.amountDiff >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-rose-600 dark:text-rose-300'}`}>
                    {toCurrency(row.amountDiff)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{(row.rate * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.reason}</td>
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
