export const closingWorkspaceStorageKey = 'excel-workspace:closingWorkspaceRows';
export const closingWorkspaceChangedEvent = 'excel-workspace:closing-workspace-changed';

const fallbackRows = [
  { id: 'WELCOME-001', company: '한빛유통', contactConfirmed: true, amountConfirmed: true, taxMatched: true, requestReady: true, requestSent: true },
  { id: 'WELCOME-002', company: '모블상사', contactConfirmed: false, amountConfirmed: false, taxMatched: false, requestReady: false, requestSent: false },
  { id: 'WELCOME-003', company: '그린물류', contactConfirmed: true, amountConfirmed: true, taxMatched: false, requestReady: false, requestSent: false },
  { id: 'WELCOME-004', company: '청담리테일', contactConfirmed: true, amountConfirmed: false, taxMatched: true, requestReady: false, requestSent: false },
  { id: 'WELCOME-005', company: '서울컴퍼니', contactConfirmed: true, amountConfirmed: true, taxMatched: true, requestReady: true, requestSent: false },
  { id: 'WELCOME-006', company: '다원문구', contactConfirmed: false, amountConfirmed: true, taxMatched: false, requestReady: false, requestSent: false },
  { id: 'WELCOME-007', company: '바른테크', contactConfirmed: true, amountConfirmed: true, taxMatched: true, requestReady: true, requestSent: true },
  { id: 'WELCOME-008', company: '코리아비즈', contactConfirmed: true, amountConfirmed: false, taxMatched: true, requestReady: false, requestSent: false },
];

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows.filter((row) => row && row.id) : [];
}

function getProgress(row) {
  return Math.round(([row.contactConfirmed, row.amountConfirmed, row.taxMatched].filter(Boolean).length / 3) * 100);
}

export function readClosingWorkspaceRows() {
  try {
    const saved = JSON.parse(localStorage.getItem(closingWorkspaceStorageKey));
    return normalizeRows(saved);
  } catch {
    return [];
  }
}

export function saveClosingWorkspaceRows(rows) {
  const nextRows = normalizeRows(rows);
  localStorage.setItem(closingWorkspaceStorageKey, JSON.stringify(nextRows));
  window.dispatchEvent(new CustomEvent(closingWorkspaceChangedEvent, { detail: nextRows }));
  return nextRows;
}

export function getClosingRowsForSummary() {
  const savedRows = readClosingWorkspaceRows();
  return savedRows.length > 0 ? savedRows : fallbackRows;
}

export function getClosingWelcomeSummary(rows = getClosingRowsForSummary()) {
  const normalizedRows = normalizeRows(rows);
  const total = normalizedRows.length;
  const done = normalizedRows.filter((row) => getProgress(row) === 100).length;
  const waiting = normalizedRows.filter((row) => getProgress(row) < 100).length;
  const contactNeeded = normalizedRows.filter((row) => !row.contactConfirmed).length;
  const taxGap = normalizedRows.filter((row) => !row.taxMatched).length;
  const requestReady = normalizedRows.filter((row) => row.requestReady && !row.requestSent).length;
  const todayProcessed = done + requestReady + taxGap;
  const passRate = total === 0 ? 0 : Math.round((done / total) * 100);
  const latestRows = normalizedRows
    .slice()
    .sort((a, b) => getProgress(b) - getProgress(a))
    .slice(0, 3);

  return {
    total,
    done,
    waiting,
    contactNeeded,
    taxGap,
    requestReady,
    todayProcessed,
    passRate,
    latestRows,
    chartBars: [
      { label: '연락', value: total === 0 ? 0 : Math.round(((total - contactNeeded) / total) * 100), tone: 'muted' },
      { label: '금액', value: total === 0 ? 0 : Math.round((normalizedRows.filter((row) => row.amountConfirmed).length / total) * 100), tone: 'sky' },
      { label: '계산서', value: total === 0 ? 0 : Math.round((normalizedRows.filter((row) => row.taxMatched).length / total) * 100), tone: 'muted' },
      { label: '발송', value: total === 0 ? 0 : Math.round((normalizedRows.filter((row) => row.requestSent).length / total) * 100), tone: 'accent' },
    ],
  };
}

export function getClosingRowStatus(row) {
  if (getProgress(row) === 100 && row.requestSent) return '마감 완료';
  if (!row.contactConfirmed) return '연락 필요';
  if (!row.amountConfirmed) return '금액 확인';
  if (!row.taxMatched) return '계산서 대조';
  if (row.requestReady && !row.requestSent) return '발송 준비';
  return '검증 완료';
}
