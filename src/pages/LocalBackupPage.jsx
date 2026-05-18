import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageShell from './PageShell';

const fallbackSettings = {
  databasePath: 'C:\\Users\\user\\AppData\\Roaming\\excel-desktop-app\\excel-desktop-app.sqlite',
  backupPath: 'C:\\Users\\user\\Documents\\ExcelDesktopApp\\Backups',
  exportPath: 'C:\\Users\\user\\Documents\\ExcelDesktopApp\\Exports',
  retentionDays: 30,
  maxBackupSizeMb: 2048,
  autoBackupEnabled: true,
  autoBackupIntervalMinutes: 30,
};

const backupTargets = [
  { label: 'SQLite DB', type: 'database', fileName: 'excel-desktop-app.sqlite', priority: '필수' },
  { label: '설정 파일', type: 'settings', fileName: 'app-settings.json', priority: '필수' },
  { label: '내보내기 산출물', type: 'exports', fileName: 'Exports 폴더', priority: '선택' },
];

function MetricCard({ label, value, detail }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </section>
  );
}

function priorityClass(priority) {
  return priority === '필수'
    ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300'
    : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
}

export default function LocalBackupPage() {
  const [settings, setSettings] = useState(fallbackSettings);
  const [loadState, setLoadState] = useState('브라우저 미리보기');

  const metrics = useMemo(() => [
    { label: '백업 폴더', value: 'Local', detail: settings.backupPath },
    { label: '보관 기간', value: `${settings.retentionDays}일`, detail: '이후 정리 후보' },
    { label: '최대 용량', value: `${settings.maxBackupSizeMb.toLocaleString('ko-KR')}MB`, detail: 'SSD 여유 공간 보호' },
    { label: '자동 백업', value: settings.autoBackupEnabled ? '켜짐' : '꺼짐', detail: `${settings.autoBackupIntervalMinutes}분 간격` },
  ], [settings]);

  const loadSettings = async () => {
    if (!window.api?.getAppSettings) {
      setSettings(fallbackSettings);
      setLoadState('브라우저 미리보기');
      return;
    }

    try {
      const result = await window.api.getAppSettings();
      setSettings(result.settings);
      setLoadState('Electron 설정 연결됨');
    } catch (error) {
      setSettings(fallbackSettings);
      setLoadState(`설정 확인 필요: ${error.message}`);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <PageShell title="로컬 백업" description="이 PC의 SSD 용량을 고려해 SQLite, 설정 파일, 산출물 백업 위치와 보관 정책을 확인합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Local backup</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{loadState}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">119GB SSD 환경에서는 백업 위치와 용량 제한을 먼저 정해두는 편이 안전합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={loadSettings}>
              새로고침
            </button>
            <Link className="btn btn-secondary" to="/settings/save">
              경로 설정
            </Link>
            <button className="btn btn-primary" type="button">
              즉시 백업
            </button>
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8">
          <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">백업 대상</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {['대상', '유형', '원본 위치', '우선순위'].map((column) => (
                    <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backupTargets.map((target) => {
                  const sourcePath = target.type === 'database'
                    ? settings.databasePath
                    : target.type === 'exports'
                      ? settings.exportPath
                      : settings.settingsPath ?? 'app-settings.json';

                  return (
                    <tr key={target.type} className="group">
                      <td className="border-b border-r border-gray-200 px-3 py-2 font-medium text-gray-800 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-100 dark:group-hover:bg-accent-500/10">
                        {target.label}
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                        {target.fileName}
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                        {sourcePath}
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:group-hover:bg-accent-500/10">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass(target.priority)}`}>
                          {target.priority}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">백업 정책</h2>
          <div className="mt-4 space-y-3">
            {[
              ['백업 폴더', settings.backupPath],
              ['보관 기간', `${settings.retentionDays}일`],
              ['용량 제한', `${settings.maxBackupSizeMb.toLocaleString('ko-KR')}MB`],
              ['자동 백업', settings.autoBackupEnabled ? `${settings.autoBackupIntervalMinutes}분 간격` : '꺼짐'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
                <p className="mt-1 break-all text-sm font-medium text-gray-800 dark:text-gray-100">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-accent-200 bg-accent-50/70 p-4 dark:border-accent-500/30 dark:bg-accent-500/10">
            <p className="text-xs font-semibold uppercase text-accent-700 dark:text-accent-300">다음 구현</p>
            <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
              즉시 백업 버튼은 다음 단계에서 SQLite와 설정 파일을 백업 폴더로 복사하고 backup_history에 기록하도록 연결하면 됩니다.
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
