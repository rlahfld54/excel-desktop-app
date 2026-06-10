import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';
import { getCurrentUser } from '../utils/authSession';
import { makeSignatureText } from '../utils/businessCard';

const fallbackTemplates = [
  {
    templateId: 1,
    templateName: '거래처 검수 협조 요청',
    channel: 'EMAIL',
    subjectTemplate: '[확인 요청] {{closing_month}} 매출 자료 검수 협조 요청드립니다',
    bodyTemplate: '안녕하세요. {{customer_name}} 담당자님.\n\n첨부드린 {{closing_month}} 매출 자료 중 확인이 필요한 항목이 있어 공유드립니다. 바쁘시겠지만 첨부 파일을 확인하신 뒤 수정이 필요한 내용이나 추가로 맞춰야 할 기준이 있다면 회신 부탁드립니다.\n\n확인 부탁드립니다.\n감사합니다.',
    tone: 'COOPERATIVE',
    status: 'ACTIVE',
    updatedAt: '-',
  },
  {
    templateId: 2,
    templateName: '첨부 파일 재확인 요청',
    channel: 'EMAIL',
    subjectTemplate: '[재확인 요청] {{customer_name}} 첨부 자료 확인 부탁드립니다',
    bodyTemplate: '안녕하세요. {{customer_name}} 담당자님.\n\n공유드린 자료 중 일부 항목의 기준값이 맞지 않아 재확인을 요청드립니다. 첨부 파일의 표시된 행을 확인하신 뒤, 실제 적용해야 할 거래처 코드와 품목 기준을 알려주시면 마감 자료에 반영하겠습니다.\n\n감사합니다.',
    tone: 'POLITE',
    status: 'ACTIVE',
    updatedAt: '-',
  },
  {
    templateId: 3,
    templateName: '마감 확인 완료 안내',
    channel: 'EMAIL',
    subjectTemplate: '[확인 완료] {{closing_month}} 매출 자료 검수 완료 안내',
    bodyTemplate: '안녕하세요. {{customer_name}} 담당자님.\n\n{{closing_month}} 매출 자료 검수가 완료되어 안내드립니다. 추가 확인이 필요한 항목은 현재 없으며, 이후 마감 기준 변경이나 정정 요청이 발생하면 별도로 공유드리겠습니다.\n\n협조해주셔서 감사합니다.',
    tone: 'THANKS',
    status: 'ACTIVE',
    updatedAt: '-',
  },
];

const previewValues = {
  customer_name: '한빛유통',
  closing_month: '2026-05',
};

function applyPreviewValues(text) {
  return Object.entries(previewValues).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    text ?? '',
  );
}

function toneLabel(tone) {
  const labels = {
    COOPERATIVE: '협조 요청',
    POLITE: '정중',
    THANKS: '감사 안내',
  };

  return labels[tone] ?? tone;
}

function statusClass(status) {
  if (status === 'ACTIVE') {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
  }

  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
}

export default function MessageTemplatesPage() {
  const currentUser = getCurrentUser();
  const [templates, setTemplates] = useState(fallbackTemplates);
  const [selectedId, setSelectedId] = useState(fallbackTemplates[0].templateId);
  const [loadState, setLoadState] = useState('브라우저 미리보기');
  const [copyState, setCopyState] = useState('');

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.templateId === selectedId) ?? templates[0],
    [selectedId, templates],
  );

  const previewSubject = applyPreviewValues(selectedTemplate?.subjectTemplate);
  const previewBody = `${applyPreviewValues(selectedTemplate?.bodyTemplate)}${makeSignatureText(currentUser)}`;

  const loadTemplates = async () => {
    if (!window.api?.getMessageTemplates) {
      setTemplates(fallbackTemplates);
      setSelectedId(fallbackTemplates[0].templateId);
      setLoadState('브라우저 미리보기');
      return;
    }

    try {
      const result = await window.api.getMessageTemplates();
      const nextTemplates = result.templates?.length ? result.templates : fallbackTemplates;
      setTemplates(nextTemplates);
      setSelectedId(nextTemplates[0].templateId);
      setLoadState('SQLite 연결됨');
    } catch (error) {
      setTemplates(fallbackTemplates);
      setSelectedId(fallbackTemplates[0].templateId);
      setLoadState(`SQLite 확인 필요: ${error.message}`);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCopy = async () => {
    const text = `${previewSubject}\n\n${previewBody}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopyState('미리보기 문구를 복사했습니다.');
    } catch {
      setCopyState('브라우저 권한 때문에 복사하지 못했습니다.');
    }
  };

  return (
    <PageShell title="문구 템플릿" description="거래처 확인 요청에 사용할 제목, 본문, 말투, 변수 적용 결과를 한 화면에서 확인합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Message templates</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
              {templates.length.toLocaleString('ko-KR')}개 템플릿 / {loadState}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              변수: {'{{customer_name}}'}, {'{{closing_month}}'} · 메일 하단 명함 자동 포함
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={loadTemplates}>
              새로고침
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleCopy}>
              미리보기 복사
            </button>
            <button className="btn btn-primary" type="button">
              템플릿 추가
            </button>
          </div>
        </div>
      </section>

      {copyState && (
        <section className="mb-4 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-300">
          {copyState}
        </section>
      )}

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-5">
          <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">템플릿 목록</h2>
          </header>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {templates.map((template) => {
              const selected = template.templateId === selectedTemplate.templateId;

              return (
                <button
                  key={template.templateId}
                  className={`flex w-full flex-col gap-2 px-4 py-3 text-left transition ${selected ? 'bg-accent-50 dark:bg-accent-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-900/30'}`}
                  type="button"
                  onClick={() => setSelectedId(template.templateId)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{template.templateName}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(template.status)}`}>
                      {template.status}
                    </span>
                  </div>
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400">{template.subjectTemplate}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span>{template.channel}</span>
                    <span>{toneLabel(template.tone)}</span>
                    <span>{template.updatedAt}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="col-span-12 rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-7">
          <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">상세 미리보기</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedTemplate.templateName}</p>
              </div>
              <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                {toneLabel(selectedTemplate.tone)}
              </span>
            </div>
          </header>

          <div className="space-y-4 p-4">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">제목 템플릿</p>
              <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 dark:border-gray-700/60 dark:bg-gray-900/30 dark:text-gray-100">
                {selectedTemplate.subjectTemplate}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">본문 템플릿</p>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-700 no-scrollbar dark:border-gray-700/60 dark:bg-gray-900/30 dark:text-gray-200">
                {selectedTemplate.bodyTemplate}
              </pre>
            </div>

            <div className="rounded-lg border border-accent-200 bg-accent-50/70 p-4 dark:border-accent-500/30 dark:bg-accent-500/10">
              <p className="text-xs font-semibold uppercase text-accent-700 dark:text-accent-300">적용 예시</p>
              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{previewSubject}</p>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-200">
                {previewBody}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
