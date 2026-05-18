import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';

const fallbackSettings = {
  databasePath: 'C:\\Users\\user\\AppData\\Roaming\\excel-desktop-app\\excel-desktop-app.sqlite',
  settingsPath: 'C:\\Users\\user\\AppData\\Roaming\\excel-desktop-app\\app-settings.json',
  exportPath: 'C:\\Users\\user\\Documents\\ExcelDesktopApp\\Exports',
  backupPath: 'C:\\Users\\user\\Documents\\ExcelDesktopApp\\Backups',
  tempPath: 'C:\\Users\\user\\Documents\\ExcelDesktopApp\\Temp',
  retentionDays: 30,
  maxBackupSizeMb: 2048,
  autoBackupEnabled: true,
  autoBackupIntervalMinutes: 30,
  performanceMode: 'LIGHT',
};

const pathFields = [
  { key: 'exportPath', label: '내보내기 폴더', description: '엑셀, CSV, 발송 목록 저장 위치' },
  { key: 'backupPath', label: '백업 폴더', description: '작업 파일과 기준 데이터 백업 위치' },
  { key: 'tempPath', label: '임시 폴더', description: '생성 중인 파일과 임시 산출물 위치' },
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

function SettingRow({ label, description, children }) {
  return (
    <div className="grid gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0 dark:border-gray-700/60 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <p className="font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function SaveSettingsPage() {
  const [settings, setSettings] = useState(fallbackSettings);
  const [loadState, setLoadState] = useState('브라우저 미리보기');
  const [saveState, setSaveState] = useState('');

  const metrics = useMemo(() => [
    { label: 'PC 기준', value: '가벼운 모드', detail: 'Ryzen 3 / RAM 16GB 기준' },
    { label: '백업 보관', value: `${settings.retentionDays}일`, detail: `최대 ${settings.maxBackupSizeMb.toLocaleString('ko-KR')}MB 권장` },
    { label: '자동 백업', value: settings.autoBackupEnabled ? '켜짐' : '꺼짐', detail: `${settings.autoBackupIntervalMinutes}분 간격` },
    { label: 'DB 위치', value: 'SQLite', detail: settings.databasePath },
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

  const updateSetting = (key, value) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleChooseDirectory = async (key, title) => {
    if (!window.api?.chooseDirectory) {
      setSaveState('Electron 실행 후 폴더 선택을 사용할 수 있습니다.');
      return;
    }

    const result = await window.api.chooseDirectory({ title });
    if (result?.canceled) return;
    updateSetting(key, result.path);
  };

  const handleSave = async () => {
    if (!window.api?.saveAppSettings) {
      setSaveState('브라우저 미리보기에서는 설정 저장 대신 화면 확인만 가능합니다.');
      return;
    }

    try {
      const result = await window.api.saveAppSettings(settings);
      setSettings(result.settings);
      setSaveState('저장 경로와 백업 정책을 저장했습니다.');
    } catch (error) {
      setSaveState(`설정 저장 실패: ${error.message}`);
    }
  };

  return (
    <PageShell title="저장 설정" description="이 PC 사양에 맞춰 SQLite, 내보내기, 백업, 임시 파일 경로와 보관 정책을 관리합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Storage profile</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{loadState}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">119GB SSD 환경이라 백업 용량을 제한하고 작업 산출물 위치를 분리합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={loadSettings}>
              새로고침
            </button>
            <button className="btn btn-primary" type="button" onClick={handleSave}>
              설정 저장
            </button>
          </div>
        </div>
      </section>

      {saveState && (
        <section className="mb-4 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-300">
          {saveState}
        </section>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8">
          <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">경로 설정</h2>
          </header>

          {pathFields.map((field) => (
            <SettingRow key={field.key} label={field.label} description={field.description}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="form-input min-w-0 flex-1"
                  value={settings[field.key] ?? ''}
                  onChange={(event) => updateSetting(field.key, event.target.value)}
                />
                <button className="btn btn-secondary shrink-0" type="button" onClick={() => handleChooseDirectory(field.key, `${field.label} 선택`)}>
                  폴더 선택
                </button>
              </div>
            </SettingRow>
          ))}

          <SettingRow label="SQLite DB" description="앱 데이터베이스 파일 위치">
            <input className="form-input w-full bg-gray-50 text-gray-500 dark:bg-gray-900/40 dark:text-gray-400" value={settings.databasePath ?? ''} readOnly />
          </SettingRow>

          <SettingRow label="설정 파일" description="저장 설정 JSON 파일 위치">
            <input className="form-input w-full bg-gray-50 text-gray-500 dark:bg-gray-900/40 dark:text-gray-400" value={settings.settingsPath ?? ''} readOnly />
          </SettingRow>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">보관 정책</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
              <span>
                <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">자동 백업</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">작업 중 정기 백업</span>
              </span>
              <input
                className="form-checkbox"
                type="checkbox"
                checked={settings.autoBackupEnabled}
                onChange={(event) => updateSetting('autoBackupEnabled', event.target.checked)}
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">자동 백업 간격</span>
              <input
                className="form-input mt-2 w-full"
                min="10"
                step="5"
                type="number"
                value={settings.autoBackupIntervalMinutes}
                onChange={(event) => updateSetting('autoBackupIntervalMinutes', Number(event.target.value))}
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">보관 기간</span>
              <input
                className="form-input mt-2 w-full"
                min="7"
                max="180"
                type="number"
                value={settings.retentionDays}
                onChange={(event) => updateSetting('retentionDays', Number(event.target.value))}
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">백업 최대 용량 MB</span>
              <input
                className="form-input mt-2 w-full"
                min="512"
                step="256"
                type="number"
                value={settings.maxBackupSizeMb}
                onChange={(event) => updateSetting('maxBackupSizeMb', Number(event.target.value))}
              />
            </label>
          </div>

          <div className="mt-5 rounded-lg border border-yellow-200 bg-yellow-50/70 p-4 dark:border-yellow-500/30 dark:bg-yellow-500/10">
            <p className="text-xs font-semibold uppercase text-yellow-700 dark:text-yellow-300">권장값</p>
            <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
              이 PC에서는 백업 30일, 최대 2GB, 자동 백업 30분 간격을 기본값으로 두는 편이 안전합니다.
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
