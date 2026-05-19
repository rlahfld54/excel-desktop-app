import React, { useMemo, useState } from 'react';

import PageShell from './PageShell';
import { addActivityLog } from '../utils/authSession';
import {
  createEmptyReportTemplate,
  readReportTemplates,
  saveReportTemplates,
} from '../data/reportTemplates';

export default function ReportTemplatesPage() {
  const [templates, setTemplates] = useState(() => readReportTemplates());
  const [selectedId, setSelectedId] = useState(templates[0]?.id);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? templates[0],
    [selectedId, templates]
  );
  const [draft, setDraft] = useState(() => selectedTemplate);

  const selectTemplate = (template) => {
    setSelectedId(template.id);
    setDraft(template);
  };

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateSection = (index, value) => {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) => (sectionIndex === index ? value : section)),
    }));
  };

  const addSection = () => {
    setDraft((current) => ({ ...current, sections: [...current.sections, '새 섹션'] }));
  };

  const handleNewTemplate = () => {
    const next = createEmptyReportTemplate();
    setTemplates((current) => [next, ...current]);
    setSelectedId(next.id);
    setDraft(next);
    addActivityLog('INFO', '보고서 템플릿 추가', '새 템플릿');
  };

  const handleSave = () => {
    const nextTemplates = templates.map((template) => (template.id === draft.id ? draft : template));
    const saved = saveReportTemplates(nextTemplates);
    setTemplates(saved);
    setDraft(saved.find((template) => template.id === draft.id));
    addActivityLog('INFO', '보고서 템플릿 저장', draft.title);
  };

  return (
    <PageShell title="보고서 템플릿" description="보고서 작성 화면에서 사용할 회사 공통 양식, 포인트 색상, 표 스타일, 섹션 구성을 설정합니다.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" type="button" onClick={handleNewTemplate}>템플릿 추가</button>
        <button className="btn btn-secondary" type="button" onClick={handleSave}>설정 저장</button>
        <span className="text-sm text-gray-500 dark:text-gray-400">저장한 설정은 보고서 작성 화면에 바로 반영됩니다.</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">템플릿 목록</h2>
          <div className="mt-4 space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                className={`w-full rounded-lg border p-3 text-left transition ${selectedTemplate?.id === template.id ? 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-500/10' : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20'}`}
                type="button"
                onClick={() => selectTemplate(template)}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{template.title}</p>
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: template.color }} aria-hidden="true" />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{template.purpose}</p>
                <p className="mt-2 text-xs font-semibold text-gray-400 dark:text-gray-500">{template.tableStyle} · {template.status}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">Template Settings</p>
              <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{draft.title}</h2>
            </div>
            <span className="rounded px-2 py-1 text-xs font-semibold text-white" style={{ backgroundColor: draft.color }}>{draft.status}</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">템플릿명</span>
              <input className="form-input w-full" value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">상태</span>
              <select className="form-select w-full" value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
                <option>사용 중</option>
                <option>초안</option>
                <option>보관</option>
              </select>
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">보고 목적</span>
              <textarea className="form-textarea w-full" rows="3" value={draft.purpose} onChange={(event) => updateDraft('purpose', event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">포인트 색상</span>
              <div className="flex items-center gap-2">
                <input className="h-10 w-14 rounded border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900" type="color" value={draft.color} onChange={(event) => updateDraft('color', event.target.value)} />
                <input className="form-input w-full font-mono" value={draft.color} onChange={(event) => updateDraft('color', event.target.value)} />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">보고서 폰트</span>
              <select className="form-select w-full" value={draft.font} onChange={(event) => updateDraft('font', event.target.value)}>
                <option>Pretendard</option>
                <option>Noto Sans KR</option>
                <option>Malgun Gothic</option>
                <option>Inter</option>
              </select>
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">표 스타일</span>
              <select className="form-select w-full" value={draft.tableStyle} onChange={(event) => updateDraft('tableStyle', event.target.value)}>
                <option>헤더 강조형</option>
                <option>비율 막대형</option>
                <option>상태 배지형</option>
                <option>예산 비교형</option>
              </select>
            </label>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">보고서 섹션</h3>
              <button className="rounded border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300" type="button" onClick={addSection}>섹션 추가</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {draft.sections.map((section, index) => (
                <label key={`${draft.id}-${index}`} className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">섹션 {index + 1}</span>
                  <input className="form-input w-full" value={section} onChange={(event) => updateSection(index, event.target.value)} />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700/60">
            <div className="px-5 py-4 text-white" style={{ backgroundColor: draft.color }}>
              <p className="text-sm font-semibold opacity-90">애스터웍스 · 총무팀</p>
              <h3 className="mt-1 text-xl font-bold">{draft.title}</h3>
            </div>
            <div className="p-5" style={{ fontFamily: `${draft.font}, Pretendard, sans-serif` }}>
              <p className="text-sm text-gray-600 dark:text-gray-300">{draft.purpose}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {draft.sections.map((section) => (
                  <div key={section} className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-gray-700/60">
                    {section}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
