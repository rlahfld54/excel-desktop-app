export function isValidDateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function normalizeDateValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const normalized = text.replace(/[./]/g, '-').replace(/\s+.*/, '');
  const compact = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  const dashed = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const candidate = compact
    ? `${compact[1]}-${compact[2]}-${compact[3]}`
    : dashed
      ? `${dashed[1]}-${dashed[2].padStart(2, '0')}-${dashed[3].padStart(2, '0')}`
      : null;
  return candidate && isValidDateValue(candidate) ? candidate : null;
}

export function validateDateRange({ startDate, endDate }, options = {}) {
  const {
    required = true,
    startLabel = '시작일',
    endLabel = '마지막일',
  } = options;
  const errors = {};

  if (!startDate) {
    if (required) errors.startDate = `${startLabel}을 입력해 주세요.`;
  } else if (!isValidDateValue(startDate)) {
    errors.startDate = `${startLabel}은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.`;
  }

  if (!endDate) {
    if (required) errors.endDate = `${endLabel}을 입력해 주세요.`;
  } else if (!isValidDateValue(endDate)) {
    errors.endDate = `${endLabel}은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.`;
  }

  if (!errors.startDate && !errors.endDate && startDate && endDate && startDate > endDate) {
    errors.endDate = `${endLabel}은 ${startLabel}보다 빠를 수 없습니다.`;
  }

  return errors;
}

export function validateSearchLength(value, label, maxLength = 100) {
  return String(value ?? '').trim().length > maxLength
    ? `${label} 검색어는 ${maxLength}자 이하로 입력해 주세요.`
    : '';
}
