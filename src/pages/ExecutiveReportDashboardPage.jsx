import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageShell from './PageShell';
import { parseNumber } from '../utils/dataFormat';
import { getCurrentMonthSalesRange, queryAllSalesData } from '../utils/sqlSalesData';

function toCurrency(value) {
  const amount = Number(value) || 0;
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString('ko-KR')}만원`;
  return `${amount.toLocaleString('ko-KR')}원`;
}

function isClosingComplete(row) {
  return Boolean(row.amountConfirmed && row.taxMatched && row.requestSent);
}

function buildReportData(salesRows, closingRows) {
  const totalSales = salesRows.reduce((sum, row) => sum + parseNumber(row[6]), 0);
  const issueRows = salesRows.filter((row) => (row[7] || '정상') !== '정상');
  const normalizedClosings = closingRows.map((row) => ({
    ...row,
    amount: Number(row.confirmedAmount || row.salesAmount || 0),
    complete: isClosingComplete(row),
  }));
  const riskClosings = normalizedClosings
    .filter((row) => !row.complete)
    .sort((left, right) => Number(right.riskScore || 0) - Number(left.riskScore || 0) || right.amount - left.amount);
  const deadlineOrder = ['10일', '25일', '30일'];
  const deadlineProgress = deadlineOrder.map((deadline) => {
    const rows = normalizedClosings.filter((row) => row.deadline === deadline);
    const done = rows.filter((row) => row.complete).length;
    const riskAmount = rows.filter((row) => !row.complete).reduce((sum, row) => sum + row.amount, 0);
    return { deadline, total: rows.length, done, riskAmount };
  }).filter((item) => item.total > 0);

  return {
    totalSales,
    transactionCount: salesRows.length,
    issueCount: issueRows.length,
    closingCount: normalizedClosings.length,
    completeCount: normalizedClosings.filter((row) => row.complete).length,
    riskAmount: riskClosings.reduce((sum, row) => sum + row.amount, 0),
    riskClosings,
    deadlineProgress,
  };
}

function ProgressBar({ value, color = 'bg-teal-600' }) {
  return <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700"><div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} /></div>;
}

function MetricCard({ label, value, detail, tone = 'teal' }) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  };
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p><span className={`rounded px-2 py-1 text-xs font-bold ${tones[tone]}`}>실제 데이터</span></div>
      <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </section>
  );
}

export default function ExecutiveReportDashboardPage() {
  const [salesRows, setSalesRows] = useState([]);
  const [closingRows, setClosingRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const report = useMemo(() => buildReportData(salesRows, closingRows), [salesRows, closingRows]);
  const completionRate = report.closingCount ? Math.round((report.completeCount / report.closingCount) * 100) : 0;

  useEffect(() => {
    let active = true;
    async function loadReport() {
      setLoading(true);
      setError('');
      try {
        if (!window.api?.getClosingCompanies) throw new Error('마감 상태를 조회하는 데스크톱 SQLite 기능을 사용할 수 없습니다.');
        const [salesResult, closingResult] = await Promise.all([
          queryAllSalesData(getCurrentMonthSalesRange()),
          window.api.getClosingCompanies({}),
        ]);
        if (!closingResult?.ok || !Array.isArray(closingResult.rows)) throw new Error('마감 상태 테이블을 불러오지 못했습니다.');
        if (!active) return;
        setSalesRows(salesResult.rows ?? []);
        setClosingRows(closingResult.rows);
      } catch (loadError) {
        if (active) setError(loadError?.message || '사장님 보고 데이터를 불러오지 못했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadReport();
    return () => { active = false; };
  }, []);

  return (
    <PageShell title="사장님 보고 대시보드" description="현재 SQLite의 매출·마감 상태 테이블을 기준으로 대표 보고 항목을 집계합니다.">
      {error && <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">보고서 데이터를 불러오지 못했습니다: {error}</div>}
      {loading && <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200">SQLite에서 사장님 보고 데이터를 불러오는 중입니다.</div>}

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="이번 달 마감률" value={`${completionRate}%`} detail={`마감 상태 ${report.closingCount}개 중 ${report.completeCount}개 완료`} />
        <MetricCard label="보고 필요 금액" value={toCurrency(report.riskAmount)} detail="미완료 마감 상태의 매출 기준" tone="rose" />
        <MetricCard label="검증 예외" value={`${report.issueCount.toLocaleString('ko-KR')}건`} detail={`이번 달 거래 ${report.transactionCount.toLocaleString('ko-KR')}건 기준`} tone="amber" />
        <MetricCard label="보고 대상 업체" value={`${report.riskClosings.length}개사`} detail="확정·대조·발송 중 미완료 업체" tone="sky" />
      </div>

      {!loading && !error && report.closingCount === 0 && <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-12 text-center text-sm font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">현재 월의 마감 상태 데이터가 없습니다. 마감 워크스페이스에서 매출 파일과 마감 상태를 먼저 확인해 주세요.</div>}

      {(report.closingCount > 0 || report.transactionCount > 0) && <>
        <div className="mb-4 grid gap-4 xl:grid-cols-3">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">오늘 보고 결론</h2>
            <div className="mt-4 rounded-lg bg-rose-50 p-4 dark:bg-rose-500/10">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">우선 처리 포인트</p>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">미완료 {report.riskClosings.length}개사 · {toCurrency(report.riskAmount)}</p>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">마감 상태에서 확정, 세금계산서 대조, 요청 발송이 끝나지 않은 업체를 우선 표시합니다.</p>
            </div>
            <Link className="btn btn-secondary mt-4" to="/closing-workspace/overview">마감 워크스페이스 열기</Link>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-2">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">마감일별 진행률</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {report.deadlineProgress.map((item) => {
                const progress = item.total ? Math.round((item.done / item.total) * 100) : 0;
                return <div key={item.deadline} className="rounded-lg border border-gray-100 p-3 dark:border-gray-700/60"><div className="flex justify-between gap-2 text-sm"><span className="font-semibold">{item.deadline} 마감</span><span className="text-gray-500">{item.done}/{item.total}</span></div><div className="mt-3"><ProgressBar value={progress} color={progress >= 80 ? 'bg-teal-600' : progress >= 50 ? 'bg-amber-500' : 'bg-rose-500'} /></div><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">미완료 영향액 {toCurrency(item.riskAmount)}</p></div>;
              })}
              {report.deadlineProgress.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">마감일이 지정된 상태가 없습니다.</p>}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-gray-900 dark:text-gray-100">대표 보고 예외 TOP</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">마감 상태 테이블의 미완료 업체를 위험도와 금액 순으로 표시합니다.</p></div><Link className="btn btn-secondary" to="/closing-workspace/send-queue">발송 큐로 이동</Link></div>
          <div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 dark:bg-gray-900/30 dark:text-gray-400"><tr><th className="px-3 py-2">업체</th><th className="px-3 py-2">미완료 항목</th><th className="px-3 py-2 text-right">금액</th><th className="px-3 py-2">담당자</th><th className="px-3 py-2">권장 액션</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {report.riskClosings.slice(0, 10).map((row) => { const incomplete = [!row.amountConfirmed && '금액 확정', !row.taxMatched && '세금계산서 대조', !row.requestSent && '요청 발송'].filter(Boolean).join(' · '); return <tr key={row.id || row.customerCode || row.company}><td className="px-3 py-2 font-semibold text-gray-900 dark:text-gray-100">{row.company || row.customerName || row.customerCode}</td><td className="px-3 py-2 text-rose-700 dark:text-rose-300">{incomplete || row.reason || '마감 확인'}</td><td className="px-3 py-2 text-right font-semibold">{toCurrency(row.amount)}</td><td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.owner || '미지정'}</td><td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.reason || '마감 상태 확인'}</td></tr>; })}
            {report.riskClosings.length === 0 && <tr><td className="px-3 py-8 text-center text-gray-500 dark:text-gray-400" colSpan="5">보고할 미완료 마감 상태가 없습니다.</td></tr>}
          </tbody></table></div>
        </section>
      </>}
    </PageShell>
  );
}
