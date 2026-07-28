import React, { useEffect, useState } from 'react';

import PageShell from './PageShell';
import { useToast } from '../components/common';

function formatBytes(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.ceil(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CacheManagerPage() {
  const [summary, setSummary] = useState({ entries: [], totalBytes: 0 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('캐시는 원본 SQLite 데이터와 백업 파일을 건드리지 않습니다.');
  const { showToast } = useToast();

  const refresh = async () => {
    if (!window.api?.getCacheSummary) return setMessage('Electron 데스크톱 앱에서만 캐시 상태를 확인할 수 있습니다.');
    setBusy(true);
    try {
      const result = await window.api.getCacheSummary();
      if (!result?.ok) throw new Error(result?.message || '캐시 상태를 읽지 못했습니다.');
      setSummary(result);
      setMessage('현재 캐시 상태를 불러왔습니다.');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  useEffect(() => { refresh(); }, []);

  const clear = async () => {
    if (!window.api?.clearAppCaches) return setMessage('Electron 데스크톱 앱에서만 캐시를 정리할 수 있습니다.');
    if (!window.confirm('웹·코드·그래픽 캐시와 업무 임시 파일을 정리할까요?\nSQLite 데이터, AWS 동기화 데이터, 백업 파일, 로그인 세션은 삭제되지 않습니다.')) return;
    setBusy(true);
    try {
      const result = await window.api.clearAppCaches();
      if (!result?.ok) throw new Error(result?.message || '캐시를 정리하지 못했습니다.');
      setSummary(result);
      setMessage('캐시와 임시 파일을 정리했습니다.');
      showToast({ type: 'success', title: '캐시 정리 완료', message: 'SQLite 데이터와 백업 파일은 유지했습니다.' });
    } catch (error) {
      setMessage(error.message);
      showToast({ type: 'error', title: '캐시 정리에 실패했습니다', message: error.message });
    } finally { setBusy(false); }
  };

  return <PageShell title="캐시 관리" description="앱 성능을 위한 보조 파일만 확인하고 정리합니다.">
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-gray-500">정리 가능한 캐시</p><p className="mt-1 text-3xl font-bold">{formatBytes(summary.totalBytes)}</p><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">SQLite, 백업, AWS 보관 파일, 로그인 24시간 인증 정보는 유지합니다.</p></div><div className="flex gap-2"><button className="btn btn-secondary" type="button" disabled={busy} onClick={refresh}>새로고침</button><button className="btn btn-primary" type="button" disabled={busy} onClick={clear}>{busy ? '정리 중…' : '캐시 정리'}</button></div></div>
      <p className="mt-5 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-200">{message}</p>
      <div className="mt-5 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"><div className="grid grid-cols-[1fr_140px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-bold text-gray-500 dark:border-gray-700 dark:bg-gray-900"><span>유형</span><span className="text-right">용량</span></div>{summary.entries.map((entry) => <div key={entry.key} className="grid grid-cols-[1fr_140px] border-b border-gray-100 px-4 py-3 text-sm last:border-0 dark:border-gray-700/60"><span className="font-semibold">{entry.label}</span><span className="text-right text-gray-500">{formatBytes(entry.bytes)}</span></div>)}</div>
    </section>
  </PageShell>;
}
