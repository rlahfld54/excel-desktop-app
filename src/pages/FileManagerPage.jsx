import React, { useMemo, useState } from 'react';

import PageShell from './PageShell';

const folderStorageKey = 'excel-workspace:folderPlan';
const currentYear = 2026;
const reportTypes = ['월간 매출', '거래처 오류', '중복 검사', '백업 검증', '요청 발송'];
const baseFolders = [
  'ExcelDesktopApp',
  'ExcelDesktopApp/Inbox',
  'ExcelDesktopApp/Workspace',
  'ExcelDesktopApp/MasterData',
  'ExcelDesktopApp/Reports',
  'ExcelDesktopApp/Reports/월간 매출',
  'ExcelDesktopApp/Reports/거래처 오류',
  'ExcelDesktopApp/Reports/중복 검사',
  'ExcelDesktopApp/Reports/백업 검증',
  'ExcelDesktopApp/Requests',
  'ExcelDesktopApp/Backups',
  'ExcelDesktopApp/Exports',
  'ExcelDesktopApp/Temp',
  'ExcelDesktopApp/Logs',
];

function createFolderPlan(year = currentYear) {
  const monthlyFolders = reportTypes.flatMap((type) =>
    Array.from({ length: 12 }, (_, index) => `ExcelDesktopApp/Reports/${type}/${year}/${String(index + 1).padStart(2, '0')}`)
  );

  return [...baseFolders, ...monthlyFolders].map((path, index) => ({
    id: index + 1,
    path,
    type: path.includes('/Reports/') ? '보고서' : path.includes('/Backups') ? '백업' : path.includes('/Requests') ? '요청' : '업무',
    status: index < baseFolders.length ? '기본' : '월별',
  }));
}

function readFolderPlan() {
  try {
    const saved = JSON.parse(localStorage.getItem(folderStorageKey));
    if (saved?.length) return saved;
  } catch {
    // ignore malformed local data
  }
  return createFolderPlan();
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

export default function FileManagerPage() {
  const [folders, setFolders] = useState(readFolderPlan);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [stateText, setStateText] = useState('보고서 종류/년도/월별 폴더 구조가 준비되었습니다.');
  const [params, setParams] = useState({ query: '' });

  const filteredFolders = useMemo(() => {
    const normalized = params.query.trim().toLowerCase();
    if (!normalized) return folders;
    return folders.filter((folder) => folder.path.toLowerCase().includes(normalized) || folder.type.toLowerCase().includes(normalized));
  }, [folders, params.query]);

  const metrics = useMemo(() => {
    const reportCount = folders.filter((folder) => folder.type === '보고서').length;
    return [
      { label: '전체 폴더', value: `${folders.length.toLocaleString('ko-KR')}개`, detail: '업무/보고서/백업/요청 포함' },
      { label: '보고서 폴더', value: `${reportCount.toLocaleString('ko-KR')}개`, detail: '종류별/년도별/월별 구조' },
      { label: '기준 연도', value: `${selectedYear}년`, detail: '월별 폴더 12개월 생성' },
      { label: '현재 모드', value: window.api?.getAppSettings ? 'Electron' : 'Browser', detail: window.api?.getAppSettings ? '실제 폴더 생성 가능' : '폴더 계획 저장' },
    ];
  }, [folders, selectedYear]);

  const buildPlan = () => {
    const nextFolders = createFolderPlan(Number(selectedYear));
    setFolders(nextFolders);
    localStorage.setItem(folderStorageKey, JSON.stringify(nextFolders));
    setStateText(`${selectedYear}년 기준 폴더 계획을 다시 만들었습니다.`);
  };

  const saveFolderPlan = async () => {
    localStorage.setItem(folderStorageKey, JSON.stringify(folders));

    if (window.api?.saveAppSettings) {
      try {
        const settingsResult = await window.api.getAppSettings?.();
        await window.api.saveAppSettings({
          ...(settingsResult?.settings ?? {}),
          folderPlan: folders,
        });
        setStateText('폴더 계획을 Electron 설정에 저장했습니다. 실제 생성은 Electron 연결 단계에서 처리합니다.');
        return;
      } catch (error) {
        setStateText(`브라우저 저장은 완료, Electron 설정 저장은 실패: ${error.message}`);
        return;
      }
    }

    setStateText('브라우저 개발 모드라 폴더 계획을 localStorage에 저장했습니다.');
  };

  const addCustomFolder = () => {
    const nextFolder = {
      id: folders.length + 1,
      path: `ExcelDesktopApp/Custom/${selectedYear}/새 폴더 ${folders.length + 1}`,
      type: '사용자',
      status: '추가',
    };
    setFolders((current) => [nextFolder, ...current]);
    setStateText(`${nextFolder.path} 폴더 계획을 추가했습니다.`);
  };

  return (
    <PageShell title="파일 관리" description="내 컴퓨터에 필요한 업무 폴더 구조를 보고서 종류, 년도, 월 기준으로 관리합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Folder plan</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{stateText}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">브라우저에서는 계획만 저장하고, Electron 연결 후 실제 PC 경로 생성으로 연결합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="form-input h-10 w-28" type="number" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} />
            <button className="btn btn-secondary" type="button" onClick={buildPlan}>구조 생성</button>
            <button className="btn btn-secondary" type="button" onClick={addCustomFolder}>폴더 추가</button>
            <button className="btn btn-primary" type="button" onClick={saveFolderPlan}>계획 저장</button>
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">폴더 구조</h2>
            <input className="form-input h-9 w-64" type="search" value={params.query} onChange={(event) => setParams({ query: event.target.value })} placeholder="폴더 검색" />
          </header>
          <div className="max-h-[480px] overflow-auto no-scrollbar">
            <table className="min-w-[760px] w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {['경로', '구분', '상태'].map((column) => (
                    <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFolders.map((folder) => (
                  <tr key={folder.id} className="group">
                    <td className="border-b border-r border-gray-200 px-3 py-2 font-mono text-xs text-gray-700 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-200 dark:group-hover:bg-accent-500/10">{folder.path}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-200 dark:group-hover:bg-accent-500/10">{folder.type}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:group-hover:bg-accent-500/10">
                      <span className="inline-flex rounded-full bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">{folder.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">권장 폴더 기준</h2>
          <div className="mt-4 space-y-3">
            {[
              ['Inbox', '외부에서 받은 원본 Excel/CSV'],
              ['Workspace', '현재 작업 중인 파일'],
              ['MasterData', '거래처/제품/단가 기준'],
              ['Reports/종류/년도/월', '보고서 종류별 산출물'],
              ['Requests', '거래처 확인 요청 패키지'],
              ['Backups', '자동/수동 백업'],
              ['Logs', '활동 로그와 감사 자료'],
            ].map(([name, detail]) => (
              <div key={name} className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{name}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
