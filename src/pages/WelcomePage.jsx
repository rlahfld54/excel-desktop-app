import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Logo from '../images/logo.svg';
import {
  closingWorkspaceChangedEvent,
  getClosingRowStatus,
  getClosingWelcomeSummary,
} from '../utils/closingWorkspaceStore';

function BrandMark() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm">
      <img className="h-7 w-7" src={Logo} alt="" />
    </div>
  );
}

function MiniChart({ bars }) {
  return (
    <div>
      <div className="grid h-28 grid-cols-4 items-end gap-2 rounded-lg bg-gray-50 px-3 py-3 dark:bg-gray-950/45">
        {bars.map((bar) => (
          <div key={bar.label} className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end rounded-sm bg-white dark:bg-gray-900">
              <span
                className={`block w-full rounded-sm ${
                  bar.tone === 'accent'
                    ? 'bg-teal-600'
                    : bar.tone === 'sky'
                      ? 'bg-sky-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                }`}
                style={{ height: `${Math.max(bar.value, 6)}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-gray-400">{bar.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <p className="rounded-md bg-teal-50 px-2 py-1 font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">완료 {bars[3]?.value ?? 0}%</p>
        <p className="rounded-md bg-sky-50 px-2 py-1 font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">금액 {bars[1]?.value ?? 0}%</p>
        <p className="rounded-md bg-gray-50 px-2 py-1 font-semibold text-gray-500 dark:bg-gray-950 dark:text-gray-400">실시간</p>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  const [summary, setSummary] = useState(() => getClosingWelcomeSummary());

  useEffect(() => {
    const refreshSummary = () => setSummary(getClosingWelcomeSummary());

    window.addEventListener('storage', refreshSummary);
    window.addEventListener(closingWorkspaceChangedEvent, refreshSummary);

    return () => {
      window.removeEventListener('storage', refreshSummary);
      window.removeEventListener(closingWorkspaceChangedEvent, refreshSummary);
    };
  }, []);

  const metrics = [
    { label: '오늘 처리', value: `${summary.todayProcessed}`, delta: `${summary.done}/${summary.total}` },
    { label: '검증 통과', value: `${summary.passRate}%`, delta: summary.taxGap > 0 ? '대조 필요' : '안정' },
    { label: '대기 요청', value: `${summary.waiting}`, delta: summary.contactNeeded > 0 ? '연락 필요' : '검토' },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7faf9] text-gray-950 dark:bg-gray-950 dark:text-white">
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[50%] bg-[linear-gradient(118deg,#dff7ef_0%,#eaf5ff_48%,#fff1c6_100%)] dark:bg-[linear-gradient(118deg,#062f25_0%,#082842_52%,#3a2b06_100%)]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-sm font-bold">Excel Workspace</p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Local Closing Automation</p>
            </div>
          </header>

          <div className="grid min-w-0 flex-1 items-center gap-8 py-8 lg:grid-cols-[1.08fr_0.92fr] lg:py-6">
            <div className="min-w-0 max-w-lg lg:order-2 lg:ml-auto">
              <p className="mb-4 inline-flex rounded-md border border-accent-200 bg-white/80 px-3 py-1 text-xs font-bold text-accent-700 shadow-xs dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-200">
                Collect · Validate · Request
              </p>
              <h1 className="text-4xl font-bold leading-tight text-gray-950 dark:text-white sm:text-5xl">
                <span className="block">매출 마감 흐름을</span>
                <span className="block">한 화면에서</span>
                <span className="block">정리합니다.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-gray-600 dark:text-gray-300">
                파일 수집부터 검증, 요청 패키지 생성까지 담당자가 오늘 확인해야 할 상태를 먼저 보여줍니다.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  className="inline-flex h-12 items-center rounded-md bg-teal-700 px-7 text-base font-bold text-white shadow-md shadow-teal-900/10 hover:bg-teal-800 dark:bg-accent-400 dark:text-gray-950 dark:hover:bg-accent-300"
                  to="/login"
                >
                  로그인
                </Link>
              </div>
            </div>

            <div className="flex min-w-0 items-center lg:order-1">
              <div className="w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-lg shadow-gray-200/60 dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/20">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">오늘의 마감 보드</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">마감 워크스페이스 데이터 기준</p>
                  </div>
                  <span className="hidden rounded-md bg-accent-50 px-2.5 py-1 text-xs font-bold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300 sm:inline-flex">
                    자동 요약 반영
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="min-w-0 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950/40">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{metric.label}</p>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <p className="text-2xl font-bold">{metric.value}</p>
                        <p className="text-xs font-bold text-accent-700 dark:text-accent-300">{metric.delta}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="min-w-0 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-bold">단계 진행률</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">현재 상태</p>
                    </div>
                    <MiniChart bars={summary.chartBars} />
                  </div>
                  <div className="min-w-0 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-bold">최근 흐름</p>
                      <span className="h-2 w-2 rounded-full bg-accent-500" />
                    </div>
                    <div className="space-y-2">
                      {summary.latestRows.map((row) => (
                        <div key={row.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-950/45">
                          <div>
                            <p className="truncate text-sm font-semibold">{row.company}</p>
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{getClosingRowStatus(row)}</p>
                          </div>
                          <p className="self-center text-xs font-medium text-gray-500 dark:text-gray-400">{row.deadline || '-'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-gray-200/80 pt-4 text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400 sm:grid-cols-3">
            <p>수집부터 요청까지 한 흐름으로 관리</p>
            <p className="sm:text-center">로컬 데스크톱 환경 기준</p>
            <p className="sm:text-right">마감 상태 자동 점검</p>
          </div>
        </div>
      </section>
    </main>
  );
}
