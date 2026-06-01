import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';
import { createSampleSalesRows, parseNumber, sampleColumns, validationTypes } from '../data/sampleSalesData';
import { useWorkspaceDataStore } from '../stores/workspaceDataStore';
import { exportRowsToXlsx } from '../utils/spreadsheetExport';
import { validateRows } from '../utils/validationRules';

const ruleLabels = {
  duplicate: '중복 의심',
  missingCustomer: '거래처 누락',
  missingProductCode: '품목 코드 누락',
  amountMismatch: '금액 불일치',
  priceMismatch: '단가 기준 불일치',
  largeQuantity: '대량 거래 확인',
  highAmount: '고액 거래 확인',
  review: '기타 확인',
};

function statusClass(status) {
  if (['정상', '승인 완료'].includes(status)) {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
  }

  if (['확인 필요', '중복 의심', '보류', '대량 거래 확인', '고액 거래 확인'].includes(status)) {
    return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
  }

  return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
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
  const rows = useWorkspaceDataStore((state) => state.rows);
  const setRows = useWorkspaceDataStore((state) => state.setRows);
  const loadLatest = useWorkspaceDataStore((state) => state.loadLatest);
  const saveRows = useWorkspaceDataStore((state) => state.saveRows);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [issues, setIssues] = useState({});
  const [summary, setSummary] = useState({ ruleCounts: {} });
  const [actionState, setActionState] = useState('1,200건 샘플 데이터가 준비되었습니다.');
  const [exportTitle, setExportTitle] = useState('sales-data-review-1200');

  useEffect(() => {
    let active = true;

    async function loadLatestRows() {
      if (!window.api?.getLatestData) return;

      const result = await window.api.getLatestData();
      let payload = result?.data?.payload;

      if (result?.ok && !payload?.rows?.length && window.api?.saveData) {
        await window.api.saveData({
          fileName: 'sample_sales_1200.xlsx',
          columns: sampleColumns,
          rows: createSampleSalesRows(1200),
          savedAt: new Date().toISOString(),
        });
        const seeded = await window.api.getLatestData();
        payload = seeded?.data?.payload;
      }

      if (!active || !Array.isArray(payload?.rows) || payload.rows.length === 0) return;

      setRows(payload.rows);
      setActionState(`SQLite 최신 데이터 ${payload.rows.length.toLocaleString('ko-KR')}건을 불러왔습니다.`);
    }

    loadLatestRows();

    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.map((row, rowIndex) => ({ row, rowIndex })).filter(({ row }) => {
      const matchesQuery = normalizedQuery === ''
        || row.some((cell) => String(cell ?? '').toLowerCase().includes(normalizedQuery));
      const matchesStatus = statusFilter === '전체' || row[7] === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, rows, statusFilter]);

  const selectedRow = rows[selectedIndex] ?? rows[0] ?? [];
  const selectedIssues = issues[selectedIndex] ?? [];

  const metrics = useMemo(() => {
    const normalCount = rows.filter((row) => ['정상', '승인 완료'].includes(row[7])).length;
    const issueCount = rows.length - normalCount;
    const duplicateCount = rows.filter((row) => row[7] === '중복 의심').length;
    const totalAmount = rows.reduce((sum, row) => sum + parseNumber(row[6]), 0);

    return [
      { label: '전체 데이터', value: `${rows.length.toLocaleString('ko-KR')}건`, detail: `${sampleColumns.length}개 컬럼 / 1200건 기준` },
      { label: '정상 데이터', value: `${normalCount.toLocaleString('ko-KR')}건`, detail: '승인 완료 포함' },
      { label: '검증 필요', value: `${issueCount.toLocaleString('ko-KR')}건`, detail: `중복 ${duplicateCount.toLocaleString('ko-KR')}건 포함`, tone: issueCount > 0 ? 'warning' : 'default' },
      { label: '합계 금액', value: `${totalAmount.toLocaleString('ko-KR')}원`, detail: '현재 표시 데이터 기준' },
    ];
  }, [rows]);

  const handleValidate = () => {
    const result = validateRows(sampleColumns, rows);
    setRows(result.rows);
    setIssues(result.issueMap);
    setSummary(result.summary);
    setActionState(`검증 완료: 정상 ${result.summary.fixedCount.toLocaleString('ko-KR')}건 / 중복 ${result.summary.duplicateCount.toLocaleString('ko-KR')}건 / 확인 ${result.summary.reviewCount.toLocaleString('ko-KR')}건`);
  };

  const handleResolve = (status) => {
    setRows((currentRows) => currentRows.map((row, index) => (
      index === selectedIndex ? row.map((cell, cellIndex) => (cellIndex === 7 ? status : cell)) : row
    )));
    setActionState(`${selectedIndex + 1}번 행을 ${status} 상태로 처리했습니다.`);
  };

  const handleExport = async () => {
    try {
      const visibleRows = filteredRows.map((item) => item.row);
      const result = await exportRowsToXlsx({
        columns: sampleColumns,
        rows: visibleRows,
        title: exportTitle,
        sheetName: 'Data Review',
      });
      setActionState(`${result.fileName} 내보내기 완료`);
    } catch (error) {
      setActionState(error.name === 'AbortError' ? '내보내기를 취소했습니다.' : `내보내기 실패: ${error.message}`);
    }
  };

  const handleSaveSnapshot = async () => {
    const payload = {
      fileName: 'data-table-review-sample.xlsx',
      columns: sampleColumns,
      rows,
      validationIssues: issues,
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem('excel-workspace:lastSnapshot', JSON.stringify(payload));

    if (window.api?.saveData) {
      try {
        await window.api.saveData(payload);
        const latest = await window.api.getLatestData?.();
        if (Array.isArray(latest?.data?.payload?.rows) && latest.data.payload.rows.length > 0) {
          setRows(latest.data.payload.rows);
        }
        setActionState('현재 데이터와 검증 이슈를 SQLite에 저장하고 최신 데이터로 다시 불러왔습니다.');
        return;
      } catch (error) {
        setActionState(`브라우저 보관은 완료, SQLite 저장은 실패: ${error.message}`);
        return;
      }
    }

    setActionState('브라우저 개발 모드라 localStorage에 저장했습니다. Electron 연결 후 SQLite 저장으로 이어집니다.');
  };

  return (
    <PageShell title="데이터 테이블" description="1,200건 샘플 데이터를 기준으로 검증 종류별 상태와 이슈를 확인합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Data review</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{actionState}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">검증 실행 후 종류별 카운트와 선택 행의 상세 사유를 확인할 수 있습니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="form-input h-10 w-52" value={exportTitle} onChange={(event) => setExportTitle(event.target.value)} placeholder="내보내기 제목" />
            <button className="btn btn-secondary" type="button" onClick={() => setRows(createSampleSalesRows(1200))}>샘플 재생성</button>
            <button className="btn btn-secondary" type="button" onClick={handleSaveSnapshot}>SQLite 저장</button>
            <button className="btn btn-secondary" type="button" onClick={handleExport}>XLSX 내보내기</button>
            <button className="btn btn-primary" type="button" onClick={handleValidate}>검증 실행</button>
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>

      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">검증 종류</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          {Object.entries(ruleLabels).map(([key, label]) => (
            <button
              key={key}
              className="rounded-md border border-gray-200 px-3 py-2 text-left hover:border-accent-200 hover:bg-accent-50 dark:border-gray-700/60 dark:hover:border-accent-500/40 dark:hover:bg-accent-500/10"
              type="button"
              onClick={() => setStatusFilter(label === '기타 확인' ? '확인 필요' : label)}
            >
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{(summary.ruleCounts?.[key] ?? rows.filter((row) => row[7] === label).length).toLocaleString('ko-KR')}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-5 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="grid gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60 xl:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap items-center gap-2">
            <input className="form-input h-9 w-full sm:w-64" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="전체 데이터 검색" />
            <select className="form-select h-9" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="전체">상태 전체</option>
              {validationTypes.map((status) => <option key={status} value={status}>{status}</option>)}
              <option value="확인 필요">확인 필요</option>
            </select>
            <button className="h-9 rounded-md px-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/60" type="button" onClick={() => { setQuery(''); setStatusFilter('전체'); }}>
              초기화
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{filteredRows.length.toLocaleString('ko-KR')} / {rows.length.toLocaleString('ko-KR')}건</span>
            <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold dark:border-gray-700/60 dark:bg-gray-900/30">1,200건 샘플</span>
          </div>
        </div>

        <div className="h-[336px] overflow-auto no-scrollbar">
          <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-14 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">#</th>
                {sampleColumns.map((column) => (
                  <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ row, rowIndex }) => {
                const selected = rowIndex === selectedIndex;
                return (
                  <tr key={`${rowIndex}-${row[0]}-${row[2]}`} className={`group cursor-pointer ${selected ? 'bg-accent-50/70 dark:bg-accent-500/10' : ''}`} onClick={() => setSelectedIndex(rowIndex)}>
                    <td className="border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs text-gray-400 dark:border-gray-700/60 dark:bg-gray-900/30">{rowIndex + 1}</td>
                    {row.map((cell, cellIndex) => (
                      <td key={`${rowIndex}-${cellIndex}`} className="h-8 max-w-64 truncate border-b border-r border-gray-200 px-3 py-1.5 text-gray-700 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-200 dark:group-hover:bg-accent-500/10" title={cell}>
                        {cellIndex === 7 ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(cell)}`}>{cell}</span> : cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
