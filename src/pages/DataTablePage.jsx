import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';
import { useWorkspaceDataStore } from '../stores/workspaceDataStore';
import {
  applyValidationStatus,
  validateBeforeInsert,
} from '../utils/preInsertValidation';

function statusClass(status) {
  if (status === '정상' || status === '승인 완료') {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
  }
  if (status === '확인 필요') {
    return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
  }
  if (status === '반려') {
    return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200';
}


function getStatusIndex(columns) {
  return columns.findIndex((column) => ['검증', '상태', '결과'].includes(column));
}

function getDateIndex(columns) {
  return columns.findIndex((column) => ['거래일', '일자', '날짜', '마감일'].includes(column));
}

export default function DataTablePage() {
  const fileName = useWorkspaceDataStore((state) => state.fileName);
  const columns = useWorkspaceDataStore((state) => state.columns);
  const rows = useWorkspaceDataStore((state) => state.rows);
  const stageWorkspace = useWorkspaceDataStore((state) => state.stageWorkspace);
  const loadLatest = useWorkspaceDataStore((state) => state.loadLatest);
  const [params, setParams] = useState({
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    status: '전체',
    query: '',
    pageSize: 50,
  });
  const [page, setPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [serverTotal, setServerTotal] = useState(rows.length);

  useEffect(() => {
    loadLatest().then((latest) => {
      setServerTotal(latest.rows?.length ?? 0);
    });
  }, [loadLatest]);

  const statusIndex = getStatusIndex(columns);
  const dateIndex = getDateIndex(columns);

  const filteredRows = useMemo(() => {
    const normalizedQuery = params.query.trim().toLowerCase();

    return rows.map((row, rowIndex) => ({ row, rowIndex })).filter(({ row }) => {
      const rowDate = dateIndex >= 0 ? String(row[dateIndex] ?? '').slice(0, 10) : '';
      const matchesDate = dateIndex < 0
        || ((!params.startDate || rowDate >= params.startDate) && (!params.endDate || rowDate <= params.endDate));
      const matchesQuery = normalizedQuery === ''
        || row.some((cell) => String(cell ?? '').toLowerCase().includes(normalizedQuery));
      const rowStatus = statusIndex >= 0 ? row[statusIndex] : '';
      const matchesStatus = params.status === '전체' || rowStatus === params.status;
      return matchesDate && matchesQuery && matchesStatus;
    });
  }, [dateIndex, params.endDate, params.query, params.startDate, params.status, rows, statusIndex]);

  const statusOptions = useMemo(() => {
    const detected = statusIndex >= 0 ? rows.map((row) => row[statusIndex]).filter(Boolean) : [];
    return ['전체', ...Array.from(new Set([...detected, '정상', '확인 필요', '반려', '승인 완료']))];
  }, [rows, statusIndex]);
  const isSqlQueryMode = Boolean(window.api?.querySalesData);
  const sqlRows = useMemo(() => rows.map((row, rowIndex) => ({ row, rowIndex })), [rows]);
  const totalRows = isSqlQueryMode ? serverTotal : filteredRows.length;
  const totalPages = Math.max(Math.ceil(totalRows / params.pageSize), 1);
  const visibleRows = isSqlQueryMode
    ? sqlRows
    : filteredRows.slice((page - 1) * params.pageSize, page * params.pageSize);

  const updateParams = (nextValues) => {
    setParams((current) => ({
      ...current,
      ...nextValues,
    }));
    setPage(1);
  };

  const fetchPage = async (targetPage) => {
    const nextPage = Math.min(Math.max(targetPage, 1), totalPages);
    const searchParams = {
      ...params,
      page: nextPage,
    };

    if (window.api?.querySalesData) {
      try {
        const result = await window.api.querySalesData(searchParams);
        const data = result?.data;
        if (result?.ok && Array.isArray(data?.rows)) {
          stageWorkspace({
            fileName: data.fileName ?? fileName,
            columns: Array.isArray(data.columns) ? data.columns : columns,
            rows: data.rows,
            validationIssues: {},
            rowActions: {},
          });
          setServerTotal(Number(data.total) || 0);
          setPage(Number(data.page) || nextPage);
          setSelectedIndex(0);
          return;
        }
      } catch (error) {
        return;
      }
    }

    setPage(nextPage);
  };

  const handleSearch = () => fetchPage(1);
  const handlePrevPage = () => fetchPage(page - 1);
  const handleNextPage = () => fetchPage(page + 1);

  const runValidation = (targetColumns = columns, targetRows = rows, nextFileName = fileName) => {
    const result = validateBeforeInsert(targetColumns, targetRows);
    const stamped = applyValidationStatus(targetColumns, targetRows, result);
    const issues = Object.fromEntries(
      Object.entries(result.issuesByRow).map(([rowIndex, rowIssues]) => [rowIndex, rowIssues.map((issue) => `${issue.type}: ${issue.message}`)])
    );

    stageWorkspace({
      fileName: nextFileName,
      columns: stamped.columns,
      rows: stamped.rows,
      validationIssues: issues,
      rowActions: {},
    });
    setValidation(result);
    setValidationIssues(issues);
    setSelectedIndex(0);
  };

  return (
    <PageShell title="원본 데이터 조회" description="업로드한 원본 데이터를 조회하고, 반려 항목이 없는 데이터만 SQL에 저장합니다.">
      <div className="flex h-[calc(100vh-14rem)] flex-col">
      <section className="mb-3 shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="grid gap-3 xl:grid-cols-[136px_136px_150px_minmax(240px,1fr)_auto] xl:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">시작일</span>
            <input
              className="form-input w-full"
              type="date"
              value={params.startDate}
              onChange={(event) => updateParams({ startDate: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">마지막일</span>
            <input
              className="form-input w-full"
              type="date"
              value={params.endDate}
              onChange={(event) => updateParams({ endDate: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">상태</span>
            <select className="form-select w-full" value={params.status} onChange={(event) => updateParams({ status: event.target.value })}>
              {statusOptions.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">검색</span>
            <input
              className="form-input w-full"
              placeholder="거래처, 품목, 담당자 검색"
              type="search"
              value={params.query}
              onChange={(event) => updateParams({ query: event.target.value })}
            />
          </label>
          <div className="flex items-end">
            <button className="btn btn-primary w-full whitespace-nowrap" type="button" onClick={handleSearch}>
              조회
            </button>
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-gray-100">원본 데이터</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {totalRows.toLocaleString('ko-KR')}건 중 {visibleRows.length.toLocaleString('ko-KR')}건 표시
            </p>
          </div>
          {totalRows > params.pageSize && (
            <div className="flex items-center gap-2">
              <button className="btn btn-secondary h-8 px-3 text-xs" type="button" disabled={page <= 1} onClick={handlePrevPage}>이전</button>
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{page} / {totalPages}</span>
              <button className="btn btn-secondary h-8 px-3 text-xs" type="button" disabled={page >= totalPages} onClick={handleNextPage}>다음</button>
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-auto no-scrollbar">
          <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-14 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">#</th>
                {columns.map((column) => (
                  <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ row, rowIndex }) => {
                const selected = rowIndex === selectedIndex;
                return (
                  <tr key={`${rowIndex}-${row.join('|')}`} className={`group cursor-pointer ${selected ? 'bg-accent-50/70 dark:bg-accent-500/10' : ''}`} onClick={() => setSelectedIndex(rowIndex)}>
                    <td className="border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs text-gray-400 dark:border-gray-700/60 dark:bg-gray-900/30">{rowIndex + 1}</td>
                    {columns.map((column, cellIndex) => {
                      const cell = row[cellIndex] ?? '';
                      return (
                        <td key={`${rowIndex}-${column}`} className="h-8 max-w-64 truncate border-b border-r border-gray-200 px-3 py-1.5 text-gray-700 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-200 dark:group-hover:bg-accent-500/10" title={cell}>
                          {cellIndex === statusIndex ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(cell)}`}>{cell}</span> : cell}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </PageShell>
  );
}
