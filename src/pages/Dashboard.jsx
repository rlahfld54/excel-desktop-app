import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageShell from './PageShell';
import { parseNumber } from '../data/sampleSalesData';
import { getCurrentUser } from '../utils/authSession';
import { priorityMeta, readTeamTodos, todoChangedEvent } from '../utils/todoSchedule';
import { getCurrentMonthSalesRange, queryAllSalesData } from '../utils/sqlSalesData';

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

function TeamDecisionPanel({ metrics, requests }) {
  const urgentRequests = requests.filter((request) => request.priority === 'HIGH').length;
  const issueRate = Math.round(metrics.issueRate * 100);

  const decisionItems = [
    `검증 오류 ${metrics.issueCount.toLocaleString('ko-KR')}건 중 긴급 요청 ${urgentRequests}건을 먼저 처리해야 합니다.`,
    `고액 거래 확인 ${metrics.highValueCount.toLocaleString('ko-KR')}건은 사장님 보고 전 총무팀 확인이 필요합니다.`,
    `중복 의심 ${metrics.duplicateCount.toLocaleString('ko-KR')}건은 마감 워크스페이스에서 업체별로 정리하면 됩니다.`,
  ];

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <h2 className="font-bold text-gray-900 dark:text-gray-100">오늘 총무팀 결론</h2>
      <div className="mt-4 rounded-lg bg-rose-50 p-4 dark:bg-rose-500/10">
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">우선 처리 포인트</p>
        <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">오류율 {issueRate}% · 긴급 요청 {urgentRequests}건</p>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
          마감 지연으로 이어질 수 있는 검증 오류와 타부서 요청을 먼저 확인합니다.
        </p>
      </div>
      <div className="mt-3 space-y-2">
        {decisionItems.map((item) => (
          <p key={item} className="rounded-md border border-gray-100 px-3 py-2 text-sm text-gray-600 dark:border-gray-700/60 dark:text-gray-300">{item}</p>
        ))}
      </div>
    </section>
  );
}


function OwnerRiskSummary({ owners }) {
  const visibleOwners = owners.slice(0, 4);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <h2 className="font-bold text-gray-900 dark:text-gray-100">담당자별 처리 리스크</h2>
      <div className="mt-4 space-y-3">
        {visibleOwners.map((owner) => {
          const riskRate = owner.transactionCount === 0 ? 0 : Math.round((owner.issueCount / owner.transactionCount) * 100);

          return (
            <div key={owner.owner}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-gray-800 dark:text-gray-100">{owner.owner}</span>
                <span className="text-gray-500 dark:text-gray-400">{owner.issueCount}/{owner.transactionCount} · {riskRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                <div className="h-2 rounded-full bg-rose-500" style={{ width: `${Math.max(riskRate, 3)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TeamRequestBoard({ requests }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-gray-100">타부서 요청</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">총무팀으로 들어온 요청을 처리 우선순위대로 확인합니다.</p>
        </div>
        <span className="rounded bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          긴급 {requests.filter((request) => request.priority === 'HIGH').length}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {requests.map((request) => {
          const meta = priorityMeta[request.priority] ?? priorityMeta.LOW;

          return (
            <article key={request.id} className={`rounded-md border px-3 py-2 ${meta.className}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] font-bold dark:bg-gray-900/30">{request.department}</span>
                    <p className="truncate text-sm font-bold">{request.title}</p>
                  </div>
                  <p className="mt-1 text-xs opacity-80">담당 {request.owner} · {request.due}</p>
                </div>
                <span className="shrink-0 rounded bg-white/70 px-2 py-1 text-xs font-bold dark:bg-gray-900/30">{request.status}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TeamScheduleOverview({ schedules }) {
  const toneClass = {
    rose: 'border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
    amber: 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    teal: 'border-teal-100 bg-teal-50 text-teal-700 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-300',
    sky: 'border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  };
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const visibleSchedules = schedules
    .filter((schedule) => schedule.itemType === 'SCHEDULE')
    .sort((a, b) => `${a.dueDate} ${a.reminderAt || '99:99'}`.localeCompare(`${b.dueDate} ${b.reminderAt || '99:99'}`))
    .slice(0, 10)
    .map((schedule) => {
      const date = new Date(`${schedule.dueDate}T00:00:00`);
      return {
        ...schedule,
        dateLabel: schedule.dueDate?.slice(5) ?? '-',
        dayLabel: Number.isNaN(date.getTime()) ? '-' : dayLabels[date.getDay()],
        timeLabel: schedule.reminderAt || '종일',
        tone: schedule.priority === 'HIGH' ? 'rose' : schedule.priority === 'MEDIUM' ? 'amber' : 'sky',
      };
    });

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-gray-100">총무팀 전체 일정표</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">총무팀 한달 일정을 한눈에 볼 수 있습니다.</p>
        </div>
        <Link className="btn btn-secondary" to="/schedule/todos">일정관리</Link>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {visibleSchedules.map((schedule) => (
          <article key={`${schedule.dueDate}-${schedule.title}`} className={`min-h-32 rounded-md border p-3 ${toneClass[schedule.tone]}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold opacity-80">{schedule.dayLabel}</p>
                <p className="text-xl font-bold">{schedule.dateLabel}</p>
              </div>
              <span className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] font-bold dark:bg-gray-900/30">{schedule.timeLabel}</span>
            </div>
            <p className="mt-4 text-sm font-bold leading-5">{schedule.title}</p>
          </article>
        ))}
        {visibleSchedules.length === 0 && (
          <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">
            등록된 총무팀 일정이 없습니다.
          </div>
        )}
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
    title: '총무팀 대시보드',
    description: '총무팀 기준으로 마감, 오류, 요청 준비 상태를 확인합니다.',
    scopeLabel: '총무팀 담당 업체',
    briefTitle: '총무팀 업무 점검',
    briefBody: (metrics) => `총무팀 담당 업체 기준으로 추가 확인 ${metrics.issueCount.toLocaleString('ko-KR')}건이 남아 있습니다. 검증 항목을 정리한 뒤 요청 패키지 생성 단계로 넘기면 됩니다.`,
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

export default function Dashboard() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser.role === 'ADMIN';
  const roleInfo = getRoleCopy(currentUser.role);
  const [rows, setRows] = useState([]);
  const [teamSchedules, setTeamSchedules] = useState(() => readTeamTodos());
  const [departmentRequests, setDepartmentRequests] = useState([]);
  const scopedRows = rows;
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

  useEffect(() => {
    let active = true;
    queryAllSalesData(getCurrentMonthSalesRange())
      .then((result) => {
        if (active) setRows(result.rows);
      })
      .catch(() => {
        if (active) setRows([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDepartmentRequests() {
      if (!window.api?.getDepartmentRequests) return;
      const result = await window.api.getDepartmentRequests();
      if (!isMounted || !result?.ok || !Array.isArray(result.requests)) return;
      setDepartmentRequests(result.requests);
    }

    loadDepartmentRequests().catch(() => setDepartmentRequests([]));

    return () => {
      isMounted = false;
    };
  }, []);

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

    loadDailySalesTrend().catch(() => setDailySalesTrend(null));

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const refreshTeamSchedules = () => setTeamSchedules(readTeamTodos());
    window.addEventListener(todoChangedEvent, refreshTeamSchedules);
    window.addEventListener('storage', refreshTeamSchedules);
    return () => {
      window.removeEventListener(todoChangedEvent, refreshTeamSchedules);
      window.removeEventListener('storage', refreshTeamSchedules);
    };
  }, []);


  return (
    <PageShell title={roleInfo.title} description={roleInfo.description}>

      {/* <ExecutiveReportContent /> */}

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="총 매출" value={toCurrency(metrics.totalSales)} detail={`전체 업체 · 평균 거래액 ${toCurrency(metrics.averageSales)}`} />
        <MetricCard label="거래 건수" value={`${metrics.transactionCount.toLocaleString('ko-KR')}건`} detail="총무팀 전체 기준 집계" />
        <MetricCard label="오류 확인" value={`${metrics.issueCount.toLocaleString('ko-KR')}건`} detail={`오류율 ${(metrics.issueRate * 100).toFixed(1)}%`} tone="rose" />
        <MetricCard label="고액 거래" value={`${metrics.highValueCount.toLocaleString('ko-KR')}건`} detail="보고 전 확인 대상" tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <TeamScheduleOverview schedules={teamSchedules} />
        <TeamRequestBoard requests={departmentRequests} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <DailyChart items={metrics.daily} maxValue={metrics.maxDaily} />
        <OwnerRiskSummary owners={metrics.ownerCustomers} />
      </div>

    </PageShell>
  );
}
