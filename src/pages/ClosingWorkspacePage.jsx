import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageShell from './PageShell';
import { addActivityLog, getCurrentUser } from '../utils/authSession';
import { addNotification } from '../utils/appNotifications';
import { readClosingWorkspaceRows, saveClosingWorkspaceRows } from '../utils/closingWorkspaceStore';

const owners = ['김민서', '박정우', '이서연', '최현우'];
const closingDays = ['10일', '25일', '30일'];
const reasonOptions = ['회신 대기', '금액 조율', '세금계산서 차이', '내부 검토', '미확정 없음'];

const baseCompanies = [
  {
    id: 'CLOSING-001',
    company: '한빛유통',
    owner: '김민서',
    deadline: '10일',
    contactName: '정산팀 오민지',
    email: 'settle@hanbit.example',
    phone: '010-4210-1842',
    salesAmount: 28450000,
    confirmedAmount: 28450000,
    taxAmount: 28450000,
    contactConfirmed: true,
    amountConfirmed: true,
    taxMatched: true,
    requestReady: true,
    requestSent: true,
    reason: '미확정 없음',
    memo: '5월 마감 확정 완료. 요청서 발송 완료.',
    history: ['06-07 거래처 확인 완료', '06-08 세금계산서 대조 완료', '06-08 요청서 발송'],
  },
  {
    id: 'CLOSING-002',
    company: '모블상사',
    owner: '김민서',
    deadline: '10일',
    contactName: '회계팀 강지훈',
    email: 'admin@moble.example',
    phone: '010-3188-5502',
    salesAmount: 19720000,
    confirmedAmount: 19650000,
    taxAmount: 19720000,
    contactConfirmed: false,
    amountConfirmed: false,
    taxMatched: false,
    requestReady: false,
    requestSent: false,
    reason: '회신 대기',
    memo: '거래처 담당자 금액 확인 회신 대기.',
    history: ['06-06 1차 확인 메일 발송', '06-08 전화 연결 실패'],
  },
  {
    id: 'CLOSING-003',
    company: '그린물류',
    owner: '박정우',
    deadline: '25일',
    contactName: '정산담당 서가은',
    email: 'tax@greenlog.example',
    phone: '010-9402-6620',
    salesAmount: 43180000,
    confirmedAmount: 43180000,
    taxAmount: 43010000,
    contactConfirmed: true,
    amountConfirmed: true,
    taxMatched: false,
    requestReady: false,
    requestSent: false,
    reason: '세금계산서 차이',
    memo: '세금계산서 공급가액 170,000원 차이 확인 필요.',
    history: ['06-05 금액 확정', '06-09 세금계산서 차이 발견'],
  },
  {
    id: 'CLOSING-004',
    company: '청담리테일',
    owner: '이서연',
    deadline: '25일',
    contactName: '관리팀 유나영',
    email: 'closing@cheongdam.example',
    phone: '010-6104-0931',
    salesAmount: 12690000,
    confirmedAmount: 12400000,
    taxAmount: 12400000,
    contactConfirmed: true,
    amountConfirmed: false,
    taxMatched: true,
    requestReady: false,
    requestSent: false,
    reason: '금액 조율',
    memo: '반품 2건 반영 여부 조율 중.',
    history: ['06-04 거래처 확인 완료', '06-08 반품 건 내부 검토 요청'],
  },
  {
    id: 'CLOSING-005',
    company: '서울컴퍼니',
    owner: '최현우',
    deadline: '30일',
    contactName: '재무팀 문하린',
    email: 'finance@seoulcp.example',
    phone: '010-8890-7311',
    salesAmount: 35860000,
    confirmedAmount: 35860000,
    taxAmount: 35860000,
    contactConfirmed: true,
    amountConfirmed: true,
    taxMatched: true,
    requestReady: true,
    requestSent: false,
    reason: '미확정 없음',
    memo: '발송 패키지 준비 완료. 발송 승인만 남음.',
    history: ['06-08 금액 확정', '06-09 패키지 생성'],
  },
  {
    id: 'CLOSING-006',
    company: '다원문구',
    owner: '박정우',
    deadline: '10일',
    contactName: '구매팀 이준',
    email: 'purchase@dawon.example',
    phone: '010-2048-2701',
    salesAmount: 9870000,
    confirmedAmount: 9870000,
    taxAmount: 10010000,
    contactConfirmed: false,
    amountConfirmed: true,
    taxMatched: false,
    requestReady: false,
    requestSent: false,
    reason: '세금계산서 차이',
    memo: '담당자 확인 전이며 세금계산서 금액이 더 큼.',
    history: ['06-07 세금계산서 업로드', '06-09 연락 필요 표시'],
  },
  {
    id: 'CLOSING-007',
    company: '바른테크',
    owner: '이서연',
    deadline: '30일',
    contactName: '정산담당 최도윤',
    email: 'settlement@baruntech.example',
    phone: '010-5211-4299',
    salesAmount: 22140000,
    confirmedAmount: 22140000,
    taxAmount: 22140000,
    contactConfirmed: true,
    amountConfirmed: true,
    taxMatched: true,
    requestReady: true,
    requestSent: true,
    reason: '미확정 없음',
    memo: '마감 완료.',
    history: ['06-06 최종 확정', '06-06 발송 완료'],
  },
  {
    id: 'CLOSING-008',
    company: '코리아비즈',
    owner: '최현우',
    deadline: '25일',
    contactName: '회계팀 장우진',
    email: 'account@koreabiz.example',
    phone: '010-3900-1187',
    salesAmount: 48750000,
    confirmedAmount: 48200000,
    taxAmount: 48200000,
    contactConfirmed: true,
    amountConfirmed: false,
    taxMatched: true,
    requestReady: false,
    requestSent: false,
    reason: '내부 검토',
    memo: '대량 거래 할인 반영 여부 내부 승인 필요.',
    history: ['06-08 거래처 확인 완료', '06-09 내부 승인 요청'],
  },
];

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
  return Math.round(([row.contactConfirmed, row.amountConfirmed, row.taxMatched].filter(Boolean).length / 3) * 100);
}

function getRowStatus(row) {
  if (getProgress(row) === 100) return '완료';
  if (!row.contactConfirmed) return '연락 필요';
  if (!row.amountConfirmed) return '금액 미확정';
  if (!row.taxMatched) return '세금계산서 차이';
  return '미확정';
}

function getRiskScore(row) {
  const deadlineWeight = row.deadline === '10일' ? 35 : row.deadline === '25일' ? 20 : 10;
  return deadlineWeight
    + (!row.contactConfirmed ? 30 : 0)
    + (!row.amountConfirmed ? 20 : 0)
    + (!row.taxMatched ? 25 : 0);
}

function withDerivedFields(row) {
  const progress = getProgress(row);
  const taxGap = row.taxAmount - row.confirmedAmount;

  return {
    ...row,
    progress,
    status: getRowStatus(row),
    riskScore: getRiskScore(row),
    taxGap,
  };
}

async function readClosingRowsFromDatabase() {
  if (!window.api?.getClosingCompanies) return [];
  const result = await window.api.getClosingCompanies();
  return result?.ok && Array.isArray(result.rows) ? result.rows.map(withDerivedFields) : [];
}

function persistClosingRows(rows) {
  saveClosingWorkspaceRows(rows);
  if (window.api?.saveClosingCompanies) {
    window.api.saveClosingCompanies(rows).catch(() => {
      // Browser-only development still has the local fallback.
    });
  }
}

function StatusPill({ children, tone = 'gray' }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    red: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    blue: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
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
    ['연락완료', 'contactConfirmed'],
    ['마감확정', 'amountConfirmed'],
    ['계산서대조', 'taxMatched'],
    ['발송준비', 'requestReady'],
    ['마감완료', 'requestSent'],
  ];

  return (
    <section className="mb-3 rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">마감 단계 현황</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">단계별 남은 업체 수와 금액을 먼저 확인합니다.</p>
        </div>
        <StatusPill tone="blue">전체 {total}개</StatusPill>
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        {stageKeys.map(([label, key]) => {
          const done = rows.filter((row) => key === 'requestSent' ? row.requestSent || (row.progress === 100 && row.requestReady) : row[key]).length;
          const remainingRows = rows.filter((row) => !(key === 'requestSent' ? row.requestSent || (row.progress === 100 && row.requestReady) : row[key]));
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

export default function ClosingWorkspacePage() {
  const currentUser = getCurrentUser();
  const [rows, setRows] = useState(() => {
    const savedRows = readClosingWorkspaceRows();
    return (savedRows.length > 0 ? savedRows : baseCompanies).map(withDerivedFields);
  });
  const [selectedId, setSelectedId] = useState(baseCompanies[0].id);
  const [tab, setTab] = useState('all');
  const [filters, setFilters] = useState({
    month: '2026-05',
    owner: '전체',
    deadline: '전체',
    status: '전체',
    query: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);

  useEffect(() => {
    let isMounted = true;

    readClosingRowsFromDatabase()
      .then((databaseRows) => {
        if (!isMounted || databaseRows.length === 0) return;
        setRows(databaseRows);
        setSelectedId((current) => (
          databaseRows.some((row) => row.id === current) ? current : databaseRows[0].id
        ));
        saveClosingWorkspaceRows(databaseRows);
      })
      .catch(() => {
        saveClosingWorkspaceRows(rows);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesOwner = filters.owner === '전체' || row.owner === filters.owner;
      const matchesDeadline = filters.deadline === '전체' || row.deadline === filters.deadline;
      const matchesStatus = filters.status === '전체' || row.status === filters.status || row.reason === filters.status;
      const matchesQuery = query === '' || [row.company, row.contactName, row.owner, row.reason].join(' ').toLowerCase().includes(query);
      const matchesTab =
        tab === 'all'
        || (tab === 'risk' && row.riskScore >= 55 && row.progress < 100)
        || (tab === 'contact' && !row.contactConfirmed)
        || (tab === 'tax' && !row.taxMatched)
        || (tab === 'done' && row.progress === 100);

      return matchesOwner && matchesDeadline && matchesStatus && matchesQuery && matchesTab;
    }).sort((a, b) => {
      if (tab === 'done') return b.progress - a.progress || a.company.localeCompare(b.company, 'ko-KR');
      return b.riskScore - a.riskScore || a.deadline.localeCompare(b.deadline, 'ko-KR');
    });
  }, [filters, rows, tab]);

  const selectedRow = rows.find((row) => row.id === selectedId) ?? filteredRows[0] ?? rows[0];
  const summary = useMemo(() => {
    const total = rows.length;
    const done = rows.filter((row) => row.progress === 100).length;
    const unconfirmed = rows.filter((row) => row.progress < 100).length;
    const taxGap = rows.filter((row) => !row.taxMatched).length;
    const contactNeeded = rows.filter((row) => !row.contactConfirmed).length;

    return {
      total,
      done,
      unconfirmed,
      taxGap,
      contactNeeded,
      progress: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  }, [rows]);

  const riskTop = rows.filter((row) => row.progress < 100).sort((a, b) => b.riskScore - a.riskScore).slice(0, 4);
  const contactNeededRows = rows.filter((row) => !row.contactConfirmed).slice(0, 4);
  const ownerSummary = owners.map((owner) => {
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
    ['세금계산서 차이', `${summary.taxGap}개`],
    ['연락 필요', `${summary.contactNeeded}개`],
    ['위험 업체', `${riskTop.length}개`],
  ];

  const handleSearch = () => {
    setIsLoading(true);
    addNotification({
      title: '마감 워크스페이스 조회 시작',
      message: `${filters.month} / ${filters.owner} / ${filters.deadline} 조건으로 데이터를 요청합니다.`,
      level: 'INFO',
      target: 'closing-workspace',
      href: '/closing-workspace/overview',
    });

    window.setTimeout(() => {
      setRows((current) => {
        const nextRows = current.map(withDerivedFields);
        persistClosingRows(nextRows);
        return nextRows;
      });
      setIsLoading(false);
      addActivityLog('INFO', '마감 워크스페이스 조회', `${filters.month} ${filters.owner} ${filters.deadline}`, currentUser.id);
      addNotification({
        title: '마감 워크스페이스 조회 완료',
        message: `${filteredRows.length.toLocaleString('ko-KR')}개 업체를 불러왔습니다.`,
        level: 'SUCCESS',
        target: 'closing-workspace',
        href: '/closing-workspace/overview',
      });
    }, 500);
  };

  const updateSelected = (patch, actionLabel) => {
    setRows((current) => {
      const nextRows = current.map((row) => (
        row.id === selectedRow.id ? withDerivedFields({ ...row, ...patch }) : row
      ));
      persistClosingRows(nextRows);
      return nextRows;
    });

    if (actionLabel) {
      addActivityLog('INFO', actionLabel, selectedRow.company, currentUser.id);
      addNotification({
        title: actionLabel,
        message: `${selectedRow.company} 처리 상태가 업데이트되었습니다.`,
        level: 'INFO',
        target: selectedRow.company,
        href: '/closing-workspace/overview',
      });
    }
  };

  const completeNextStep = () => {
    if (!selectedRow.contactConfirmed) {
      updateSelected({ contactConfirmed: true, history: [`${new Date().toLocaleDateString('ko-KR')} 거래처 담당자 확인 완료`, ...selectedRow.history] }, '거래처 확인 완료');
      return;
    }

    if (!selectedRow.amountConfirmed) {
      updateSelected({ amountConfirmed: true, confirmedAmount: selectedRow.salesAmount, history: [`${new Date().toLocaleDateString('ko-KR')} 마감 금액 확정`, ...selectedRow.history] }, '마감 금액 확정');
      return;
    }

    if (!selectedRow.taxMatched) {
      updateSelected({ taxMatched: true, taxAmount: selectedRow.confirmedAmount, history: [`${new Date().toLocaleDateString('ko-KR')} 세금계산서 대조 완료`, ...selectedRow.history] }, '세금계산서 대조 완료');
      return;
    }

    updateSelected({ requestReady: true, reason: '미확정 없음', history: [`${new Date().toLocaleDateString('ko-KR')} 요청 발송 준비 완료`, ...selectedRow.history] }, '요청 발송 준비 완료');
  };

  return (
    <PageShell title="마감 워크스페이스" description="업체별 마감 현황, 거래처 확인, 금액 확정, 세금계산서 대조, 요청 발송 준비를 한 화면에서 처리합니다.">
      <section className="mb-3 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="grid gap-3 xl:grid-cols-[132px_120px_104px_150px_minmax(260px,1fr)_auto] xl:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">마감월</span>
            <input className="form-input w-full" type="month" value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">담당자</span>
            <select className="form-select w-full" value={filters.owner} onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))}>
              <option>전체</option>
              {owners.map((owner) => <option key={owner}>{owner}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">마감일</span>
            <select className="form-select w-full" value={filters.deadline} onChange={(event) => setFilters((current) => ({ ...current, deadline: event.target.value }))}>
              <option>전체</option>
              {closingDays.map((day) => <option key={day}>{day}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">상태/사유</span>
            <select className="form-select w-full" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option>전체</option>
              <option>완료</option>
              <option>연락 필요</option>
              <option>금액 미확정</option>
              <option>세금계산서 차이</option>
              {reasonOptions.map((reason) => <option key={reason}>{reason}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">검색/사유</span>
            <input
              className="form-input w-full"
              placeholder="업체, 담당자, 미확정 사유 검색"
              type="search"
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            />
          </label>
          <div className="flex items-end">
            <button className="btn btn-primary w-full whitespace-nowrap" type="button" onClick={handleSearch} disabled={isLoading}>
              {isLoading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">필터 변경 후 조회 버튼을 눌러 대량 데이터를 요청하는 흐름입니다.</p>
          <Link className="btn btn-secondary w-full sm:w-auto" to="/closing-workspace/send-queue">
            발송 큐 열기
          </Link>
        </div>
      </section>

      <div className="mb-3">
        <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">마감 요약</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">필요할 때만 펼쳐 보고, 접으면 핵심 수치만 남깁니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quickSummaryItems.map(([label, value]) => (
              <span key={label} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 shadow-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <span className="text-gray-400 dark:text-gray-500">{label}</span>
                <span className="text-gray-900 dark:text-gray-100">{value}</span>
              </span>
            ))}
            <button
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/70"
              type="button"
              aria-expanded={isSummaryOpen}
              onClick={() => setIsSummaryOpen((current) => !current)}
            >
              {isSummaryOpen ? '요약 접기' : '요약 펼치기'}
            </button>
          </div>
        </div>

        {isSummaryOpen && (
          <>
            <StageOverview rows={rows} />

            <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['전체 진척도', `${summary.progress}%`, `${summary.done}/${summary.total} 업체 완료`, 'green'],
                ['미확정', `${summary.unconfirmed}개`, '금액 또는 대조 단계 남음', 'amber'],
                ['세금계산서 차이', `${summary.taxGap}개`, '공급가액 재확인 필요', 'red'],
                ['연락 필요', `${summary.contactNeeded}개`, '거래처 담당자 확인 전', 'blue'],
              ].map(([label, value, detail, tone]) => (
                <section key={label} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
                      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
                    </div>
                    <StatusPill tone={tone}>{label}</StatusPill>
                  </div>
                  {label === '전체 진척도' && <div className="mt-2"><ProgressBar value={summary.progress} /></div>}
                </section>
              ))}
            </div>

            <div className="mb-3 grid gap-2 xl:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.75fr)_minmax(260px,0.85fr)]">
              <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">위험 업체 TOP</h2>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {riskTop.map((row) => (
                    <button key={row.id} className="rounded-md border border-rose-100 bg-rose-50/60 px-2.5 py-2 text-left hover:border-rose-300 dark:border-rose-500/20 dark:bg-rose-500/10" type="button" onClick={() => setSelectedId(row.id)}>
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{row.company}</p>
                      <p className="mt-0.5 truncate text-[11px] text-rose-700 dark:text-rose-300">마감 {row.deadline} · {row.reason} · 위험 {row.riskScore}</p>
                    </button>
                  ))}
                </div>
              </section>
              <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">연락 필요 업체</h2>
                <div className="mt-2 space-y-1.5">
                  {contactNeededRows.map((row) => (
                    <button key={row.id} className="flex w-full items-center justify-between rounded-md border border-gray-100 px-2.5 py-1.5 text-left hover:bg-gray-50 dark:border-gray-700/60 dark:hover:bg-gray-700/40" type="button" onClick={() => setSelectedId(row.id)}>
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
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ['all', '전체 업체'],
          ['risk', '위험 업체'],
          ['contact', '연락 필요'],
          ['tax', '세금계산서 차이'],
          ['done', '완료/기록'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === value ? 'bg-teal-600 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
            type="button"
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      
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
                  <th className="px-4 py-3">세금계산서</th>
                  <th className="px-4 py-3 text-right">확정 금액</th>
                  <th className="px-4 py-3">요청</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer transition-colors ${selectedRow.id === row.id ? 'bg-teal-50/70 dark:bg-teal-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
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
                      <p className="mt-1 text-xs text-gray-500">{row.reason}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.owner}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.deadline}</td>
                    <td className="px-4 py-3">
                      <div className="min-w-28">
                        <div className="mb-1 text-xs font-semibold text-gray-500">{row.progress}%</div>
                        <ProgressBar value={row.progress} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={row.progress === 100 ? 'green' : row.status === '연락 필요' ? 'red' : 'amber'}>{row.status}</StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={row.taxMatched ? 'green' : 'red'}>{row.taxMatched ? '일치' : formatCurrency(row.taxGap)}</StatusPill>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(row.confirmedAmount)}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={row.requestSent ? 'green' : row.requestReady ? 'blue' : 'gray'}>
                        {row.requestSent ? '발송 완료' : row.requestReady ? '발송 준비' : '대기'}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">선택 업체 상세</p>
              <h2 className="mt-1 truncate text-xl font-bold text-gray-900 dark:text-gray-100">{selectedRow.company}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedRow.owner} · 마감 {selectedRow.deadline}</p>
            </div>
            <StatusPill tone={selectedRow.riskScore >= 55 && selectedRow.progress < 100 ? 'red' : 'green'}>
              위험 {selectedRow.riskScore}
            </StatusPill>
          </div>

          <div className="mt-4 rounded-lg border border-gray-100 p-3 dark:border-gray-700/60">
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">거래처 담당자</p>
            <p className="mt-2 font-semibold text-gray-900 dark:text-gray-100">{selectedRow.contactName}</p>
            <p className="mt-1 text-sm text-gray-500">{selectedRow.email}</p>
            <p className="text-sm text-gray-500">{selectedRow.phone}</p>
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input className="form-checkbox" type="checkbox" checked={selectedRow.contactConfirmed} onChange={(event) => updateSelected({ contactConfirmed: event.target.checked }, '거래처 확인 상태 변경')} />
              거래처 담당자 확인 완료
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="block rounded-lg border border-gray-100 p-3 dark:border-gray-700/60">
              <span className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">마감 확정 금액</span>
              <input
                className="form-input mt-2 w-full"
                type="number"
                value={selectedRow.confirmedAmount}
                onChange={(event) => updateSelected({ confirmedAmount: Number(event.target.value), amountConfirmed: false })}
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input className="form-checkbox" type="checkbox" checked={selectedRow.amountConfirmed} onChange={(event) => updateSelected({ amountConfirmed: event.target.checked }, '금액 확정 상태 변경')} />
                금액 확정
              </label>
            </label>
            <label className="block rounded-lg border border-gray-100 p-3 dark:border-gray-700/60">
              <span className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">세금계산서 금액</span>
              <input
                className="form-input mt-2 w-full"
                type="number"
                value={selectedRow.taxAmount}
                onChange={(event) => updateSelected({ taxAmount: Number(event.target.value), taxMatched: false })}
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input className="form-checkbox" type="checkbox" checked={selectedRow.taxMatched} onChange={(event) => updateSelected({ taxMatched: event.target.checked }, '세금계산서 대조 상태 변경')} />
                세금계산서 일치
              </label>
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">미확정 사유</span>
            <select className="form-select w-full" value={selectedRow.reason} onChange={(event) => updateSelected({ reason: event.target.value }, '미확정 사유 변경')}>
              {reasonOptions.map((reason) => <option key={reason}>{reason}</option>)}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">메모/처리 기록</span>
            <textarea className="form-textarea w-full" rows="4" value={selectedRow.memo} onChange={(event) => updateSelected({ memo: event.target.value })} />
          </label>

          <div className="mt-3 rounded-lg border border-gray-100 p-3 dark:border-gray-700/60">
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">처리 기록</p>
            <div className="mt-2 space-y-2">
              {selectedRow.history.map((item) => (
                <p key={item} className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-900/30 dark:text-gray-300">{item}</p>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <button className="btn btn-primary" type="button" onClick={completeNextStep}>다음 단계 완료</button>
            <button className="btn btn-secondary" type="button" onClick={() => updateSelected({ reason: selectedRow.reason === '미확정 없음' ? '내부 검토' : selectedRow.reason }, '미확정으로 보류')}>미확정으로 넘기기</button>
            <button className="btn btn-secondary" type="button" onClick={() => updateSelected({ requestReady: true, requestSent: false }, '요청 발송 준비')}>요청 발송 준비</button>
          </div>
        </aside>
      </div>

    </PageShell>
  );
}
