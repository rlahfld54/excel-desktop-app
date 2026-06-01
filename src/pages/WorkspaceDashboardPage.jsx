import React, { useEffect, useMemo, useRef, useState } from 'react';

import Sidebar from '../partials/Sidebar';
import Header from '../partials/Header';
import Breadcrumbs from '../useComponents/Breadcrumbs';
import ExcelTable from '../useComponents/ExcelTable';
import { sampleColumns, createSampleSalesRows } from '../data/sampleSalesData';
import { useWorkspaceDataStore } from '../stores/workspaceDataStore';
import { parseSpreadsheetFile } from '../utils/fileParsers';
import { notifyUser } from '../utils/notifications';
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

function ChangeNotice({ notice }) {
  if (!notice) return null;

  const toneClasses = {
    success: 'border-green-200 bg-green-50 text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200',
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
    info: 'border-accent-200 bg-accent-50 text-accent-800 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-200',
  };

  return (
    <div className="pointer-events-none fixed right-5 top-20 z-50 max-w-sm">
      <div className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${toneClasses[notice.type] ?? toneClasses.info}`}>
        <p className="font-semibold">{notice.title}</p>
        <p className="mt-1 leading-5">{notice.message}</p>
      </div>
    </div>
  );
}

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileName = useWorkspaceDataStore((state) => state.fileName);
  const columns = useWorkspaceDataStore((state) => state.columns);
  const rows = useWorkspaceDataStore((state) => state.rows);
  const rowActions = useWorkspaceDataStore((state) => state.rowActions);
  const validationIssues = useWorkspaceDataStore((state) => state.validationIssues);
  const isDirty = useWorkspaceDataStore((state) => state.isDirty);
  const sourceMode = useWorkspaceDataStore((state) => state.sourceMode);
  const stageWorkspace = useWorkspaceDataStore((state) => state.stageWorkspace);
  const setRows = useWorkspaceDataStore((state) => state.setRows);
  const setRowActions = useWorkspaceDataStore((state) => state.setRowActions);
  const setValidationIssues = useWorkspaceDataStore((state) => state.setValidationIssues);
  const saveRows = useWorkspaceDataStore((state) => state.saveRows);
  const [logs, setLogs] = useState(initialLogs);
  const [uploadState, setUploadState] = useState('샘플 데이터 로드됨');
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [downloadTitle, setDownloadTitle] = useState('excel-sample-data-1200');
  const [downloadState, setDownloadState] = useState('저장 위치 선택 가능');
  const [automationState, setAutomationState] = useState('대기 중');
  const [automationQueue, setAutomationQueue] = useState(automationSteps);
  const [lastSavedAt, setLastSavedAt] = useState('방금 전');
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [tableRevision, setTableRevision] = useState(0);
  const [notice, setNotice] = useState(null);
  const automationTimersRef = useRef([]);
  const noticeTimerRef = useRef(null);
  const tableData = useMemo(() => ({
    fileName,
    columns,
    rows,
  }), [columns, fileName, rows]);

  useEffect(() => () => {
    automationTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    window.clearTimeout(noticeTimerRef.current);
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
      {
        label: '저장 상태',
        value: isDirty ? 'SQLite 미저장' : '저장됨',
        detail: sourceMode === 'draft' ? '화면 상태만 반영됨' : '저장 버튼으로 DB 반영',
      },
      { label: '자동화 상태', value: automationState, detail: '정리 규칙 7개 준비됨' },
      {
        label: '검증 결과',
        value: issueCount > 0 ? `${issueCount.toLocaleString('ko-KR')}건 확인 필요` : '이슈 없음',
        detail: `중복 ${duplicateCount.toLocaleString('ko-KR')} · 확인 ${reviewCount.toLocaleString('ko-KR')} · 처리 ${Object.keys(rowActions).length.toLocaleString('ko-KR')}`,
      },
    ];
  }, [automationState, isDirty, rowActions, sourceMode, tableData]);

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

  const showNotice = (type, title, message, { sound = true } = {}) => {
    window.clearTimeout(noticeTimerRef.current);
    setNotice({ type, title, message });
    notifyUser({ type, title, message, sound }).catch(() => {});
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
    }, 3200);
  };

  const handleFileUpload = async (file) => {
    setIsLoadingFile(true);
    setUploadState(`${file.name} 읽는 중`);

    try {
      const parsed = await parseSpreadsheetFile(file);
      stageWorkspace({
        ...parsed,
        rowActions: {},
        validationIssues: {},
      });
      setSelectedRowIndex(0);
      setTableRevision((revision) => revision + 1);
      setUploadState('업로드 완료 · 아직 SQLite 미저장');
      addLog('INFO', `${file.name} 파일을 화면에 불러왔습니다. 저장 버튼을 누르면 SQLite에 반영됩니다.`);
      showNotice('info', '업로드 완료', `${parsed.rows.length.toLocaleString('ko-KR')}행을 화면에 반영했습니다. 저장 전까지 DB에는 들어가지 않습니다.`);
    } catch (error) {
      setUploadState('업로드 실패');
      addLog('ERROR', error.message);
      showNotice('error', '업로드 실패', error.message);
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
      const databaseResult = await saveRows({
        fileName: tableData.fileName,
        columns: tableData.columns,
        rows: tableData.rows,
        rowActions,
        validationIssues,
      });
      if (databaseResult.ok) {
        addLog('INFO', '현재 작업을 SQLite에 저장했습니다.');
        showNotice('success', 'SQLite 저장 완료', `${tableData.rows.length.toLocaleString('ko-KR')}행이 DB 테이블에 반영됐습니다.`);
      } else {
        const warningMessage = databaseResult.mode === 'browser-only'
          ? '브라우저 미리보기라 SQLite에는 저장하지 않고 로컬 상태만 보관했습니다.'
          : `SQLite 저장 실패: ${databaseResult.message}`;
        addLog('WARN', warningMessage);
        showNotice('warning', '저장 확인 필요', warningMessage);
      }
    } catch (error) {
      const message = error.name === 'AbortError' ? '저장이 취소되었습니다.' : error.message;
      setDownloadState(message);
      addLog('WARN', message);
      showNotice(error.name === 'AbortError' ? 'warning' : 'error', '저장 실패', message);
    }
  };

  const handleNewTask = () => {
    stageWorkspace({
      fileName: 'sample_sales_1200.csv',
      columns: sampleColumns,
      rows: createSampleSalesRows(1200),
      rowActions: {},
      validationIssues: {},
    });
    setUploadState('새 작업 준비됨');
    setDownloadState('저장 위치 선택 가능');
    setAutomationState('대기 중');
    setAutomationQueue(automationSteps);
    setSelectedRowIndex(0);
    setTableRevision((revision) => revision + 1);
    setDownloadTitle('excel-sample-data-1200');
    addLog('INFO', '새 작업을 만들고 1,200건 샘플 데이터를 다시 불러왔습니다.');
    showNotice('info', '새 작업 준비', '샘플 데이터가 화면 상태로 준비됐습니다. 필요할 때 저장하세요.');
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
    showNotice('info', '자동화 시작', '선택한 자동화 단계를 실행합니다.', { sound: false });

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
          showNotice('success', '자동화 완료', `중복 ${duplicateCount.toLocaleString('ko-KR')}건, 확인 필요 ${reviewCount.toLocaleString('ko-KR')}건을 감지했습니다.`);
        }
      }, (stepIndex + 1) * 650);
      automationTimersRef.current.push(timerId);
    });
  };

  const handleValidateData = () => {
    const result = validateRows(tableData.columns, tableData.rows);

    setRows(result.rows);
    setValidationIssues(result.issueMap);
    setAutomationState('검증 완료');
    addLog('WARN', `검증 규칙을 적용했습니다. 중복 의심 ${result.summary.duplicateCount.toLocaleString('ko-KR')}건, 확인 필요 ${result.summary.reviewCount.toLocaleString('ko-KR')}건입니다.`);
    showNotice('warning', '검증 완료', `중복 의심 ${result.summary.duplicateCount.toLocaleString('ko-KR')}건, 확인 필요 ${result.summary.reviewCount.toLocaleString('ko-KR')}건입니다.`);
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

    setRows((currentRows) => {
      const nextRows = currentRows.map((row, rowIndex) => {
        if (rowIndex !== selectedRowIndex) return row;
        return row.map((cell, cellIndex) => (cellIndex === statusColumnIndex ? nextStatus : cell));
      });

      return nextRows;
    });
    setRowActions((currentActions) => ({
      ...currentActions,
      [selectedRowIndex]: action,
    }));
    setAutomationState('검토 반영');
    addLog('INFO', `${selectedRowIndex + 1}번 행을 '${nextStatus}' 상태로 처리했습니다.`);
    showNotice('success', '행 상태 변경', `${selectedRowIndex + 1}번 행을 '${nextStatus}' 상태로 처리했습니다. 저장하면 DB에 반영됩니다.`, { sound: false });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-gray-900">
        <ChangeNotice notice={notice} />
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onFileUpload={handleFileUpload}
          onSave={handleSaveCurrent}
          lastSavedAt={lastSavedAt}
        />

        <main className="flex grow flex-col">
          <div className="flex min-h-full w-full max-w-9xl flex-1 flex-col px-4 py-3 sm:px-6 lg:px-8">
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
              visibleRowCount={24}
              fillAvailableHeight
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
