import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';
import { isSharedApiEnabled } from '../config/cloud';
import { sharedDataService } from '../services/sharedDataService';

const allowedExtensions = ['xlsx', 'xls', 'csv', 'pdf'];

function fileType(fileName = '') {
  return String(fileName).split('.').pop()?.toUpperCase() || 'FILE';
}

function fileSize(sizeBytes) {
  const value = Number(sizeBytes || 0);
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function contentType(fileName = '') {
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'csv') return 'text/csv';
  if (extension === 'xls') return 'application/vnd.ms-excel';
  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

export default function AwsFileStoragePage() {
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('필요한 엑셀·CSV·PDF만 AWS에 보관할 수 있습니다.');

  const loadFiles = async () => {
    if (!isSharedApiEnabled()) return setMessage('AWS API 주소가 설정되지 않았습니다.');
    const result = await sharedDataService.listCloudFiles();
    if (!result.ok) return setMessage(`파일 목록을 불러오지 못했습니다: ${result.message}`);
    setFiles(result.data?.files ?? []);
  };

  useEffect(() => { loadFiles(); }, []);

  const filteredFiles = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return files;
    return files.filter((file) => String(file.fileName || '').toLowerCase().includes(keyword));
  }, [files, query]);

  const upload = async () => {
    if (!window.api?.chooseFiles || !window.api?.readFileBase64) return setMessage('Electron 데스크톱 앱에서만 업로드할 수 있습니다.');
    const picked = await window.api.chooseFiles({ title: 'AWS에 보관할 파일 선택 (여러 개 선택 가능)', filters: [{ name: '엑셀·CSV·PDF', extensions: allowedExtensions }] });
    if (picked?.canceled || !picked?.paths?.length) return;
    setBusy(true);
    try {
      const failed = [];
      let completedCount = 0;
      for (const filePath of picked.paths) {
        try {
          const local = await window.api.readFileBase64(filePath);
          if (!local?.ok) throw new Error(local?.message || '파일을 읽지 못했습니다.');
          setMessage(`AWS 업로드 중: ${completedCount + 1}/${picked.paths.length} · ${local.fileName}`);
          const presign = await sharedDataService.presignCloudFile({ fileName: local.fileName, contentType: contentType(local.fileName), sizeBytes: local.sizeBytes });
          if (!presign.ok) throw new Error(presign.message || '업로드 주소 생성에 실패했습니다.');
          const binary = Uint8Array.from(atob(local.base64), (character) => character.charCodeAt(0));
          const uploaded = await fetch(presign.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType(local.fileName) }, body: binary });
          if (!uploaded.ok) throw new Error(`S3 업로드 실패 (${uploaded.status})`);
          const completed = await sharedDataService.completeCloudFile({ key: presign.data.key, fileName: local.fileName, contentType: contentType(local.fileName), sizeBytes: local.sizeBytes });
          if (!completed.ok) throw new Error(completed.message || '파일 기록 저장에 실패했습니다.');
          completedCount += 1;
        } catch (error) { failed.push(`${filePath.split(/[\\/]/).pop()}: ${error.message}`); }
      }
      await loadFiles();
      setMessage(failed.length ? `${completedCount}개 업로드 완료 · ${failed.length}개 실패: ${failed.join(' / ')}` : `${completedCount}개 파일을 AWS에 보관했습니다.`);
    } catch (error) {
      setMessage(`업로드 실패: ${error.message}`);
    } finally { setBusy(false); }
  };

  const uploadFolder = async () => {
    if (!window.api?.chooseFolderFiles || !window.api?.readFileBase64) return setMessage('Electron 데스크톱 앱에서만 폴더 업로드를 할 수 있습니다.');
    const picked = await window.api.chooseFolderFiles({ title: 'AWS에 보관할 폴더 선택', extensions: allowedExtensions });
    if (picked?.canceled) return;
    if (!picked?.files?.length) return setMessage('선택한 폴더에 업로드 가능한 엑셀·CSV·PDF 파일이 없습니다.');
    setBusy(true);
    try {
      const failed = [];
      let completedCount = 0;
      for (const selectedFile of picked.files) {
        try {
          const local = await window.api.readFileBase64(selectedFile);
          if (!local?.ok) throw new Error(local?.message || '파일을 읽지 못했습니다.');
          setMessage(`폴더 업로드 중: ${completedCount + 1}/${picked.files.length} · ${local.fileName}`);
          const presign = await sharedDataService.presignCloudFile({ fileName: local.fileName, contentType: contentType(local.fileName), sizeBytes: local.sizeBytes });
          if (!presign.ok) throw new Error(presign.message || '업로드 주소 생성에 실패했습니다.');
          const binary = Uint8Array.from(atob(local.base64), (character) => character.charCodeAt(0));
          const uploaded = await fetch(presign.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType(local.fileName) }, body: binary });
          if (!uploaded.ok) throw new Error(`S3 업로드 실패 (${uploaded.status})`);
          const completed = await sharedDataService.completeCloudFile({ key: presign.data.key, fileName: local.fileName, contentType: contentType(local.fileName), sizeBytes: local.sizeBytes });
          if (!completed.ok) throw new Error(completed.message || '파일 기록 저장에 실패했습니다.');
          completedCount += 1;
        } catch (error) { failed.push(`${selectedFile.relativePath}: ${error.message}`); }
      }
      await loadFiles();
      const skippedText = picked.skippedCount ? ` · 지원하지 않는 ${picked.skippedCount}개 파일 건너뜀` : '';
      setMessage(failed.length ? `${completedCount}개 업로드 완료${skippedText} · ${failed.length}개 실패: ${failed.join(' / ')}` : `${completedCount}개 파일을 폴더 구조와 함께 AWS에 보관했습니다.${skippedText}`);
    } catch (error) {
      setMessage(`폴더 업로드 실패: ${error.message}`);
    } finally { setBusy(false); }
  };

  const download = async (file) => {
    setBusy(true);
    try {
      const result = await sharedDataService.downloadCloudFile(file.objectKey);
      if (!result.ok) throw new Error(result.message || '다운로드 주소 생성에 실패했습니다.');
      const saved = await window.api?.downloadCloudFile?.({ url: result.data.downloadUrl, fileName: file.fileName });
      if (saved?.canceled) return;
      if (!saved?.ok) throw new Error(saved?.message || '다운로드에 실패했습니다.');
      setMessage(`다운로드 완료: ${file.fileName}`);
    } catch (error) { setMessage(`다운로드 실패: ${error.message}`); } finally { setBusy(false); }
  };

  const remove = async (file) => {
    if (!window.confirm(`AWS에서 “${file.fileName}” 파일을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    try {
      const result = await sharedDataService.deleteCloudFile(file.objectKey);
      if (!result.ok) throw new Error(result.message || '파일 삭제에 실패했습니다.');
      setFiles((current) => current.filter((item) => item.objectKey !== file.objectKey));
      setMessage(`AWS 파일을 삭제했습니다: ${file.fileName}`);
    } catch (error) { setMessage(`삭제 실패: ${error.message}`); } finally { setBusy(false); }
  };

  return (
    <PageShell title="AWS 파일 보관함" description="필요한 엑셀·CSV·PDF만 S3에 보관하고 언제든 다운로드하거나 삭제합니다.">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold">내 AWS 보관 파일</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">지원 형식: XLSX, XLS, CSV, PDF · 파일당 최대 100MB · 폴더 업로드 시 하위 폴더 구조도 보존</p>
          </div>
          <div className="flex flex-wrap gap-2"><button className="btn btn-secondary" type="button" disabled={busy} onClick={loadFiles}>새로고침</button><button className="btn btn-secondary" type="button" disabled={busy} onClick={uploadFolder}>{busy ? '작업 중…' : '폴더 업로드'}</button><button className="btn btn-primary" type="button" disabled={busy} onClick={upload}>{busy ? '작업 중…' : '파일 업로드'}</button></div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input className="form-input flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="파일명으로 검색" /><p className="shrink-0 self-center text-sm text-gray-500">{filteredFiles.length}개 파일</p></div>
        <p className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-200">{message}</p>
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"><div className="hidden grid-cols-[minmax(0,1fr)_90px_150px_170px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 md:grid dark:border-gray-700 dark:bg-gray-900"><span>파일</span><span>형식</span><span>업로드</span><span>작업</span></div>{filteredFiles.length === 0 ? <p className="px-4 py-12 text-center text-sm text-gray-500">조건에 맞는 보관 파일이 없습니다.</p> : filteredFiles.map((file) => <div key={file.fileId} className="grid gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_90px_150px_170px] md:items-center dark:border-gray-700/60"><div className="min-w-0"><p className="truncate font-semibold">{file.fileName}</p><p className="mt-1 text-xs text-gray-500">{fileSize(file.sizeBytes)}</p></div><span className="text-sm text-gray-600 dark:text-gray-300">{fileType(file.fileName)}</span><span className="text-sm text-gray-500">{new Date(file.uploadedAt).toLocaleString('ko-KR')}</span><div className="flex gap-2"><button className="btn btn-secondary h-8 px-3 text-xs" type="button" disabled={busy} onClick={() => download(file)}>다운로드</button><button className="btn h-8 border-rose-200 bg-rose-50 px-3 text-xs text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" type="button" disabled={busy} onClick={() => remove(file)}>삭제</button></div></div>)}</div>
      </section>
    </PageShell>
  );
}
