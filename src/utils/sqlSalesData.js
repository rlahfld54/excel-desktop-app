import { getCurrentMonthRange } from './dataFormat';

export function getCurrentMonthSalesRange() {
  const { startDate, endDate } = getCurrentMonthRange();
  return { startDate, endDate };
}

export async function queryAllSalesData(options = {}) {
  if (!window.api?.querySalesData) {
    throw new Error('SQLite 조회는 Electron 데스크톱 앱에서만 사용할 수 있습니다.');
  }

  const pageSize = 200;
  const rows = [];
  let page = 1;
  let total = 0;
  let columns = [];

  do {
    const result = await window.api.querySalesData({
      status: '전체',
      customer: '',
      product: '',
      owner: '전체',
      ...options,
      page,
      pageSize,
    });
    if (!result?.ok || !Array.isArray(result.data?.rows)) {
      throw new Error('SQLite 매출 조회 결과가 올바르지 않습니다.');
    }

    rows.push(...result.data.rows);
    total = Number(result.data.total) || 0;
    columns = result.data.columns ?? columns;
    page += 1;
  } while (rows.length < total);

  return { rows, columns, total };
}
