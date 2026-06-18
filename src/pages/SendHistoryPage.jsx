import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';

const fallbackItems = [
  {
    itemId: 1,
    packageName: 'REQ-202605-SAMPLE',
    closingMonth: '2026-05',
    customerName: '한빛유통',
    channel: 'EMAIL',
    recipientEmail: 'settle@hanbit.example',
    status: 'READY',
    createdAt: '-',
    sentCheckedAt: '-',
    subject: '[확인 요청] 2026-05 매출 자료 검수 협조 요청드립니다',
  },
  {
    itemId: 2,
    packageName: 'REQ-202605-SAMPLE',
    closingMonth: '2026-05',
    customerName: '모블상사',
    channel: 'KAKAO',
    recipientEmail: 'admin@moble.example',
    status: 'READY',
    createdAt: '-',
    sentCheckedAt: '-',
    subject: '[확인 요청] 2026-05 매출 자료 검수 협조 요청드립니다',
  },
];

const statusActions = [
  { status: 'SENT', label: '발송 완료' },
  { status: 'REPLIED', label: '회신 확인' },
  { status: 'CLOSED', label: '종료 처리' },
  { status: 'FAILED', label: '실패 표시' },
];

function statusClass(status) {
  const map = {
    READY: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300',
    SENT: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300',
    REPLIED: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    FAILED: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  };

  return map[status] ?? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
}

function channelClass(channel) {
  return channel === 'EMAIL'
    ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300'
    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
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

function flattenPackageItems(packages) {
  return packages.flatMap((sendPackage) => (
    (sendPackage.items ?? []).map((item) => ({
      ...item,
      packageName: sendPackage.packageName,
      closingMonth: sendPackage.closingMonth,
      packageStatus: sendPackage.status,
    }))
  ));
}

function monthToDate(month) {
  return `${month || '1900-01'}-01`;
}

function isInDateRange(value, startDate, endDate) {
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
}

export default function SendHistoryPage() {
  const [items, setItems] = useState(fallbackItems);
  const [selectedId, setSelectedId] = useState(fallbackItems[0].itemId);
  const [params, setParams] = useState({
    startDate: '2026-05-01',
    endDate: '2026-05-31',
  });
  const [loadState, setLoadState] = useState('브라우저 미리보기');
  const [memo, setMemo] = useState('');
  const [updateState, setUpdateState] = useState('');

  const filteredItems = useMemo(() => (
    items.filter((item) => isInDateRange(monthToDate(item.closingMonth), params.startDate, params.endDate))
  ), [items, params.endDate, params.startDate]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.itemId === selectedId) ?? filteredItems[0] ?? items[0],
    [filteredItems, items, selectedId],
  );

  const metrics = useMemo(() => {
    const readyCount = filteredItems.filter((item) => item.status === 'READY').length;
    const sentCount = filteredItems.filter((item) => item.status === 'SENT').length;
    const repliedCount = filteredItems.filter((item) => item.status === 'REPLIED').length;
    const closedCount = filteredItems.filter((item) => item.status === 'CLOSED').length;
    const failedCount = filteredItems.filter((item) => item.status === 'FAILED').length;

    return [
      { label: '전체 대상', value: `${filteredItems.length.toLocaleString('ko-KR')}건`, detail: '패키지 항목 기준' },
      { label: '발송 전', value: `${readyCount.toLocaleString('ko-KR')}건`, detail: '수동 발송 대기' },
      { label: '진행 중', value: `${(sentCount + repliedCount).toLocaleString('ko-KR')}건`, detail: `발송 ${sentCount.toLocaleString('ko-KR')} / 회신 ${repliedCount.toLocaleString('ko-KR')}` },
      { label: '종료/실패', value: `${(closedCount + failedCount).toLocaleString('ko-KR')}건`, detail: `종료 ${closedCount.toLocaleString('ko-KR')} / 실패 ${failedCount.toLocaleString('ko-KR')}` },
    ];
  }, [filteredItems]);

  const setNextItems = (packages) => {
    const nextItems = flattenPackageItems(packages ?? []);
    const normalized = nextItems.length ? nextItems : fallbackItems;
    setItems(normalized);
    setSelectedId((currentId) => normalized.some((item) => item.itemId === currentId) ? currentId : normalized[0].itemId);
  };

  const loadHistory = async () => {
    if (!window.api?.getSendPackages) {
      setItems(fallbackItems);
      setSelectedId(fallbackItems[0].itemId);
      setLoadState('브라우저 미리보기');
      return;
    }

    try {
      const result = await window.api.getSendPackages();
      setNextItems(result.packages ?? []);
      setLoadState(result.packages?.length ? 'SQLite 연결됨' : 'SQLite 연결됨 / 이력 없음');
    } catch (error) {
      setItems(fallbackItems);
      setSelectedId(fallbackItems[0].itemId);
      setLoadState(`SQLite 확인 필요: ${error.message}`);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleUpdateStatus = async (status) => {
    if (!selectedItem) return;

    if (!window.api?.updateSendPackageItemStatus) {
      setItems((currentItems) => currentItems.map((item) => (
        item.itemId === selectedItem.itemId ? { ...item, status, memo } : item
      )));
      setUpdateState('브라우저 미리보기에서 상태만 변경했습니다.');
      return;
    }

    try {
      const result = await window.api.updateSendPackageItemStatus({
        itemId: selectedItem.itemId,
        status,
        memo,
      });
      setNextItems(result.packages ?? []);
      setUpdateState(`${selectedItem.customerName} 상태를 ${status}(으)로 변경했습니다.`);
    } catch (error) {
      setUpdateState(`상태 변경 실패: ${error.message}`);
    }
  };

  return (
    <PageShell title="발송 이력" description="문서 기준 4단계: 발송 완료, 회신, 종료 상태를 거래처별로 수동 체크합니다.">
      <div className="flex h-[calc(100vh-14rem)] flex-col">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Send history</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{loadState}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">직접 발송 이후 상태를 기록해 미회신과 종료 대상을 구분합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={loadHistory}>
              새로고침
            </button>
            <button className="btn btn-primary" type="button" onClick={() => handleUpdateStatus('SENT')}>
              발송 완료 체크
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
          <p className="text-sm text-gray-500 dark:text-gray-400">마감월 기준으로 날짜 범위에 포함된 발송 이력만 표시합니다.</p>
        </div>
      </section>

      {updateState && (
        <section className="mb-4 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-300">
          {updateState}
        </section>
      )}

      <div className="mb-4 grid shrink-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-5">
        <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">거래처별 이력</h2>
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{filteredItems.length.toLocaleString('ko-KR')}건</span>
          </header>
          <div className="min-h-0 flex-1 overflow-auto no-scrollbar">
            <table className="min-w-[900px] w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {['마감월', '패키지', '거래처', '채널', '수신자', '상태'].map((column) => (
                    <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const selected = item.itemId === selectedItem?.itemId;

                  return (
                    <tr
                      key={`${item.packageName}-${item.itemId}`}
                      className={`group cursor-pointer ${selected ? 'bg-accent-50/70 dark:bg-accent-500/10' : ''}`}
                      onClick={() => {
                        setSelectedId(item.itemId);
                        setMemo(item.memo ?? '');
                      }}
                    >
                      <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                        {item.closingMonth}
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                        {item.packageName}
                      </td>
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
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">선택 이력</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedItem?.customerName}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedItem?.packageName}</p>

          <div className="mt-5 space-y-3">
            <div className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">제목</p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">{selectedItem?.subject}</p>
            </div>
            <div className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">현재 상태</p>
              <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(selectedItem?.status)}`}>
                {selectedItem?.status}
              </span>
            </div>
            <label className="block rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
              <span className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">처리 메모</span>
              <textarea
                className="form-textarea mt-2 h-24 w-full resize-none text-sm"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="회신 내용, 재요청 사유, 종료 메모"
              />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {statusActions.map((action) => (
              <button
                key={action.status}
                className={`h-9 rounded-md px-2 text-xs font-semibold transition ${action.status === 'FAILED' ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300' : 'border border-gray-200 text-gray-700 hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700 dark:border-gray-700/60 dark:text-gray-200 dark:hover:border-accent-500/40 dark:hover:bg-accent-500/10 dark:hover:text-accent-300'}`}
                type="button"
                onClick={() => handleUpdateStatus(action.status)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </aside>
      </div>
      </div>
    </PageShell>
  );
}
