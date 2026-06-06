import React from 'react';
import { Link } from 'react-router-dom';

import Logo from '../images/logo.svg';

const metrics = [
  { label: '오늘 처리', value: '42', delta: '+12%' },
  { label: '검증 통과', value: '96%', delta: '안정' },
  { label: '대기 요청', value: '7', delta: '검토' },
];

const activityRows = [
  ['거래처 매출 마감표', '검증 완료', '2분 전'],
  ['중복 코드 점검', '확인 필요', '12분 전'],
  ['요청 패키지 생성', '대기', '28분 전'],
];

function BrandMark() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm">
      <img className="h-7 w-7" src={Logo} alt="" />
    </div>
  );
}

function MiniChart() {
  const bars = [42, 58, 46, 78, 64, 88, 72];

  return (
    <div className="flex h-28 items-end gap-2">
      {bars.map((height, index) => (
        <div key={height + index} className="flex flex-1 items-end rounded-sm bg-gray-100 dark:bg-gray-800">
          <span
            className={`block w-full rounded-sm ${index === 5 ? 'bg-accent-500' : index === 3 ? 'bg-sky-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            style={{ height: `${height}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export default function WelcomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7faf9] text-gray-950 dark:bg-gray-950 dark:text-white">
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[58%] bg-[linear-gradient(118deg,#dff7ef_0%,#eaf5ff_48%,#fff1c6_100%)] dark:bg-[linear-gradient(118deg,#062f25_0%,#082842_52%,#3a2b06_100%)]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-7 sm:px-8 lg:px-10">
          <header className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-sm font-bold">Excel Workspace</p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Local Closing Automation</p>
            </div>
          </header>

          <div className="grid min-w-0 flex-1 items-center gap-9 py-10 lg:grid-cols-[0.88fr_1.12fr] lg:py-8">
            <div className="min-w-0 max-w-xl">
              <p className="mb-5 inline-flex rounded-md border border-accent-200 bg-white/75 px-3 py-1 text-xs font-bold text-accent-700 shadow-xs dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-200">
                Collect · Validate · Request
              </p>
              <h1 className="text-4xl font-bold leading-tight text-gray-950 dark:text-white sm:text-5xl">
                <span className="block">매출 마감 흐름을</span>
                <span className="block">한 화면에서</span>
                <span className="block">정리합니다.</span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-gray-600 dark:text-gray-300">
                파일 수집부터 검증, 요청 패키지 생성까지 담당자가 오늘 확인해야 할 상태만 먼저 보여줍니다.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="inline-flex h-11 items-center rounded-md bg-teal-700 px-5 text-sm font-bold text-white shadow-sm hover:bg-teal-800 dark:bg-accent-400 dark:text-gray-950 dark:hover:bg-accent-300" to="/login">
                  로그인
                </Link>
              </div>
            </div>

            <div className="flex min-w-0 items-center">
              <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-xl shadow-gray-200/70 dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/20">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">오늘의 마감 보드</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">2026년 6월 6일 기준</p>
                  </div>
                  <span className="hidden rounded-md bg-accent-50 px-2.5 py-1 text-xs font-bold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300 sm:inline-flex">자동 점검 실행 중</span>
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

                <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="min-w-0 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-bold">처리량</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">최근 7일</p>
                    </div>
                    <MiniChart />
                  </div>
                  <div className="min-w-0 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-bold">최근 흐름</p>
                      <span className="h-2 w-2 rounded-full bg-accent-500" />
                    </div>
                    <div className="space-y-2">
                      {activityRows.map(([name, status, time]) => (
                        <div key={name} className="grid grid-cols-[1fr_auto] gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-950/45">
                          <div>
                            <p className="truncate text-sm font-semibold">{name}</p>
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{status}</p>
                          </div>
                          <p className="self-center text-xs font-medium text-gray-500 dark:text-gray-400">{time}</p>
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
