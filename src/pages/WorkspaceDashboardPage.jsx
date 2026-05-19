import React, { useEffect, useMemo, useRef, useState } from 'react';

import Sidebar from '../partials/Sidebar';
import Header from '../partials/Header';
import Breadcrumbs from '../useComponents/Breadcrumbs';
import ExcelTable from '../useComponents/ExcelTable';
import { sampleColumns, createSampleSalesRows } from '../data/sampleSalesData';
import { parseSpreadsheetFile } from '../utils/fileParsers';
import { exportRowsToXlsx } from '../utils/spreadsheetExport';
import { validateRows } from '../utils/validationRules';

const sampleRows = createSampleSalesRows(1200);

const automationSteps = [
  { title: '데이터 정리', status: '진행 가능', progress: 72 },
  { title: '코드 매핑', status: '대기', progress: 0 },
  { title: '중복 검사', status: '대기', progress: 0 },
  { title: '보고서 생성', status: '대기', progress: 0 },
];

const completedAutomationSteps = automationSteps.map((step) => ({
  ...step,
  status: '완료',
  progress: 100,
}));

const initialLogs = [
  { time: '15:04:12', type: 'INFO', text: '파일 스키마를 분석했습니다.' },
  { time: '15:04:18', type: 'WARN', text: '품목 코드 C-0412가 2회 반복되었습니다.' },
  { time: '15:04:21', type: 'INFO', text: '거래처 코드 매핑 규칙 7개를 불러왔습니다.' },
  { time: '15:04:27', type: 'ERROR', text: '2개 행에서 필수 금액 값이 비어 있습니다.' },
];

const issueStatuses = ['확인 필요', '중복 의심', '수정 필요', '보류'];
const actionLabels = {
  approved: '승인 완료',
  hold: '보류',
  needsEdit: '수정 필요',
};

function countRowsByStatus(rows, columns, status) {
  const statusIndex = columns.findIndex((column) => ['검증', '상태', '결과'].includes(column));
  if (statusIndex < 0) return 0;
  return rows.filter((row) => row[statusIndex] === status).length;
}

function countIssueRows(rows, columns) {
  const statusIndex = columns.findIndex((column) => ['검증', '상태', '결과'].includes(column));
  if (statusIndex < 0) return 0;
  return rows.filter((row) => issueStatuses.includes(row[statusIndex])).length;
}

function getCurrentTime() {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tableData, setTableData] = useState({
    fileName: 'sample_sales_1200.csv',
    columns: sampleColumns,
    rows: sampleRows,
  });
  const [logs, setLogs] = useState(initialLogs);
  const [uploadState, setUploadState] = useState('샘플 데이터 로드됨');
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [downloadTitle, setDownloadTitle] = useState('excel-sample-data-1200');
  const [downloadState, setDownloadState] = useState('저장 위치 선택 가능');
  const [automationState, setAutomationState] = useState('대기 중');
  const [automationQueue, setAutomationQueue] = useState(automationSteps);
  const [lastSavedAt, setLastSavedAt] = useState('방금 전');
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [rowActions, setRowActions] = useState({});
  const [tableRevision, setTableRevision] = useState(0);
  const [validationIssues, setValidationIssues] = useState({});
  const automationTimersRef = useRef([]);

  useEffect(() => () => {
    automationTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
  }, []);

  const quickStats = useMemo(() => {
    const reviewCount = countRowsByStatus(tableData.rows, tableData.columns, '확인 필요');
    const duplicateCount = countRowsByStatus(tableData.rows, tableData.columns, '중복 의심');
    const issueCount = countIssueRows(tableData.rows, tableData.columns);

    return [
      {
        label: '열린 파일',
        value: tableData.fileName,
        detail: `${tableData.columns.length.toLocaleString('ko-KR')}개 열 · ${tableData.rows.length.toLocaleString('ko-KR')}행`,
      },
      { label: '자동화 상태', value: automationState, detail: '정리 규칙 7개 준비됨' },
      {
        label: '검증 결과',
        value: issueCount > 0 ? `${issueCount.toLocaleString('ko-KR')}건 확인 필요` : '이슈 없음',
        detail: `중복 ${duplicateCount.toLocaleString('ko-KR')} · 확인 ${reviewCount.toLocaleString('ko-KR')} · 처리 ${Object.keys(rowActions).length.toLocaleString('ko-KR')}`,
      },
    ];
  }, [automationState, rowActions, tableData]);

  const selectedRow = tableData.rows[selectedRowIndex] ?? tableData.rows[0] ?? [];
  const statusColumnIndex = tableData.columns.findIndex((column) => ['검증', '상태', '결과'].includes(column));
  const selectedStatus = statusColumnIndex >= 0 ? selectedRow[statusColumnIndex] : '';
  const selectedAction = rowActions[selectedRowIndex];
  const selectedIssues = validationIssues[selectedRowIndex] ?? [];
  const selectedRowDetails = tableData.columns.map((column, index) => ({
    column,
    value: selectedRow[index] ?? '',
  }));

  const addLog = (type, text) => {
    setLogs((currentLogs) => [
      { time: getCurrentTime(), type, text },
      ...currentLogs,
    ].slice(0, 8));
  };

  const handleFileUpload = async (file) => {
    setIsLoadingFile(true);
    setUploadState(`${file.name} 읽는 중`);

    try {
      const parsed = await parseSpreadsheetFile(file);
      setTableData(parsed);
      setSelectedRowIndex(0);
      setRowActions({});
      setValidationIssues({});
      setTableRevision((revision) => revision + 1);
      setUploadState('업로드 완료');
      addLog('INFO', `${file.name} 파일을 불러왔습니다. ${parsed.rows.length.toLocaleString('ko-KR')}행을 표시합니다.`);
    } catch (error) {
      setUploadState('업로드 실패');
      addLog('ERROR', error.message);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleDownloadSample = async () => {
    setDownloadState('엑셀 파일 생성 중');

    try {
      const result = await exportRowsToXlsx({
        columns: sampleColumns,
        rows: sampleRows,
        title: downloadTitle,
        sheetName: 'Sample 1200',
      });
      const locationText = result.saveMode === 'electron-dialog' || result.saveMode === 'location-picker'
        ? '선택한 위치에 저장됨'
        : '브라우저 기본 다운로드 폴더에 저장됨';

      setDownloadState(`${result.fileName} · ${locationText}`);
      setLastSavedAt('방금 전');
      addLog('INFO', `1,200건 샘플 데이터를 ${result.fileName} 파일로 저장했습니다.`);
    } catch (error) {
      const message = error.name === 'AbortError' ? '다운로드가 취소되었습니다.' : error.message;
      setDownloadState(message);
      addLog('WARN', message);
    }
  };

  const handleSaveCurrent = async () => {
    setDownloadState('현재 작업 저장 중');

    try {
      const result = await exportRowsToXlsx({
        columns: tableData.columns,
        rows: tableData.rows,
        title: `${downloadTitle}-current`,
        sheetName: 'Current Data',
      });
      setDownloadState(`${result.fileName} · 현재 작업 저장됨`);
      setLastSavedAt('방금 전');
      addLog('INFO', `현재 작업을 ${result.fileName} 파일로 저장했습니다.`);
      if (window.api?.saveData) {
        await window.api.saveData({
          fileName: tableData.fileName,
          columns: tableData.columns,
          rows: tableData.rows,
          rowActions,
          validationIssues,
          savedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      const message = error.name === 'AbortError' ? '저장이 취소되었습니다.' : error.message;
      setDownloadState(message);
      addLog('WARN', message);
    }
  };

  const handleNewTask = () => {
    setTableData({
      fileName: 'sample_sales_1200.csv',
      columns: sampleColumns,
      rows: createSampleSalesRows(1200),
    });
    setUploadState('새 작업 준비됨');
    setDownloadState('저장 위치 선택 가능');
    setAutomationState('대기 중');
    setAutomationQueue(automationSteps);
    setSelectedRowIndex(0);
    setRowActions({});
    setValidationIssues({});
    setTableRevision((revision) => revision + 1);
    setDownloadTitle('excel-sample-data-1200');
    addLog('INFO', '새 작업을 만들고 1,200건 샘플 데이터를 다시 불러왔습니다.');
  };

  const handleRunAutomation = () => {
    if (automationState === '실행 중') return;

    const reviewCount = countRowsByStatus(tableData.rows, tableData.columns, '확인 필요');
    const duplicateCount = countRowsByStatus(tableData.rows, tableData.columns, '중복 의심');

    automationTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    automationTimersRef.current = [];
    setAutomationState('실행 중');
    setAutomationQueue(automationSteps.map((step, index) => ({
      ...step,
      status: index === 0 ? '실행 중' : '대기',
      progress: index === 0 ? 35 : 0,
    })));
    addLog('INFO', '자동화 실행을 시작했습니다.');

    automationSteps.forEach((step, stepIndex) => {
      const timerId = window.setTimeout(() => {
        setAutomationQueue((currentQueue) => currentQueue.map((item, itemIndex) => {
          if (itemIndex < stepIndex) return { ...item, status: '완료', progress: 100 };
          if (itemIndex === stepIndex) return { ...item, status: '완료', progress: 100 };
          if (itemIndex === stepIndex + 1) return { ...item, status: '실행 중', progress: 45 };
          return item;
        }));
        addLog('INFO', `${step.title} 단계를 완료했습니다.`);

        if (stepIndex === automationSteps.length - 1) {
          setAutomationState('완료');
          setAutomationQueue(completedAutomationSteps);
          addLog('INFO', `자동화가 완료되었습니다. 중복 ${duplicateCount.toLocaleString('ko-KR')}건, 확인 필요 ${reviewCount.toLocaleString('ko-KR')}건을 감지했습니다.`);
        }
      }, (stepIndex + 1) * 650);
      automationTimersRef.current.push(timerId);
    });
  };

  const handleValidateData = () => {
    const result = validateRows(tableData.columns, tableData.rows);

    setTableData((currentData) => ({
      ...currentData,
      rows: result.rows,
    }));
    setValidationIssues(result.issueMap);
    setAutomationState('검증 완료');
    addLog('WARN', `검증 규칙을 적용했습니다. 중복 의심 ${result.summary.duplicateCount.toLocaleString('ko-KR')}건, 확인 필요 ${result.summary.reviewCount.toLocaleString('ko-KR')}건입니다.`);
  };

  const handlePinColumn = (isPinned) => {
    addLog('INFO', isPinned ? '첫 번째 데이터 열을 고정했습니다.' : '첫 번째 데이터 열 고정을 해제했습니다.');
  };

  const handleSelectRow = (rowIndex) => {
    setSelectedRowIndex(rowIndex);
  };

  const handleResolveSelectedRow = (action) => {
    if (!selectedRow) return;

    const nextStatus = actionLabels[action];
    if (!nextStatus) return;

    setTableData((currentData) => {
      const nextRows = currentData.rows.map((row, rowIndex) => {
        if (rowIndex !== selectedRowIndex) return row;
        return row.map((cell, cellIndex) => (cellIndex === statusColumnIndex ? nextStatus : cell));
      });

      return {
        ...currentData,
        rows: nextRows,
      };
    });
    setRowActions((currentActions) => ({
      ...currentActions,
      [selectedRowIndex]: action,
    }));
    setAutomationState('검토 반영');
    addLog('INFO', `${selectedRowIndex + 1}번 행을 '${nextStatus}' 상태로 처리했습니다.`);
  };

  const handleUndo = () => {
    addLog('INFO', '이전 작업으로 되돌릴 준비가 되었습니다. 실제 편집 이력은 다음 단계에서 연결할 수 있습니다.');
  };

  const handleRedo = () => {
    addLog('INFO', '되돌린 작업을 다시 적용할 준비가 되었습니다.');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-gray-900">
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onFileUpload={handleFileUpload}
          onSave={handleSaveCurrent}
          onRun={handleRunAutomation}
          onUndo={handleUndo}
          onRedo={handleRedo}
          lastSavedAt={lastSavedAt}
        />

        <main className="grow">
          <div className="w-full max-w-9xl px-4 py-3 sm:px-6 lg:px-8">
            <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 md:text-2xl">
                  Excel Automation Workspace
                </h1>
                <Breadcrumbs />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 dark:text-gray-300">
                  <span className="shrink-0 text-xs font-semibold text-gray-400 dark:text-gray-500">다운로드 제목</span>
                  <input
                    className="w-44 bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
                    value={downloadTitle}
                    onChange={(event) => setDownloadTitle(event.target.value)}
                    placeholder="파일 제목"
                  />
                </label>
                <button className="btn btn-secondary" type="button" onClick={handleNewTask}>
                  새 작업
                </button>
                <button className="btn btn-secondary" type="button" onClick={handleSaveCurrent}>
                  현재 작업 저장
                </button>
                <button className="btn btn-secondary" type="button" onClick={handleDownloadSample}>
                  샘플 엑셀 다운로드
                </button>
                <button className="btn btn-primary" type="button" onClick={handleRunAutomation}>
                  자동화 실행
                </button>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {quickStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
                  <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{stat.label}</p>
                  <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{stat.value}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{stat.detail}</p>
                </div>
              ))}
            </div>

            <ExcelTable
              columns={tableData.columns}
              rows={tableData.rows}
              fileName={tableData.fileName}
              isLoading={isLoadingFile}
              onExport={handleDownloadSample}
              onValidate={handleValidateData}
              onPin={handlePinColumn}
              selectedRowIndex={selectedRowIndex}
              onRowSelect={handleSelectRow}
              resetKey={tableRevision}
            />

            <div className="h-32" aria-hidden="true" />
          </div>
        </main>

        <section className="pointer-events-none fixed bottom-3 left-4 right-4 z-30 lg:left-24 2xl:left-[17rem]">
          <div className="pointer-events-auto overflow-hidden rounded-lg border border-gray-200 bg-white/95 shadow-lg shadow-gray-900/10 backdrop-blur dark:border-gray-700/60 dark:bg-gray-800/95">
            <div className="grid gap-0 xl:grid-cols-[minmax(300px,0.95fr)_minmax(280px,0.85fr)_minmax(0,1.2fr)]">
              <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700/60 xl:border-b-0 xl:border-r">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">선택 행 상세</h2>
                  <span className="rounded bg-accent-50 px-2 py-1 text-xs font-semibold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                    #{selectedRowIndex + 1} · {selectedAction ? actionLabels[selectedAction] : selectedStatus || '상태 없음'}
                  </span>
                </div>
                <div className="mb-2 grid grid-cols-3 gap-2">
                  {selectedRowDetails.slice(0, 3).map((detail) => (
                    <div key={detail.column} className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase text-gray-400 dark:text-gray-500">{detail.column}</p>
                      <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-100">{detail.value}</p>
                    </div>
                  ))}
                </div>
                {selectedIssues.length > 0 && (
                  <p className="mt-2 truncate text-xs text-yellow-700 dark:text-yellow-300">
                    {selectedIssues[0]}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <button className="h-8 rounded-md bg-accent-600 px-2 text-xs font-semibold text-white hover:bg-accent-700" type="button" onClick={() => handleResolveSelectedRow('approved')}>
                    승인
                  </button>
                  <button className="h-8 rounded-md border border-yellow-200 bg-yellow-50 px-2 text-xs font-semibold text-yellow-700 hover:bg-yellow-100 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300" type="button" onClick={() => handleResolveSelectedRow('hold')}>
                    보류
                  </button>
                  <button className="h-8 rounded-md border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" type="button" onClick={() => handleResolveSelectedRow('needsEdit')}>
                    수정 필요
                  </button>
                </div>
              </div>

              <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700/60 xl:border-b-0 xl:border-r">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">자동화 큐</h2>
                  <span className="truncate text-xs text-gray-500 dark:text-gray-400">활성 파일: {tableData.fileName}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {automationQueue.map((step, index) => (
                    <div key={step.title} className="min-w-0">
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${index === 0 ? 'bg-accent-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {index + 1}
                        </span>
                        <span className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">{step.title}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
                        <div className="h-1.5 rounded-full bg-accent-500" style={{ width: `${step.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-3 py-2">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">로그 및 자동화 상태</h2>
                  <span className="truncate text-xs text-gray-500 dark:text-gray-400">{uploadState} · {downloadState}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  {logs.slice(0, 4).map((log) => (
                    <div key={`${log.time}-${log.text}`} className="min-w-0 rounded-md bg-gray-50 px-2.5 py-1.5 text-sm dark:bg-gray-900/30">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-400">{log.time}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${log.type === 'ERROR' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300' : log.type === 'WARN' ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300' : 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300'}`}>
                          {log.type}
                        </span>
                      </div>
                      <p className="truncate text-gray-600 dark:text-gray-300">{log.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

export default Dashboard;
