import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';

const fallbackMasterData = {
  ok: false,
  customers: [
    { customerCode: 'CUST-001', customerName: '한빛유통', businessNumber: '101-81-00001', taxStatus: 'ACTIVE', status: 'ACTIVE' },
    { customerCode: 'CUST-002', customerName: '세종오피스', businessNumber: '102-82-00002', taxStatus: 'ACTIVE', status: 'ACTIVE' },
  ],
  customerAliases: [
    { aliasId: 1, customerCode: 'CUST-001', customerName: '한빛유통', aliasName: '(주)한빛유통', source: 'SAMPLE', confidence: 0.96, status: 'ACTIVE' },
    { aliasId: 2, customerCode: 'CUST-002', customerName: '세종오피스', aliasName: '세종 오피스', source: 'SAMPLE', confidence: 0.97, status: 'ACTIVE' },
  ],
  products: [
    { productCode: 'PAPER-A4-001', productName: 'A4 복사용지', unit: 'BOX', status: 'ACTIVE' },
    { productCode: 'USB-HUB-04', productName: '4포트 USB 허브', unit: 'EA', status: 'ACTIVE' },
  ],
  productAliases: [
    { aliasId: 1, productCode: 'PAPER-A4-001', productName: 'A4 복사용지', aliasName: 'A4 용지', source: 'SAMPLE', confidence: 0.98, status: 'ACTIVE' },
    { aliasId: 2, productCode: 'USB-HUB-04', productName: '4포트 USB 허브', aliasName: 'USB 허브 4P', source: 'SAMPLE', confidence: 0.95, status: 'ACTIVE' },
  ],
  prices: [
    { priceId: 1, customerName: '한빛유통', productName: 'A4 복사용지', customerCode: 'CUST-001', productCode: 'PAPER-A4-001', price: 24500, currency: 'KRW', startDate: '2026-01-01', status: 'ACTIVE' },
    { priceId: 2, customerName: '세종오피스', productName: '4포트 USB 허브', customerCode: 'CUST-002', productCode: 'USB-HUB-04', price: 18900, currency: 'KRW', startDate: '2026-01-01', status: 'ACTIVE' },
  ],
  suggestions: [
    { suggestionId: 1, targetType: 'CUSTOMER', rawValue: '한빛 유통', suggestedCode: 'CUST-001', suggestedName: '한빛유통', confidence: 0.98, status: 'PENDING' },
    { suggestionId: 2, targetType: 'PRODUCT', rawValue: 'USB 허브 4P', suggestedCode: 'USB-HUB-04', suggestedName: '4포트 USB 허브', confidence: 0.95, status: 'PENDING' },
  ],
  contacts: [],
};

function formatPercent(value) {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

function formatPrice(value) {
  return Number(value ?? 0).toLocaleString('ko-KR');
}

function badgeClass(status) {
  if (status === 'ACTIVE' || status === 'APPROVED') {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
  }

  if (status === 'PENDING') {
    return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
  }

  return 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300';
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
                <td className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={columns.length}>
                  {emptyText}
                </td>
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

export default function CodeMappingPage() {
  const [masterData, setMasterData] = useState(fallbackMasterData);
  const [loadState, setLoadState] = useState('브라우저 미리보기');
  const [isSeeding, setIsSeeding] = useState(false);

  const loadMasterData = async () => {
    if (!window.api?.getMasterData) {
      setMasterData(fallbackMasterData);
      setLoadState('브라우저 미리보기');
      return;
    }

    try {
      const data = await window.api.getMasterData();
      setMasterData(data);
      setLoadState('SQLite 연결됨');
    } catch (error) {
      setMasterData(fallbackMasterData);
      setLoadState(`SQLite 확인 필요: ${error.message}`);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  const metrics = useMemo(() => {
    const aliasCount = masterData.customerAliases.length + masterData.productAliases.length;
    const pendingCount = masterData.suggestions.filter((item) => item.status === 'PENDING').length;
    const activePriceCount = masterData.prices.filter((item) => item.status === 'ACTIVE').length;

    return [
      { label: '거래처 기준', value: `${masterData.customers.length.toLocaleString('ko-KR')}건`, detail: `별칭 ${masterData.customerAliases.length.toLocaleString('ko-KR')}건` },
      { label: '제품 기준', value: `${masterData.products.length.toLocaleString('ko-KR')}건`, detail: `별칭 ${masterData.productAliases.length.toLocaleString('ko-KR')}건` },
      { label: '단가 기준', value: `${activePriceCount.toLocaleString('ko-KR')}건`, detail: `검증에 바로 사용할 가격표` },
      { label: '매핑 후보', value: `${pendingCount.toLocaleString('ko-KR')}건`, detail: `자동 추천 검토 대기 / 전체 별칭 ${aliasCount.toLocaleString('ko-KR')}건` },
    ];
  }, [masterData]);

  const handleSeed = async () => {
    if (!window.api?.seedMasterData) {
      setLoadState('Electron 실행 후 SQLite 시드 가능');
      return;
    }

    setIsSeeding(true);
    setLoadState('기준 데이터 준비 중');
    try {
      const data = await window.api.seedMasterData();
      setMasterData(data);
      setLoadState('샘플 기준 데이터 준비 완료');
    } catch (error) {
      setLoadState(`시드 실패: ${error.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <PageShell title="코드 매핑" description="거래처명, 제품명, 단가 기준을 표준 코드로 맞춰 검증 자동화의 기준점을 관리합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Master data</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">기준 데이터와 매핑 후보</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{loadState}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={loadMasterData}>
              새로고침
            </button>
            <button className="btn btn-secondary" type="button">
              후보 승인
            </button>
            <button className="btn btn-primary" type="button" onClick={handleSeed} disabled={isSeeding}>
              {isSeeding ? '준비 중' : '기준 데이터 시드'}
            </button>
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 space-y-5 xl:col-span-7">
          <DataTable
            title="거래처 별칭"
            emptyText="등록된 거래처 별칭이 없습니다."
            rows={masterData.customerAliases}
            columns={[
              { label: '원본명', key: 'aliasName' },
              { label: '표준 거래처', key: 'customerName' },
              { label: '코드', key: 'customerCode' },
              { label: '신뢰도', render: (row) => formatPercent(row.confidence) },
              { label: '상태', render: (row) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(row.status)}`}>{row.status}</span> },
            ]}
          />
          <DataTable
            title="제품 별칭"
            emptyText="등록된 제품 별칭이 없습니다."
            rows={masterData.productAliases}
            columns={[
              { label: '원본명', key: 'aliasName' },
              { label: '표준 제품', key: 'productName' },
              { label: '코드', key: 'productCode' },
              { label: '신뢰도', render: (row) => formatPercent(row.confidence) },
              { label: '상태', render: (row) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(row.status)}`}>{row.status}</span> },
            ]}
          />
        </div>

        <div className="col-span-12 space-y-5 xl:col-span-5">
          <DataTable
            title="단가 기준"
            emptyText="등록된 단가 기준이 없습니다."
            rows={masterData.prices}
            columns={[
              { label: '거래처', key: 'customerName' },
              { label: '제품', key: 'productName' },
              { label: '단가', render: (row) => `${formatPrice(row.price)} ${row.currency}` },
              { label: '시작일', key: 'startDate' },
              { label: '상태', render: (row) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(row.status)}`}>{row.status}</span> },
            ]}
          />
          <DataTable
            title="자동 추천 후보"
            emptyText="검토 대기 중인 매핑 후보가 없습니다."
            rows={masterData.suggestions}
            columns={[
              { label: '유형', key: 'targetType' },
              { label: '원본값', key: 'rawValue' },
              { label: '추천 코드', key: 'suggestedCode' },
              { label: '신뢰도', render: (row) => formatPercent(row.confidence) },
              { label: '상태', render: (row) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(row.status)}`}>{row.status}</span> },
            ]}
          />
        </div>
      </div>
    </PageShell>
  );
}
