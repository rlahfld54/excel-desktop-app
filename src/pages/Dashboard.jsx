import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

import PageShell from './PageShell';
import { createSampleSalesRows, parseNumber } from '../data/sampleSalesData';
import { getCurrentUser } from '../utils/authSession';

const rows = createSampleSalesRows(1200);

function toCurrency(value) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억원`;
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString('ko-KR')}만원`;
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function getDashboardMetrics(sourceRows) {
  const customerMap = new Map();
  const statusMap = new Map();
  const ownerMap = new Map();
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
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-gray-900 dark:text-gray-100">일자별 매출 흐름</h2>
        <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">최근 45일 기준</span>
      </div>
      <div className="mt-4 flex h-56 items-end gap-1 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 dark:border-gray-700/60 dark:bg-gray-900/30">
        {items.map((item) => (
          <div key={item.day} className="flex min-w-2 flex-1 flex-col items-center justify-end gap-2">
            <div
              className="w-full rounded-t bg-teal-600 transition hover:bg-teal-500"
              style={{ height: `${Math.max((item.amount / maxValue) * 100, 5)}%` }}
              title={`${item.day} ${toCurrency(item.amount)}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const currentUser = getCurrentUser();
  const metrics = useMemo(() => getDashboardMetrics(rows), []);
  const actionItems = [
    { title: '매출 마감 비교', path: '/validate/sales-compare', detail: '전월/당월 마감 차이 확인' },
    { title: '데이터 오류 확인', path: '/collect/data-table', detail: `${metrics.issueCount.toLocaleString('ko-KR')}건 검토 필요` },
    { title: '중복 검사', path: '/validate/duplicate-checker', detail: `${metrics.duplicateCount.toLocaleString('ko-KR')}건 중복 의심` },
    { title: '보고서 생성', path: '/results/report-generator', detail: '월간 매출/거래처 비율 양식 준비' },
  ];

  return (
    <PageShell title="총무팀 대시보드" description="매출, 거래처 비율, 데이터 오류, 보고서 생성 상태를 한눈에 확인합니다.">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard label="현재 매출" value={toCurrency(metrics.totalSales)} detail={`평균 거래액 ${toCurrency(metrics.averageSales)}`} />
        <MetricCard label="거래 건수" value={`${metrics.transactionCount.toLocaleString('ko-KR')}건`} detail="1,200건 샘플 기준 집계" />
        <MetricCard label="오류 확인" value={`${metrics.issueCount.toLocaleString('ko-KR')}건`} detail={`오류율 ${(metrics.issueRate * 100).toFixed(1)}%`} tone="rose" />
        <MetricCard label="고액 거래" value={`${metrics.highValueCount.toLocaleString('ko-KR')}건`} detail="총무팀 추가 승인 대상" tone="amber" />
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
        <HorizontalBars title="거래처별 거래 현황 비율" items={metrics.customers.slice(0, 6)} />
        <HorizontalBars title="담당자별 매출 기여도" items={metrics.owners.slice(0, 6)} colorClass="bg-sky-600" />
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

        <section className="rounded-lg border border-teal-100 bg-teal-50 p-4 shadow-xs dark:border-teal-500/20 dark:bg-teal-500/10">
          <p className="text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">Signed in</p>
          <h2 className="mt-2 text-lg font-bold text-teal-950 dark:text-teal-100">{currentUser.name} 관리자</h2>
          <p className="mt-2 text-sm leading-6 text-teal-800 dark:text-teal-200">
            현재 대시보드는 총무팀 보고 기준으로 구성되어 있으며, 보고서 생성 페이지의 회사 공통 양식과 같은 포인트 색상을 사용합니다.
          </p>
          <Link className="btn btn-primary mt-4 w-full" to="/results/report-generator">보고서 생성으로 이동</Link>
        </section>
      </div>
    </PageShell>
  );
}
