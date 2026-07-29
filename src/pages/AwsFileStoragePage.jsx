import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';
import { isSharedApiEnabled } from '../config/cloud';
import { sharedDataService } from '../services/sharedDataService';

const blockedExtensions = new Set(['apk', 'app', 'bat', 'cmd', 'com', 'dll', 'exe', 'jar', 'js', 'jse', 'msi', 'ps1', 'scr', 'sh', 'vbe', 'vbs', 'wsf']);

function extensionOf(fileName = '') {
  return String(fileName).split('.').pop()?.trim().toLowerCase() || '';
}

function isAllowedFile(fileName = '') {
  return !blockedExtensions.has(extensionOf(fileName));
}

function fileType(fileName = '') {
  return String(fileName).split('.').pop()?.toUpperCase() || 'FILE';
}

function fileSize(sizeBytes) {
  const value = Number(sizeBytes || 0);
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function contentType(fileName = '') {
  const extension = extensionOf(fileName);
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'csv') return 'text/csv';
  if (extension === 'xls') return 'application/vnd.ms-excel';
  if (extension === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (extension === 'doc') return 'application/msword';
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (extension === 'ppt') return 'application/vnd.ms-powerpoint';
  if (extension === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (extension === 'txt' || extension === 'md') return 'text/plain; charset=utf-8';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'svg') return 'image/svg+xml';
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'zip') return 'application/zip';
  return 'application/octet-stream';
}

function normalizePath(value = '') {
  return String(value).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function pathSegments(fileName = '') {
  return normalizePath(fileName).split('/').filter(Boolean);
}

function storagePath(file = {}) {
  // 앱의 루트는 S3의 user-files/ 폴더다. 첫 화면에는 그 아래의
  // 사용자별 폴더(2, 4, ...)를 모두 보여 주고 클릭해서 들어간다.
  // 일부 이전 API 응답은 objectKey가 없으므로 uploadedBy로 경로를 복원한다.
  const objectKey = normalizePath(file.objectKey || file.object_key);
  const uploadedBy = String(file.uploadedBy || file.uploaded_by || '').trim();
  const sourcePath = objectKey || (uploadedBy ? `user-files/${uploadedBy}/${normalizePath(file.fileName)}` : normalizePath(file.fileName));
  return sourcePath.replace(/^user-files\//, '');
}

function folderContents(files, folderPath = '') {
  const prefix = folderPath ? `${normalizePath(folderPath)}/` : '';
  const folders = new Map();
  const directFiles = [];

  files.forEach((file) => {
    const relativePath = storagePath(file);
    if (!relativePath.startsWith(prefix)) return;
    const remainder = relativePath.slice(prefix.length);
    const [firstSegment, ...remaining] = remainder.split('/').filter(Boolean);
    if (!firstSegment) return;
    if (remaining.length) {
      const childPath = `${prefix}${firstSegment}`;
      const current = folders.get(childPath) ?? { name: firstSegment, path: childPath, fileCount: 0 };
      current.fileCount += 1;
      folders.set(childPath, current);
      return;
    }
    directFiles.push(file);
  });

  return {
    folders: [...folders.values()].sort((left, right) => left.name.localeCompare(right.name, 'ko-KR')),
    files: directFiles.sort((left, right) => String(left.fileName).localeCompare(String(right.fileName), 'ko-KR')),
  };
}

function breadcrumbParts(folderPath = '') {
  const parts = pathSegments(folderPath);
  return parts.map((name, index) => ({
    name,
    path: parts.slice(0, index + 1).join('/'),
  }));
}

export default function AwsFileStoragePage() {
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState('');
  const [currentFolder, setCurrentFolder] = useState('');
  const [uploadDestination, setUploadDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('이미지·문서·압축파일·미디어 등 필요한 파일을 AWS에 보관할 수 있습니다. 실행 파일과 스크립트는 제외됩니다.');

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

  const visibleContents = useMemo(() => {
    // 검색은 폴더를 다시 통과시키지 않고 일치한 파일을 바로 보여 준다.
    if (query.trim()) return { folders: [], files: filteredFiles };
    return folderContents(files, currentFolder);
  }, [files, currentFolder, filteredFiles, query]);
  const crumbs = useMemo(() => breadcrumbParts(currentFolder), [currentFolder]);
  const uploadDestinations = useMemo(() => {
    const folders = new Set();
    files.forEach((file) => {
      const parts = pathSegments(storagePath(file)).slice(0, -1);
      parts.forEach((_, index) => folders.add(parts.slice(0, index + 1).join('/')));
    });
    return [...folders].sort((left, right) => left.localeCompare(right, 'ko-KR'));
  }, [files]);

  const destinationLabel = uploadDestination || '내 기본 폴더';

  const upload = async () => {
    if (!window.api?.chooseFiles || !window.api?.readFileBase64) return setMessage('Electron 데스크톱 앱에서만 업로드할 수 있습니다.');
    const picked = await window.api.chooseFiles({ title: 'AWS에 보관할 파일 선택 (여러 개 선택 가능)', filters: [{ name: '모든 파일', extensions: ['*'] }] });
    if (picked?.canceled || !picked?.paths?.length) return;
    const selectedPaths = picked.paths.filter(isAllowedFile);
    const blockedCount = picked.paths.length - selectedPaths.length;
    if (!selectedPaths.length) return setMessage('실행 파일 또는 스크립트는 AWS 보관함에 업로드할 수 없습니다.');
    setBusy(true);
    try {
      const failed = [];
      let completedCount = 0;
      for (const filePath of selectedPaths) {
        try {
          const local = await window.api.readFileBase64(filePath);
          if (!local?.ok) throw new Error(local?.message || '파일을 읽지 못했습니다.');
          setMessage(`AWS 업로드 중: ${completedCount + 1}/${selectedPaths.length} · ${local.fileName}`);
          const presign = await sharedDataService.presignCloudFile({ fileName: local.fileName, destinationPath: uploadDestination, contentType: contentType(local.fileName), sizeBytes: local.sizeBytes });
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
      const blockedText = blockedCount ? ` · 보안상 ${blockedCount}개 제외` : '';
      setMessage(failed.length ? `${completedCount}개 업로드 완료${blockedText} · ${failed.length}개 실패: ${failed.join(' / ')}` : `${completedCount}개 파일을 “${destinationLabel}”에 보관했습니다.${blockedText}`);
    } catch (error) {
      setMessage(`업로드 실패: ${error.message}`);
    } finally { setBusy(false); }
  };

  const uploadFolder = async () => {
    if (!window.api?.chooseFolderFiles || !window.api?.readFileBase64) return setMessage('Electron 데스크톱 앱에서만 폴더 업로드를 할 수 있습니다.');
    const picked = await window.api.chooseFolderFiles({ title: 'AWS에 보관할 폴더 선택' });
    if (picked?.canceled) return;
    const selectedFiles = (picked?.files ?? []).filter((file) => isAllowedFile(file.relativePath || file.path));
    const blockedCount = (picked?.files?.length ?? 0) - selectedFiles.length;
    if (!selectedFiles.length) return setMessage('선택한 폴더에 업로드할 수 있는 파일이 없습니다. 실행 파일과 스크립트는 제외됩니다.');
    setBusy(true);
    try {
      const failed = [];
      let completedCount = 0;
      for (const selectedFile of selectedFiles) {
        try {
          const local = await window.api.readFileBase64(selectedFile);
          if (!local?.ok) throw new Error(local?.message || '파일을 읽지 못했습니다.');
          setMessage(`폴더 업로드 중: ${completedCount + 1}/${selectedFiles.length} · ${local.fileName}`);
          const presign = await sharedDataService.presignCloudFile({ fileName: local.fileName, destinationPath: uploadDestination, contentType: contentType(local.fileName), sizeBytes: local.sizeBytes });
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
      const skippedCount = Number(picked.skippedCount || 0) + blockedCount;
      const skippedText = skippedCount ? ` · 보안상 ${skippedCount}개 파일 제외` : '';
      setMessage(failed.length ? `${completedCount}개 업로드 완료${skippedText} · ${failed.length}개 실패: ${failed.join(' / ')}` : `${completedCount}개 파일을 “${destinationLabel}”에 폴더 구조와 함께 보관했습니다.${skippedText}`);
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
      setMessage(`AWS 파일 삭제 중: ${file.fileName}`);
      const result = await sharedDataService.deleteCloudFile(file.objectKey);
      if (!result.ok) {
        const permissionHint = /accessdenied|deleteobject|권한/i.test(result.message || '')
          ? ' Lambda 실행 역할에 s3:DeleteObject 권한이 필요합니다.'
          : '';
        throw new Error(`${result.message || '파일 삭제에 실패했습니다.'}${permissionHint}`);
      }
      await loadFiles();
      setMessage(`AWS 파일을 삭제했습니다: ${file.fileName}`);
    } catch (error) {
      const timeoutHint = /timed out|시간 초과/i.test(error?.message || '')
        ? ' Lambda가 VPC에서 S3에 연결하지 못하고 있습니다. S3 Gateway VPC 엔드포인트 상태와 Lambda 배포를 확인하세요.'
        : '';
      setMessage(`삭제 실패: ${error.message}.${timeoutHint}`);
    } finally { setBusy(false); }
  };

  return (
    <PageShell title="AWS 파일 보관함" description="이미지, 문서, 압축파일 등 필요한 업무 파일을 S3에 보관하고 언제든 다운로드하거나 삭제합니다.">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold">내 AWS 보관 파일</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">이미지·문서·압축파일·미디어 등 지원 · 파일당 최대 100MB · 폴더 업로드 시 하위 폴더 구조도 보존(빈 폴더 제외) · 실행 파일/스크립트 제외</p>
          </div>
          <div className="flex flex-wrap gap-2"><button className="btn btn-secondary" type="button" disabled={busy} onClick={loadFiles}>새로고침</button><button className="btn btn-secondary" type="button" disabled={busy} onClick={uploadFolder}>{busy ? '작업 중…' : '폴더 업로드'}</button><button className="btn btn-primary" type="button" disabled={busy} onClick={upload}>{busy ? '작업 중…' : '파일 업로드'}</button></div>
        </div>
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-teal-100 bg-teal-50/60 p-3 sm:flex-row sm:items-center dark:border-teal-500/20 dark:bg-teal-500/10">
          <label className="shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-200" htmlFor="aws-upload-destination">업로드 위치</label>
          <select id="aws-upload-destination" className="form-select min-w-0 flex-1" value={uploadDestination} disabled={busy} onChange={(event) => setUploadDestination(event.target.value)}>
            <option value="">내 기본 폴더</option>
            {uploadDestinations.map((folder) => <option key={folder} value={folder}>📁 {folder}</option>)}
          </select>
          {currentFolder && <button className="btn btn-secondary shrink-0" type="button" disabled={busy} onClick={() => setUploadDestination(currentFolder)}>현재 폴더 선택</button>}
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input className="form-input flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="파일명 또는 경로로 검색" /><p className="shrink-0 self-center text-sm text-gray-500">{filteredFiles.length}개 파일</p></div>
        <p className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-200">{message}</p>
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-900">
            <button className="font-semibold text-teal-700 hover:underline disabled:text-gray-400 dark:text-teal-300" type="button" disabled={!currentFolder || Boolean(query.trim())} onClick={() => setCurrentFolder('')}>내 파일</button>
            {crumbs.map((crumb) => <React.Fragment key={crumb.path}><span className="text-gray-400">/</span><button className="font-semibold text-teal-700 hover:underline disabled:text-gray-400 dark:text-teal-300" type="button" disabled={Boolean(query.trim())} onClick={() => setCurrentFolder(crumb.path)}>{crumb.name}</button></React.Fragment>)}
            {query.trim() && <><span className="text-gray-400">/</span><span className="font-medium text-gray-500">검색 결과</span></>}
          </div>
          {currentFolder && !query.trim() && <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-700/60"><button className="text-xs font-semibold text-gray-500 hover:text-teal-700 dark:text-gray-400 dark:hover:text-teal-300" type="button" onClick={() => setCurrentFolder(crumbs.at(-2)?.path ?? '')}>← 상위 폴더</button></div>}
          <div className="hidden grid-cols-[minmax(0,1fr)_90px_150px_170px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 md:grid dark:border-gray-700 dark:bg-gray-900"><span>파일</span><span>형식</span><span>업로드</span><span>작업</span></div>
          {visibleContents.folders.map((folder) => <button key={folder.path} className="grid w-full gap-2 border-b border-gray-100 px-4 py-3 text-left hover:bg-teal-50/50 dark:border-gray-700/60 dark:hover:bg-teal-500/10 md:grid-cols-[minmax(0,1fr)_90px_150px_170px] md:items-center" type="button" onClick={() => setCurrentFolder(folder.path)}><div className="min-w-0"><p className="truncate font-semibold text-gray-900 dark:text-gray-100">📁 {folder.name}</p><p className="mt-1 text-xs text-gray-500">파일 {folder.fileCount}개</p></div><span className="text-sm text-gray-600 dark:text-gray-300">폴더</span><span className="text-sm text-gray-500">-</span><span className="text-xs font-semibold text-teal-700 dark:text-teal-300">열기 →</span></button>)}
          {visibleContents.files.map((file) => {
            const segments = pathSegments(file.fileName);
            const parentPath = pathSegments(storagePath(file)).slice(0, -1).join('/');
            return (
              <div key={file.fileId} className="grid gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_90px_150px_170px] md:items-center dark:border-gray-700/60">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{segments.at(-1) || file.fileName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                    <span>{fileSize(file.sizeBytes)}</span>
                    {parentPath && <button className="font-semibold text-teal-700 hover:underline dark:text-teal-300" type="button" onClick={() => { setQuery(''); setCurrentFolder(parentPath); }}>📁 {parentPath}</button>}
                  </div>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-300">{fileType(file.fileName)}</span>
                <span className="text-sm text-gray-500">{new Date(file.uploadedAt).toLocaleString('ko-KR')}</span>
                <div className="flex gap-2"><button className="btn btn-secondary h-8 px-3 text-xs" type="button" disabled={busy} onClick={() => download(file)}>다운로드</button><button className="btn h-8 border-rose-200 bg-rose-50 px-3 text-xs text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" type="button" disabled={busy} onClick={() => remove(file)}>삭제</button></div>
              </div>
            );
          })}
          {!visibleContents.folders.length && !visibleContents.files.length && <p className="px-4 py-12 text-center text-sm text-gray-500">{query.trim() ? '조건에 맞는 보관 파일이 없습니다.' : '이 폴더에는 파일이 없습니다.'}</p>}
        </div>
      </section>
    </PageShell>
  );
}
