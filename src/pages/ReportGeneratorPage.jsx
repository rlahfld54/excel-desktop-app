import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageShell from './PageShell';
import { createSampleSalesRows, parseNumber } from '../data/sampleSalesData';
import { readReportTemplates } from '../data/reportTemplates';
import { exportStyledReportToXlsx } from '../utils/spreadsheetExport';
import { addActivityLog, getCurrentUser } from '../utils/authSession';

const company = {
  name: 'Aster Works',
  koreanName: '애스터웍스',
  department: '총무팀',
};

const rows = createSampleSalesRows(1200);
const reportFontStack = 'Pretendard, Inter, Noto Sans KR, Malgun Gothic, sans-serif';

function toCurrency(value) {
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function getReportMetrics(sourceRows) {
  const totalSales = sourceRows.reduce((sum, row) => sum + parseNumber(row[6]), 0);
  const issueRows = sourceRows.filter((row) => row[7] !== '정상');
  const customerMap = new Map();
  const statusMap = new Map();

  sourceRows.forEach((row) => {
    const customer = row[1] || '거래처 미확인';
    const amount = parseNumber(row[6]);
    const status = row[7] || '정상';

    customerMap.set(customer, (customerMap.get(customer) ?? 0) + amount);
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
  });

  return {
    totalSales,
    averageAmount: Math.round(totalSales / sourceRows.length),
    transactionCount: sourceRows.length,
    issueCount: issueRows.length,
    issueRate: issueRows.length / sourceRows.length,
    customers: Array.from(customerMap.entries())
      .map(([name, amount]) => ({ name, amount, ratio: amount / totalSales }))
      .sort((a, b) => b.amount - a.amount),
    statuses: Array.from(statusMap.entries())
      .map(([name, count]) => ({ name, count, ratio: count / sourceRows.length }))
      .sort((a, b) => b.count - a.count),
  };
}

function makeCsv(columns, csvRows) {
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [columns.map(escape).join(','), ...csvRows.map((row) => row.map(escape).join(','))].join('\n');
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReportGeneratorPage() {
  const currentUser = getCurrentUser();
  const [templates] = useState(() => readReportTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id);
  const [reportTitle, setReportTitle] = useState('2026년 5월 총무팀 월간 보고서');
  const [statusText, setStatusText] = useState('보고서 양식을 선택하고 생성할 수 있습니다.');
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const metrics = useMemo(() => getReportMetrics(rows), []);
  const topCustomers = metrics.customers.slice(0, 5);
  const topStatuses = metrics.statuses.slice(0, 5);

  const summary = useMemo(() => [
    { label: '총 매출액', value: toCurrency(metrics.totalSales), detail: '월간 거래 기준' },
    { label: '거래 건수', value: `${metrics.transactionCount.toLocaleString('ko-KR')}건`, detail: '샘플 데이터' },
    { label: '평균 거래액', value: toCurrency(metrics.averageAmount), detail: '건별 평균' },
    { label: '오류율', value: `${(metrics.issueRate * 100).toFixed(1)}%`, detail: `${metrics.issueCount.toLocaleString('ko-KR')}건 확인` },
  ], [metrics]);

  const customerRows = useMemo(() => topCustomers.map((customer, index) => [
    customer.name,
    toCurrency(customer.amount),
    `${(customer.ratio * 100).toFixed(1)}%`,
    index === 0 ? '핵심 거래처' : '정기 점검',
    customer.ratio > 0.12 ? '집중 관리' : '정상',
    '월말 정산 반영',
  ]), [topCustomers]);

  const statusRows = useMemo(() => topStatuses.map((status) => [
    status.name,
    `${status.count.toLocaleString('ko-KR')}건`,
    `${(status.ratio * 100).toFixed(1)}%`,
    status.name === '정상' ? '자동 승인' : '총무팀 확인',
    currentUser.name,
    'D+1',
  ]), [currentUser.name, topStatuses]);

  const handleCreateReport = async () => {
    setStatusText('보고서 파일을 생성하는 중입니다.');
    try {
      const result = await exportStyledReportToXlsx({
        title: reportTitle,
        company,
        template: selectedTemplate,
        summary,
        customerRows,
        statusRows,
      });
      addActivityLog('INFO', '보고서 생성', selectedTemplate.title);
      setStatusText(`${result.fileName} 파일을 생성했습니다.`);
    } catch (error) {
      const message = error.name === 'AbortError' ? '보고서 저장이 취소되었습니다.' : error.message;
      setStatusText(message);
      addActivityLog('WARN', '보고서 생성 실패', message);
    }
  };

  const handleExportCsv = () => {
    const rowsForCsv = [
      ['보고서명', reportTitle, '회사', company.koreanName, '부서', company.department],
      ['작성자', currentUser.name, '권한', currentUser.role, '기준 데이터', `${metrics.transactionCount.toLocaleString('ko-KR')}건`],
      ['총 매출액', toCurrency(metrics.totalSales), '평균 거래액', toCurrency(metrics.averageAmount), '오류율', `${(metrics.issueRate * 100).toFixed(1)}%`],
      [],
      ['거래처', '매출액', '비율', '관리 포인트', '상태', '비고'],
      ...customerRows,
      [],
      ['검증 종류', '건수', '비율', '처리 기준', '담당', '완료 예정'],
      ...statusRows,
    ];
    const csv = makeCsv(['항목1', '값1', '항목2', '값2', '항목3', '값3'], rowsForCsv);
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${company.koreanName}_${selectedTemplate.title}.csv`);
    addActivityLog('INFO', 'CSV 내보내기', selectedTemplate.title);
    setStatusText('CSV 파일을 내보냈습니다.');
  };

  return (
    <PageShell title="보고서 작성" description="총무팀에서 바로 사용할 수 있는 회사 공통 양식의 보고서를 생성하고 내려받습니다.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" type="button" onClick={handleCreateReport}>보고서 생성</button>
        <Link className="btn btn-secondary" to="/reports/templates">템플릿 추가</Link>
        <button className="btn btn-secondary" type="button" onClick={handleExportCsv}>CSV 내보내기</button>
        <span className="text-sm text-gray-500 dark:text-gray-400">{statusText}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">Report Templates</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">총무팀 보고서 양식</h2>
          </div>
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                className={`w-full rounded-lg border p-3 text-left transition ${selectedTemplateId === template.id ? 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-500/10' : 'border-gray-200 bg-white hover:border-teal-200 dark:border-gray-700 dark:bg-gray-900/20'}`}
                type="button"
                onClick={() => setSelectedTemplateId(template.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{template.title}</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{template.purpose}</p>
                  </div>
                  <span className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-white" style={{ backgroundColor: template.color }}>{template.badge}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <div className="border-b border-gray-200 px-6 py-5 text-white dark:border-gray-700/60" style={{ backgroundColor: selectedTemplate.color, fontFamily: reportFontStack }}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded bg-white text-lg font-black" style={{ color: selectedTemplate.color }}>AW</div>
                  <div>
                    <p className="text-sm font-semibold opacity-90">{company.koreanName} · {company.department}</p>
                    <h2 className="text-2xl font-bold tracking-normal">{reportTitle}</h2>
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-6 opacity-90">{selectedTemplate.purpose}</p>
              </div>
              <label className="min-w-72 rounded bg-white/10 p-3 text-sm">
                <span className="mb-2 block font-semibold text-white">보고서 제목</span>
                <input
                  className="w-full rounded-md border border-white/20 bg-white px-3 py-2 font-semibold text-gray-900 outline-none"
                  value={reportTitle}
                  onChange={(event) => setReportTitle(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="p-6" style={{ fontFamily: `${selectedTemplate.font}, ${reportFontStack}` }}>
            <div className="grid gap-3 md:grid-cols-4">
              {summary.map((item) => (
                <div key={item.label} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700/60">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{item.label}</p>
                  <p className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">{item.value}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <ReportTable title="거래처별 거래 현황" columns={['거래처', '매출액', '비율']} rows={customerRows.map((row) => row.slice(0, 3))} accent={selectedTemplate.color} />
              <ReportTable title="검증 종류별 현황" columns={['검증 종류', '건수', '비율']} rows={statusRows.map((row) => row.slice(0, 3))} accent={selectedTemplate.color} />
            </div>

            <div className="mt-6 rounded-lg border p-4" style={{ borderColor: `${selectedTemplate.color}33`, backgroundColor: `${selectedTemplate.color}10` }}>
              <h3 className="font-bold text-gray-900 dark:text-gray-100">보고서 구성</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {selectedTemplate.sections.map((section) => (
                  <div key={section} className="rounded-md bg-white px-3 py-2 text-sm font-semibold shadow-xs dark:bg-gray-900/40" style={{ color: selectedTemplate.color }}>{section}</div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function ReportTable({ title, columns, rows, accent }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-gray-100">{title}</h3>
        <span className="text-xs font-semibold" style={{ color: accent }}>TOP 5</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700/60">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs font-semibold text-white" style={{ backgroundColor: accent }}>
            <tr>
              {columns.map((column) => <th key={column} className="px-3 py-2">{column}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {rows.map((row) => (
              <tr key={row.join('-')}>
                {row.map((cell) => <td key={cell} className="px-3 py-2 text-gray-700 dark:text-gray-200">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
