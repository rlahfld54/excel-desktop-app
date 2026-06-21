import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';
import { notifyUser } from '../utils/notifications';

const fallbackSettings = {
  databasePath: '%APPDATA%/excel-desktop-app/excel-desktop-app.sqlite',
  settingsPath: '%APPDATA%/excel-desktop-app/app-settings.json',
  workspaceRoot: 'Documents/ExcelDesktopApp',
  inboxPath: 'Documents/ExcelDesktopApp/Inbox',
  workspacePath: 'Documents/ExcelDesktopApp/Workspace',
  masterDataPath: 'Documents/ExcelDesktopApp/MasterData',
  reportsPath: 'Documents/ExcelDesktopApp/Reports',
  requestsPath: 'Documents/ExcelDesktopApp/Requests',
  exportPath: 'Documents/ExcelDesktopApp/Exports',
  backupPath: '%ProgramData%/Excel Desktop App/Backup',
  tempPath: 'Documents/ExcelDesktopApp/Temp',
  logsPath: 'Documents/ExcelDesktopApp/Logs',
  retentionDays: 31,
  maxBackupSizeMb: 2048,
  autoBackupEnabled: true,
  autoBackupIntervalMinutes: 30,
  performanceMode: 'LIGHT',
  notificationsEnabled: true,
  desktopNotificationsEnabled: true,
  notificationSoundEnabled: true,
  notificationSoundPath: '',
  cloudApiBaseUrl: '',
  lastCloudSyncAt: '',
};

const pathFields = [
  { key: 'exportPath', label: '내보내기 폴더', description: '엑셀, CSV, 발송 목록 저장 위치' },
  { key: 'backupPath', label: '백업 폴더', description: '기본값은 이 PC의 모든 사용자가 함께 쓰는 ProgramData 경로' },
  { key: 'tempPath', label: '임시 폴더', description: '생성 중인 파일과 임시 산출물 위치' },
];

function isCommonBackupPath(value = '') {
  return String(value)
    .replaceAll('\\', '/')
    .toLowerCase()
    .includes('/programdata/excel desktop app/backup');
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
  const [cloudAccessToken, setCloudAccessToken] = useState('');
  const [isCloudBusy, setIsCloudBusy] = useState(false);
  const usesCommonBackupPath = isCommonBackupPath(settings.backupPath);

  const metrics = useMemo(() => [
    { label: '실행 환경', value: window.api?.getAppSettings ? '설치 앱' : '브라우저', detail: '현재 PC의 사용자 경로를 자동 적용' },
    { label: '백업 보관', value: `${settings.retentionDays}일`, detail: `최대 ${settings.maxBackupSizeMb.toLocaleString('ko-KR')}MB 권장` },
    { label: '자동 백업', value: settings.autoBackupEnabled ? '켜짐' : '꺼짐', detail: `${settings.autoBackupIntervalMinutes}분 간격` },
    { label: '백업 범위', value: usesCommonBackupPath ? 'PC 공용' : '사용자 지정', detail: settings.backupPath },
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

  const handleChooseSoundFile = async () => {
    if (!window.api?.chooseFile) {
      setSaveState('Electron 실행 후 알림음 파일을 선택할 수 있습니다.');
      return;
    }

    const result = await window.api.chooseFile({
      title: '알림음 파일 선택',
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }],
    });
    if (result?.canceled) return;
    updateSetting('notificationSoundPath', result.path);
  };

  const handleTestNotification = async () => {
    await notifyUser({
      type: 'success',
      title: '알림 테스트',
      message: '현재 알림 설정으로 표시와 소리를 테스트했습니다.',
      settings,
    });
    setSaveState('알림 테스트를 실행했습니다. 소리가 나지 않으면 설정 저장 후 다시 시도하거나 OS 볼륨을 확인하세요.');
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

  const handleCloudDownload = async () => {
    if (!window.api?.downloadCloudData) {
      setSaveState('설치된 데스크톱 앱에서 AWS 동기화를 사용할 수 있습니다.');
      return;
    }

    setIsCloudBusy(true);
    setSaveState('');
    try {
      const result = await window.api.downloadCloudData({
        apiBaseUrl: settings.cloudApiBaseUrl,
        accessToken: cloudAccessToken,
      });
      if (!result?.ok) throw new Error(result?.message || 'AWS 데이터를 내려받지 못했습니다.');
      const refreshed = await window.api.getAppSettings();
      setSettings(refreshed.settings);
      setCloudAccessToken('');
      setSaveState(`AWS 데이터를 SQLite에 저장했습니다. 거래처 ${result.imported.customers}건, 제품 ${result.imported.products}건, 연락처 ${result.imported.contacts}건`);
    } catch (error) {
      setSaveState(`AWS 동기화 실패: ${error.message}`);
    } finally {
      setIsCloudBusy(false);
    }
  };

  return (
    <PageShell title="저장 설정" description="이 PC 사양에 맞춰 SQLite, 내보내기, 백업, 임시 파일 경로와 보관 정책을 관리합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Storage profile</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{loadState}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              설치된 PC의 AppData, Documents, ProgramData 위치를 기준으로 저장 경로를 자동 구성합니다.
            </p>
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
              {field.key === 'backupPath' && (
                <p className={`mt-2 text-xs leading-5 ${usesCommonBackupPath ? 'text-green-600 dark:text-green-300' : 'text-amber-600 dark:text-amber-300'}`}>
                  {usesCommonBackupPath
                    ? '현재 이 PC의 공용 ProgramData 백업 폴더를 사용합니다.'
                    : '현재 사용자 지정 경로를 사용합니다. ProgramData 생성 권한이 없으면 사용자 문서의 ExcelDesktopApp/Backups 경로가 자동 적용될 수 있습니다.'}
                </p>
              )}
            </SettingRow>
          ))}

          <SettingRow label="SQLite DB" description="앱 데이터베이스 파일 위치">
            <input className="form-input w-full bg-gray-50 text-gray-500 dark:bg-gray-900/40 dark:text-gray-400" value={settings.databasePath ?? ''} readOnly />
          </SettingRow>

          <SettingRow label="설정 파일" description="저장 설정 JSON 파일 위치">
            <input className="form-input w-full bg-gray-50 text-gray-500 dark:bg-gray-900/40 dark:text-gray-400" value={settings.settingsPath ?? ''} readOnly />
          </SettingRow>
          <SettingRow label="AWS 데이터 연결" description="요청할 때 중앙 데이터를 내려받아 로컬 SQLite에 저장">
            <div className="space-y-3">
              <input
                className="form-input w-full"
                value={settings.cloudApiBaseUrl ?? ''}
                onChange={(event) => updateSetting('cloudApiBaseUrl', event.target.value)}
                placeholder="https://api.example.com"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="form-input min-w-0 flex-1"
                  type="password"
                  value={cloudAccessToken}
                  onChange={(event) => setCloudAccessToken(event.target.value)}
                  placeholder="일회용 접근 토큰 (저장되지 않음)"
                />
                <button className="btn btn-primary shrink-0" type="button" disabled={isCloudBusy || !settings.cloudApiBaseUrl} onClick={handleCloudDownload}>
                  {isCloudBusy ? '받는 중…' : 'AWS 데이터 받기'}
                </button>
              </div>
              <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                마지막 동기화: {settings.lastCloudSyncAt ? new Date(settings.lastCloudSyncAt).toLocaleString('ko-KR') : '아직 없음'}
              </p>
            </div>
          </SettingRow>
          <SettingRow label="알림 설정" description="작업 변경, 저장 완료, 오류 발생 시 표시할 알림 방식">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">앱 알림</span>
                <input
                  className="form-checkbox"
                  type="checkbox"
                  checked={settings.notificationsEnabled ?? true}
                  onChange={(event) => updateSetting('notificationsEnabled', event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">데스크톱 알림</span>
                <input
                  className="form-checkbox"
                  type="checkbox"
                  checked={settings.desktopNotificationsEnabled ?? true}
                  onChange={(event) => updateSetting('desktopNotificationsEnabled', event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">알림음</span>
                <input
                  className="form-checkbox"
                  type="checkbox"
                  checked={settings.notificationSoundEnabled ?? true}
                  onChange={(event) => updateSetting('notificationSoundEnabled', event.target.checked)}
                />
              </label>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className="form-input min-w-0 flex-1"
                placeholder="비워두면 기본 짧은 알림음 사용"
                value={settings.notificationSoundPath ?? ''}
                onChange={(event) => updateSetting('notificationSoundPath', event.target.value)}
              />
              <button className="btn btn-secondary shrink-0" type="button" onClick={handleChooseSoundFile}>
                알림음 선택
              </button>
              <button className="btn btn-secondary shrink-0" type="button" onClick={handleTestNotification}>
                테스트
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
              Windows/Linux에서는 OS 기본음을 끄고 앱에서 별도 소리를 재생합니다. mp3, wav, ogg, m4a 파일을 사용할 수 있습니다.
            </p>
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
                max="31"
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
            <p className="text-xs font-semibold uppercase text-yellow-700 dark:text-yellow-300">경로 적용 기준</p>
            <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
              SQLite와 앱 설정은 현재 Windows 사용자 AppData에 저장합니다. 백업은 기본적으로 ProgramData의 공용 폴더를 사용하며,
              회사 보안 정책으로 폴더 생성이 차단되면 현재 사용자의 문서 폴더로 안전하게 전환합니다.
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
