import React, { useMemo, useState } from 'react';

import { Modal, StatusBadge } from '../components/common';
import PageShell from './PageShell';
import { addNotification } from '../utils/appNotifications';

const emptyMasterData = {
  customers: [],
  products: [],
  productAliases: [],
  prices: [],
  suggestions: [],
  contacts: [],
};

function formatPercent(value) {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

function formatPrice(value) {
  return Number(value ?? 0).toLocaleString('ko-KR');
}

function MetricCard({ label, value, detail }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </section>
  );
}

function DataTable({ title, columns, rows, emptyText }) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{rows.length.toLocaleString('ko-KR')}건</span>
      </header>
      <div className="max-h-72 overflow-auto no-scrollbar">
        <table className="min-w-[720px] w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((column) => (
                <th key={column.label} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={columns.length}>{emptyText}</td>
              </tr>
            ) : rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`} className="group">
                {columns.map((column) => (
                  <td key={column.label} className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-200 dark:group-hover:bg-accent-500/10">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const sourceOptions = [
  { value: 'SALES_UPLOAD', label: '매출 업로드' },
  { value: 'CONTACT_UPLOAD', label: '연락처 업로드' },
  { value: 'MANUAL', label: '직접 등록' },
];

const emptyAliasForm = {
  sourceType: 'SALES_UPLOAD',
  sourceCustomerCode: '',
  sourceCustomerName: '',
  customerId: '',
  customerCode: '',
  customerName: '',
  status: 'ACTIVE',
};

function sourceLabel(value) {
  return sourceOptions.find((option) => option.value === value)?.label ?? value;
}

export default function CodeMappingPage() {
  const [masterData, setMasterData] = useState(emptyMasterData);
  const [loadState, setLoadState] = useState('조회 버튼을 눌러 SQLite 기준 데이터를 불러오세요.');
  const [activeView, setActiveView] = useState('customers');
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('masterData');
  // UI 1단계 테스트용 임시 state. 다음 단계에서 SQLite customer_alias_mappings CRUD로 교체한다.
  const [customerAliases, setCustomerAliases] = useState([]);
  const [aliasSearch, setAliasSearch] = useState('');
  const [aliasStatusFilter, setAliasStatusFilter] = useState('ALL');
  const [aliasModalOpen, setAliasModalOpen] = useState(false);
  const [editingAlias, setEditingAlias] = useState(null);
  const [aliasForm, setAliasForm] = useState(emptyAliasForm);
  const [customerSearch, setCustomerSearch] = useState('');
  const [aliasErrors, setAliasErrors] = useState({});
  const [aliasMessage, setAliasMessage] = useState('');

  const metrics = useMemo(() => {
    const aliasCount = masterData.productAliases.length;
    const pendingCount = masterData.suggestions.filter((item) => item.status === 'PENDING').length;
    const activePriceCount = masterData.prices.filter((item) => item.status === 'ACTIVE').length;
    const reviewPriceCount = masterData.prices.filter((item) => item.status === 'REVIEW').length;

    return [
      { label: '거래처 기준', value: `${masterData.customers.length.toLocaleString('ko-KR')}건`, detail: '거래처코드·거래처명 기준' },
      { label: '제품 기준', value: `${masterData.products.length.toLocaleString('ko-KR')}건`, detail: `별칭 ${masterData.productAliases.length.toLocaleString('ko-KR')}건` },
      { label: '단가 기준', value: `${activePriceCount.toLocaleString('ko-KR')}건`, detail: `검토 단가 ${reviewPriceCount.toLocaleString('ko-KR')}건` },
      { label: '매핑 후보', value: `${pendingCount.toLocaleString('ko-KR')}건`, detail: `전체 별칭 ${aliasCount.toLocaleString('ko-KR')}건` },
    ];
  }, [masterData]);

  const loadMasterData = async () => {
    if (!window.api?.getMasterData || isLoading) {
      if (!window.api?.getMasterData) setLoadState('SQLite 조회는 Electron 데스크톱 앱에서만 사용할 수 있습니다.');
      return;
    }

    setIsLoading(true);
    addNotification({
      title: '기준 데이터 조회 시작',
      message: '거래처/제품/단가 기준 데이터를 불러오는 중입니다.',
      level: 'INFO',
      target: '코드 매핑',
      href: '/validate/code-mapping',
    });
    try {
      const data = await window.api.getMasterData();
      const nextData = {
        customers: data?.customers ?? [],
        products: data?.products ?? [],
        productAliases: data?.productAliases ?? [],
        prices: data?.prices ?? [],
        suggestions: data?.suggestions ?? [],
        contacts: data?.contacts ?? [],
      };
      setMasterData(nextData);
      setLoadState('SQLite에서 기준 데이터를 불러왔습니다.');
      addNotification({
        title: '기준 데이터 조회 완료',
        message: 'SQLite에서 기준 데이터를 불러왔습니다.',
        level: 'SUCCESS',
        target: '코드 매핑',
        href: '/validate/code-mapping',
      });
    } catch (error) {
      setMasterData(emptyMasterData);
      setLoadState(`SQLite 조회 실패: ${error.message}`);
      addNotification({
        title: 'SQLite 조회 실패',
        message: error.message,
        level: 'WARN',
        target: '코드 매핑',
        href: '/validate/code-mapping',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const tableViews = useMemo(() => [
    {
      id: 'customers',
      title: '거래처명 기준',
      count: masterData.customers.length,
      detail: 'SQL 거래처 테이블 기준으로 거래처명과 거래처코드를 조회합니다.',
      rows: masterData.customers,
      emptyText: '등록된 거래처 기준이 없습니다.',
      columns: [
        { label: '거래처명', key: 'customerName' },
        { label: '거래처코드', key: 'customerCode' },
        { label: '사업자번호', key: 'businessNumber' },
        { label: '세금계산서', key: 'taxStatus' },
        { label: '상태', render: (row) => <StatusBadge status={row.status} /> },
      ],
    },
    {
      id: 'products',
      title: '제품명 기준',
      count: masterData.products.length,
      detail: 'SQL 품목 테이블 기준으로 제품명과 제품코드를 조회합니다.',
      rows: masterData.products,
      emptyText: '등록된 제품 기준이 없습니다.',
      columns: [
        { label: '제품명', key: 'productName' },
        { label: '제품코드', key: 'productCode' },
        { label: '단위', key: 'unit' },
        { label: '메모', key: 'memo' },
        { label: '상태', render: (row) => <StatusBadge status={row.status} /> },
      ],
    },
    {
      id: 'prices',
      title: '단가 기준',
      count: masterData.prices.length,
      detail: '거래처/제품별 적용 단가와 검토 상태를 확인합니다.',
      rows: masterData.prices,
      emptyText: '등록된 단가 기준이 없습니다.',
      columns: [
        { label: '거래처', key: 'customerName' },
        { label: '제품', key: 'productName' },
        { label: '단가', render: (row) => `${formatPrice(row.price)} ${row.currency}` },
        { label: '시작일', key: 'startDate' },
        { label: '상태', render: (row) => <StatusBadge status={row.status} /> },
      ],
    },
    {
      id: 'productAliases',
      title: '제품 별칭',
      count: masterData.productAliases.length,
      detail: '원본 제품명을 표준 제품 코드로 매핑합니다.',
      rows: masterData.productAliases,
      emptyText: '등록된 제품 별칭이 없습니다.',
      columns: [
        { label: '원본명', key: 'aliasName' },
        { label: '표준 제품', key: 'productName' },
        { label: '코드', key: 'productCode' },
        { label: '신뢰도', render: (row) => formatPercent(row.confidence) },
        { label: '상태', render: (row) => <StatusBadge status={row.status} /> },
      ],
    },
    {
      id: 'suggestions',
      title: '자동 매핑 후보',
      count: masterData.suggestions.length,
      detail: '빈값, 누락, 낮은 신뢰도 후보를 검토합니다.',
      rows: masterData.suggestions,
      emptyText: '검토 대기 중인 매핑 후보가 없습니다.',
      columns: [
        { label: '유형', key: 'targetType' },
        { label: '원본값', key: 'rawValue' },
        { label: '추천 코드', key: 'suggestedCode' },
        { label: '신뢰도', render: (row) => formatPercent(row.confidence) },
        { label: '상태', render: (row) => <StatusBadge status={row.status} /> },
      ],
    },
  ], [masterData]);
  const activeTable = tableViews.find((view) => view.id === activeView) ?? tableViews[0];
  const filteredAliases = customerAliases.filter((alias) => {
    const query = aliasSearch.trim().toLowerCase();
    const matchesSearch = !query || [alias.sourceCustomerCode, alias.sourceCustomerName, alias.customerCode, alias.customerName]
      .some((value) => String(value ?? '').toLowerCase().includes(query));
    return matchesSearch && (aliasStatusFilter === 'ALL' || alias.status === aliasStatusFilter);
  });
  const candidateCustomers = masterData.customers.filter((customer) => {
    const query = customerSearch.trim().toLowerCase();
    return !query || [customer.customerCode, customer.customerName]
      .some((value) => String(value ?? '').toLowerCase().includes(query));
  });
  const openAliasModal = (alias = null) => {
    setEditingAlias(alias);
    setAliasForm(alias ? { ...alias } : { ...emptyAliasForm });
    setCustomerSearch('');
    setAliasErrors({});
    setAliasModalOpen(true);
  };
  const saveAlias = () => {
    const errors = {};
    if (!aliasForm.sourceType) errors.sourceType = '업로드 출처를 선택해주세요.';
    if (!aliasForm.sourceCustomerCode.trim() && !aliasForm.sourceCustomerName.trim()) errors.source = '원본 거래처코드 또는 거래처명 중 하나를 입력해주세요.';
    if (!aliasForm.customerCode) errors.customer = '기준 거래처를 선택해주세요.';
    setAliasErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const nextAlias = {
      ...aliasForm,
      sourceCustomerCode: aliasForm.sourceCustomerCode.trim(),
      sourceCustomerName: aliasForm.sourceCustomerName.trim(),
      mappingId: editingAlias?.mappingId ?? Date.now(),
      updatedAt: new Date().toISOString(),
    };
    setCustomerAliases((current) => editingAlias
      ? current.map((item) => item.mappingId === editingAlias.mappingId ? nextAlias : item)
      : [...current, nextAlias]);
    setAliasModalOpen(false);
    setAliasMessage('화면에 임시 반영되었습니다. 새로고침하면 사라집니다.');
  };
  const toggleAliasStatus = (alias) => {
    setCustomerAliases((current) => current.map((item) => item.mappingId === alias.mappingId
      ? { ...item, status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', updatedAt: new Date().toISOString() }
      : item));
    setAliasMessage('상태가 화면에 임시 반영되었습니다.');
  };

  return (
    <PageShell title="코드 매핑" description="등록된 거래처명, 제품명, 단가 기준과 매핑 후보를 확인합니다.">
      <div className="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist" aria-label="코드 매핑 관리 영역">
        {[['masterData', '기준 데이터'], ['customerAliases', '거래처 별칭 매핑']].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={activeSection === id} className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeSection === id ? 'border-teal-500 text-teal-700 dark:border-teal-400 dark:text-teal-200' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100'}`} onClick={() => setActiveSection(id)}>{label}</button>
        ))}
      </div>

      {activeSection === 'masterData' && <>
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">기준별 조회</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{loadState}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" type="button" onClick={loadMasterData} disabled={isLoading}>
              {isLoading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tableViews.map((view) => (
            <button
              key={view.id}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${activeView === view.id ? 'border-teal-500 bg-teal-50 text-teal-700 dark:border-teal-400 dark:bg-teal-500/10 dark:text-teal-200' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/50'}`}
              type="button"
              onClick={() => setActiveView(view.id)}
            >
              {view.title} · {view.count.toLocaleString('ko-KR')}건
            </button>
          ))}
        </div>
      </section>

      <DataTable
        title={activeTable.title}
        emptyText={activeTable.emptyText}
        rows={activeTable.rows}
        columns={activeTable.columns}
      />
      </>}

      {activeSection === 'customerAliases' && <>
        <section className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <div><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">거래처 별칭 매핑</h2><p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">엑셀에 입력된 거래처 코드와 거래처명을 등록된 기준 거래처에 연결합니다.<br />한 번 저장한 매핑은 다음 업로드부터 자동으로 적용할 수 있습니다.</p></div>
          <button className="btn btn-primary" type="button" onClick={() => openAliasModal()}>새 매핑 등록</button>
        </section>

        <div className="mb-4 grid grid-cols-3 gap-3">
          {[['전체 매핑', customerAliases.length], ['사용 중', customerAliases.filter((item) => item.status === 'ACTIVE').length], ['미사용', customerAliases.filter((item) => item.status === 'INACTIVE').length]].map(([label, count]) => <div key={label} className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700/60 dark:bg-gray-800"><p className="text-xs text-gray-500 dark:text-gray-400">{label}</p><p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{count.toLocaleString('ko-KR')}</p></div>)}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className="form-input min-w-64 flex-1" type="search" aria-label="거래처 별칭 검색" placeholder="원본 코드·이름 또는 기준 거래처 검색" value={aliasSearch} onChange={(event) => setAliasSearch(event.target.value)} />
          <select className="form-select" aria-label="매핑 상태" value={aliasStatusFilter} onChange={(event) => setAliasStatusFilter(event.target.value)}><option value="ALL">전체</option><option value="ACTIVE">사용</option><option value="INACTIVE">미사용</option></select>
          <button className="btn btn-secondary" type="button" onClick={() => { setAliasSearch(''); setAliasStatusFilter('ALL'); }}>초기화</button>
        </div>
        {aliasMessage && <p role="status" className="mb-3 text-sm text-gray-500 dark:text-gray-400">{aliasMessage}</p>}

        {customerAliases.length === 0 ? <section className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center dark:border-gray-700/60 dark:bg-gray-800"><h3 className="font-semibold text-gray-900 dark:text-gray-100">등록된 거래처 별칭 매핑이 없습니다.</h3><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">엑셀에서 사용하는 거래처명과 거래처코드를 기준 거래처에 연결하면 다음 업로드부터 자동으로 인식할 수 있습니다.</p><button className="btn btn-secondary mt-5" type="button" onClick={() => openAliasModal()}>첫 매핑 등록</button></section>
          : <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-800"><table className="min-w-[920px] w-full border-separate border-spacing-0 text-sm"><thead><tr>{['업로드 출처', '원본 거래처코드', '원본 거래처명', '연결된 기준 거래처', '상태', '수정일', '관리'].map((heading) => <th key={heading} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">{heading}</th>)}</tr></thead><tbody>{filteredAliases.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">검색 조건에 맞는 매핑이 없습니다.</td></tr> : filteredAliases.map((alias) => <tr key={alias.mappingId} className="group"><td className="border-b border-r border-gray-200 px-3 py-2 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:group-hover:bg-accent-500/10">{sourceLabel(alias.sourceType)}</td><td className="border-b border-r border-gray-200 px-3 py-2 dark:border-gray-700/60">{alias.sourceCustomerCode || '—'}</td><td className="border-b border-r border-gray-200 px-3 py-2 dark:border-gray-700/60">{alias.sourceCustomerName || '—'}</td><td className="border-b border-r border-gray-200 px-3 py-2 dark:border-gray-700/60">{alias.customerCode} · {alias.customerName}</td><td className="border-b border-r border-gray-200 px-3 py-2 dark:border-gray-700/60"><StatusBadge status={alias.status} /></td><td className="border-b border-r border-gray-200 px-3 py-2 dark:border-gray-700/60">{new Date(alias.updatedAt).toLocaleDateString('ko-KR')}</td><td className="whitespace-nowrap border-b border-gray-200 px-3 py-2 dark:border-gray-700/60"><button className="text-accent-700 hover:underline dark:text-accent-300" type="button" onClick={() => openAliasModal(alias)}>수정</button><button className="ml-3 text-gray-600 hover:underline dark:text-gray-300" type="button" onClick={() => toggleAliasStatus(alias)}>{alias.status === 'ACTIVE' ? '미사용' : '다시 사용'}</button></td></tr>)}</tbody></table></div>}
      </>}

      <Modal open={aliasModalOpen} title={editingAlias ? '거래처 별칭 매핑 수정' : '거래처 별칭 매핑 등록'} description="원본 거래처 정보를 기준 거래처에 연결합니다. 이 단계에서는 화면에만 임시 반영됩니다." size="lg" onClose={() => setAliasModalOpen(false)}>
        <div className="space-y-4 p-5 text-sm">
          <label className="block font-semibold text-gray-700 dark:text-gray-200">업로드 출처<select className="form-select mt-1 w-full" value={aliasForm.sourceType} onChange={(event) => setAliasForm((current) => ({ ...current, sourceType: event.target.value }))}>{sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{aliasErrors.sourceType && <span className="mt-1 block text-xs text-red-600">{aliasErrors.sourceType}</span>}</label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block font-semibold text-gray-700 dark:text-gray-200">원본 거래처코드<input className="form-input mt-1 w-full" value={aliasForm.sourceCustomerCode} onChange={(event) => setAliasForm((current) => ({ ...current, sourceCustomerCode: event.target.value }))} placeholder="예: 00123, DS-01" /></label><label className="block font-semibold text-gray-700 dark:text-gray-200">원본 거래처명<input className="form-input mt-1 w-full" value={aliasForm.sourceCustomerName} onChange={(event) => setAliasForm((current) => ({ ...current, sourceCustomerName: event.target.value }))} placeholder="예: (주)대성, 대성 본사" /></label></div>
          {aliasErrors.source && <p className="text-xs text-red-600">{aliasErrors.source}</p>}
          <div><div className="flex items-center justify-between"><label htmlFor="alias-customer-search" className="font-semibold text-gray-700 dark:text-gray-200">기준 거래처</label><button type="button" className="text-xs text-accent-700 underline dark:text-accent-300" onClick={loadMasterData} disabled={isLoading}>{isLoading ? '불러오는 중...' : '기준 데이터 불러오기'}</button></div><input id="alias-customer-search" className="form-input mt-1 w-full" type="search" placeholder="거래처코드 또는 거래처명 검색" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} /><select className="form-select mt-2 w-full" size={Math.min(5, Math.max(candidateCustomers.length, 2))} aria-label="기준 거래처 선택" value={aliasForm.customerCode} onChange={(event) => { const customer = masterData.customers.find((item) => item.customerCode === event.target.value); setAliasForm((current) => ({ ...current, customerId: customer?.customerId ?? customer?.id ?? '', customerCode: customer?.customerCode ?? '', customerName: customer?.customerName ?? '' })); }}><option value="">거래처 선택</option>{candidateCustomers.map((customer) => <option key={customer.customerCode} value={customer.customerCode}>{customer.customerCode} · {customer.customerName}</option>)}</select>{masterData.customers.length === 0 && <p className="mt-1 text-xs text-gray-500">기준 데이터를 불러온 뒤 거래처를 선택하세요.</p>}{aliasErrors.customer && <p className="mt-1 text-xs text-red-600">{aliasErrors.customer}</p>}</div>
          {editingAlias && <label className="block font-semibold text-gray-700 dark:text-gray-200">상태<select className="form-select mt-1 w-full" value={aliasForm.status} onChange={(event) => setAliasForm((current) => ({ ...current, status: event.target.value }))}><option value="ACTIVE">사용</option><option value="INACTIVE">미사용</option></select></label>}
          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700"><button className="btn btn-secondary" type="button" onClick={() => setAliasModalOpen(false)}>취소</button><button className="btn btn-primary" type="button" onClick={saveAlias}>화면에 임시 반영</button></div>
        </div>
      </Modal>
    </PageShell>
  );
}
