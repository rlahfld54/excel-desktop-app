import React, { useEffect, useMemo, useRef, useState } from 'react';

const rowHeight = 28;
const cleanStatuses = ['정상', '승인 완료'];
const issueStatuses = ['확인 필요', '중복 의심', '수정 필요', '보류'];

function getStatusClass(value) {
  if (value === '정상' || value === '성공' || value === '완료' || value === '승인 완료') {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
  }

  if (value === '중복 의심' || value === '확인 필요' || value === '검토 필요' || value === '보류') {
    return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
  }

  return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
}

function compareCell(a, b) {
  const aNumber = Number(String(a).replaceAll(',', ''));
  const bNumber = Number(String(b).replaceAll(',', ''));

  if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
    return aNumber - bNumber;
  }

  return String(a).localeCompare(String(b), 'ko-KR', { numeric: true });
}

function ExcelTable({
  columns = [],
  rows = [],
  fileName = 'workspace-data.csv',
  isLoading = false,
  onExport,
  onValidate,
  onPin,
  selectedRowIndex = 0,
  onRowSelect,
  resetKey = 0,
  visibleRowCount = 10,
  fillAvailableHeight = false,
}) {
  const [params, setParams] = useState({ query: '', status: '전체', page: 1 });
  const [sortConfig, setSortConfig] = useState({ index: -1, direction: 'asc' });
  const [activeTab, setActiveTab] = useState('Sheet 1');
  const [isFirstColumnPinned, setIsFirstColumnPinned] = useState(false);
  const tableViewportRef = useRef(null);
  const pageSize = Math.max(Number(visibleRowCount) || 10, 1);
  const tableViewportHeight = pageSize * rowHeight + 24;

  const statusColumnIndex = columns.findIndex((column) => ['검증', '상태', '결과'].includes(column));
  const statusOptions = useMemo(() => {
    if (statusColumnIndex < 0) return [];
    return Array.from(new Set(rows.map((row) => row[statusColumnIndex]).filter(Boolean)));
  }, [rows, statusColumnIndex]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = params.query.trim().toLowerCase();

    return rows.map((row, rowIndex) => ({ row, rowIndex })).filter(({ row }) => {
      const statusValue = statusColumnIndex < 0 ? '' : row[statusColumnIndex];
      const matchesTab = activeTab === 'Sheet 1'
        || activeTab === '정제 결과' && cleanStatuses.includes(statusValue)
        || activeTab === '오류 목록' && issueStatuses.includes(statusValue);
      const matchesQuery = normalizedQuery === ''
        || row.some((cell) => String(cell ?? '').toLowerCase().includes(normalizedQuery));
      const matchesStatus = params.status === '전체'
        || statusColumnIndex < 0
        || statusValue === params.status;

      return matchesTab && matchesQuery && matchesStatus;
    });
  }, [activeTab, params.query, params.status, rows, statusColumnIndex]);

  const sortedRows = useMemo(() => {
    if (sortConfig.index < 0) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const result = compareCell(a.row[sortConfig.index] ?? '', b.row[sortConfig.index] ?? '');
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [filteredRows, sortConfig]);

  const totalPages = Math.max(Math.ceil(sortedRows.length / pageSize), 1);
  const safePage = Math.min(params.page, totalPages);
  const hasActiveTools = activeTab !== 'Sheet 1' || params.query || params.status !== '전체' || sortConfig.index >= 0;

  const goToPage = (page) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setParams((current) => ({ ...current, page: nextPage }));
    tableViewportRef.current?.scrollTo({
      top: (nextPage - 1) * pageSize * rowHeight,
    });
  };

  const handleSort = (columnIndex) => {
    setParams((current) => ({ ...current, page: 1 }));
    tableViewportRef.current?.scrollTo({ top: 0 });
    setSortConfig((current) => {
      if (current.index !== columnIndex) return { index: columnIndex, direction: 'asc' };
      if (current.direction === 'asc') return { index: columnIndex, direction: 'desc' };
      return { index: -1, direction: 'asc' };
    });
  };

  const resetTools = () => {
    setActiveTab('Sheet 1');
    setParams({ query: '', status: '전체', page: 1 });
    setSortConfig({ index: -1, direction: 'asc' });
    tableViewportRef.current?.scrollTo({ top: 0 });
  };

  const handleTableScroll = (event) => {
    const nextPage = Math.floor(event.currentTarget.scrollTop / (pageSize * rowHeight)) + 1;
    setParams((current) => ({ ...current, page: Math.min(Math.max(nextPage, 1), totalPages) }));
  };

  useEffect(() => {
    setParams((current) => ({ ...current, page: 1 }));
    tableViewportRef.current?.scrollTo({ top: 0 });
  }, [activeTab, params.query, params.status, sortConfig.index, sortConfig.direction]);

  useEffect(() => {
    setActiveTab('Sheet 1');
    setParams({ query: '', status: '전체', page: 1 });
    setSortConfig({ index: -1, direction: 'asc' });
    setIsFirstColumnPinned(false);
    tableViewportRef.current?.scrollTo({ top: 0 });
  }, [columns, fileName, resetKey]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setParams((current) => ({ ...current, status: '전체', page: 1 }));
    tableViewportRef.current?.scrollTo({ top: 0 });
  };

  const handleValidateClick = () => {
    setActiveTab('오류 목록');
    setParams((current) => ({ ...current, status: '전체', page: 1 }));
    onValidate?.();
  };

  const handlePinClick = () => {
    const nextPinned = !isFirstColumnPinned;
    setIsFirstColumnPinned(nextPinned);
    onPin?.(nextPinned);
  };

  return (
    <section className={`flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 ${fillAvailableHeight ? 'min-h-0 flex-1' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700/60">
        <div className="flex items-center gap-2">
          {['Sheet 1', '정제 결과', '오류 목록'].map((tab) => (
            <button
              key={tab}
              className={`h-8 rounded-md px-3 text-sm font-medium ${activeTab === tab ? 'bg-accent-600 text-white shadow-xs hover:bg-accent-700 dark:bg-accent-500 dark:hover:bg-accent-400' : 'text-gray-500 hover:bg-accent-50 hover:text-accent-700 dark:text-gray-400 dark:hover:bg-accent-500/10 dark:hover:text-accent-300'}`}
              type="button"
              onClick={() => handleTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="h-8 rounded-md border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-accent-50 hover:text-accent-700 dark:border-gray-700/60 dark:text-gray-300 dark:hover:bg-accent-500/10 dark:hover:text-accent-300" type="button" onClick={handleValidateClick}>
            검증
          </button>
          <button className={`h-8 rounded-md border px-2.5 text-xs font-medium ${isFirstColumnPinned ? 'border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-500/40 dark:bg-accent-500/10 dark:text-accent-300' : 'border-gray-200 text-gray-600 hover:bg-accent-50 hover:text-accent-700 dark:border-gray-700/60 dark:text-gray-300 dark:hover:bg-accent-500/10 dark:hover:text-accent-300'}`} type="button" onClick={handlePinClick}>
            {isFirstColumnPinned ? '고정됨' : '고정'}
          </button>
          <button
            className="h-8 rounded-md border border-accent-200 bg-accent-50 px-2.5 text-xs font-semibold text-accent-700 hover:bg-accent-100 dark:border-accent-500/40 dark:bg-accent-500/10 dark:text-accent-300"
            type="button"
            onClick={onExport}
          >
            내보내기
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-b border-gray-100 px-4 py-2.5 dark:border-gray-700/60 xl:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 placeholder-gray-400 focus:border-accent-400 focus:outline-none dark:border-gray-700/60 dark:bg-gray-900/30 dark:text-gray-200 sm:w-56"
            type="search"
            value={params.query}
            onChange={(event) => {
              setParams((current) => ({ ...current, query: event.target.value, page: 1 }));
            }}
            placeholder="전체 데이터 검색"
          />
          <select
            className="h-9 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-700 focus:border-accent-400 focus:outline-none dark:border-gray-700/60 dark:bg-gray-900/30 dark:text-gray-200"
            value={params.status}
            onChange={(event) => {
              setParams((current) => ({ ...current, status: event.target.value, page: 1 }));
            }}
            disabled={statusOptions.length === 0}
          >
            <option value="전체">상태 전체</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <span className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900/30 dark:text-gray-400">
            {fillAvailableHeight ? '화면 높이 맞춤' : `${pageSize}행 보기`}
          </span>
          {hasActiveTools && (
            <button className="h-9 rounded-md px-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/60" type="button" onClick={resetTools}>
              초기화
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="truncate">활성 파일: {fileName}</span>
          <span>{sortedRows.length.toLocaleString('ko-KR')} / {rows.length.toLocaleString('ko-KR')}행 · {columns.length.toLocaleString('ko-KR')}열</span>
          <div className="flex items-center gap-1">
            <button className="h-8 w-8 rounded-md border border-gray-200 hover:bg-accent-50 hover:text-accent-700 disabled:opacity-40 dark:border-gray-700/60 dark:hover:bg-accent-500/10" type="button" onClick={() => goToPage(1)} disabled={safePage === 1} title="첫 페이지">«</button>
            <button className="h-8 w-8 rounded-md border border-gray-200 hover:bg-accent-50 hover:text-accent-700 disabled:opacity-40 dark:border-gray-700/60 dark:hover:bg-accent-500/10" type="button" onClick={() => goToPage(safePage - 1)} disabled={safePage === 1} title="이전 페이지">‹</button>
            <span className="min-w-20 text-center font-medium text-gray-700 dark:text-gray-200">{safePage} / {totalPages}</span>
            <button className="h-8 w-8 rounded-md border border-gray-200 hover:bg-accent-50 hover:text-accent-700 disabled:opacity-40 dark:border-gray-700/60 dark:hover:bg-accent-500/10" type="button" onClick={() => goToPage(safePage + 1)} disabled={safePage === totalPages} title="다음 페이지">›</button>
            <button className="h-8 w-8 rounded-md border border-gray-200 hover:bg-accent-50 hover:text-accent-700 disabled:opacity-40 dark:border-gray-700/60 dark:hover:bg-accent-500/10" type="button" onClick={() => goToPage(totalPages)} disabled={safePage === totalPages} title="마지막 페이지">»</button>
          </div>
        </div>
      </div>

      <div
        ref={tableViewportRef}
        className={`overflow-auto ${fillAvailableHeight ? 'min-h-[360px] flex-1' : ''}`}
        style={fillAvailableHeight ? undefined : { height: tableViewportHeight }}
        onScroll={handleTableScroll}
      >
        {isLoading ? (
          <div className="flex h-full min-h-80 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            파일을 읽는 중입니다...
          </div>
        ) : columns.length === 0 ? (
          <div className="flex h-full min-h-80 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            표시할 데이터가 없습니다.
          </div>
        ) : (
          <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-sm dark:text-gray-300">
            <thead className="sticky top-0 z-10 text-xs text-gray-500 dark:text-gray-400">
              <tr>
                <th className="w-12 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center font-semibold dark:border-gray-700/60 dark:bg-gray-900/40">#</th>
                {columns.map((column, columnIndex) => {
                  const isSorted = sortConfig.index === columnIndex;
                  const sortMark = isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '';

                  return (
                    <th key={column} className={`border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold dark:border-gray-700/60 dark:bg-gray-900/40 ${isFirstColumnPinned && columnIndex === 0 ? 'sticky left-12 z-20 shadow-[1px_0_0_0_rgba(229,231,235,1)] dark:shadow-[1px_0_0_0_rgba(55,65,81,1)]' : ''}`}>
                      <button
                        className="flex w-full items-center justify-between gap-2 text-left hover:text-accent-700 dark:hover:text-accent-300"
                        type="button"
                        aria-label={`정렬: ${column}`}
                        title={`${column} 정렬`}
                        onClick={() => handleSort(columnIndex)}
                      >
                        <span>{column}</span>
                        <span className="text-[10px] text-accent-600">{sortMark}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(({ row, rowIndex }) => {
                const isSelected = rowIndex === selectedRowIndex;

                return (
                <tr
                  key={`${rowIndex}-${row[0] ?? ''}-${row[1] ?? ''}`}
                  className={`group cursor-pointer ${isSelected ? 'outline outline-2 outline-accent-300 outline-offset-[-2px]' : ''}`}
                  onClick={() => onRowSelect?.(rowIndex)}
                >
                  <td className={`border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs dark:border-gray-700/60 dark:bg-gray-900/30 ${isSelected ? 'font-semibold text-accent-700 dark:text-accent-300' : 'text-gray-400'}`}>
                    {rowIndex + 1}
                  </td>
                  {columns.map((column, cellIndex) => {
                    const cell = row[cellIndex] ?? '';
                    const isStatus = cellIndex === statusColumnIndex && cell;

                    return (
                      <td
                        key={`${column}-${cellIndex}`}
                        className={`h-7 max-w-64 truncate border-b border-r border-gray-200 px-3 py-1 text-gray-700 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-200 dark:group-hover:bg-accent-500/10 ${isSelected ? 'bg-accent-50/70 dark:bg-accent-500/10' : ''} ${isFirstColumnPinned && cellIndex === 0 ? 'sticky left-12 z-10 bg-white shadow-[1px_0_0_0_rgba(229,231,235,1)] group-hover:bg-accent-50 dark:bg-gray-800 dark:shadow-[1px_0_0_0_rgba(55,65,81,1)] dark:group-hover:bg-gray-800' : ''}`}
                        title={cell}
                      >
                        {isStatus ? (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusClass(cell)}`}>
                            {cell}
                          </span>
                        ) : (
                          cell
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default ExcelTable;
