import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';
import { createSampleSalesRows, parseNumber, sampleColumns } from '../data/sampleSalesData';
import { useWorkspaceDataStore } from '../stores/workspaceDataStore';
import { parseSpreadsheetFile } from '../utils/fileParsers';
import {
  applyValidationStatus,
  blockingValidationTypes,
  reviewValidationTypes,
  validateBeforeInsert,
} from '../utils/preInsertValidation';
import { exportRowsToXlsx } from '../utils/spreadsheetExport';

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

function MetricCard({ label, value, detail, tone = 'default' }) {
  const toneClass = {
    default: 'border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-800',
    danger: 'border-red-200 bg-red-50/70 dark:border-red-500/30 dark:bg-red-500/10',
    warning: 'border-yellow-200 bg-yellow-50/70 dark:border-yellow-500/30 dark:bg-yellow-500/10',
  }[tone];

  return (
    <section className={`rounded-lg border px-4 py-3 shadow-xs ${toneClass}`}>
      <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 truncate text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </section>
  );
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
  const saveRows = useWorkspaceDataStore((state) => state.saveRows);
  const [query, setQuery] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '2026-05-01',
    endDate: '2026-05-31',
  });
  const [statusFilter, setStatusFilter] = useState('전체');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [validation, setValidation] = useState(null);
  const [validationIssues, setValidationIssues] = useState({});
  const [actionState, setActionState] = useState('원본 데이터를 조회하고, SQL 저장 전에 검증할 수 있습니다.');
  const [exportTitle, setExportTitle] = useState('sales-data-review');

  useEffect(() => {
    loadLatest().then((latest) => {
      setActionState(`${latest.fileName} 데이터를 불러왔습니다.`);
    });
  }, [loadLatest]);

  const statusIndex = getStatusIndex(columns);
  const dateIndex = getDateIndex(columns);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.map((row, rowIndex) => ({ row, rowIndex })).filter(({ row }) => {
      const rowDate = dateIndex >= 0 ? String(row[dateIndex] ?? '').slice(0, 10) : '';
      const matchesDate = dateIndex < 0
        || ((!dateRange.startDate || rowDate >= dateRange.startDate) && (!dateRange.endDate || rowDate <= dateRange.endDate));
      const matchesQuery = normalizedQuery === ''
        || row.some((cell) => String(cell ?? '').toLowerCase().includes(normalizedQuery));
      const rowStatus = statusIndex >= 0 ? row[statusIndex] : '';
      const matchesStatus = statusFilter === '전체' || rowStatus === statusFilter;
      return matchesDate && matchesQuery && matchesStatus;
    });
  }, [dateIndex, dateRange.endDate, dateRange.startDate, query, rows, statusFilter, statusIndex]);

  const statusOptions = useMemo(() => {
    if (statusIndex < 0) return ['전체'];
    return ['전체', ...Array.from(new Set(rows.map((row) => row[statusIndex]).filter(Boolean)))];
  }, [rows, statusIndex]);


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
    setActionState(result.passed
      ? `검증 완료: 반려 없음, 재확인 ${result.reviewCount.toLocaleString('ko-KR')}건`
      : `검증 완료: 반려 ${result.blockerCount.toLocaleString('ko-KR')}건이 있어 SQL 저장 전 수정이 필요합니다.`);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setActionState(`${file.name} 파일을 읽는 중입니다.`);
    try {
      const parsed = await parseSpreadsheetFile(file);
      runValidation(parsed.columns, parsed.rows, parsed.fileName);
    } catch (error) {
      setActionState(`파일 업로드 실패: ${error.message}`);
    }
  };

  const handleSaveSnapshot = async () => {
    if (validation && !validation.passed) {
      setActionState(`반려 ${validation.blockerCount.toLocaleString('ko-KR')}건이 남아 있어 SQL 저장을 막았습니다.`);
      return;
    }

    const result = await saveRows({
      fileName,
      columns,
      rows,
      validationIssues,
    });

    setActionState(result.ok
      ? '현재 데이터와 검증 이슈를 SQLite에 저장하고 최신 데이터로 다시 불러왔습니다.'
      : result.mode === 'browser-only'
        ? '브라우저 미리보기라 localStorage에 저장했습니다. Electron 연결 후 SQLite 저장으로 이어집니다.'
        : `SQLite 저장 실패: ${result.message}`);
  };

  const handleExport = async () => {
    try {
      const visibleRows = filteredRows.map((item) => item.row);
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

  const handleSampleReset = () => {
    const nextRows = createSampleSalesRows(1200);
    runValidation(sampleColumns, nextRows, 'sample_sales_1200.xlsx');
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
              value={dateRange.startDate}
              onChange={(event) => setDateRange((current) => ({ ...current, startDate: event.target.value }))}
              onInput={(event) => setDateRange((current) => ({ ...current, startDate: event.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">마지막일</span>
            <input
              className="form-input w-full"
              type="date"
              value={dateRange.endDate}
              onChange={(event) => setDateRange((current) => ({ ...current, endDate: event.target.value }))}
              onInput={(event) => setDateRange((current) => ({ ...current, endDate: event.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">상태</span>
            <select className="form-select w-full" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">검색</span>
            <input
              className="form-input w-full"
              placeholder="거래처, 품목, 담당자 검색"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-700/60 dark:bg-gray-900/30 dark:text-gray-300">
            {filteredRows.length.toLocaleString('ko-KR')} / {rows.length.toLocaleString('ko-KR')}행
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">

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
              {filteredRows.map(({ row, rowIndex }) => {
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
