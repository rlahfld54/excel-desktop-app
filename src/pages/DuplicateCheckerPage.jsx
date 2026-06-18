import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';
import { findDuplicateGroups } from '../data/sampleSalesData';
import { useWorkspaceDataStore } from '../stores/workspaceDataStore';

function badgeClass(value) {
  if (['병합 완료', '예외 등록'].includes(value)) {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
  }

  if (['검토', '대기'].includes(value)) {
    return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
  }

  return 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300';
}

function MetricCard({ label, value, detail }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </section>
  );
}

export default function DuplicateCheckerPage() {
  const rows = useWorkspaceDataStore((state) => state.rows);
  const loadLatest = useWorkspaceDataStore((state) => state.loadLatest);
  const [groups, setGroups] = useState(() => findDuplicateGroups(rows));
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id);
  const [actionState, setActionState] = useState(`${groups.length.toLocaleString('ko-KR')}개 중복 그룹을 찾았습니다.`);

  useEffect(() => {
    loadLatest().catch(() => {
      // Browser-only development keeps the workspace store fallback data.
    });
  }, [loadLatest]);

  useEffect(() => {
    const nextGroups = findDuplicateGroups(rows);
    setGroups(nextGroups);
    setSelectedGroupId((current) => (
      nextGroups.some((group) => group.id === current) ? current : nextGroups[0]?.id
    ));
    setActionState(`${nextGroups.length.toLocaleString('ko-KR')}媛?以묐났 洹몃９??李얠븯?듬땲??`);
  }, [rows]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0];
  const metrics = useMemo(() => {
    const targetRows = groups.reduce((sum, group) => sum + group.items.length, 0);
    const completed = groups.filter((group) => group.status !== '검토').length;

    return [
      { label: '전체 데이터', value: `${rows.length.toLocaleString('ko-KR')}건`, detail: '현재 작업 데이터' },
      { label: '중복 그룹', value: `${groups.length.toLocaleString('ko-KR')}건`, detail: `${targetRows.toLocaleString('ko-KR')}개 행 포함` },
      { label: '처리 완료', value: `${completed.toLocaleString('ko-KR')}건`, detail: '병합 또는 예외 등록' },
      { label: '검사 기준', value: '5개', detail: '거래일/거래처/품목/수량/금액' },
    ];
  }, [groups, rows.length]);

  const updateGroupStatus = (status) => {
    setGroups((current) => current.map((group) => (
      group.id === selectedGroup.id ? { ...group, status } : group
    )));
    setActionState(`${selectedGroup.id} 그룹을 ${status} 상태로 처리했습니다.`);
  };

  const rerunCheck = () => {
    const nextGroups = findDuplicateGroups(rows);
    setGroups(nextGroups);
    setSelectedGroupId(nextGroups[0]?.id);
    setActionState(`${nextGroups.length.toLocaleString('ko-KR')}개 중복 그룹을 다시 계산했습니다.`);
  };

  return (
    <PageShell title="중복 검사" description="1,200건 데이터를 기준으로 중복 거래 후보를 계산하고 병합/예외 처리합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Duplicate check</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{actionState}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">현재 작업 데이터에서 중복 후보를 검사합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={rerunCheck}>검사 재실행</button>
            <button className="btn btn-secondary" type="button" onClick={() => updateGroupStatus('예외 등록')}>예외 등록</button>
            <button className="btn btn-primary" type="button" onClick={() => updateGroupStatus('병합 완료')}>중복 병합</button>
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-7">
          <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">중복 후보 목록</h2>
          </header>
          <div className="max-h-[440px] overflow-auto no-scrollbar">
            <table className="min-w-[760px] w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {['그룹', '행 번호', '거래처', '품목', '금액', '신뢰도', '상태'].map((column) => (
                    <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className={`group cursor-pointer ${selectedGroup?.id === group.id ? 'bg-accent-50/70 dark:bg-accent-500/10' : ''}`} onClick={() => setSelectedGroupId(group.id)}>
                    <td className="border-b border-r border-gray-200 px-3 py-2 font-semibold text-gray-800 dark:border-gray-700/60 dark:text-gray-100">{group.id}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{group.rowNumbers}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{group.customerName}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{group.productName}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{group.amount}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{group.confidence}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 dark:border-gray-700/60">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(group.status)}`}>{group.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">선택 그룹 상세</h2>
          {selectedGroup ? (
            <div className="mt-4 space-y-3">
              {selectedGroup.items.map(({ row, rowIndex }) => (
                <div key={rowIndex} className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{rowIndex + 1}번 행</p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{row[0]}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{row[1]} / {row[2]} / {row[4]}개 / {row[6]}원</p>
                </div>
              ))}
              <div className="rounded-lg border border-accent-200 bg-accent-50/70 p-4 dark:border-accent-500/30 dark:bg-accent-500/10">
                <p className="text-xs font-semibold uppercase text-accent-700 dark:text-accent-300">처리 기준</p>
                <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">동일 거래일, 거래처, 품목 코드, 수량, 금액이 모두 일치하면 강한 중복 후보로 분류합니다.</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">선택된 중복 그룹이 없습니다.</p>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
