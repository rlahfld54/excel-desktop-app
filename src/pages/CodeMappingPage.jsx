import React, { useMemo, useState } from 'react';

import { StatusBadge } from '../components/common';
import PageShell from './PageShell';
import { addNotification } from '../utils/appNotifications';

const masterStorageKey = 'excel-workspace:masterData';
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

function getInitialMasterData() {
  if (window.api?.getMasterData) return emptyMasterData;

  try {
    const saved = JSON.parse(localStorage.getItem(masterStorageKey));
    const hasBundledSampleCodes = saved?.products?.some((product) => (
      ['PAPER-A4-001', 'TONER-BLK-2108', 'USB-HUB-04'].includes(product.productCode)
    ));
    if (!hasBundledSampleCodes && saved && typeof saved === 'object') {
      return { ...emptyMasterData, ...saved };
    }
  } catch {
    // ignore malformed local data
  }
  return emptyMasterData;
}

export default function CodeMappingPage() {
  const [masterData, setMasterData] = useState(emptyMasterData);
  const [loadState, setLoadState] = useState('조회 버튼을 눌러 SQLite 기준 데이터를 불러오세요.');
  const [activeView, setActiveView] = useState('customers');
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <PageShell title="코드 매핑" description="등록된 거래처명, 제품명, 단가 기준과 매핑 후보를 확인합니다.">
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
    </PageShell>
  );
}
