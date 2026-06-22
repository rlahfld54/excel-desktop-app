export function parseNumber(value) {
  if (typeof value === 'number') return value;
  const normalized = String(value ?? '').replace(/[,\s원₩]/g, '').trim();
  if (!normalized) return Number.NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return {
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    startDate: formatDateValue(new Date(year, month, 1)),
    endDate: formatDateValue(new Date(year, month + 1, 0)),
  };
}

export function isWithinDateRange(value, startDate, endDate) {
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
}

export function formatCurrency(value, currency = '원') {
  const amount = Number(value) || 0;
  return `${amount.toLocaleString('ko-KR')}${currency}`;
}
