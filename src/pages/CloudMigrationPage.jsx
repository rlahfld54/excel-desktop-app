import React, { useState } from 'react';

import PageShell from './PageShell';
import { isSharedApiEnabled } from '../config/cloud';
import { sharedDataService } from '../services/sharedDataService';

export default function CloudMigrationPage() {
  const [message, setMessage] = useState('로컬 SQLite와 AWS RDS의 고객·상품·담당자를 양방향으로 맞출 수 있습니다.');
  const [busy, setBusy] = useState(false);

  const sync = async () => {
    if (!isSharedApiEnabled()) return setMessage('AWS API 주소가 설정되지 않았습니다.');
    if (!window.api?.exportWorkspaceForCloud || !window.api?.applyCloudWorkspace) return setMessage('Electron 앱에서만 동기화할 수 있습니다.');
    if (!window.confirm('로컬과 AWS의 최신 고객·상품·담당자 데이터를 동기화할까요?')) return;
    setBusy(true);
    try {
      const local = await window.api.exportWorkspaceForCloud();
      const result = await sharedDataService.syncWorkspace(local.payload);
      if (!result.ok) throw new Error(result.message || '동기화에 실패했습니다.');
      const applied = await window.api.applyCloudWorkspace(result.data?.snapshot ?? {});
      if (!applied?.ok) throw new Error('AWS 데이터를 로컬 SQLite에 반영하지 못했습니다.');
      const s = result.data?.summary ?? {};
      setMessage(`동기화 완료: 고객 ${s.customers ?? 0} · 상품 ${s.products ?? 0} · 업로드 ${s.salesUploads ?? 0} · 매출 ${s.sales ?? 0} · 담당자 ${s.contacts ?? 0} · 마감 ${s.closingStatuses ?? 0} · 기타 원본 ${s.archives ?? 0}건. 최신 AWS 결과를 이 PC에도 저장했습니다.`);
    } catch (error) { setMessage(`동기화 실패: ${error.message}`); } finally { setBusy(false); }
  };

  return <PageShell title="AWS 양방향 동기화" description="인터넷이 없을 때는 로컬 SQLite로 일하고, 연결되면 AWS RDS와 최신 데이터를 맞춥니다.">
    <div className="mx-auto max-w-2xl rounded-xl border border-accent-200 bg-white p-6 shadow-xs dark:border-accent-500/30 dark:bg-gray-800">
      <h2 className="text-lg font-bold">로컬 SQLite ↔ AWS RDS</h2>
      <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">같은 고객 코드·상품 코드·담당자는 <b>updated_at</b>이 더 최근인 값을 사용합니다. 동기화 중 로컬 데이터는 삭제하지 않습니다. 매출 원본은 기존의 “AWS 이관” 기능으로 먼저 올린 뒤, 이 화면에서는 기준정보와 담당자를 맞춥니다.</p>
      <button className="btn btn-primary mt-6" type="button" disabled={busy} onClick={sync}>{busy ? '동기화 중...' : '지금 AWS와 동기화'}</button>
      <p className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-200">{message}</p>
    </div>
  </PageShell>;
}
