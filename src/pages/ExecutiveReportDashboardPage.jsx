import React from 'react';
import { Link } from 'react-router-dom';

import PageShell from './PageShell';

const executiveMetrics = [
  {
    label: '이번 달 마감률',
    value: '68%',
    detail: '총 38개 업체 중 26개 완료',
    tone: 'teal',
  },
  {
    label: '보고 필요 금액',
    value: '2.8억원',
    detail: '미확정/내부 검토 영향액',
    tone: 'rose',
  },
  {
    label: '오늘 보고 예외',
    value: '9건',
    detail: '대표 보고 전 확인 필요',
    tone: 'amber',
  },
  {
    label: '예상 마감 지연',
    value: '4개사',
    detail: '연락 2회 이상 + 미회신',
    tone: 'sky',
  },
];

const closingTrend = [
  { day: '06-01', done: 8, risk: 14 },
  { day: '06-03', done: 13, risk: 12 },
  { day: '06-05', done: 17, risk: 10 },
  { day: '06-07', done: 20, risk: 8 },
  { day: '06-09', done: 26, risk: 9 },
  { day: '06-10', done: 28, risk: 7 },
];

const deadlineProgress = [
  { label: '10일 마감', done: 12, total: 14, riskAmount: '4,200만원' },
  { label: '25일 마감', done: 9, total: 15, riskAmount: '1.6억원' },
  { label: '30일 마감', done: 5, total: 9, riskAmount: '8,100만원' },
];

const reportIssues = [
  {
    company: '다원문구',
    type: '내부 검토',
    amount: '1,401만원',
    owner: '박정우',
    action: '금일 15시까지 마감 금액 승인 확인',
  },
  {
    company: '모블상사',
    type: '금액 미확정',
    amount: '1,965만원',
    owner: '김민서',
    action: '2차 재연락 후 회신 없으면 내일 보고',
  },
  {
    company: '청담리테일',
    type: '금액 조율',
    amount: '1,240만원',
    owner: '이서연',
    action: '반품 2건 반영 여부 확인',
  },
  {
    company: '그린물류',
    type: '내부 검토',
    amount: '4,318만원',
    owner: '박정우',
    action: '마감 금액 승인 사유 정리',
  },
];

const ownerRisks = [
  { owner: '김민서', total: 11, blocked: 2, riskAmount: '5,600만원' },
  { owner: '박정우', total: 10, blocked: 4, riskAmount: '1.9억원' },
  { owner: '이서연', total: 9, blocked: 2, riskAmount: '4,300만원' },
  { owner: '최현우', total: 8, blocked: 1, riskAmount: '4,100만원' },
];

const decisionItems = [
  '25일 마감 업체 중 6개사가 아직 금액 확정 전입니다.',
  '내부 검토 업체 3개사는 오늘 안에 재확인해야 합니다.',
  '연락 2회 이상 미회신 업체는 발송 큐에서 일괄 재연락 준비가 필요합니다.',
];

function toneClasses(tone) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  };

  return tones[tone] ?? tones.teal;
}

function ProgressBar({ value, color = 'bg-teal-600' }) {
  return (
    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}

function ExecutiveTrendChart() {
  const width = 640;
  const height = 220;
  const padding = { top: 18, right: 18, bottom: 30, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = 38;
  const toPoint = (item, index, key) => {
    const x = padding.left + (index / (closingTrend.length - 1)) * plotWidth;
    const y = padding.top + plotHeight - (item[key] / maxValue) * plotHeight;
    return { ...item, x, y };
  };
  const donePoints = closingTrend.map((item, index) => toPoint(item, index, 'done'));
  const riskPoints = closingTrend.map((item, index) => toPoint(item, index, 'risk'));
  const pathFor = (points) => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const donePath = pathFor(donePoints);
  const riskPath = pathFor(riskPoints);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-gray-100">대표 보고용 마감 추세</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">완료 업체와 보고 예외 건수를 같이 봅니다.</p>
        </div>
        <div className="flex gap-3 text-xs font-semibold">
          <span className="text-teal-700 dark:text-teal-300">완료</span>
          <span className="text-rose-700 dark:text-rose-300">예외</span>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 dark:border-gray-700/60 dark:bg-gray-900/30">
        <svg className="h-56 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="대표 보고용 마감 추세 차트" preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + plotHeight - ratio * plotHeight;
            return (
              <line key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="currentColor" strokeDasharray="4 6" className="text-gray-200 dark:text-gray-700" />
            );
          })}
          <path d={donePath} fill="none" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={riskPath} fill="none" stroke="#e11d48" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {donePoints.map((point) => (
            <circle key={`done-${point.day}`} cx={point.x} cy={point.y} r="4" fill="#ffffff" stroke="#0f766e" strokeWidth="2" vectorEffect="non-scaling-stroke">
              <title>{`${point.day} 완료 ${point.done}개`}</title>
            </circle>
          ))}
          {riskPoints.map((point) => (
            <circle key={`risk-${point.day}`} cx={point.x} cy={point.y} r="4" fill="#ffffff" stroke="#e11d48" strokeWidth="2" vectorEffect="non-scaling-stroke">
              <title>{`${point.day} 예외 ${point.risk}건`}</title>
            </circle>
          ))}
          {closingTrend.map((point, index) => {
            const x = padding.left + (index / (closingTrend.length - 1)) * plotWidth;
            return (
              <text key={point.day} x={x} y={height - 8} textAnchor="middle" className="fill-gray-500 text-[10px] dark:fill-gray-400">
                {point.day}
              </text>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

export function ExecutiveReportContent() {
  return (
    <>
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {executiveMetrics.map((metric) => (
          <section key={metric.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{metric.label}</p>
              <span className={`rounded px-2 py-1 text-xs font-bold ${toneClasses(metric.tone)}`}>보고용</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">{metric.value}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{metric.detail}</p>
          </section>
        ))}
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <ExecutiveTrendChart />
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">오늘 보고 결론</h2>
          <div className="mt-4 rounded-lg bg-rose-50 p-4 dark:bg-rose-500/10">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">보고 포인트</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">25일 마감 위험 집중</p>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">미확정 6개사와 내부 검토 3개사가 이번 주 보고 리스크입니다.</p>
          </div>
          <div className="mt-3 space-y-2">
            {decisionItems.map((item) => (
              <p key={item} className="rounded-md border border-gray-100 px-3 py-2 text-sm text-gray-600 dark:border-gray-700/60 dark:text-gray-300">{item}</p>
            ))}
          </div>
        </section>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">마감일별 진행률</h2>
          <div className="mt-4 space-y-4">
            {deadlineProgress.map((item) => {
              const progress = Math.round((item.done / item.total) * 100);
              return (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-gray-800 dark:text-gray-100">{item.label}</span>
                    <span className="text-gray-500">{item.done}/{item.total} · {progress}%</span>
                  </div>
                  <ProgressBar value={progress} color={progress >= 80 ? 'bg-teal-600' : progress >= 60 ? 'bg-amber-500' : 'bg-rose-500'} />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">위험 금액 {item.riskAmount}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">대표 보고 예외 TOP</h2>
            <Link className="btn btn-secondary" to="/closing-workspace/send-queue">발송 큐로 이동</Link>
          </div>
          <div className="mt-4 overflow-x-auto" data-table-tools="false">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2">업체</th>
                  <th className="px-3 py-2">예외</th>
                  <th className="px-3 py-2 text-right">금액</th>
                  <th className="px-3 py-2">담당자</th>
                  <th className="px-3 py-2">보고 액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {reportIssues.map((item) => (
                  <tr key={item.company}>
                    <td className="px-3 py-2 font-semibold text-gray-900 dark:text-gray-100">{item.company}</td>
                    <td className="px-3 py-2 text-rose-700 dark:text-rose-300">{item.type}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-gray-100">{item.amount}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{item.owner}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{item.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <h2 className="font-bold text-gray-900 dark:text-gray-100">담당자별 보고 리스크</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ownerRisks.map((item) => {
            const riskRate = Math.round((item.blocked / item.total) * 100);
            return (
              <div key={item.owner} className="rounded-lg border border-gray-100 p-3 dark:border-gray-700/60">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{item.owner}</p>
                  <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">{riskRate}%</span>
                </div>
                <div className="mt-3"><ProgressBar value={riskRate} color="bg-rose-500" /></div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">막힌 업체 {item.blocked}/{item.total} · {item.riskAmount}</p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

export default function ExecutiveReportDashboardPage() {
  return (
    <PageShell title="사장님 보고 대시보드" description="대표 보고 전에 필요한 마감률, 위험 금액, 지연 업체, 내부 검토 항목을 한 화면에서 정리합니다.">
      <ExecutiveReportContent />
    </PageShell>
  );
}
