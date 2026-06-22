export const closingWorkspaceChangedEvent = 'excel-workspace:closing-workspace-changed';

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows.filter((row) => row && row.id) : [];
}

function getProgress(row) {
  if (row.amountConfirmed) return 100;
  if (Number(row.contactCount) >= 1) return 50;
  return 0;
}

export function readClosingWorkspaceRows() {
  return [];
}

export function saveClosingWorkspaceRows(rows) {
  const nextRows = normalizeRows(rows);
  window.dispatchEvent(new CustomEvent(closingWorkspaceChangedEvent, { detail: nextRows }));
  return nextRows;
}

export function getClosingRowsForSummary() {
  return readClosingWorkspaceRows();
}

export function getClosingWelcomeSummary(rows = getClosingRowsForSummary()) {
  const normalizedRows = normalizeRows(rows);
  const total = normalizedRows.length;
  const done = normalizedRows.filter((row) => getProgress(row) === 100).length;
  const waiting = normalizedRows.filter((row) => getProgress(row) < 100).length;
  const contactNeeded = normalizedRows.filter((row) => Number(row.contactCount) === 0).length;
  const requestReady = normalizedRows.filter((row) => row.requestReady && !row.requestSent).length;
  const todayProcessed = done + requestReady;
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
    requestReady,
    todayProcessed,
    passRate,
    latestRows,
    chartBars: [
      { label: '연락', value: total === 0 ? 0 : Math.round(((total - contactNeeded) / total) * 100), tone: 'muted' },
      { label: '금액', value: total === 0 ? 0 : Math.round((normalizedRows.filter((row) => row.amountConfirmed).length / total) * 100), tone: 'sky' },
      { label: '발송', value: total === 0 ? 0 : Math.round((normalizedRows.filter((row) => row.requestSent).length / total) * 100), tone: 'accent' },
    ],
  };
}

export function getClosingRowStatus(row) {
  const successfulSendCount = Number(row.contactCount) || 0;
  if (successfulSendCount >= 1 && row.amountConfirmed) return '완료';
  if (successfulSendCount >= 3) return '처리 지연';
  if (successfulSendCount >= 1) return '마감 진행 중';
  return '연락 필요';
}
