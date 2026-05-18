import React, { useState } from 'react';

import Sidebar from '../partials/Sidebar';
import Header from '../partials/Header';
import Breadcrumbs from '../useComponents/Breadcrumbs';
import ExcelTable from '../useComponents/ExcelTable';

const quickStats = [
  { label: '열린 파일', value: 'sales_orders_2026.xlsx', detail: '10개 열 · 2,184행' },
  { label: '자동화 상태', value: '대기 중', detail: '정리 규칙 7개 준비됨' },
  { label: '검증 결과', value: '23건 확인 필요', detail: '중복 12 · 누락 7 · 코드 4' },
];

const explorerGroups = [
  {
    title: '최근 파일',
    items: ['sales_orders_2026.xlsx', 'supplier_codes.csv', 'backup_0518.xlsx'],
  },
  {
    title: '고정 파일',
    items: ['월간 매출 원본.xlsx', '거래처 코드표.xlsx'],
  },
  {
    title: '백업 버전',
    items: ['오늘 15:02 자동 저장', '어제 18:40 로컬 백업'],
  },
];

const logs = [
  { time: '15:04:12', type: 'INFO', text: '파일 스키마를 분석했습니다.' },
  { time: '15:04:18', type: 'WARN', text: '품목 코드 C-0412가 2회 반복되었습니다.' },
  { time: '15:04:21', type: 'INFO', text: '거래처 코드 매핑 규칙 7개를 불러왔습니다.' },
  { time: '15:04:27', type: 'ERROR', text: '2개 행에서 필수 금액 값이 비어 있습니다.' },
];

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-gray-900">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="w-full max-w-9xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 md:text-3xl">
                  Excel Automation Workspace
                </h1>
                <Breadcrumbs />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button className="btn border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/60" type="button">
                  새 작업
                </button>
                <button className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white" type="button">
                  자동화 실행
                </button>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {quickStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
                  <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{stat.label}</p>
                  <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{stat.value}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{stat.detail}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-12 xl:col-span-9">
                <ExcelTable />
              </div>

              <aside className="col-span-12 flex flex-col gap-5 xl:col-span-3">
                <section className="rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
                  <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">작업 탐색기</h2>
                  </header>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {explorerGroups.map((group) => (
                      <div key={group.title} className="px-4 py-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{group.title}</p>
                        <div className="space-y-1">
                          {group.items.map((item) => (
                            <button key={item} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50" type="button">
                              <span className="truncate">{item}</span>
                              <span className="ml-2 h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">자동화 큐</h2>
                  <div className="mt-4 space-y-3">
                    {['데이터 정리', '코드 매핑', '중복 검사', '보고서 생성'].map((step, index) => (
                      <div key={step} className="flex items-center gap-3">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${index === 0 ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{step}</p>
                          <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
                            <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${index === 0 ? 72 : 0}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </div>

            <section className="mt-5 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
              <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">로그 및 자동화 상태</h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">실시간 모니터링</span>
              </header>
              <div className="grid gap-0 md:grid-cols-4">
                {logs.map((log) => (
                  <div key={`${log.time}-${log.text}`} className="border-b border-gray-100 px-4 py-3 text-sm last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 dark:border-gray-700/60">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{log.time}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${log.type === 'ERROR' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300' : log.type === 'WARN' ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300' : 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'}`}>
                        {log.type}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300">{log.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs text-gray-500 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 dark:text-gray-400">
              <span>활성 파일: sales_orders_2026.xlsx</span>
              <span>2,184행 · 10열 · 선택 셀 H2 · 합계 3,550,300원</span>
              <span>UTF-8 · 자동 저장 켜짐 · 로컬 동기화 정상</span>
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}

export default Dashboard;
