import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StatusBadge } from '../components/common';
import PageShell from './PageShell';
import { addActivityLog, getCurrentUser } from '../utils/authSession';
import { addNotification } from '../utils/appNotifications';
import { saveClosingWorkspaceRows } from '../utils/closingWorkspaceStore';

const closingDays = ['10일', '25일', '30일'];
const reasonOptions = ['회신 대기', '금액 조율', '내부 검토', '기타'];

function formatCurrency(value) {
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function formatShortCurrency(value) {
  const amount = Math.abs(Number(value));

  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString('ko-KR')}만원`;
  return `${amount.toLocaleString('ko-KR')}원`;
}

function getProgress(row) {
  if (row.amountConfirmed) return 100;
  if (row.contactCount >= 1) return 50;
  return 0;
}

function getRowStatus(row) {
  if (row.contactCount >= 1 && row.amountConfirmed) return '완료';
  if (row.contactCount >= 3) return '처리 지연';
  if (row.contactCount >= 1) return '마감 진행 중';
  return '연락 필요';
}

function getRiskScore(row) {
  const deadlineWeight = row.deadline === '10일' ? 35 : row.deadline === '25일' ? 20 : 10;
  return deadlineWeight
    + (row.contactCount === 0 ? 20 : 0)
    + (!row.amountConfirmed ? 20 : 0)
    + (row.contactCount >= 3 && !row.amountConfirmed ? 30 : 0);
}

function withDerivedFields(row) {
  const successfulSendCount = Number(row.contactCount) || 0;
  const normalizedRow = {
    ...row,
    contactCount: successfulSendCount,
    requestSent: successfulSendCount >= 1,
    amountConfirmed: Boolean(successfulSendCount >= 1 && row.amountConfirmed),
  };
  const progress = getProgress(normalizedRow);
  const status = getRowStatus(normalizedRow);
  const legacyReason = row.reason === '미확정 없음' ? '' : row.reason;
  const reason = progress === 100
    ? ''
    : legacyReason || (status === '처리 지연' || status === '마감 진행 중' ? '회신 대기' : '내부 검토');

  return {
    ...normalizedRow,
    reason,
    progress,
    status,
    riskScore: getRiskScore(normalizedRow),
  };
}

function getClosingDate(row, month) {
  const day = String(parseInt(row.deadline, 10) || 1).padStart(2, '0');
  return `${month}-${day}`;
}

function isWithinDateRange(value, startDate, endDate) {
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
}

function getCurrentMonthRange() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const format = (date) => {
    const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${dateMonth}-${day}`;
  };

  return {
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    startDate: format(new Date(year, month, 1)),
    endDate: format(new Date(year, month + 1, 0)),
  };
}

async function readClosingRowsFromDatabase(options) {
  if (!window.api?.getClosingCompanies) return [];
  const result = await window.api.getClosingCompanies(options);
  return result?.ok && Array.isArray(result.rows) ? result.rows.map(withDerivedFields) : [];
}

function persistClosingRows(rows, options) {
  saveClosingWorkspaceRows(rows);
  if (window.api?.saveClosingCompanies) {
    window.api.saveClosingCompanies({ rows, options }).catch(() => {
      // Browser-only development still has the local fallback.
    });
  }
}

function ProgressBar({ value }) {
  const tone = value >= 100 ? 'bg-emerald-600' : value >= 67 ? 'bg-sky-600' : value >= 34 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
      <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}

function StageOverview({ rows }) {
  const total = rows.length;
  const stageKeys = [
    ['메일 발송', 'sent'],
    ['처리 지연', 'delayed'],
    ['금액 확정', 'amountConfirmed'],
  ];

  return (
    <section className="mb-3 rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">마감 단계 현황</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">단계별 남은 업체 수와 금액을 먼저 확인합니다.</p>
        </div>
        <StatusBadge tone="blue">전체 {total}개</StatusBadge>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {stageKeys.map(([label, key]) => {
          const isDone = (row) => {
            if (key === 'sent') return row.contactCount >= 1;
            if (key === 'delayed') return row.contactCount >= 3 && !row.amountConfirmed;
            return Boolean(row[key]);
          };
          const done = rows.filter(isDone).length;
          const remainingRows = rows.filter((row) => !isDone(row));
          const remainingAmount = remainingRows.reduce((sum, row) => sum + row.confirmedAmount, 0);
          const progress = total === 0 ? 0 : Math.round((done / total) * 100);

          return (
            <div key={label} className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-2 dark:border-gray-700/60 dark:bg-gray-900/30">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold text-gray-800 dark:text-gray-100">{label}</p>
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">{progress}%</span>
              </div>
              <div className="mt-1.5"><ProgressBar value={progress} /></div>
              <p className="mt-1.5 text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                남음 {remainingRows.length}개 · {formatShortCurrency(remainingAmount)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SummaryModal({ noSendRows, onClose, onSelectRow, ownerSummary, riskTop, rows, summary }) {
  return (
    <Modal
      open
      title="마감 요약"
      description="전체 진척도와 확인이 필요한 업체를 한 번에 봅니다."
      size="4xl"
      onClose={onClose}
    >
          <StageOverview rows={rows} />

          <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['전체 진척도', `${summary.progress}%`, `${summary.done}/${summary.total} 업체 완료`, 'green'],
              ['미확정', `${summary.unconfirmed}개`, '금액 또는 대조 단계 남음', 'amber'],
              ['연락 필요', `${summary.noSend}개`, '성공 메일 발송 0회', 'blue'],
            ].map(([label, value, detail, tone]) => (
              <section key={label} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
                    <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
                  </div>
                  <StatusBadge tone={tone}>{label}</StatusBadge>
                </div>
                {label === '전체 진척도' && <div className="mt-2"><ProgressBar value={summary.progress} /></div>}
              </section>
            ))}
          </div>

          <div className="grid gap-2 xl:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.75fr)_minmax(260px,0.85fr)]">
            <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">위험 업체 TOP</h2>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {riskTop.map((row) => (
                  <button
                    key={row.id}
                    className="rounded-md border border-rose-100 bg-rose-50/60 px-2.5 py-2 text-left hover:border-rose-300 dark:border-rose-500/20 dark:bg-rose-500/10"
                    type="button"
                    onClick={() => onSelectRow(row.id)}
                  >
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{row.company}</p>
                    <p className="mt-0.5 truncate text-[11px] text-rose-700 dark:text-rose-300">마감 {row.deadline} · {row.reason} · 위험 {row.riskScore}</p>
                  </button>
                ))}
              </div>
            </section>
            <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">메일 미발송 업체</h2>
              <div className="mt-2 space-y-1.5">
                {noSendRows.map((row) => (
                  <button
                    key={row.id}
                    className="flex w-full items-center justify-between rounded-md border border-gray-100 px-2.5 py-1.5 text-left hover:bg-gray-50 dark:border-gray-700/60 dark:hover:bg-gray-700/40"
                    type="button"
                    onClick={() => onSelectRow(row.id)}
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-gray-800 dark:text-gray-100">{row.company}</span>
                    <span className="text-xs text-gray-500">{row.deadline}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">담당자별 업체 현황</h2>
              <div className="mt-2 space-y-2">
                {ownerSummary.map((item) => (
                  <div key={item.owner}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-gray-800 dark:text-gray-100">{item.owner}</span>
                      <span className="text-gray-500">{item.done}/{item.total}</span>
                    </div>
                    <ProgressBar value={item.progress} />
                  </div>
                ))}
              </div>
            </section>
          </div>
    </Modal>
  );
}

export default function ClosingWorkspacePage() {
  const currentUser = getCurrentUser();
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState('all');
  const [params, setParams] = useState(() => ({
    ...getCurrentMonthRange(),
    owner: currentUser.name || currentUser.id || '전체',
    deadline: '전체',
    query: '',
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [activeOwners, setActiveOwners] = useState(() => (
    [currentUser.name || currentUser.id].filter(Boolean)
  ));

  useEffect(() => {
    let active = true;
    if (!window.api?.listUsers) return undefined;

    window.api.listUsers()
      .then((result) => {
        if (!active) return;
        const owners = (result?.users ?? [])
          .filter((user) => (
            user.status === 'ACTIVE'
            && (currentUser.role === 'ADMIN' || user.id === currentUser.id)
          ))
          .map((user) => user.name || user.id)
          .filter(Boolean);
        setActiveOwners(Array.from(new Set(owners)));
      })
      .catch(() => {
        // Keep the current logged-in user when SQLite users cannot be loaded.
      });

    return () => {
      active = false;
    };
  }, [currentUser.id, currentUser.role]);

  const ownerOptions = useMemo(
    () => activeOwners,
    [activeOwners],
  );

  const statusScopeRows = useMemo(() => {
    const query = params.query.trim().toLowerCase();

    return rows.filter((row) => {
      const closingDate = getClosingDate(row, params.month);
      const matchesDateRange = isWithinDateRange(closingDate, params.startDate, params.endDate);
      const matchesOwner = params.owner === '전체' || row.owner === params.owner;
      const matchesDeadline = params.deadline === '전체' || row.deadline === params.deadline;
      const matchesQuery = query === '' || [row.company, row.contactName, row.owner, row.reason].join(' ').toLowerCase().includes(query);

      return matchesDateRange && matchesOwner && matchesDeadline && matchesQuery;
    });
  }, [params, rows]);

  const filteredRows = useMemo(() => {
    return statusScopeRows.filter((row) => (
      tab === 'all' || row.status === tab
    )).sort((a, b) => {
      if (tab === '완료') return b.progress - a.progress || a.company.localeCompare(b.company, 'ko-KR');
      return b.riskScore - a.riskScore || getClosingDate(a, params.month).localeCompare(getClosingDate(b, params.month), 'ko-KR');
    });
  }, [params.month, statusScopeRows, tab]);

  const selectedRow = filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0] ?? null;
  const summary = useMemo(() => {
    const total = rows.length;
    const done = rows.filter((row) => row.progress === 100).length;
    const unconfirmed = rows.filter((row) => row.progress < 100).length;
    const noSend = rows.filter((row) => row.contactCount === 0).length;

    return {
      total,
      done,
      unconfirmed,
      noSend,
      progress: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  }, [rows]);

  const riskTop = rows.filter((row) => row.progress < 100).sort((a, b) => b.riskScore - a.riskScore).slice(0, 4);
  const noSendRows = rows.filter((row) => row.contactCount === 0).slice(0, 4);
  const ownerSummary = ownerOptions.map((owner) => {
    const ownerRows = rows.filter((row) => row.owner === owner);
    const done = ownerRows.filter((row) => row.progress === 100).length;
    return {
      owner,
      total: ownerRows.length,
      done,
      progress: ownerRows.length === 0 ? 0 : Math.round((done / ownerRows.length) * 100),
    };
  });
  const quickSummaryItems = [
    ['전체 진척도', `${summary.progress}%`],
    ['미확정', `${summary.unconfirmed}개`],
    ['위험 업체', `${riskTop.length}개`],
  ];
  const statusFilters = [
    { value: 'all', label: '전체', count: statusScopeRows.length, tone: 'teal' },
    { value: '연락 필요', label: '연락 필요', count: statusScopeRows.filter((row) => row.status === '연락 필요').length, tone: 'gray' },
    { value: '마감 진행 중', label: '마감 진행 중', count: statusScopeRows.filter((row) => row.status === '마감 진행 중').length, tone: 'sky' },
    { value: '처리 지연', label: '처리 지연', count: statusScopeRows.filter((row) => row.status === '처리 지연').length, tone: 'rose' },
    { value: '완료', label: '완료', count: statusScopeRows.filter((row) => row.status === '완료').length, tone: 'emerald' },
  ];
  const statusButtonTones = {
    teal: 'border-teal-600 bg-teal-600 text-white',
    rose: 'border-rose-500 bg-rose-500 text-white',
    amber: 'border-amber-500 bg-amber-500 text-white',
    sky: 'border-sky-600 bg-sky-600 text-white',
    emerald: 'border-emerald-600 bg-emerald-600 text-white',
    gray: 'border-gray-500 bg-gray-600 text-white',
  };

  const updateDateFilter = (key, value) => {
    setParams((current) => ({
      ...current,
      [key]: value,
      month: key === 'startDate' && value ? value.slice(0, 7) : current.month,
    }));
  };

  const handleSearch = async () => {
    setIsLoading(true);
    addNotification({
      title: '마감 워크스페이스 조회 시작',
      message: `${params.startDate}~${params.endDate} / ${params.owner} / ${params.deadline} 조건으로 데이터를 요청합니다.`,
      level: 'INFO',
      target: 'closing-workspace',
      href: '/closing-workspace/overview',
    });

    try {
      const databaseRows = await readClosingRowsFromDatabase(params);
      setRows(databaseRows);
      setSelectedId(databaseRows[0]?.id ?? '');
      setIsLoading(false);
      addActivityLog('INFO', '마감 워크스페이스 조회', `${params.startDate}~${params.endDate} ${params.owner} ${params.deadline}`, currentUser.id);
      addNotification({
        title: '마감 워크스페이스 조회 완료',
        message: `${databaseRows.length.toLocaleString('ko-KR')}개 업체를 불러왔습니다.`,
        level: 'SUCCESS',
        target: 'closing-workspace',
        href: '/closing-workspace/overview',
      });
    } catch (error) {
      setRows([]);
      setSelectedId('');
      addNotification({
        title: '마감 워크스페이스 조회 실패',
        message: error?.message || 'SQLite 조회 중 오류가 발생했습니다.',
        level: 'ERROR',
        target: 'closing-workspace',
        href: '/closing-workspace/overview',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateRow = (rowId, patch, actionLabel) => {
    const targetRow = rows.find((row) => row.id === rowId);
    if (!targetRow) return;

    setRows((current) => {
      const nextRows = current.map((row) => (
        row.id === rowId ? withDerivedFields({ ...row, ...patch }) : row
      ));
      persistClosingRows(nextRows, params);
      return nextRows;
    });

    if (actionLabel) {
      addActivityLog('INFO', actionLabel, targetRow.company, currentUser.id);
      addNotification({
        title: actionLabel,
        message: `${targetRow.company} 처리 상태가 업데이트되었습니다.`,
        level: 'INFO',
        target: targetRow.company,
        href: '/closing-workspace/overview',
      });
    }
  };

  const updateSelected = (patch, actionLabel) => {
    if (!selectedRow) return;
    updateRow(selectedRow.id, patch, actionLabel);
  };

  return (
    <PageShell title="마감 워크스페이스" description="업체별 메일 발송, 마감 진행, 처리 지연, 금액 확정 현황을 한 화면에서 관리합니다.">
      <div>
      <section className="mb-3 shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="grid gap-3 xl:grid-cols-[136px_136px_120px_104px_minmax(260px,1fr)_auto] xl:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">시작일</span>
            <input
              className="form-input w-full"
              type="date"
              value={params.startDate}
              onChange={(event) => updateDateFilter('startDate', event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">마지막일</span>
            <input
              className="form-input w-full"
              type="date"
              value={params.endDate}
              onChange={(event) => updateDateFilter('endDate', event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">담당자</span>
            <select className="form-select w-full" value={params.owner} onChange={(event) => setParams((current) => ({ ...current, owner: event.target.value }))}>
              {currentUser.role === 'ADMIN' && <option>전체</option>}
              {ownerOptions.map((owner) => <option key={owner}>{owner}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">마감일</span>
            <select className="form-select w-full" value={params.deadline} onChange={(event) => setParams((current) => ({ ...current, deadline: event.target.value }))}>
              <option>전체</option>
              {closingDays.map((day) => <option key={day}>{day}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">검색</span>
            <input
              className="form-input w-full"
              placeholder="업체, 담당자, 처리 사유 검색"
              type="search"
              value={params.query}
              onChange={(event) => setParams((current) => ({ ...current, query: event.target.value }))}
            />
          </label>
          <div className="flex items-end">
            <button className="btn btn-primary w-full whitespace-nowrap" type="button" onClick={handleSearch} disabled={isLoading}>
              {isLoading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      </section>

      <section className="mb-3 shrink-0 rounded-lg border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">마감 현황</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">지금 처리할 단계별로 업체를 바로 골라봅니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quickSummaryItems.map(([label, value]) => (
              <span key={label} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 shadow-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <span className="text-gray-400 dark:text-gray-500">{label}</span>
                <span className="text-gray-900 dark:text-gray-100">{value}</span>
              </span>
            ))}
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setIsSummaryModalOpen(true)}
            >
              마감 요약 보기
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {statusFilters.map(({ value, label, count, tone }) => (
          <button
            key={value}
            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
              tab === value
                ? statusButtonTones[tone]
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/40'
            }`}
            type="button"
            onClick={() => {
              setTab(value);
              setSelectedId('');
            }}
          >
            <span className="text-sm font-semibold">{label}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              tab === value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
            }`}>
              {count}
            </span>
          </button>
          ))}
        </div>
      </section>
      
      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8" data-table-tools="false">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">업체별 마감 리스트</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">업체</th>
                  <th className="px-4 py-3">담당자</th>
                  <th className="px-4 py-3">마감일</th>
                  <th className="px-4 py-3">진척도</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-center">금액 확정</th>
                  <th className="px-4 py-3 text-right">확정 금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer transition-colors ${selectedRow?.id === row.id ? 'bg-teal-50/70 dark:bg-teal-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedId(row.id);
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {row.company}
                      </span>
                      {row.reason && <p className="mt-1 text-xs text-gray-500">{row.reason}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.owner}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{getClosingDate(row, params.month)}</td>
                    <td className="px-4 py-3">
                      <div className="min-w-28">
                        <div className="mb-1 text-xs font-semibold text-gray-500">{row.progress}%</div>
                        <ProgressBar value={row.progress} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={row.status === '완료' ? 'green' : row.status === '처리 지연' ? 'red' : row.status === '마감 진행 중' ? 'blue' : 'gray'}>{row.status}</StatusBadge>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">성공 발송 {row.contactCount}회</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        aria-label={`${row.company} 금액 확정`}
                        className="form-checkbox"
                        type="checkbox"
                        checked={row.amountConfirmed}
                        disabled={!row.requestSent}
                        title={row.requestSent ? '거래처 회신 금액을 확인하면 체크하세요.' : '메일 발송 완료 후 금액을 확정할 수 있습니다.'}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          updateRow(
                            row.id,
                            {
                              amountConfirmed: checked,
                              reason: checked ? row.reason : '금액 조율',
                            },
                            checked ? '금액 확정' : '금액 확정 해제',
                          );
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(row.confirmedAmount)}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                      {rows.length === 0 ? '조회 버튼을 눌러 마감 데이터를 불러오세요.' : '선택한 상태에 해당하는 업체가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          {!selectedRow ? (
            <div className="flex min-h-72 items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400">
              조회 후 업체를 선택하면 상세 정보가 표시됩니다.
            </div>
          ) : (
          <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">선택 업체 상세</p>
              <h2 className="mt-1 truncate text-xl font-bold text-gray-900 dark:text-gray-100">{selectedRow.company}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedRow.owner} · 마감 {selectedRow.deadline}</p>
            </div>
            <StatusBadge tone={selectedRow.riskScore >= 55 && selectedRow.progress < 100 ? 'red' : 'green'}>
              위험 {selectedRow.riskScore}
            </StatusBadge>
          </div>

          <div className="mt-3 rounded-lg border border-gray-100 p-3 dark:border-gray-700/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">거래처 담당자</p>
                <p className="mt-2 font-semibold text-gray-900 dark:text-gray-100">{selectedRow.contactName}</p>
                <p className="mt-1 text-sm text-gray-500">{selectedRow.email}</p>
                <p className="text-sm text-gray-500">{selectedRow.phone}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-700/60">
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">마감 확정 금액</span>
                <input
                  className="form-input mt-2 w-full"
                  type="number"
                  value={selectedRow.confirmedAmount}
                  onChange={(event) => updateSelected({
                    confirmedAmount: Number(event.target.value),
                    amountConfirmed: false,
                    reason: '금액 조율',
                  })}
                />
              </div>
            </div>
          </div>

          {selectedRow.progress < 100 && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">
                {selectedRow.status === '처리 지연' ? '처리 지연 사유' : '미완료 사유'}
              </span>
              <select className="form-select w-full" value={selectedRow.reason} onChange={(event) => updateSelected({ reason: event.target.value }, '처리 지연 사유 변경')}>
                {reasonOptions.map((reason) => <option key={reason}>{reason}</option>)}
              </select>
            </label>
          )}

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">메모/처리 기록</span>
            <textarea className="form-textarea w-full" rows="4" value={selectedRow.memo} onChange={(event) => updateSelected({ memo: event.target.value })} />
          </label>

       
          </>
          )}
        </aside>
      </div>
      </div>

      {isSummaryModalOpen && (
        <SummaryModal
          noSendRows={noSendRows}
          onClose={() => setIsSummaryModalOpen(false)}
          onSelectRow={(rowId) => {
            setSelectedId(rowId);
            setIsSummaryModalOpen(false);
          }}
          ownerSummary={ownerSummary}
          riskTop={riskTop}
          rows={rows}
          summary={summary}
        />
      )}

    </PageShell>
  );
}
