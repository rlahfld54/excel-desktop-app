import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageShell from './PageShell';
import { createSampleSalesRows, sampleColumns } from '../data/sampleSalesData';
import { excelUploadTemplates } from '../data/excelUploadTemplates';
import { useWorkspaceDataStore } from '../stores/workspaceDataStore';
import { addActivityLog } from '../utils/authSession';
import { parseSpreadsheetFile } from '../utils/fileParsers';
import {
  applyValidationStatus,
  blockingValidationTypes,
  reviewValidationTypes,
  validateBeforeInsert,
} from '../utils/preInsertValidation';
import { exportAllUploadTemplatesToXlsx, exportUploadTemplateToXlsx } from '../utils/spreadsheetExport';

function ValidationCard({ label, value, tone = 'default' }) {
  const toneClass = {
    default: 'border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-800',
    danger: 'border-red-200 bg-red-50/70 dark:border-red-500/30 dark:bg-red-500/10',
    warning: 'border-yellow-200 bg-yellow-50/70 dark:border-yellow-500/30 dark:bg-yellow-500/10',
    success: 'border-green-200 bg-green-50/70 dark:border-green-500/30 dark:bg-green-500/10',
  }[tone];

  return (
    <section className={`rounded-lg border px-4 py-3 shadow-xs ${toneClass}`}>
      <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </section>
  );
}

function IssueList({ title, types, counts, tone }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <h2 className="font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {types.map((type) => (
          <div key={type} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700/60">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{type}</span>
            <span className={`rounded px-2 py-1 text-xs font-bold ${tone === 'danger' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-200'}`}>
              {(counts[type] ?? 0).toLocaleString('ko-KR')}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TemplateMiniCard({ template, onDownload }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">{template.targetMenu}</p>
          <h2 className="mt-1 text-base font-bold text-gray-900 dark:text-gray-100">{template.title}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">{template.description}</p>
        </div>
        <button className="btn btn-secondary shrink-0" type="button" onClick={() => onDownload(template)}>양식 다운로드</button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">필수 컬럼</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {template.requiredColumns.map((column) => (
              <span key={column} className="rounded bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">{column}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">선택 컬럼</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {template.optionalColumns.map((column) => (
              <span key={column} className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">{column}</span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function UploadValidationPage() {
  const stageWorkspace = useWorkspaceDataStore((state) => state.stageWorkspace);
  const saveRows = useWorkspaceDataStore((state) => state.saveRows);
  const [draft, setDraft] = useState(null);
  const [validation, setValidation] = useState(null);
  const [selectedType, setSelectedType] = useState('전체');
  const [statusText, setStatusText] = useState('파일을 선택하면 SQL 저장 전에 반려 항목과 담당자 확인 항목을 먼저 검사합니다.');
  const [templateStatus, setTemplateStatus] = useState('필요한 표준 양식 2개만 제공합니다.');
  const [isSaving, setIsSaving] = useState(false);

  const issueRows = useMemo(() => {
    if (!validation) return [];
    return Object.values(validation.issuesByRow)
      .flat()
      .filter((issue) => selectedType === '전체' || issue.type === selectedType)
      .slice(0, 200);
  }, [selectedType, validation]);

  const runValidation = (nextDraft) => {
    const result = validateBeforeInsert(nextDraft.columns, nextDraft.rows);
    const stamped = applyValidationStatus(nextDraft.columns, nextDraft.rows, result);
    const validationIssues = Object.fromEntries(
      Object.entries(result.issuesByRow).map(([rowIndex, issues]) => [rowIndex, issues.map((issue) => `${issue.type}: ${issue.message}`)])
    );

    setDraft({ ...nextDraft, ...stamped, validationIssues });
    setValidation(result);
    setSelectedType('전체');
    setStatusText(result.passed
      ? `반려 항목 없이 검증했습니다. 담당자 재확인 ${result.reviewCount.toLocaleString('ko-KR')}건을 확인한 뒤 저장할 수 있습니다.`
      : `반려 ${result.blockerCount.toLocaleString('ko-KR')}건이 있어 SQL 저장을 막았습니다.`);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setStatusText(`${file.name} 파일을 읽는 중입니다.`);
    try {
      const parsed = await parseSpreadsheetFile(file);
      runValidation(parsed);
    } catch (error) {
      setStatusText(`파일 검증 실패: ${error.message}`);
    }
  };

  const handleLoadSample = () => {
    runValidation({
      fileName: 'sample_sales_1200.xlsx',
      columns: sampleColumns,
      rows: createSampleSalesRows(1200),
    });
  };

  const handleSave = async () => {
    if (!draft || !validation?.passed) return;

    setIsSaving(true);
    stageWorkspace({
      fileName: draft.fileName,
      columns: draft.columns,
      rows: draft.rows,
      validationIssues: draft.validationIssues,
      rowActions: {},
    });

    const result = await saveRows({
      fileName: draft.fileName,
      columns: draft.columns,
      rows: draft.rows,
      validationIssues: draft.validationIssues,
    });

    setStatusText(result.ok
      ? `${draft.rows.length.toLocaleString('ko-KR')}행을 SQLite에 저장했습니다.`
      : result.mode === 'browser-only'
        ? '브라우저 미리보기라 로컬 상태에만 저장했습니다.'
        : `SQLite 저장 실패: ${result.message}`);
    setIsSaving(false);
  };

  const handleTemplateDownload = async (template) => {
    setTemplateStatus(`${template.title} 양식을 생성하는 중입니다.`);
    try {
      const result = await exportUploadTemplateToXlsx(template);
      addActivityLog('INFO', '엑셀 양식 다운로드', template.title);
      setTemplateStatus(`${result.fileName} 파일을 생성했습니다.`);
    } catch (error) {
      setTemplateStatus(error.name === 'AbortError' ? '양식 저장이 취소되었습니다.' : error.message);
    }
  };

  const handleTemplateDownloadAll = async () => {
    setTemplateStatus('매출 마감 표준 양식 2개를 생성하는 중입니다.');
    try {
      const result = await exportAllUploadTemplatesToXlsx(excelUploadTemplates);
      addActivityLog('INFO', '엑셀 양식 전체 다운로드', '매출 마감 표준 양식');
      setTemplateStatus(`${result.fileName} 파일을 생성했습니다.`);
    } catch (error) {
      setTemplateStatus(error.name === 'AbortError' ? '양식 저장이 취소되었습니다.' : error.message);
    }
  };

  const allTypes = ['전체', ...blockingValidationTypes, ...reviewValidationTypes];

  return (
    <PageShell title="업로드 전 검증" description="담당자가 받은 엑셀 파일을 SQL에 넣기 전에 반려해야 할 데이터와 한 번 더 확인할 데이터를 분리해서 검토합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Upload templates</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">표준 엑셀 양식</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{templateStatus}</p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={handleTemplateDownloadAll}>두 양식 한 번에 다운로드</button>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {excelUploadTemplates.map((template) => (
            <TemplateMiniCard key={template.id} template={template} onDownload={handleTemplateDownload} />
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Pre-insert validation</p>
            <p className="mt-1 truncate text-lg font-bold text-gray-900 dark:text-gray-100">{draft?.fileName ?? '검증할 파일 없음'}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{statusText}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn btn-primary cursor-pointer">
              파일 업로드
              <input className="sr-only" type="file" accept=".csv,.xlsx" onChange={handleFileUpload} />
            </label>
            <button className="btn btn-secondary" type="button" onClick={handleLoadSample}>샘플 검증</button>
            <button className="btn btn-secondary" type="button" onClick={handleSave} disabled={!validation?.passed || isSaving}>
              {isSaving ? '저장 중' : 'SQL 저장'}
            </button>
            <Link className="btn btn-secondary" to="/collect/data-table">원본 데이터 조회</Link>
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ValidationCard label="전체 행" value={`${(draft?.rows.length ?? 0).toLocaleString('ko-KR')}건`} />
        <ValidationCard label="반려 항목" value={`${(validation?.blockerCount ?? 0).toLocaleString('ko-KR')}건`} tone={(validation?.blockerCount ?? 0) > 0 ? 'danger' : 'success'} />
        <ValidationCard label="재확인 항목" value={`${(validation?.reviewCount ?? 0).toLocaleString('ko-KR')}건`} tone={(validation?.reviewCount ?? 0) > 0 ? 'warning' : 'default'} />
        <ValidationCard label="저장 가능" value={validation?.passed ? '가능' : '대기'} tone={validation?.passed ? 'success' : 'danger'} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <IssueList title="SQL 저장 전 반려" types={blockingValidationTypes} counts={validation?.counts ?? {}} tone="danger" />
        <IssueList title="담당자 재확인" types={reviewValidationTypes} counts={validation?.counts ?? {}} tone="warning" />
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">검증 상세</h2>
          <select className="form-select h-9" value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
            {allTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-[920px] w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                {['행', '구분', '처리', '내용'].map((column) => (
                  <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {issueRows.length > 0 ? issueRows.map((issue) => (
                <tr key={`${issue.rowNumber}-${issue.type}-${issue.message}`}>
                  <td className="border-b border-r border-gray-200 px-3 py-2 dark:border-gray-700/60">{issue.rowNumber}</td>
                  <td className="border-b border-r border-gray-200 px-3 py-2 font-semibold text-gray-800 dark:border-gray-700/60 dark:text-gray-100">{issue.type}</td>
                  <td className="border-b border-r border-gray-200 px-3 py-2 dark:border-gray-700/60">
                    <span className={`rounded px-2 py-1 text-xs font-bold ${issue.severity === 'block' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-200'}`}>
                      {issue.severity === 'block' ? '반려' : '재확인'}
                    </span>
                  </td>
                  <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{issue.message}</td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={4}>표시할 검증 이슈가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
