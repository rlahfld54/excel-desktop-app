import React, { useState } from 'react';

import PageShell from './PageShell';
import { excelUploadTemplates } from '../data/excelUploadTemplates';
import { exportAllUploadTemplatesToXlsx, exportUploadTemplateToXlsx } from '../utils/spreadsheetExport';
import { addActivityLog } from '../utils/authSession';

export default function ExcelTemplatesPage() {
  const [statusText, setStatusText] = useState('자동화에 필요한 표준 첨부 양식을 내려받을 수 있습니다.');

  const handleDownload = async (template) => {
    setStatusText(`${template.title} 양식을 생성하는 중입니다.`);
    try {
      const result = await exportUploadTemplateToXlsx(template);
      addActivityLog('INFO', '엑셀 양식 다운로드', template.title);
      setStatusText(`${result.fileName} 파일을 생성했습니다.`);
    } catch (error) {
      const message = error.name === 'AbortError' ? '양식 저장이 취소되었습니다.' : error.message;
      setStatusText(message);
    }
  };

  const handleDownloadAll = async () => {
    setStatusText('전체 표준 양식을 생성하는 중입니다.');
    try {
      const result = await exportAllUploadTemplatesToXlsx(excelUploadTemplates);
      addActivityLog('INFO', '엑셀 양식 전체 다운로드', '표준 양식 전체');
      setStatusText(`${result.fileName} 파일을 생성했습니다.`);
    } catch (error) {
      const message = error.name === 'AbortError' ? '양식 저장이 취소되었습니다.' : error.message;
      setStatusText(message);
    }
  };

  return (
    <PageShell title="엑셀 첨부 양식" description="마감 비교, 자동화, 코드 매핑, 거래처 확인 요청에 사용할 표준 엑셀 양식을 관리합니다.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" type="button" onClick={handleDownloadAll}>전체 양식 다운로드</button>
        <span className="text-sm text-gray-500 dark:text-gray-400">{statusText}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {excelUploadTemplates.map((template) => (
          <section key={template.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">{template.targetMenu}</p>
                <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{template.title}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{template.description}</p>
              </div>
              <button className="btn btn-secondary shrink-0" type="button" onClick={() => handleDownload(template)}>
                양식 다운로드
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">필수 컬럼</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {template.requiredColumns.map((column) => (
                    <span key={column} className="rounded bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                      {column}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">선택 컬럼</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {template.optionalColumns.map((column) => (
                    <span key={column} className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {column}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700/60">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2">작성 규칙</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {template.rules.map((rule) => (
                    <tr key={rule}>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
