import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';
import { getCurrentUser } from '../utils/authSession';

function statusClass(status) {
  if (['READY', 'CREATED', 'COMPLETED'].includes(status)) {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
  }

  if (['FAILED', 'MISSING'].includes(status)) {
    return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
  }

  return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
}

function channelClass(channel) {
  if (channel === 'EMAIL') {
    return 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300';
  }

  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function createSendListCsv(sendPackage) {
  const headers = ['package_name', 'closing_month', 'customer_code', 'customer_name', 'channel', 'recipient_email', 'subject', 'pdf_path', 'xlsx_path', 'status'];
  const rows = (sendPackage?.items ?? []).map((item) => [
    sendPackage.packageName,
    sendPackage.closingMonth,
    item.customerCode,
    item.customerName,
    item.channel,
    item.recipientEmail,
    item.subject,
    item.attachmentPdfPath,
    item.attachmentXlsxPath,
    item.status,
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

function downloadCsvInBrowser(fileName, csv) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function MetricCard({ label, value, detail, tone = 'default' }) {
  const toneClass = tone === 'warning'
    ? 'border-yellow-200 bg-yellow-50/70 dark:border-yellow-500/30 dark:bg-yellow-500/10'
    : 'border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-800';

  return (
    <section className={`rounded-lg border px-4 py-3 shadow-xs ${toneClass}`}>
      <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </section>
  );
}

function monthToDate(month) {
  return `${month || '1900-01'}-01`;
}

function isInDateRange(value, startDate, endDate) {
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
}

function ChecklistItem({ label, detail, status }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
      <div className="min-w-0">
        <p className="font-medium text-gray-800 dark:text-gray-100">{label}</p>
        <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{detail}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(status)}`}>
        {status}
      </span>
    </div>
  );
}

export default function SendPackagesPage() {
  const currentUser = getCurrentUser();
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [params, setParams] = useState({
    startDate: '',
    endDate: '',
  });
  const [loadState, setLoadState] = useState('등록된 발송 패키지가 없습니다.');
  const [exportState, setExportState] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);

  const filteredPackages = useMemo(() => (
    packages.filter((sendPackage) => isInDateRange(monthToDate(sendPackage.closingMonth), params.startDate, params.endDate))
  ), [packages, params.endDate, params.startDate]);

  const selectedPackage = useMemo(
    () => filteredPackages.find((item) => item.packageId === selectedPackageId) ?? filteredPackages[0] ?? packages[0],
    [filteredPackages, packages, selectedPackageId],
  );
  const selectedItem = useMemo(
    () => selectedPackage?.items.find((item) => item.itemId === selectedItemId) ?? selectedPackage?.items[0],
    [selectedItemId, selectedPackage],
  );

  const metrics = useMemo(() => {
    const itemCount = filteredPackages.reduce((sum, sendPackage) => sum + (sendPackage.itemCount ?? 0), 0);
    const readyCount = filteredPackages.reduce((sum, sendPackage) => sum + (sendPackage.readyCount ?? 0), 0);
    const missingEmailCount = filteredPackages.reduce((sum, sendPackage) => sum + (sendPackage.missingEmailCount ?? 0), 0);
    const missingAttachmentCount = filteredPackages.reduce((sum, sendPackage) => sum + (sendPackage.missingAttachmentCount ?? 0), 0);

    return [
      { label: '패키지', value: `${filteredPackages.length.toLocaleString('ko-KR')}건`, detail: '거래처 요청 묶음' },
      { label: '발송 대상', value: `${itemCount.toLocaleString('ko-KR')}건`, detail: `${readyCount.toLocaleString('ko-KR')}건 준비 완료` },
      { label: '이메일 확인', value: `${missingEmailCount.toLocaleString('ko-KR')}건`, detail: 'EMAIL 채널 이메일 누락', tone: missingEmailCount > 0 ? 'warning' : 'default' },
      { label: '첨부 확인', value: `${missingAttachmentCount.toLocaleString('ko-KR')}건`, detail: 'PDF/XLSX 경로 누락', tone: missingAttachmentCount > 0 ? 'warning' : 'default' },
    ];
  }, [filteredPackages]);

  const setNextPackages = (nextPackages) => {
    const normalized = Array.isArray(nextPackages) ? nextPackages : [];
    setPackages(normalized);
    setSelectedPackageId(normalized[0]?.packageId ?? null);
    setSelectedItemId(normalized[0]?.items?.[0]?.itemId ?? null);
  };

  const loadPackages = async () => {
    if (!window.api?.getSendPackages) {
      setNextPackages([]);
      setLoadState('Electron 실행 시 실제 발송 패키지와 연결됩니다.');
      return;
    }

    try {
      const result = await window.api.getSendPackages({
        createdBy: currentUser.id,
        isAdmin: currentUser.id === '황주은' && currentUser.role === 'ADMIN',
      });
      setNextPackages(result.packages ?? []);
      setLoadState(result.packages?.length ? 'SQLite 연결됨' : 'SQLite 연결됨 / 패키지 없음');
    } catch (error) {
      setNextPackages([]);
      setLoadState(`SQLite 확인 필요: ${error.message}`);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const handlePrepareAttachments = async () => {
    if (!selectedPackage) return;

    if (!window.api?.prepareSendPackageAttachments) {
      setExportState('Electron 실행 후 첨부 경로 준비를 저장할 수 있습니다.');
      return;
    }

    setIsPreparing(true);
    try {
      const result = await window.api.prepareSendPackageAttachments({
        packageId: selectedPackage.packageId,
        createdBy: currentUser.id,
        isAdmin: currentUser.id === '황주은' && currentUser.role === 'ADMIN',
      });
      setNextPackages(result.packages ?? []);
      setExportState('거래처별 PDF/XLSX 첨부 경로를 준비했습니다.');
    } catch (error) {
      setExportState(`첨부 준비 실패: ${error.message}`);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleExportSendList = async () => {
    if (!selectedPackage) return;

    const csv = createSendListCsv(selectedPackage);
    const fileName = `${selectedPackage.packageName}-send_list.csv`;

    try {
      if (window.api?.saveFileAs) {
        const bytes = Array.from(new TextEncoder().encode(`\uFEFF${csv}`));
        const result = await window.api.saveFileAs({ fileName, bytes });
        if (result?.canceled) {
          setExportState('send_list.csv 저장을 취소했습니다.');
          return;
        }
        setExportState(`${fileName} 저장 완료`);
        return;
      }

      downloadCsvInBrowser(fileName, csv);
      setExportState(`${fileName} 다운로드 완료`);
    } catch (error) {
      setExportState(`CSV 저장 실패: ${error.message}`);
    }
  };

  return (
    <PageShell title="발송 패키지" description="거래처별 PDF/XLSX 첨부, 수신자, 제목과 본문을 하나의 발송 준비 묶음으로 관리합니다.">
      <div className="flex h-[calc(100vh-14rem)] flex-col">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Send packages</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{loadState}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">문서 기준 3단계: 거래처별 검수 결과 PDF/XLSX 첨부 생성 준비</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={loadPackages}>
              새로고침
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleExportSendList}>
              send_list.csv
            </button>
            <button className="btn btn-secondary" type="button" onClick={handlePrepareAttachments} disabled={isPreparing}>
              {isPreparing ? '준비 중' : '첨부 경로 준비'}
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3 dark:border-gray-700/60 sm:grid-cols-[136px_136px_minmax(0,1fr)] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">시작일</span>
            <input
              className="form-input w-full"
              type="date"
              value={params.startDate}
              onChange={(event) => setParams((current) => ({ ...current, startDate: event.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">마지막일</span>
            <input
              className="form-input w-full"
              type="date"
              value={params.endDate}
              onChange={(event) => setParams((current) => ({ ...current, endDate: event.target.value }))}
            />
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400">마감월 기준으로 날짜 범위에 포함된 패키지만 표시합니다.</p>
        </div>
      </section>

      {exportState && (
        <section className="mb-4 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-300">
          {exportState}
        </section>
      )}

      <div className="mb-4 grid shrink-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-5">
        <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <header className="shrink-0 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">패키지 목록</h2>
          </header>
          <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700/60">
            {filteredPackages.map((sendPackage) => {
              const selected = sendPackage.packageId === selectedPackage?.packageId;

              return (
                <button
                  key={sendPackage.packageId}
                  className={`flex w-full flex-col gap-2 px-4 py-3 text-left transition ${selected ? 'bg-accent-50 dark:bg-accent-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-900/30'}`}
                  type="button"
                  onClick={() => {
                    setSelectedPackageId(sendPackage.packageId);
                    setSelectedItemId(sendPackage.items[0]?.itemId);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{sendPackage.packageName}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(sendPackage.status)}`}>
                      {sendPackage.status}
                    </span>
                  </div>
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400">{sendPackage.outputFolderPath}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    대상 {sendPackage.itemCount.toLocaleString('ko-KR')}건 / 첨부 누락 {(sendPackage.missingAttachmentCount ?? 0).toLocaleString('ko-KR')}건
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8">
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">거래처별 첨부 준비</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedPackage?.packageName}</p>
            </div>
            <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
              {selectedPackage?.closingMonth}
            </span>
          </header>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div data-table-tools="false" className="min-h-0 overflow-auto border-b border-gray-200 no-scrollbar dark:border-gray-700/60 lg:border-b-0 lg:border-r">
              <table className="min-w-[760px] w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {['거래처', '채널', '수신자', 'PDF', 'XLSX', '상태'].map((column) => (
                      <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(selectedPackage?.items ?? []).map((item) => {
                    const selected = item.itemId === selectedItem?.itemId;

                    return (
                      <tr
                        key={item.itemId}
                        className={`group cursor-pointer ${selected ? 'bg-accent-50/70 dark:bg-accent-500/10' : ''}`}
                        onClick={() => setSelectedItemId(item.itemId)}
                      >
                        <td className="border-b border-r border-gray-200 px-3 py-2 font-medium text-gray-800 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-100 dark:group-hover:bg-accent-500/10">
                          {item.customerName}
                        </td>
                        <td className="border-b border-r border-gray-200 px-3 py-2 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:group-hover:bg-accent-500/10">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${channelClass(item.channel)}`}>
                            {item.channel}
                          </span>
                        </td>
                        <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                          {item.recipientEmail ?? '확인 필요'}
                        </td>
                        <td className="border-b border-r border-gray-200 px-3 py-2 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:group-hover:bg-accent-500/10">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(item.attachmentPdfPath ? 'READY' : 'MISSING')}`}>
                            {item.attachmentPdfPath ? 'READY' : 'MISSING'}
                          </span>
                        </td>
                        <td className="border-b border-r border-gray-200 px-3 py-2 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:group-hover:bg-accent-500/10">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(item.attachmentXlsxPath ? 'READY' : 'MISSING')}`}>
                            {item.attachmentXlsxPath ? 'READY' : 'MISSING'}
                          </span>
                        </td>
                        <td className="border-b border-r border-gray-200 px-3 py-2 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:group-hover:bg-accent-500/10">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <aside className="min-h-0 overflow-y-auto p-4">
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">선택 대상</p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedItem?.customerName}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedItem?.customerCode}</p>

              <div className="mt-4 space-y-3">
                <ChecklistItem label="수신자" detail={selectedItem?.recipientEmail ?? '이메일 확인 필요'} status={selectedItem?.recipientEmail ? 'READY' : 'MISSING'} />
                <ChecklistItem label="제목" detail={selectedItem?.subject ?? '제목 없음'} status={selectedItem?.subject ? 'READY' : 'MISSING'} />
                <ChecklistItem label="PDF 첨부" detail={selectedItem?.attachmentPdfPath ?? 'PDF 경로 없음'} status={selectedItem?.attachmentPdfPath ? 'READY' : 'MISSING'} />
                <ChecklistItem label="XLSX 첨부" detail={selectedItem?.attachmentXlsxPath ?? 'XLSX 경로 없음'} status={selectedItem?.attachmentXlsxPath ? 'READY' : 'MISSING'} />
              </div>

              <div className="mt-5 rounded-lg border border-accent-200 bg-accent-50/70 p-4 dark:border-accent-500/30 dark:bg-accent-500/10">
                <p className="text-xs font-semibold uppercase text-accent-700 dark:text-accent-300">생성 기준</p>
                <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
                  초기 MVP에서는 실제 파일을 자동 발송하지 않고, 거래처 코드 기준의 PDF/XLSX 경로와 send_list.csv를 먼저 준비합니다.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>
      </div>
    </PageShell>
  );
}
