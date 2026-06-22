function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthSalesRange() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return {
    startDate: formatDate(new Date(year, month, 1)),
    endDate: formatDate(new Date(year, month + 1, 0)),
  };
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
