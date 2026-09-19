import React, { useEffect, useState } from 'react';

import PageShell from './PageShell';
import {
  CLOSING_COLUMNS,
  defaultClosingDocumentSettings,
  normalizeClosingDocumentSettings,
  makeImageDataUrl,
} from '../utils/closingDocumentSettings';

  const PREVIEW_TARGET = {
    company: '(주)거래처명',
    taxStatus: '과세',
    salesAmount: 12500000,
    taxAmount: 1250000,
  };

function ImageSetting({ label, value, onChange }) {
  const selectImage = async () => {
    if (!window.api?.chooseFile || !window.api?.readFileBase64) return;
    const result = await window.api.chooseFile({
      title: `${label} 선택`,
      filters: [{ name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'svg'] }],
    });
    if (result?.canceled || !result.path) return;
    const file = await window.api.readFileBase64(result.path);
    if (file?.ok) onChange(makeImageDataUrl(file.base64, file.fileName));
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{label}</p>
        <div className="flex gap-2">
          <button className="btn btn-secondary h-8 px-2.5 text-xs" type="button" onClick={selectImage}>등록/변경</button>
          {value && <button className="btn btn-secondary h-8 px-2.5 text-xs" type="button" onClick={() => onChange('')}>삭제</button>}
        </div>
      </div>
      <div className="mt-3 flex h-20 items-center justify-center rounded-md bg-gray-50 p-2 dark:bg-gray-900/40">
        {value ? <img className="max-h-full max-w-full object-contain" src={value} alt={`${label} 미리보기`} /> : <span className="text-xs text-gray-400">등록된 이미지 없음</span>}
      </div>
    </div>
  );
}

function Preview({ settings, target }) {
  const visibleColumns = CLOSING_COLUMNS.filter(
    (column) => settings.visibleColumns[column.key]
  );

  return (
    <section className="sticky top-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">

      {/* 상단 */}
      <div className="mb-3 flex items-start justify-between gap-3 border-b pb-3 dark:border-gray-700">
        {settings.logoDataUrl ? (
          <img
            className="h-10 max-w-28 object-contain"
            src={settings.logoDataUrl}
            alt="회사 로고"
          />
        ) : (
          <span className="text-xs text-gray-400">회사 로고</span>
        )}

        <div className="text-right">
          <p className="text-xs text-gray-500">매출마감장</p>

          <h2
            className="text-lg font-bold"
            style={{ color: settings.primaryColor }}
          >
            {target?.company || '거래처명'}
          </h2>
        </div>
      </div>

      {/* 금액 요약 */}
      <div
        className="rounded-md p-3"
        style={{
          backgroundColor: `${settings.primaryColor}12`,
          borderLeft: `4px solid ${settings.primaryColor}`,
        }}
      >
        <p className="text-xs text-gray-500">
          2026년 9월 매출 마감장 · 일반 과세
        </p>

        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {['공급가액', '부가세', '합계'].map((label, index) => (
            <div key={label}>
              <p className="text-[11px] text-gray-500">
                {label}
              </p>

              <p
                className="text-sm font-bold"
                style={{ color: settings.primaryColor }}
              >
                {
                  [
                    '12,500,000원',
                    '1,250,000원',
                    '13,750,000원',
                  ][index]
                }
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 매출 상세 */}
      <div className="mt-3 overflow-hidden rounded-md border dark:border-gray-700">

        <div
          className="grid gap-1 px-2 py-2 text-[10px] font-bold text-white"
          style={{
            gridTemplateColumns: `repeat(${Math.min(
              visibleColumns.length,
              5
            )}, minmax(0, 1fr))`,
            backgroundColor: settings.primaryColor,
          }}
        >
          {visibleColumns.slice(0, 5).map((column) => (
            <span key={column.key} className="truncate">
              {column.label}
            </span>
          ))}
        </div>

        <div className="space-y-1 p-2 text-[10px] text-gray-500">
          <div className="grid grid-cols-5 gap-1">
            <span>한빛유통</span>
            <span>CUST-001</span>
            <span>A4 복사용지</span>
            <span>10</span>
            <span>245,000원</span>
          </div>

          <div className="grid grid-cols-5 gap-1">
            <span>세종오피스</span>
            <span>CUST-002</span>
            <span>토너</span>
            <span>2</span>
            <span>156,000원</span>
          </div>
        </div>
      </div>

      {/* 직인 */}
      {settings.sealDataUrl && (
        <div className="mt-4 flex justify-end border-t pt-3 dark:border-gray-700">
          <img
            className="h-12 w-12 object-contain"
            src={settings.sealDataUrl}
            alt="직인"
          />
        </div>
      )}

    </section>
  );
}

export default function ClosingDocumentSettingsPage() {
  const [settings, setSettings] = useState(defaultClosingDocumentSettings);
  const [notice, setNotice] = useState('설정은 저장 후 다음 매출마감 생성부터 자동 적용됩니다.');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    window.api?.getAppSettings?.().then((result) => {
      if (active && result?.settings) setSettings(normalizeClosingDocumentSettings(result.settings.closingDocument));
    });
    return () => { active = false; };
  }, []);

  const update = (patch) => setSettings((current) => ({ ...current, ...patch }));
  const updateManager = (key, value) => setSettings((current) => ({ ...current, manager: { ...current.manager, [key]: value } }));
  const save = async () => {
    if (!window.api?.getAppSettings || !window.api?.saveAppSettings) {
      setNotice('Electron 데스크톱 앱에서만 설정을 저장할 수 있습니다.');
      return;
    }
    setIsSaving(true);
    try {
      const current = await window.api.getAppSettings();
      const result = await window.api.saveAppSettings({ ...(current?.settings || {}), closingDocument: normalizeClosingDocumentSettings(settings) });
      if (!result?.ok) throw new Error(result?.message || '설정 저장에 실패했습니다.');
      setSettings(normalizeClosingDocumentSettings(result.settings?.closingDocument));
      setNotice('매출마감장 설정을 저장했습니다.');
    } catch (error) {
      setNotice(error?.message || '설정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageShell title="매출마감장 설정" description="회사 정보와 문서 표시 항목을 정하고 Excel, PDF, 메일에 함께 적용합니다.">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(480px,0.9fr)_minmax(600px,1.1fr)]">
        <div className="space-y-4">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
           <div className="flex items-center justify-between gap-3"><p className="text-sm text-gray-500">{notice}</p><button className="btn btn-primary" type="button" onClick={save} disabled={isSaving}>{isSaving ? '저장 중...' : '설정 저장'}</button></div>

            <h2 className="font-bold text-gray-900 dark:text-gray-100">브랜딩 및 이미지</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-500">회사 대표 색상</span><div className="flex gap-2"><input className="h-10 w-14 cursor-pointer" type="color" value={settings.primaryColor} onChange={(event) => update({ primaryColor: event.target.value })} /><input className="form-input flex-1" value={settings.primaryColor} onChange={(event) => update({ primaryColor: event.target.value })} /></div></label>
              <div className="sm:col-span-1" />
              <ImageSetting label="회사 로고" value={settings.logoDataUrl} onChange={(logoDataUrl) => update({ logoDataUrl })} />
              <ImageSetting label="대표자 직인" value={settings.sealDataUrl} onChange={(sealDataUrl) => update({ sealDataUrl })} />
            </div>
          </section>
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">표시 컬럼</h2>
            <p className="mt-1 text-xs text-gray-500">컬럼 순서와 데이터 구조는 고정되며, 출력 시 표시 여부만 바뀝니다.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">{CLOSING_COLUMNS.map((column) => <label key={column.key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" checked={Boolean(settings.visibleColumns[column.key])} onChange={(event) => update({ visibleColumns: { ...settings.visibleColumns, [column.key]: event.target.checked } })} />{column.label}</label>)}</div>
          </section>
        
        </div>
        <Preview
          settings={settings}
          target={PREVIEW_TARGET}
        />
      </div>
    </PageShell>
  );
}
