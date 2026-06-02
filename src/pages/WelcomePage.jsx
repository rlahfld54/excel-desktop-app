import React from 'react';
import { Link } from 'react-router-dom';

import Logo from '../images/logo.svg';

function PreviewRow({ label, value, tone = 'accent' }) {
  const toneClass = tone === 'sky'
    ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200'
    : tone === 'yellow'
      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-200'
      : 'bg-accent-100 text-accent-800 dark:bg-accent-500/15 dark:text-accent-200';

  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3 last:border-b-0 dark:border-gray-700/60">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">최근 작업 상태</p>
      </div>
      <span className={`shrink-0 rounded px-2.5 py-1 text-xs font-bold ${toneClass}`}>{value}</span>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <section className="relative min-h-screen">
        <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(135deg,#ecfdf7_0%,#e3f3ff_48%,#fff2c9_100%)] dark:bg-[linear-gradient(135deg,#022c22_0%,#0b324f_55%,#342809_100%)]" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/80 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
                <img className="h-6 w-6" src={Logo} alt="" />
              </span>
              <div>
                <p className="text-sm font-bold text-gray-950 dark:text-white">Excel Workspace</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">매출 마감 자동화</p>
              </div>
            </div>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md bg-gray-950 px-4 text-sm font-bold text-white shadow-sm hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
              to="/login"
            >
              로그인하기
            </Link>
          </header>

          <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:py-12">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex rounded bg-white/80 px-3 py-1 text-xs font-bold uppercase text-accent-700 shadow-sm ring-1 ring-accent-200 dark:bg-gray-900/80 dark:text-accent-200 dark:ring-accent-500/30">
                Local Excel Automation
              </p>
              <h1 className="text-4xl font-bold leading-tight text-gray-950 dark:text-white md:text-5xl">
                매출 마감 자료를 한 곳에서 정리하고 검증합니다.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-gray-600 dark:text-gray-300">
                파일 업로드, 중복 검증, 요청 패키지 생성, 백업 이력까지 데스크톱 앱 안에서 이어지는 업무 공간입니다.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-md bg-accent-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-accent-700"
                  to="/login"
                >
                  로그인 페이지로 이동
                </Link>
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-5 text-sm font-bold text-gray-800 shadow-sm hover:border-accent-300 hover:text-accent-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-accent-500/60 dark:hover:text-accent-200"
                  to="/dashboard"
                >
                  대시보드 미리보기
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700/60 dark:bg-gray-900">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
                  <div>
                    <p className="text-xs font-bold uppercase text-accent-600 dark:text-accent-300">Today</p>
                    <p className="text-lg font-bold">마감 업무 현황</p>
                  </div>
                  <span className="rounded bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">자동 저장</span>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  {[
                    ['업로드 파일', '18건'],
                    ['검증 이슈', '7건'],
                    ['요청 패키지', '5건'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700/60 dark:bg-gray-950/60">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
                      <p className="mt-2 text-2xl font-bold">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700/60">
                  <PreviewRow label="sales_orders_2026.xlsx" value="검증 완료" />
                  <PreviewRow label="supplier_codes.csv" value="확인 필요" tone="yellow" />
                  <PreviewRow label="request_package_05" value="발송 준비" tone="sky" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
