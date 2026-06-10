import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageShell from './PageShell';
import { createSampleSalesRows, parseNumber } from '../data/sampleSalesData';
import { getCurrentUser } from '../utils/authSession';
import { getTodoSummary, priorityMeta } from '../utils/todoSchedule';

const rows = createSampleSalesRows(1200);
const closingDeadlines = [10, 25, 30];

function toCurrency(value) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억원`;
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString('ko-KR')}만원`;
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function getDashboardMetrics(sourceRows) {
  const customerMap = new Map();
  const statusMap = new Map();
  const ownerMap = new Map();
  const ownerCustomerMap = new Map();
  const productMap = new Map();
  const dailyMap = new Map();

  sourceRows.forEach((row) => {
    const customer = row[1] || '거래처 미확인';
    const product = row[3] || '품목 미확인';
    const owner = row[8] || '담당자 미확인';
    const status = row[7] || '정상';
    const amount = parseNumber(row[6]);
    const day = row[0].slice(5);

    customerMap.set(customer, (customerMap.get(customer) ?? 0) + amount);
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
    ownerMap.set(owner, (ownerMap.get(owner) ?? 0) + amount);
    if (!ownerCustomerMap.has(owner)) {
      ownerCustomerMap.set(owner, {
        owner,
        amount: 0,
        transactionCount: 0,
        issueCount: 0,
        customers: new Map(),
      });
    }

    const ownerGroup = ownerCustomerMap.get(owner);
    ownerGroup.amount += amount;
    ownerGroup.transactionCount += 1;
    if (status !== '정상') ownerGroup.issueCount += 1;

    if (!ownerGroup.customers.has(customer)) {
      ownerGroup.customers.set(customer, {
        name: customer,
        amount: 0,
        transactionCount: 0,
        issueCount: 0,
      });
    }

    const ownerCustomer = ownerGroup.customers.get(customer);
    ownerCustomer.amount += amount;
    ownerCustomer.transactionCount += 1;
    if (status !== '정상') ownerCustomer.issueCount += 1;

    productMap.set(product, (productMap.get(product) ?? 0) + amount);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + amount);
  });

  const totalSales = sourceRows.reduce((sum, row) => sum + parseNumber(row[6]), 0);
  const issues = sourceRows.filter((row) => row[7] !== '정상');
  const highValue = sourceRows.filter((row) => row[7] === '고액 거래 확인');
  const duplicate = sourceRows.filter((row) => row[7] === '중복 의심');

  const sortAmount = ([, a], [, b]) => b - a;
  const customers = Array.from(customerMap.entries()).sort(sortAmount).map(([name, amount]) => ({ name, amount, ratio: amount / totalSales }));
  const owners = Array.from(ownerMap.entries()).sort(sortAmount).map(([name, amount]) => ({ name, amount, ratio: amount / totalSales }));
  const products = Array.from(productMap.entries()).sort(sortAmount).map(([name, amount]) => ({ name, amount, ratio: amount / totalSales }));
  const statuses = Array.from(statusMap.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count, ratio: count / sourceRows.length }));
  const daily = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([day, amount]) => ({ day, amount }));
  const maxDaily = Math.max(...daily.map((item) => item.amount));
  const ownerCustomers = Array.from(ownerCustomerMap.values())
    .map((owner) => ({
      ...owner,
      ratio: owner.amount / totalSales,
      customers: Array.from(owner.customers.values()).sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalSales,
    averageSales: Math.round(totalSales / sourceRows.length),
    transactionCount: sourceRows.length,
    issueCount: issues.length,
    issueRate: issues.length / sourceRows.length,
    highValueCount: highValue.length,
    duplicateCount: duplicate.length,
    customers,
    owners,
    products,
    statuses,
    ownerCustomers,
    daily,
    maxDaily,
  };
}

function MetricCard({ label, value, detail, tone = 'teal' }) {
  const toneClass = tone === 'amber'
    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
    : tone === 'rose'
      ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
      : 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p>
        <span className={`rounded px-2 py-1 text-xs font-bold ${toneClass}`}>총무팀</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </div>
  );
}

function HorizontalBars({ title, items, valueFormatter = toCurrency, colorClass = 'bg-teal-600' }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <h2 className="font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.name}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-gray-700 dark:text-gray-200">{item.name}</span>
              <span className="shrink-0 text-gray-500 dark:text-gray-400">{valueFormatter(item.amount ?? item.count)}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
              <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${Math.max(item.ratio * 100, 3)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DailyChart({ items, maxValue }) {
  const safeMaxValue = Math.max(maxValue || 0, 1);
  const chartWidth = 640;
  const chartHeight = 220;
  const padding = { top: 18, right: 18, bottom: 28, left: 42 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const points = items.map((item, index) => {
    const x = padding.left + (items.length <= 1 ? plotWidth : (index / (items.length - 1)) * plotWidth);
    const y = padding.top + plotHeight - (item.amount / safeMaxValue) * plotHeight;
    return { ...item, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${padding.top + plotHeight} L ${padding.left} ${padding.top + plotHeight} Z`
    : '';
  const guideValues = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    ratio,
    y: padding.top + plotHeight - ratio * plotHeight,
    label: toCurrency(safeMaxValue * ratio),
  }));
  const labelPoints = points.filter((_, index) => (
    index === 0 ||
    index === points.length - 1 ||
    index % Math.max(Math.ceil(points.length / 4), 1) === 0
  ));

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-gray-900 dark:text-gray-100">일자별 매출 흐름</h2>
        <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">최근 45일 기준</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 dark:border-gray-700/60 dark:bg-gray-900/30">
        <svg
          className="h-56 w-full"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label="일자별 매출 흐름 선 차트"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="dailySalesArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0d9488" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
            </linearGradient>
            <filter id="dailySalesGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {guideValues.map((guide) => (
            <g key={guide.ratio}>
              <line
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={guide.y}
                y2={guide.y}
                stroke="currentColor"
                className="text-gray-200 dark:text-gray-700"
                strokeDasharray="4 6"
              />
              <text
                x={padding.left - 8}
                y={guide.y + 4}
                textAnchor="end"
                className="fill-gray-400 text-[10px] dark:fill-gray-500"
              >
                {guide.label}
              </text>
            </g>
          ))}
          {areaPath && <path d={areaPath} fill="url(#dailySalesArea)" />}
          {linePath && (
            <g key={linePath}>
              <path
                d={linePath}
                fill="none"
                stroke="#0f766e"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sales-trend-line"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={linePath}
                fill="none"
                stroke="#5eead4"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sales-trend-line sales-trend-line-highlight"
                vectorEffect="non-scaling-stroke"
                filter="url(#dailySalesGlow)"
              />
              <circle r="5" fill="#0f766e" className="sales-trend-runner">
                <animateMotion dur="5s" repeatCount="indefinite" path={linePath} />
              </circle>
            </g>
          )}
          {points.map((point) => (
            <circle
              key={point.day}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#ffffff"
              stroke="#0f766e"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${point.day} ${toCurrency(point.amount)}`}</title>
            </circle>
          ))}
          {labelPoints.map((point) => (
            <text
              key={`label-${point.day}`}
              x={point.x}
              y={chartHeight - 8}
              textAnchor="middle"
              className="fill-gray-500 text-[10px] dark:fill-gray-400"
            >
              {point.day}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}

const roleCopy = {
  ADMIN: {
    title: '총무팀 관리자 대시보드',
    description: '전체 매출, 담당자별 업체 배분, 오류와 승인 대상을 한눈에 확인합니다.',
    scopeLabel: '전체 업체',
    briefTitle: '관리자 점검',
    briefBody: (metrics) => `현재 오류율은 ${(metrics.issueRate * 100).toFixed(1)}%입니다. 담당자별 업체 배분과 고액 거래 승인 대상을 확인한 뒤 월간 매출 보고서 생성 단계로 넘길 수 있습니다.`,
  },
  MANAGER: {
    title: '담당자 대시보드',
    description: '내가 맡은 업체의 매출, 오류, 요청 준비 상태를 확인합니다.',
    scopeLabel: '내 담당 업체',
    briefTitle: '담당 업무 점검',
    briefBody: (metrics) => `내 담당 업체 기준으로 추가 확인 ${metrics.issueCount.toLocaleString('ko-KR')}건이 남아 있습니다. 검증 항목을 정리한 뒤 요청 패키지 생성 단계로 넘기면 됩니다.`,
  },
  VIEWER: {
    title: '조회 대시보드',
    description: '내 담당 업체의 처리 현황과 확인이 필요한 항목을 조회합니다.',
    scopeLabel: '조회 가능 업체',
    briefTitle: '조회 요약',
    briefBody: (metrics) => `내가 볼 수 있는 업체 기준 거래 ${metrics.transactionCount.toLocaleString('ko-KR')}건과 확인 항목 ${metrics.issueCount.toLocaleString('ko-KR')}건이 집계되어 있습니다.`,
  },
};

function getRoleCopy(role) {
  return roleCopy[role] ?? roleCopy.VIEWER;
}

function buildClosingSchedule(customers) {
  const items = customers.map((customer, index) => {
    const contactDone = index % 5 !== 1;
    const amountDone = contactDone && index % 4 !== 2;
    const taxDone = amountDone && index % 6 !== 3;
    const doneCount = [contactDone, amountDone, taxDone].filter(Boolean).length;
    const deadlineDay = closingDeadlines[index % closingDeadlines.length];
    const progress = Math.round((doneCount / 3) * 100);
    const waitingStep = !contactDone ? '거래처 담당자 확인' : !amountDone ? '마감 금액 확정' : !taxDone ? '세금계산서 대조' : '완료';

    return {
      ...customer,
      deadlineDay,
      progress,
      waitingStep,
      contactDone,
      amountDone,
      taxDone,
    };
  });

  const deadlineGroups = closingDeadlines.map((day) => {
    const groupItems = items.filter((item) => item.deadlineDay === day);
    const completed = groupItems.filter((item) => item.progress === 100).length;
    const progress = groupItems.length === 0 ? 100 : Math.round((completed / groupItems.length) * 100);

    return {
      day,
      total: groupItems.length,
      completed,
      progress,
      remaining: groupItems.filter((item) => item.progress < 100),
    };
  });

  return {
    items,
    deadlineGroups,
    remainingCustomers: items.filter((item) => item.progress < 100).sort((a, b) => a.deadlineDay - b.deadlineDay || a.progress - b.progress),
  };
}

function DeadlineProgressPanel({ schedule }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-gray-100">마감 기한별 진척도</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">10일, 25일, 30일 마감 업체를 100% 기준으로 확인합니다.</p>
        </div>
        <Link className="btn btn-secondary" to="/validate/sales-compare">마감 비교 보기</Link>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {schedule.deadlineGroups.map((group) => (
          <div key={group.day} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700/60">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-gray-900 dark:text-gray-100">{group.day}일 마감</p>
              <span className="text-lg font-bold text-teal-700 dark:text-teal-300">{group.progress}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-700">
              <div className="h-2 rounded-full bg-teal-600 dark:bg-teal-400" style={{ width: `${group.progress}%` }} />
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              완료 {group.completed.toLocaleString('ko-KR')} / {group.total.toLocaleString('ko-KR')}개 업체
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RemainingClosingPanel({ items }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-gray-900 dark:text-gray-100">남은 마감 업체</h2>
        <span className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {items.length.toLocaleString('ko-KR')}개
        </span>
      </div>
      <div className="mt-4 max-h-72 space-y-2 overflow-auto no-scrollbar">
        {items.slice(0, 8).map((item) => (
          <Link key={`${item.deadlineDay}-${item.name}`} className="block rounded-lg border border-gray-200 p-3 transition hover:border-teal-300 hover:bg-teal-50 dark:border-gray-700 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10" to="/validate/sales-compare">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.deadlineDay}일 마감 · {item.waitingStep}</p>
              </div>
              <span className="shrink-0 text-sm font-bold text-gray-700 dark:text-gray-200">{item.progress}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
              <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${item.progress}%` }} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TodoAgendaPanel({ summary }) {
  const topItems = [...summary.todayTodos, ...summary.reminders]
    .filter((todo, index, source) => source.findIndex((item) => item.id === todo.id) === index)
    .filter((todo) => !todo.done)
    .slice(0, 4);

  return (
    <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Today agenda</p>
          <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
            오늘 일정 {summary.todayTodos.length.toLocaleString('ko-KR')}개 · 중요 {summary.highOpenCount.toLocaleString('ko-KR')}개
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">알림 시간이 설정된 일정은 마이페이지와 상단 투두에서 함께 관리됩니다.</p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:min-w-[560px]">
          {topItems.length > 0 ? topItems.map((todo) => {
            const meta = priorityMeta[todo.priority] ?? priorityMeta.LOW;
            return (
              <Link key={todo.id} className={`rounded-lg border-l-4 px-3 py-2 ${meta.accent} bg-gray-50 hover:bg-teal-50 dark:bg-gray-900/30 dark:hover:bg-teal-500/10`} to={todo.path || '/settings/preferences'}>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{todo.title}</span>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-bold ${meta.className}`}>{meta.label}</span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{todo.dueDate || todo.due} {todo.reminderAt ? `· ${todo.reminderAt}` : ''}</p>
              </Link>
            );
          }) : (
            <Link className="rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm font-semibold text-gray-500 hover:border-teal-300 hover:text-teal-700 dark:border-gray-700 dark:text-gray-400" to="/settings/preferences">
              오늘 등록된 일정이 없습니다
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function OwnerCustomerPanel({ currentUser, items, isAdmin }) {
  const visibleItems = isAdmin ? items.slice(0, 4) : items.filter((item) => item.owner === currentUser.name).slice(0, 1);
  const fallbackItems = visibleItems.length ? visibleItems : items.slice(0, isAdmin ? 4 : 1);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-gray-100">담당자별 업체 현황</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isAdmin ? '담당자별로 맡은 업체와 확인 건수를 비교합니다.' : '내가 맡은 업체별 거래와 확인 건수를 보여줍니다.'}
          </p>
        </div>
        <span className="rounded-md bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
          업체 배분
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {fallbackItems.map((owner) => (
          <div key={owner.owner} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700/60">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{owner.owner}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {owner.customers.length.toLocaleString('ko-KR')}개 업체 · {owner.transactionCount.toLocaleString('ko-KR')}건
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-gray-700 dark:text-gray-200">{toCurrency(owner.amount)}</span>
            </div>

            <div className="mt-3 space-y-2">
              {owner.customers.slice(0, 3).map((customer) => (
                <div key={customer.name} className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-gray-800 dark:text-gray-100">{customer.name}</span>
                    <span className="shrink-0 text-gray-500 dark:text-gray-400">{toCurrency(customer.amount)}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    거래 {customer.transactionCount.toLocaleString('ko-KR')}건 · 확인 {customer.issueCount.toLocaleString('ko-KR')}건
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClosingSummary({ currentUser, metrics, roleInfo }) {
  const readyCount = metrics.transactionCount - metrics.issueCount;
  const summaryItems = [
    { label: '검증 통과', value: `${readyCount.toLocaleString('ko-KR')}건`, detail: '보고서 반영 가능' },
    { label: '추가 확인', value: `${metrics.issueCount.toLocaleString('ko-KR')}건`, detail: '담당자 검토 필요' },
    { label: currentUser.role === 'ADMIN' ? '고액 승인' : '고액 확인', value: `${metrics.highValueCount.toLocaleString('ko-KR')}건`, detail: currentUser.role === 'ADMIN' ? '총무팀 승인 대상' : '관리자 확인 대상' },
  ];

  return (
    <aside className="rounded-lg border border-teal-100 bg-teal-50 p-4 shadow-xs dark:border-teal-500/20 dark:bg-teal-500/10">
      <p className="text-xs font-bold uppercase text-teal-700 dark:text-teal-300">{roleInfo.briefTitle}</p>
      <h2 className="mt-2 text-lg font-bold text-teal-950 dark:text-teal-100">
        {currentUser.name}
      </h2>
      <p className="mt-2 text-sm leading-6 text-teal-800 dark:text-teal-200">
        {roleInfo.briefBody(metrics)}
      </p>

      <div className="mt-4 space-y-2">
        {summaryItems.map((item) => (
          <div key={item.label} className="rounded-md border border-white/70 bg-white/70 p-3 dark:border-teal-500/20 dark:bg-gray-900/40">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-teal-900 dark:text-teal-100">{item.label}</span>
              <span className="text-sm font-bold text-teal-700 dark:text-teal-200">{item.value}</span>
            </div>
            <p className="mt-1 text-xs text-teal-700/80 dark:text-teal-200/80">{item.detail}</p>
          </div>
        ))}
      </div>

      {currentUser.role !== 'VIEWER' && (
        <Link className="btn btn-primary mt-4 w-full" to="/results/report-generator">
          보고서 생성으로 이동
        </Link>
      )}
    </aside>
  );
}

export default function Dashboard() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser.role === 'ADMIN';
  const roleInfo = getRoleCopy(currentUser.role);
  const scopedRows = useMemo(() => {
    if (isAdmin) return rows;

    const assignedRows = rows.filter((row) => row[8] === currentUser.name);
    return assignedRows.length ? assignedRows : rows;
  }, [currentUser.name, isAdmin]);
  const [dailySalesTrend, setDailySalesTrend] = useState(null);
  const metrics = useMemo(() => {
    const baseMetrics = getDashboardMetrics(scopedRows);

    if (!isAdmin || !dailySalesTrend?.items?.length) {
      return baseMetrics;
    }

    return {
      ...baseMetrics,
      daily: dailySalesTrend.items,
      maxDaily: dailySalesTrend.maxValue,
    };
  }, [dailySalesTrend, isAdmin, scopedRows]);
  const closingSchedule = useMemo(() => buildClosingSchedule(metrics.customers), [metrics.customers]);
  const todoSummary = getTodoSummary(currentUser.id);

  useEffect(() => {
    let isMounted = true;

    async function loadDailySalesTrend() {
      if (!window.api?.getDailySalesTrend) return;

      const result = await window.api.getDailySalesTrend({ limit: 45 });
      if (!isMounted || !result?.ok || !result.items?.length) return;

      setDailySalesTrend({
        items: result.items,
        maxValue: result.maxValue,
        source: result.source,
      });
    }

    loadDailySalesTrend().catch(() => {
      // Browser-only development keeps the sample chart when Electron IPC is unavailable.
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const actionItems = [
    { title: '매출 마감 비교', path: '/validate/sales-compare', detail: '전월/당월 마감 차이 확인', roles: ['ADMIN', 'MANAGER'] },
    { title: '데이터 오류 확인', path: '/collect/data-table', detail: `${metrics.issueCount.toLocaleString('ko-KR')}건 확인 필요`, roles: ['ADMIN', 'MANAGER', 'VIEWER'] },
    { title: '중복 검사', path: '/validate/duplicate-checker', detail: `${metrics.duplicateCount.toLocaleString('ko-KR')}건 중복 의심`, roles: ['ADMIN', 'MANAGER'] },
    { title: '요청 현황', path: '/request/dashboard', detail: '업체별 확인 요청 진행 상태', roles: ['ADMIN', 'MANAGER', 'VIEWER'] },
    { title: '보고서 생성', path: '/results/report-generator', detail: '월간 매출/거래처 비율 양식 준비', roles: ['ADMIN', 'MANAGER'] },
    { title: '활동 로그', path: '/results/activity-logs', detail: '사용자 작업과 변경 이력 확인', roles: ['ADMIN'] },
  ].filter((item) => item.roles.includes(currentUser.role));

  return (
    <PageShell title={roleInfo.title} description={roleInfo.description}>
      <TodoAgendaPanel summary={todoSummary} />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard label="현재 매출" value={toCurrency(metrics.totalSales)} detail={`${roleInfo.scopeLabel} · 평균 거래액 ${toCurrency(metrics.averageSales)}`} />
        <MetricCard label="거래 건수" value={`${metrics.transactionCount.toLocaleString('ko-KR')}건`} detail={`${roleInfo.scopeLabel} 기준 집계`} />
        <MetricCard label="오류 확인" value={`${metrics.issueCount.toLocaleString('ko-KR')}건`} detail={`오류율 ${(metrics.issueRate * 100).toFixed(1)}%`} tone="rose" />
        <MetricCard label="고액 거래" value={`${metrics.highValueCount.toLocaleString('ko-KR')}건`} detail={isAdmin ? '총무팀 추가 승인 대상' : '관리자 확인 대상'} tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <DeadlineProgressPanel schedule={closingSchedule} />
        <RemainingClosingPanel items={closingSchedule.remainingCustomers} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <DailyChart items={metrics.daily} maxValue={metrics.maxDaily} />
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">오늘 처리할 업무</h2>
          <div className="mt-4 space-y-2">
            {actionItems.map((item) => (
              <Link key={item.title} className="block rounded-lg border border-gray-200 p-3 transition hover:border-teal-300 hover:bg-teal-50 dark:border-gray-700 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10" to={item.path}>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.detail}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <OwnerCustomerPanel currentUser={currentUser} items={metrics.ownerCustomers} isAdmin={isAdmin} />
        <HorizontalBars title={isAdmin ? '담당자별 매출 기여도' : '내 담당 업체 매출 비율'} items={isAdmin ? metrics.owners.slice(0, 6) : metrics.customers.slice(0, 6)} colorClass="bg-sky-600" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <HorizontalBars title="거래처별 거래 현황 비율" items={metrics.customers.slice(0, 6)} />
        <HorizontalBars title="검증 종류별 오류 현황" items={metrics.statuses.slice(0, 6)} valueFormatter={(value) => `${value.toLocaleString('ko-KR')}건`} colorClass="bg-amber-500" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">품목별 매출 TOP 5</h2>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">구매/정산 참고</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700/60">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2">품목</th>
                  <th className="px-3 py-2">매출액</th>
                  <th className="px-3 py-2">비율</th>
                  <th className="px-3 py-2">관리 기준</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {metrics.products.slice(0, 5).map((product) => (
                  <tr key={product.name}>
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{product.name}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{toCurrency(product.amount)}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{(product.ratio * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{product.ratio > 0.12 ? '단가 재확인' : '정상'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <ClosingSummary currentUser={currentUser} metrics={metrics} roleInfo={roleInfo} />
      </div>
    </PageShell>
  );
}
