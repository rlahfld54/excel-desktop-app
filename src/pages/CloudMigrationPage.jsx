import React, { useEffect, useState } from 'react';

import PageShell from './PageShell';
import { isSharedApiEnabled } from '../config/cloud';
import { sharedDataService } from '../services/sharedDataService';

export default function CloudMigrationPage() {
  const [message, setMessage] = useState('로컬 SQLite와 AWS RDS의 고객·상품·담당자를 양방향으로 맞출 수 있습니다.');
  const [busy, setBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [files, setFiles] = useState([]);

  const loadFiles = async () => {
    if (!isSharedApiEnabled()) return;
    const result = await sharedDataService.listCloudFiles();
    if (result.ok) setFiles(result.data?.files ?? []);
  };

  useEffect(() => { loadFiles(); }, []);

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

  const uploadFileOnRequest = async () => {
    if (!isSharedApiEnabled()) return setMessage('AWS API 주소가 설정되지 않았습니다.');
    if (!window.api?.chooseFile || !window.api?.readFileBase64) return setMessage('Electron 앱에서만 파일 보관을 사용할 수 있습니다.');
    const picked = await window.api.chooseFile({ title: 'AWS에 보관할 파일 선택', filters: [{ name: '엑셀·PDF', extensions: ['xlsx', 'xls', 'csv', 'pdf'] }] });
    if (picked?.canceled || !picked?.path) return;
    setFileBusy(true);
    try {
      const local = await window.api.readFileBase64(picked.path);
      if (!local?.ok) throw new Error(local?.message || '파일을 읽지 못했습니다.');
      const extension = local.fileName.toLowerCase().split('.').pop();
      const contentType = extension === 'pdf' ? 'application/pdf' : extension === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const presign = await sharedDataService.presignCloudFile({ fileName: local.fileName, contentType, sizeBytes: local.sizeBytes });
      if (!presign.ok) throw new Error(presign.message || '업로드 URL을 만들지 못했습니다.');
      const binary = Uint8Array.from(atob(local.base64), (character) => character.charCodeAt(0));
      const upload = await fetch(presign.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: binary });
      if (!upload.ok) throw new Error(`S3 업로드 실패 (${upload.status})`);
      const completed = await sharedDataService.completeCloudFile({ key: presign.data.key, fileName: local.fileName, contentType, sizeBytes: local.sizeBytes });
      if (!completed.ok) throw new Error(completed.message || '파일 기록 저장에 실패했습니다.');
      await loadFiles();
      setMessage(`파일 보관 완료: ${local.fileName} (${Math.ceil(local.sizeBytes / 1024)}KB). 파일을 선택했을 때만 AWS에 업로드됩니다.`);
    } catch (error) { setMessage(`파일 보관 실패: ${error.message}`); } finally { setFileBusy(false); }
  };

  const downloadFile = async (file) => {
    const result = await sharedDataService.downloadCloudFile(file.objectKey);
    if (!result.ok) return setMessage(`다운로드 링크 생성 실패: ${result.message}`);
    if (!window.api?.downloadCloudFile) return setMessage('Electron 앱에서만 파일을 다운로드할 수 있습니다.');
    const saved = await window.api.downloadCloudFile({ url: result.data.downloadUrl, fileName: file.fileName });
    if (saved?.canceled) return;
    if (!saved?.ok) return setMessage(`다운로드 실패: ${saved?.message || '알 수 없는 오류'}`);
    setMessage(`다운로드 완료: ${file.fileName}`);
  };

  return <PageShell title="AWS 양방향 동기화" description="인터넷이 없을 때는 로컬 SQLite로 일하고, 연결되면 AWS RDS와 최신 데이터를 맞춥니다.">
    <div className="mx-auto max-w-2xl rounded-xl border border-accent-200 bg-white p-6 shadow-xs dark:border-accent-500/30 dark:bg-gray-800">
      <h2 className="text-lg font-bold">로컬 SQLite ↔ AWS RDS</h2>
      <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">같은 고객 코드·상품 코드·담당자는 <b>updated_at</b>이 더 최근인 값을 사용합니다. 동기화 중 로컬 데이터는 삭제하지 않습니다. 매출 원본은 기존의 “AWS 이관” 기능으로 먼저 올린 뒤, 이 화면에서는 기준정보와 담당자를 맞춥니다.</p>
      <button className="btn btn-primary mt-6" type="button" disabled={busy} onClick={sync}>{busy ? '동기화 중...' : '지금 AWS와 동기화'}</button>
      <div className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700">
        <h3 className="font-semibold">파일 선택 보관</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">평소에는 로컬에만 두고, 필요한 엑셀·PDF만 선택해 S3에 올립니다. 최대 100MB까지 지원합니다.</p>
        <button className="btn btn-secondary mt-3" type="button" disabled={fileBusy} onClick={uploadFileOnRequest}>{fileBusy ? 'S3 업로드 중...' : '엑셀/PDF를 AWS에 보관'}</button>
      </div>
      <div className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">AWS 보관 파일</h3>
          <button className="btn btn-secondary h-8 px-3 text-xs" type="button" onClick={loadFiles}>새로고침</button>
        </div>
        <div className="mt-3 space-y-2">
          {files.length === 0 && <p className="text-sm text-gray-500">아직 보관된 파일이 없습니다.</p>}
          {files.map((file) => (
            <div key={file.fileId} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
              <div className="min-w-0"><p className="truncate font-medium">{file.fileName}</p><p className="text-xs text-gray-500">{Math.ceil(Number(file.sizeBytes || 0) / 1024)}KB · {String(file.uploadedAt || '').slice(0, 10)}</p></div>
              <button className="btn btn-secondary shrink-0 h-8 px-3 text-xs" type="button" onClick={() => downloadFile(file)}>다운로드</button>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-200">{message}</p>
    </div>
  </PageShell>;
}
