import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageShell from './PageShell';
import { getCurrentUser } from '../utils/authSession';

const fallbackSettings = {
  databasePath: '%APPDATA%/excel-desktop-app/excel-desktop-app.sqlite',
  settingsPath: '%APPDATA%/excel-desktop-app/app-settings.json',
  backupPath: '%ProgramData%/Excel Desktop App/Backup',
  retentionDays: 31,
  autoBackupEnabled: true,
  autoBackupTime: '23:50',
};

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatSize(bytes = 0) {
  if (!bytes) return '-';
  const mb = bytes / 1024 / 1024;
  return `${mb.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}MB`;
}

function backupTypeLabel(type) {
  if (type === 'auto') return '자동 백업';
  if (type === 'restore_point') return '복구 전 저장';
  return '수동 백업';
}

function backupTypeClass(type) {
  if (type === 'auto') return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
  if (type === 'restore_point') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
}

function getYesterdayBackup(backups) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const key = yesterday.toISOString().slice(0, 10);

  return backups
    .filter((backup) => backup.createdAt?.slice(0, 10) === key)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function MetricCard({ label, value, detail }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </section>
  );
}

function BackupRow({ backup, selected, onPreview, onRestore }) {
  return (
    <article className={`rounded-lg border bg-white p-4 shadow-xs dark:bg-gray-800 ${selected ? 'border-accent-300 ring-2 ring-accent-100 dark:border-accent-500/60 dark:ring-accent-500/20' : 'border-gray-200 dark:border-gray-700/60'}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{backup.message}</h2>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${backupTypeClass(backup.type)}`}>
              {backupTypeLabel(backup.type)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {backup.createdBy || '사용자'} · {formatDate(backup.createdAt)} · {formatSize(backup.sizeBytes)}
          </p>
          <p className="mt-2 break-all text-xs text-gray-400 dark:text-gray-500">{backup.folderPath}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button className="btn btn-secondary" type="button" onClick={() => onPreview(backup)}>
            미리보기
          </button>
          <button className="btn btn-primary" type="button" onClick={() => onRestore(backup)}>
            이 시점으로 복구
          </button>
        </div>
      </div>
    </article>
  );
}

export default function LocalBackupPage() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser.role === 'ADMIN';
  const [settings, setSettings] = useState(fallbackSettings);
  const [backups, setBackups] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [message, setMessage] = useState('');
  const [params, setParams] = useState({ query: '' });
  const [statusText, setStatusText] = useState('백업 목록을 확인해 주세요.');
  const [isBusy, setIsBusy] = useState(false);

  const electronReady = Boolean(window.api?.listBackups);

  const loadBackups = async () => {
    if (!window.api?.listBackups) {
      setBackups([]);
      setSelectedBackup(null);
      setStatusText('Electron 실행 시 실제 백업 파일과 연결됩니다.');
      return;
    }

    setIsBusy(true);
    try {
      const result = await window.api.listBackups();
      const loadedBackups = (result.backups ?? []).filter((backup) => (
        isAdmin || backup.createdBy === currentUser.id
      ));
      setSettings({ ...fallbackSettings, ...(result.settings ?? {}) });
      setBackups(loadedBackups);
      setSelectedBackup((current) => loadedBackups.find((backup) => backup.id === current?.id) ?? loadedBackups[0] ?? null);
      setStatusText(loadedBackups.length > 0 ? '백업 목록을 불러왔습니다.' : '아직 저장된 백업이 없습니다.');
    } catch (error) {
      setStatusText(`백업 목록 확인 실패: ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const filteredBackups = useMemo(() => {
    const normalizedQuery = params.query.trim().toLowerCase();
    if (!normalizedQuery) return backups;

    return backups.filter((backup) => [
      backup.message,
      backup.type,
      backup.createdBy,
      backup.createdAt,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery)));
  }, [backups, params.query]);

  const yesterdayBackup = useMemo(() => getYesterdayBackup(backups), [backups]);

  const metrics = useMemo(() => [
    { label: '보관 기간', value: '최대 1개월', detail: `${Math.min(settings.retentionDays ?? 31, 31)}일 이후 자동 정리` },
    { label: '자동 백업', value: settings.autoBackupEnabled ? '켜짐' : '꺼짐', detail: `매일 ${settings.autoBackupTime ?? '23:50'}` },
    { label: '백업 위치', value: settings.backupPath?.toLowerCase().includes('programdata') ? 'PC 공용' : '사용자 지정', detail: settings.backupPath },
    { label: '최근 백업', value: backups[0] ? formatDate(backups[0].createdAt) : '-', detail: backups[0]?.message ?? '아직 없음' },
  ], [backups, settings]);

  const handleCreateBackup = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setStatusText('백업 메모를 입력해 주세요.');
      return;
    }

    if (!window.api?.createBackup) {
      const previewBackup = {
        id: `preview_${Date.now()}`,
        message: trimmedMessage,
        type: 'manual',
        createdBy: currentUser.id,
        createdAt: new Date().toISOString(),
        retentionUntil: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
        sizeBytes: 0,
        folderPath: fallbackSettings.backupPath,
      };
      setBackups((current) => [previewBackup, ...current]);
      setSelectedBackup(previewBackup);
      setMessage('');
      setStatusText('미리보기 백업을 추가했습니다. Electron에서 실행하면 실제 파일로 저장됩니다.');
      return;
    }

    setIsBusy(true);
    try {
      const result = await window.api.createBackup({ message: trimmedMessage, type: 'manual', createdBy: currentUser.id });
      setMessage('');
      await loadBackups();
      setSelectedBackup(result.backup);
      setStatusText('수동 백업을 저장했습니다.');
    } catch (error) {
      setStatusText(`수동 백업 실패: ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestore = async (backup) => {
    setSelectedBackup(backup);

    if (!window.confirm(`"${backup.message}" 시점으로 복구할까요?\n현재 상태는 복구 전에 자동 백업됩니다.`)) {
      return;
    }

    if (!window.api?.restoreBackup) {
      setStatusText('Electron 실행 시 실제 복구가 가능합니다. 현재는 UI 미리보기입니다.');
      return;
    }

    setIsBusy(true);
    try {
      await window.api.restoreBackup({ backupId: backup.id });
      await loadBackups();
      setStatusText('복구가 완료되었습니다. 복구 직전 상태도 자동 저장했습니다.');
    } catch (error) {
      setStatusText(`복구 실패: ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestoreYesterday = () => {
    if (!yesterdayBackup) {
      setStatusText('어제 날짜의 백업이 없습니다. 매일 23:50 자동 백업 이후부터 사용할 수 있습니다.');
      return;
    }

    handleRestore(yesterdayBackup);
  };

  return (
    <PageShell title="백업 및 복구" description="월 마감 전후의 데이터를 GitHub 커밋처럼 메모와 함께 남기고, 필요한 날짜의 백업으로 되돌립니다. 백업본은 최대 한 달만 보관합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Backup timeline</p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{statusText}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              자동 백업은 매일 23:50에 생성되고, 기본 백업 위치는 이 PC의 공용 ProgramData 폴더입니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={loadBackups} disabled={isBusy}>
              새로고침
            </button>
            <Link className="btn btn-secondary" to="/settings/save">
              저장 경로 설정
            </Link>
            <button className="btn btn-primary" type="button" onClick={handleRestoreYesterday} disabled={isBusy}>
              어제 기준 복구
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
        <section className="col-span-12 space-y-4 xl:col-span-8">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="block">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">백업 메모</span>
                <input
                  className="form-input mt-2 w-full"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="예: 6월 마감 전 최종본"
                />
              </label>
              <button className="btn btn-primary h-10" type="button" onClick={handleCreateBackup} disabled={isBusy}>
                최종본 백업 남기기
              </button>
            </div>
            {!electronReady && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
                현재 브라우저 미리보기입니다. 데스크톱 앱으로 실행하면 SQLite와 설정 파일이 실제 백업됩니다.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">백업 히스토리</h2>
              <input
                className="form-input h-9 w-full sm:w-64"
                type="search"
                value={params.query}
                onChange={(event) => setParams({ query: event.target.value })}
                placeholder="메모, 날짜, 유형 검색"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredBackups.map((backup) => (
              <BackupRow
                key={backup.id}
                backup={backup}
                selected={selectedBackup?.id === backup.id}
                onPreview={setSelectedBackup}
                onRestore={handleRestore}
              />
            ))}
            {filteredBackups.length === 0 && (
              <section className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700/60 dark:bg-gray-800 dark:text-gray-400">
                조건에 맞는 백업이 없습니다.
              </section>
            )}
          </div>
        </section>

        <aside className="col-span-12 space-y-5 xl:col-span-4">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">선택한 복구 지점</h2>
            {selectedBackup ? (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">메모</p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{selectedBackup.message}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">생성 시각</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{formatDate(selectedBackup.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">보관 만료</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{formatDate(selectedBackup.retentionUntil)}</p>
                </div>
                <button className="btn btn-primary w-full" type="button" onClick={() => handleRestore(selectedBackup)} disabled={isBusy}>
                  선택 백업으로 복구
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">백업을 선택하면 복구 정보를 확인할 수 있습니다.</p>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">운영 규칙</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <p>매일 23:50에 자동 백업을 생성합니다.</p>
              <p>사용자가 남기는 수동 백업은 메모와 생성자를 함께 기록합니다.</p>
              <p>복구 전에는 현재 상태를 자동 저장해 되돌릴 지점을 남깁니다.</p>
              <p>모든 백업은 월 마감 기준에 맞춰 최대 한 달만 보관합니다.</p>
              <p>ProgramData 사용 권한이 없으면 현재 사용자의 문서 폴더에 백업합니다.</p>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">저장 위치</h2>
            <div className="mt-4 space-y-3">
              {[
                ['백업 폴더', settings.backupPath],
                ['SQLite DB', settings.databasePath],
                ['설정 파일', settings.settingsPath],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                  <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
                  <p className="mt-1 break-all text-sm text-gray-700 dark:text-gray-300">{value}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
