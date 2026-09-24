import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Download, GripVertical, Save, Settings2 } from 'lucide-react';

import PageShell from './PageShell';
import { excelUploadTemplates } from '../data/excelUploadTemplates';
import { exportUploadTemplateToXlsx } from '../utils/spreadsheetExport';
import { makeImageDataUrl } from '../utils/closingDocumentSettings';

const typeOptions = [
  ['text', '텍스트'], ['number', '숫자'], ['currency', '금액'], ['percent', '백분율'], ['date', '날짜'], ['yearMonth', '연월'], ['formula', '자동 계산'],
];
const editableTemplates = excelUploadTemplates.filter((template) => template.id === 'sales-closing-compare');
const defaultLogo = { dataUrl: '', x: 16, y: 14, width: 160, height: 48, aspectRatio: 160 / 48, lockAspect: true, exportScale: 3 };
const defaultSeal = { dataUrl: '', x: 520, y: 270, width: 64, height: 64, aspectRatio: 1, lockAspect: true, exportScale: 3 };

function inferType(label, calculated) {
  if (calculated) return label.includes('률') ? 'percent' : 'formula';
  if (label.includes('기준월')) return 'yearMonth';
  if (label.includes('일')) return 'date';
  if (/(금액|단가|공급가액|부가세|합계|수량)/.test(label)) return 'currency';
  return 'text';
}

function defaultFormat(type) {
  return ({ currency: '#,##0', percent: '0.0%', date: 'yyyy-mm-dd', yearMonth: 'yyyy-mm' })[type] || '@';
}

function toColumnLabel(index) {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function makeDraft(template) {
  const calculatedIndexes = new Set(Object.keys(template.formulaColumns || {}).map(Number));
  const allColumns = [...template.requiredColumns, ...template.optionalColumns];
  return {
    templateId: template.id,
    title: template.title,
    description: template.description || '',
    primaryColor: template.primaryColor || '#17365D',
    font: 'Noto Sans KR',
    logo: defaultLogo,
    seal: defaultSeal,
    status: 'DRAFT',
    columns: allColumns.map((label, index) => {
      const calculated = calculatedIndexes.has(index + 1);
      const type = inferType(label, calculated);
      return {
        id: `${template.id}-${index}`,
        key: template.id === 'sales-closing-compare'
          ? ['baseMonth', 'previousSupply', 'customer', 'currentSupply', 'changeAmount', 'changeRate'][index]
          : `column-${index}`,
        label,
        required: index < template.requiredColumns.length,
        calculated,
        visible: true,
        dataType: type,
        displayFormat: defaultFormat(type),
        sourceIndex: index,
      };
    }),
  };
}

function normalizeDraft(saved, template) {
  const fallback = makeDraft(template);
  if (!saved) return fallback;
  return {
    ...fallback,
    ...saved,
    logo: { ...defaultLogo, ...(saved.logo || {}) },
    seal: { ...defaultSeal, ...(saved.seal || {}) },
  };
}

function readImageSize(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

async function prepareImageForExcel(image) {
  if (!image?.dataUrl || !/^data:image\/svg\+xml/i.test(image.dataUrl)) return image;
  const source = new Image();
  await new Promise((resolve, reject) => {
    source.onload = resolve;
    source.onerror = reject;
    source.src = image.dataUrl;
  });
  const scale = Math.max(1, Number(image.exportScale) || 3);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return { ...image, dataUrl: canvas.toDataURL('image/png') };
}

function ImagePlacementSetting({ label, value, onChange }) {
  const chooseImage = async () => {
    if (!window.api?.chooseFile || !window.api?.readFileBase64) return;
    const result = await window.api.chooseFile({
      title: `${label} 선택`,
      filters: [{ name: '이미지', extensions: ['svg', 'png', 'jpg', 'jpeg'] }],
    });
    if (result?.canceled || !result.path) return;
    const file = await window.api.readFileBase64(result.path);
    if (file?.ok) {
      const dataUrl = makeImageDataUrl(file.base64, file.fileName);
      const size = await readImageSize(dataUrl);
      const aspectRatio = size?.width && size?.height ? size.width / size.height : value.aspectRatio;
      onChange({ ...value, dataUrl, aspectRatio, height: value.lockAspect ? Math.round(value.width / aspectRatio) : value.height });
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-gray-800 dark:text-gray-100">{label}</p><div className="flex gap-1"><button className="btn btn-secondary h-8 px-2 text-xs" type="button" onClick={chooseImage}>등록/변경</button>{value.dataUrl && <button className="btn btn-secondary h-8 px-2 text-xs" type="button" onClick={() => onChange({ ...value, dataUrl: '' })}>삭제</button>}</div></div>
      <div className="mt-3 flex h-20 items-center justify-center rounded bg-gray-50 dark:bg-gray-900/30">{value.dataUrl ? <img className="max-h-16 max-w-full object-contain" src={value.dataUrl} alt={`${label} 미리보기`} /> : <span className="text-xs text-gray-400">등록된 이미지 없음</span>}</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label><span className="mb-1 block text-[11px] font-semibold text-gray-500">X 좌표</span><input className="form-input h-9 w-full" type="number" min="0" value={value.x} onChange={(e) => onChange({ ...value, x: Math.max(0, Number(e.target.value)) })} /></label>
        <label><span className="mb-1 block text-[11px] font-semibold text-gray-500">Y 좌표</span><input className="form-input h-9 w-full" type="number" min="0" value={value.y} onChange={(e) => onChange({ ...value, y: Math.max(0, Number(e.target.value)) })} /></label>
        <label><span className="mb-1 block text-[11px] font-semibold text-gray-500">너비</span><input className="form-input h-9 w-full" type="number" min="24" max="500" value={value.width} onChange={(e) => { const width = Math.max(24, Number(e.target.value)); onChange({ ...value, width, height: value.lockAspect ? Math.round(width / value.aspectRatio) : value.height }); }} /></label>
        <label><span className="mb-1 block text-[11px] font-semibold text-gray-500">높이</span><input className="form-input h-9 w-full" type="number" min="24" max="300" value={value.height} onChange={(e) => { const height = Math.max(24, Number(e.target.value)); onChange({ ...value, height, width: value.lockAspect ? Math.round(height * value.aspectRatio) : value.width }); }} /></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300"><input type="checkbox" checked={value.lockAspect} onChange={(e) => onChange({ ...value, lockAspect: e.target.checked, height: e.target.checked ? Math.round(value.width / value.aspectRatio) : value.height })} />원본 비율 유지</label>
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">Excel 출력 품질<select className="form-select h-8 text-xs" value={value.exportScale} onChange={(e) => onChange({ ...value, exportScale: Number(e.target.value) })}><option value="2">2배</option><option value="3">3배</option><option value="4">4배</option></select></label>
      </div>
    </div>
  );
}

function DraggablePreviewImage({ label, image, containerRef, onChange }) {
  const startDrag = (event) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = image.x;
    const originY = image.y;
    const bounds = container.getBoundingClientRect();
    const move = (moveEvent) => {
      const x = Math.min(Math.max(0, originX + moveEvent.clientX - startX), Math.max(0, bounds.width - image.width));
      const y = Math.min(Math.max(0, originY + moveEvent.clientY - startY), Math.max(0, bounds.height - image.height));
      onChange({ ...image, x: Math.round(x), y: Math.round(y) });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  return (
    <button
      type="button"
      className="absolute z-10 cursor-move rounded border border-dashed border-teal-500 bg-white/30 p-0.5 shadow-sm hover:ring-2 hover:ring-teal-300"
      style={{ left: image.x, top: image.y, width: image.width, height: image.height, touchAction: 'none' }}
      onPointerDown={startDrag}
      title={`${label} — 드래그하여 이동`}
    >
      <img className={`pointer-events-none h-full w-full select-none ${image.lockAspect ? 'object-contain' : 'object-fill'}`} src={image.dataUrl} alt={label} draggable={false} />
    </button>
  );
}

function validateDraft(draft) {
  const errors = [];
  const visible = draft.columns.filter((column) => column.visible);
  if (!draft.title.trim()) errors.push('양식명을 입력해 주세요.');
  if (visible.length === 0) errors.push('표시할 칼럼이 하나 이상 필요합니다.');
  if (draft.columns.some((column) => column.required && !column.visible)) errors.push('필수 입력 칼럼은 숨길 수 없습니다.');
  const names = visible.map((column) => column.label.trim());
  if (names.some((name) => !name)) errors.push('빈 칼럼명이 있습니다.');
  if (new Set(names).size !== names.length) errors.push('중복된 칼럼명이 있습니다.');
  const keys = new Set(visible.map((column) => column.key));
  if (keys.has('changeAmount') || keys.has('changeRate')) {
    if (!keys.has('previousSupply') || !keys.has('currentSupply')) errors.push('자동 계산에는 전월·해당월 공급가액 칼럼이 필요합니다.');
  }
  return errors;
}

export default function TemplateSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const templateId = searchParams.get('template') || editableTemplates[0].id;
  const template = editableTemplates.find((item) => item.id === templateId) || editableTemplates[0];
  const [draft, setDraft] = useState(() => makeDraft(template));
  const [notice, setNotice] = useState('초안으로 저장한 뒤 검증하고 기본양식으로 적용할 수 있습니다.');
  const [dragColumnIndex, setDragColumnIndex] = useState(null);
  const previewRef = useRef(null);
  const errors = useMemo(() => validateDraft(draft), [draft]);
  const visibleColumns = draft.columns.filter((column) => column.visible);

  useEffect(() => {
    let active = true;
    window.api?.getAppSettings?.().then((result) => {
      if (!active) return;
      const saved = result?.settings?.formTemplateDrafts?.[template.id];
      setDraft(normalizeDraft(saved, template));
    });
    return () => { active = false; };
  }, [template]);

  const update = (patch) => setDraft((current) => ({ ...current, ...patch, status: 'DRAFT' }));
  const updateColumn = (id, patch) => setDraft((current) => ({
    ...current,
    status: 'DRAFT',
    columns: current.columns.map((column) => column.id === id ? { ...column, ...patch } : column),
  }));
  const moveColumn = (index, direction) => setDraft((current) => {
    const to = index + direction;
    if (to < 0 || to >= current.columns.length) return current;
    const columns = [...current.columns];
    [columns[index], columns[to]] = [columns[to], columns[index]];
    return { ...current, status: 'DRAFT', columns };
  });
  const moveColumnTo = (fromIndex, toIndex) => {
    if (fromIndex === null || fromIndex === toIndex) return;
    setDraft((current) => {
      const columns = [...current.columns];
      const [moved] = columns.splice(fromIndex, 1);
      columns.splice(toIndex, 0, moved);
      return { ...current, status: 'DRAFT', columns };
    });
    setDragColumnIndex(null);
    setNotice('칼럼 순서를 변경했습니다.');
  };

  const persist = async (nextDraft, applied = false) => {
    if (!window.api?.getAppSettings || !window.api?.saveAppSettings) {
      setNotice('Electron 데스크톱 앱에서만 저장할 수 있습니다.');
      return false;
    }
    const current = await window.api.getAppSettings();
    const settings = current?.settings || {};
    const previous = settings.formTemplateDrafts?.[template.id];
    const versions = applied
      ? [{ savedAt: new Date().toISOString(), draft: nextDraft }, ...(settings.formTemplateVersions?.[template.id] || [])].slice(0, 5)
      : (settings.formTemplateVersions?.[template.id] || []);
    const result = await window.api.saveAppSettings({
      ...settings,
      formTemplateDrafts: { ...(settings.formTemplateDrafts || {}), [template.id]: nextDraft },
      formTemplateVersions: { ...(settings.formTemplateVersions || {}), [template.id]: versions },
      formTemplatePrevious: { ...(settings.formTemplatePrevious || {}), [template.id]: previous || null },
    });
    if (!result?.ok) throw new Error(result?.message || '저장에 실패했습니다.');
    return true;
  };

  const saveDraft = async () => {
    try {
      if (await persist({ ...draft, status: 'DRAFT' })) setNotice('초안을 저장했습니다.');
    } catch (error) { setNotice(error.message); }
  };

  const applyDraft = async () => {
    if (errors.length) { setNotice(errors[0]); return; }
    const next = { ...draft, status: 'ACTIVE', appliedAt: new Date().toISOString() };
    try {
      if (await persist(next, true)) { setDraft(next); setNotice('검증을 통과해 기본양식으로 적용했습니다.'); }
    } catch (error) { setNotice(error.message); }
  };

  const download = async () => {
    if (errors.length) { setNotice(errors[0]); return; }
    const ordered = draft.columns.filter((column) => column.visible);
    const sampleRows = (template.sampleRows || []).map((row) => ordered.map((column) => row[column.sourceIndex] ?? null));
    const formulaColumns = {};
    const columnNumberFormats = {};
    let changeAmountColumn;
    let changeRateColumn;
    const previousIndex = ordered.findIndex((column) => column.key === 'previousSupply');
    const currentIndex = ordered.findIndex((column) => column.key === 'currentSupply');
    if (previousIndex >= 0 && currentIndex >= 0) {
      const previousLetter = toColumnLabel(previousIndex);
      const currentLetter = toColumnLabel(currentIndex);
      ordered.forEach((column, index) => {
        columnNumberFormats[index + 1] = column.displayFormat;
        if (column.key === 'changeAmount') {
          formulaColumns[index + 1] = (row) => `=${currentLetter}${row}-${previousLetter}${row}`;
          changeAmountColumn = toColumnLabel(index);
        }
        if (column.key === 'changeRate') {
          formulaColumns[index + 1] = (row) => `=IF(${previousLetter}${row}=0,IF(${currentLetter}${row}=0,0,1),${currentLetter}${row}/${previousLetter}${row}-1)`;
          changeRateColumn = toColumnLabel(index);
        }
      });
    }
    const [logo, seal] = await Promise.all([prepareImageForExcel(draft.logo), prepareImageForExcel(draft.seal)]);
    const result = await exportUploadTemplateToXlsx({
      ...template,
      title: draft.title,
      description: draft.description,
      primaryColor: draft.primaryColor,
      logo,
      seal,
      requiredColumns: ordered.map((column) => column.label),
      optionalColumns: [],
      sampleRows,
      formulaColumns: Object.keys(formulaColumns).length ? formulaColumns : undefined,
      columnNumberFormats,
      changeAmountColumn,
      changeRateColumn,
    });
    setNotice(`${result.fileName} 파일을 생성했습니다.`);
  };

  return (
    <PageShell title="양식 설정" description="신규 양식의 공통 서식, 필수·선택 칼럼, 순서와 데이터 형식을 설정합니다.">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-center gap-3">
          <select className="form-select" value={template.id} onChange={(event) => setSearchParams({ template: event.target.value })}>
            {editableTemplates.map((item) => <option key={item.id} value={item.id}>{item.title} · 신규 양식</option>)}
          </select>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${draft.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{draft.status === 'ACTIVE' ? '기본양식' : '편집 중'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" type="button" onClick={download}><Download size={15} />미리보기 다운로드</button>
          <button className="btn btn-secondary" type="button" onClick={saveDraft}><Save size={15} />초안 저장</button>
          <button className="btn btn-primary" type="button" onClick={applyDraft}><CheckCircle2 size={15} />기본양식으로 적용</button>
        </div>
      </div>
      <p className="mb-4 text-sm text-gray-500">{notice}</p>

      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(720px,1.05fr)_minmax(560px,0.95fr)]">
        <div className="space-y-4">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">공통 서식</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label><span className="mb-1 block text-xs font-semibold text-gray-500">양식명</span><input className="form-input w-full" value={draft.title} onChange={(e) => update({ title: e.target.value })} /></label>
              <label><span className="mb-1 block text-xs font-semibold text-gray-500">글꼴</span><select className="form-select w-full" value={draft.font} onChange={(e) => update({ font: e.target.value })}><option>Noto Sans KR</option><option>Pretendard</option><option>Malgun Gothic</option></select></label>
              <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-gray-500">안내 문구</span><textarea className="form-textarea w-full" rows="3" value={draft.description} onChange={(e) => update({ description: e.target.value })} /></label>
              <label><span className="mb-1 block text-xs font-semibold text-gray-500">대표 색상</span><div className="flex gap-2"><input type="color" className="h-10 w-14" value={draft.primaryColor} onChange={(e) => update({ primaryColor: e.target.value })} /><input className="form-input flex-1" value={draft.primaryColor} onChange={(e) => update({ primaryColor: e.target.value })} /></div></label>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">로고 및 직인</h2>
            <p className="mt-1 text-xs text-gray-500">오른쪽 미리보기에서 직접 드래그하거나 X·Y 좌표와 크기를 숫자로 조절할 수 있습니다.</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <ImagePlacementSetting label="회사 로고" value={draft.logo} onChange={(logo) => update({ logo })} />
              <ImagePlacementSetting label="직인" value={draft.seal} onChange={(seal) => update({ seal })} />
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-2"><Settings2 size={18} className="text-teal-600" /><h2 className="font-bold text-gray-900 dark:text-gray-100">칼럼 설정</h2></div>
            <div className="mt-4 space-y-2 overflow-x-auto pb-1">
              <div className="grid min-w-[690px] grid-cols-[24px_24px_minmax(140px,1fr)_112px_112px_118px_62px] gap-2 px-2.5 text-[11px] font-semibold text-gray-400">
                <span /><span>표시</span><span>칼럼명</span><span>구분</span><span>데이터 형식</span><span>표시 형식</span><span className="text-right">이동</span>
              </div>
              {draft.columns.map((column, index) => (
                <div
                  key={column.id}
                  className={`grid min-w-[690px] grid-cols-[24px_24px_minmax(140px,1fr)_112px_112px_118px_62px] items-center gap-2 rounded-lg border bg-gray-50 p-2.5 transition dark:bg-gray-900/30 ${dragColumnIndex === index ? 'border-teal-400 opacity-60' : 'border-gray-200 dark:border-gray-700'}`}
                  draggable
                  onDragStart={() => setDragColumnIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => moveColumnTo(dragColumnIndex, index)}
                  onDragEnd={() => setDragColumnIndex(null)}
                >
                  <GripVertical size={17} className="cursor-grab text-gray-400 active:cursor-grabbing" />
                  <input type="checkbox" checked={column.visible} onChange={(e) => updateColumn(column.id, { visible: e.target.checked })} />
                  <input className="form-input h-9" value={column.label} onChange={(e) => updateColumn(column.id, { label: e.target.value })} />
                  {column.calculated ? (
                    <span className="truncate rounded bg-amber-50 px-2 py-2 text-center text-[11px] font-semibold text-amber-600">자동 계산</span>
                  ) : (
                    <select className="form-select h-9 text-xs" value={column.required ? 'required' : 'optional'} onChange={(e) => updateColumn(column.id, { required: e.target.value === 'required' })}>
                      <option value="required">필수 칼럼</option>
                      <option value="optional">선택 칼럼</option>
                    </select>
                  )}
                  <select className="form-select h-9" value={column.dataType} onChange={(e) => updateColumn(column.id, { dataType: e.target.value, displayFormat: defaultFormat(e.target.value) })}>{typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  <input className="form-input h-9 font-mono text-xs" value={column.displayFormat} onChange={(e) => updateColumn(column.id, { displayFormat: e.target.value })} />
                  <div className="flex justify-end gap-1"><button type="button" className="rounded p-1 text-gray-500 hover:bg-white" onClick={() => moveColumn(index, -1)} disabled={index === 0}><ChevronUp size={15} /></button><button type="button" className="rounded p-1 text-gray-500 hover:bg-white" onClick={() => moveColumn(index, 1)} disabled={index === draft.columns.length - 1}><ChevronDown size={15} /></button></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky top-4 space-y-4">
          <section ref={previewRef} className="relative min-h-[360px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700 dark:bg-gray-800">
            {draft.logo.dataUrl && <DraggablePreviewImage label="회사 로고" image={draft.logo} containerRef={previewRef} onChange={(logo) => update({ logo })} />}
            {draft.seal.dataUrl && <DraggablePreviewImage label="직인" image={draft.seal} containerRef={previewRef} onChange={(seal) => update({ seal })} />}
            <div className="px-5 py-4 text-white" style={{ backgroundColor: draft.primaryColor }}><p className="text-xs opacity-80">EXCEL TEMPLATE</p><h2 className="mt-1 text-xl font-bold">{draft.title}</h2></div>
            <div className="p-5"><p className="rounded bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-900/30 dark:text-gray-300">{draft.description || '안내 문구가 표시됩니다.'}</p><div className="mt-4 overflow-x-auto"><table className="min-w-full text-xs"><thead><tr style={{ backgroundColor: draft.primaryColor }} className="text-white">{visibleColumns.map((column) => <th key={column.id} className="whitespace-nowrap px-3 py-2">{column.label}</th>)}</tr></thead><tbody><tr>{visibleColumns.map((column) => <td key={column.id} className="whitespace-nowrap border-b px-3 py-2 text-gray-500">{column.dataType === 'currency' ? '100,000' : column.dataType === 'percent' ? '12.5%' : '샘플'}</td>)}</tr></tbody></table></div></div>
          </section>
          <section className={`rounded-lg border p-4 ${errors.length ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
            <div className="flex items-center gap-2">{errors.length ? <AlertTriangle size={18} className="text-amber-600" /> : <CheckCircle2 size={18} className="text-green-600" />}<h2 className="font-bold text-gray-900">다운로드 전 검증</h2></div>
            {errors.length ? <ul className="mt-2 space-y-1 text-sm text-amber-800">{errors.map((error) => <li key={error}>· {error}</li>)}</ul> : <p className="mt-2 text-sm text-green-700">필수 구조와 칼럼 설정이 정상입니다.</p>}
          </section>
        </div>
      </div>
    </PageShell>
  );
}
