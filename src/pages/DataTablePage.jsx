import React, { useMemo, useRef, useState } from 'react';

import PageShell from './PageShell';
import { exportRowsToXlsx } from '../utils/spreadsheetExport';

const columns = ['거래일', '거래처', '품목 코드', '품목명', '수량', '단가', '금액', '검증', '담당자'];
const statusOptions = ['전체', '정상', '확인 필요', '중복 의심', '수정 필요', '승인 완료', '보류'];
const pageSize = 10;

const customers = ['한빛유통', '세종오피스', '모블상사', '대원시스템', '청담리테일', '바른테크', '동서문구', '그린물류'];
const products = [
  ['PAPER-A4-001', 'A4 복사용지', 24500],
  ['TONER-BLK-2108', '흑백 토너 2108', 78000],
  ['USB-HUB-04', '4포트 USB 허브', 18900],
  ['CABLE-MEET-01', '회의실 HDMI 케이블', 9200],
  ['LABEL-STK-02', '라벨 스티커', 13200],
  ['MOUSE-WL-01', '무선 마우스', 22000],
  ['FILE-BOX-03', '문서 보관 박스', 3400],
  ['KEYBOARD-01', '업무용 키보드', 31000],
];
const owners = ['김민서', '박지훈', '이서연', '최현우', '정다은', '오수진'];

function formatNumber(value) {
  return Number(value).toLocaleString('ko-KR');
}

function parseNumber(value) {
  return Number(String(value ?? '').replaceAll(',', ''));
}

function formatDate(index) {
  const date = new Date(2026, 4, 18);
  date.setDate(date.getDate() - (index % 45));
  return date.toISOString().slice(0, 10);
}

function getInitialStatus(index, productCode) {
  if (index % 37 === 0) return '확인 필요';
  if (index % 29 === 0 || (productCode === 'USB-HUB-04' && index % 11 === 0)) return '중복 의심';
  return '정상';
}

function createRows(count = 1200) {
  return Array.from({ length: count }, (_, index) => {
    const product = products[index % products.length];
    const quantity = ((index * 7) % 130) + 1;
    const unitPrice = product[2];
    const amount = quantity * unitPrice;

    return [
      formatDate(index),
      customers[index % customers.length],
      product[0],
      product[1],
      formatNumber(quantity),
      formatNumber(unitPrice),
      formatNumber(amount),
      getInitialStatus(index, product[0]),
      owners[index % owners.length],
    ];
  });
}

function statusClass(status) {
  if (['정상', '승인 완료'].includes(status)) {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
  }

  if (['확인 필요', '중복 의심', '보류'].includes(status)) {
    return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
  }

  return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
}

function compareCell(a, b) {
  const aNumber = parseNumber(a);
  const bNumber = parseNumber(b);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return String(a).localeCompare(String(b), 'ko-KR', { numeric: true });
}

function validateRows(rows) {
  const seen = new Map();
  const issues = {};
  let duplicateCount = 0;
  let reviewCount = 0;

  const nextRows = rows.map((row, index) => {
    const rowIssues = [];
    const quantity = parseNumber(row[4]);
    const unitPrice = parseNumber(row[5]);
    const amount = parseNumber(row[6]);
    const duplicateKey = [row[0], row[1], row[2], row[4], row[6]].join('|');

    if (!row[1]) rowIssues.push('거래처명이 비어 있습니다.');
    if (!row[2]) rowIssues.push('품목 코드가 비어 있습니다.');
    if (Number.isFinite(quantity) && Number.isFinite(unitPrice) && Number.isFinite(amount) && quantity * unitPrice !== amount) {
      rowIssues.push('수량과 단가를 곱한 금액이 일치하지 않습니다.');
    }
    if (Number.isFinite(amount) && amount >= 5000000) {
      rowIssues.push('단일 거래 금액이 5,000,000원 이상입니다.');
    }
    if (Number.isFinite(quantity) && quantity >= 100) {
      rowIssues.push('수량이 100개 이상인 대량 거래입니다.');
    }
    if (seen.has(duplicateKey)) {
      rowIssues.push(`${seen.get(duplicateKey) + 1}행과 거래일/거래처/품목/수량/금액이 같습니다.`);
    } else {
      seen.set(duplicateKey, index);
    }

    let status = '정상';
    if (rowIssues.some((issue) => issue.includes('같습니다'))) {
      status = '중복 의심';
      duplicateCount += 1;
    } else if (rowIssues.length > 0) {
      status = '확인 필요';
      reviewCount += 1;
    }

    if (rowIssues.length > 0) {
      issues[index] = rowIssues;
    }

    return row.map((cell, cellIndex) => (cellIndex === 7 ? status : cell));
  });

  return {
    rows: nextRows,
    issues,
    summary: {
      duplicateCount,
      reviewCount,
      normalCount: nextRows.length - duplicateCount - reviewCount,
    },
  };
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

export default function DataTablePage() {
  const [rows, setRows] = useState(() => createRows(1200));
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [sortConfig, setSortConfig] = useState({ index: -1, direction: 'asc' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [issues, setIssues] = useState({});
  const [actionState, setActionState] = useState('1,200건 샘플 데이터 로드됨');
  const [exportTitle, setExportTitle] = useState('sales-data-review-1200');
  const tableRef = useRef(null);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.map((row, rowIndex) => ({ row, rowIndex })).filter(({ row }) => {
      const matchesQuery = normalizedQuery === ''
        || row.some((cell) => String(cell ?? '').toLowerCase().includes(normalizedQuery));
      const matchesStatus = statusFilter === '전체' || row[7] === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, rows, statusFilter]);

  const sortedRows = useMemo(() => {
    if (sortConfig.index < 0) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const result = compareCell(a.row[sortConfig.index], b.row[sortConfig.index]);
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [filteredRows, sortConfig]);

  const selectedRow = rows[selectedIndex] ?? rows[0] ?? [];
  const selectedIssues = issues[selectedIndex] ?? [];

  const metrics = useMemo(() => {
    const normalCount = rows.filter((row) => row[7] === '정상' || row[7] === '승인 완료').length;
    const duplicateCount = rows.filter((row) => row[7] === '중복 의심').length;
    const reviewCount = rows.filter((row) => ['확인 필요', '수정 필요', '보류'].includes(row[7])).length;
    const totalAmount = rows.reduce((sum, row) => sum + parseNumber(row[6]), 0);

    return [
      { label: '전체 행', value: `${rows.length.toLocaleString('ko-KR')}건`, detail: `${columns.length}개 컬럼 / 화면 10행 고정` },
      { label: '검증 정상', value: `${normalCount.toLocaleString('ko-KR')}건`, detail: '승인 완료 포함' },
      { label: '확인 필요', value: `${(duplicateCount + reviewCount).toLocaleString('ko-KR')}건`, detail: `중복 ${duplicateCount.toLocaleString('ko-KR')} / 검토 ${reviewCount.toLocaleString('ko-KR')}`, tone: duplicateCount + reviewCount > 0 ? 'warning' : 'default' },
      { label: '합계 금액', value: `${totalAmount.toLocaleString('ko-KR')}원`, detail: '현재 데이터 기준' },
    ];
  }, [rows]);

  const handleSort = (columnIndex) => {
    setSortConfig((current) => {
      if (current.index !== columnIndex) return { index: columnIndex, direction: 'asc' };
      if (current.direction === 'asc') return { index: columnIndex, direction: 'desc' };
      return { index: -1, direction: 'asc' };
    });
  };

  const handleValidate = () => {
    const result = validateRows(rows);
    setRows(result.rows);
    setIssues(result.issues);
    setActionState(`검증 완료: 정상 ${result.summary.normalCount.toLocaleString('ko-KR')}건 / 중복 ${result.summary.duplicateCount.toLocaleString('ko-KR')}건 / 확인 ${result.summary.reviewCount.toLocaleString('ko-KR')}건`);
  };

  const handleResolve = (status) => {
    setRows((currentRows) => currentRows.map((row, index) => (
      index === selectedIndex ? row.map((cell, cellIndex) => (cellIndex === 7 ? status : cell)) : row
    )));
    setActionState(`${selectedIndex + 1}행을 ${status}(으)로 처리했습니다.`);
  };

  const handleExport = async () => {
    try {
      const visibleRows = sortedRows.map((item) => item.row);
      const result = await exportRowsToXlsx({
        columns,
        rows: visibleRows,
        title: exportTitle,
        sheetName: 'Data Review',
      });
      setActionState(`${result.fileName} 내보내기 완료`);
    } catch (error) {
      setActionState(error.name === 'AbortError' ? '내보내기를 취소했습니다.' : `내보내기 실패: ${error.message}`);
    }
  };

  return (
    <PageShell title="데이터 테이블" description="대용량 Excel/CSV 데이터를 10행 고정 테이블로 검토하고, 검색/필터/정렬/검증 처리를 수행합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Data review</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{actionState}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">현재 PC 사양에 맞춰 한 번에 보여주는 행은 10개로 고정하고, 내부 스크롤로 이동합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="form-input h-10 w-52"
              value={exportTitle}
              onChange={(event) => setExportTitle(event.target.value)}
              placeholder="내보내기 제목"
            />
            <button className="btn btn-secondary" type="button" onClick={() => setRows(createRows(1200))}>
              샘플 재생성
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleExport}>
              XLSX 내보내기
            </button>
            <button className="btn btn-primary" type="button" onClick={handleValidate}>
              검증 실행
            </button>
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <section className="mb-5 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="grid gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60 xl:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="form-input h-9 w-full sm:w-64"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="전체 데이터 검색"
            />
            <select className="form-select h-9" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <button
              className="h-9 rounded-md px-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/60"
              type="button"
              onClick={() => {
                setQuery('');
                setStatusFilter('전체');
                setSortConfig({ index: -1, direction: 'asc' });
              }}
            >
              초기화
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{sortedRows.length.toLocaleString('ko-KR')} / {rows.length.toLocaleString('ko-KR')}건</span>
            <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold dark:border-gray-700/60 dark:bg-gray-900/30">10행 고정</span>
          </div>
        </div>

        <div ref={tableRef} className="h-[336px] overflow-auto no-scrollbar">
          <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-14 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">#</th>
                {columns.map((column, columnIndex) => {
                  const sorted = sortConfig.index === columnIndex;
                  const mark = sorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '';

                  return (
                    <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">
                      <button className="flex w-full items-center justify-between gap-2 text-left hover:text-accent-700 dark:hover:text-accent-300" type="button" onClick={() => handleSort(columnIndex)}>
                        <span>{column}</span>
                        <span className="text-[10px] text-accent-600">{mark}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(({ row, rowIndex }) => {
                const selected = rowIndex === selectedIndex;

                return (
                  <tr
                    key={`${rowIndex}-${row[0]}-${row[2]}`}
                    className={`group cursor-pointer ${selected ? 'bg-accent-50/70 dark:bg-accent-500/10' : ''}`}
                    onClick={() => setSelectedIndex(rowIndex)}
                  >
                    <td className="border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs text-gray-400 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:bg-gray-900/30 dark:group-hover:bg-accent-500/10">
                      {rowIndex + 1}
                    </td>
                    {row.map((cell, cellIndex) => (
                      <td key={`${rowIndex}-${cellIndex}`} className="h-8 max-w-64 truncate border-b border-r border-gray-200 px-3 py-1.5 text-gray-700 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-200 dark:group-hover:bg-accent-500/10" title={cell}>
                        {cellIndex === 7 ? (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(cell)}`}>
                            {cell}
                          </span>
                        ) : cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-12 gap-5">
        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">선택 행</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedRow[1]}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedRow[0]} / {selectedRow[2]}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(selectedRow[7])}`}>
              {selectedRow[7]}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ['품목명', selectedRow[3]],
              ['수량', selectedRow[4]],
              ['단가', `${selectedRow[5]}원`],
              ['금액', `${selectedRow[6]}원`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
                <p className="mt-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button className="h-9 rounded-md bg-accent-600 px-2 text-xs font-semibold text-white hover:bg-accent-700" type="button" onClick={() => handleResolve('승인 완료')}>
              승인
            </button>
            <button className="h-9 rounded-md border border-yellow-200 bg-yellow-50 px-2 text-xs font-semibold text-yellow-700 hover:bg-yellow-100 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300" type="button" onClick={() => handleResolve('보류')}>
              보류
            </button>
            <button className="h-9 rounded-md border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" type="button" onClick={() => handleResolve('수정 필요')}>
              수정 필요
            </button>
          </div>
        </aside>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-7">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">검증 이슈</h2>
          <div className="mt-4 space-y-2">
            {selectedIssues.length ? selectedIssues.map((issue) => (
              <div key={issue} className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200">
                {issue}
              </div>
            )) : (
              <div className="rounded-md border border-gray-100 px-3 py-2 text-sm text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                선택한 행에 기록된 검증 이슈가 없습니다.
              </div>
            )}
          </div>
        </aside>
      </section>
    </PageShell>
  );
}
