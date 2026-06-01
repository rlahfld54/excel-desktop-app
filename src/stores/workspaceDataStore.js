import { create } from 'zustand';

import { createSampleSalesRows, sampleColumns } from '../data/sampleSalesData';

const sampleRows = createSampleSalesRows(1200);
const storageKey = 'excel-workspace:workspaceData';
const appliedStatuses = new Set([
  '수정 반영',
  '중복 검토',
  '검토 필요',
  '?섏젙 諛섏쁺',
  '以묐났 寃??',
  '寃???꾩슂',
]);

function countAppliedRows(rows) {
  return rows.filter((row) => appliedStatuses.has(row[7])).length;
}

function readLocalWorkspaceData() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved?.rows) && saved.rows.length > 0) {
      return {
        columns: Array.isArray(saved.columns) && saved.columns.length > 0 ? saved.columns : sampleColumns,
        rows: saved.rows,
        savedAt: saved.savedAt ?? null,
        appliedCount: Number(saved.appliedCount) || countAppliedRows(saved.rows),
        sourceMode: 'browser-storage',
      };
    }
  } catch {
    // Ignore malformed local fallback data and use the bundled sample.
  }

  return {
    columns: sampleColumns,
    rows: sampleRows,
    savedAt: null,
    appliedCount: 0,
    sourceMode: 'sample',
  };
}

function writeLocalWorkspaceData({ columns, rows, savedAt, appliedCount }) {
  localStorage.setItem(storageKey, JSON.stringify({
    columns,
    rows,
    savedAt,
    appliedCount,
  }));
}

function buildValidationIssues(results = {}) {
  const validationIssues = {};

  Object.values(results).forEach((result) => {
    result.issues?.forEach((issue) => {
      const rowIndex = issue.rowNumber - 1;
      validationIssues[rowIndex] = [...(validationIssues[rowIndex] ?? []), issue.message];
    });
  });

  return validationIssues;
}

async function saveRowsToDatabase({ columns, rows, fileName, results }) {
  if (!window.api?.saveData) return { ok: false, mode: 'browser-only' };

  try {
    return await window.api.saveData({
      fileName,
      columns,
      rows,
      validationIssues: buildValidationIssues(results),
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    return { ok: false, mode: 'sqlite-error', message: error.message };
  }
}

async function readLatestFromDatabase() {
  if (!window.api?.getLatestData) return null;

  const result = await window.api.getLatestData();
  const payload = result?.data?.payload;

  if (!result?.ok || !Array.isArray(payload?.rows) || payload.rows.length === 0) {
    return null;
  }

  return {
    columns: Array.isArray(payload.columns) && payload.columns.length > 0 ? payload.columns : sampleColumns,
    rows: payload.rows,
    savedAt: result.data.savedAt ?? payload.savedAt ?? null,
    appliedCount: countAppliedRows(payload.rows),
    sourceMode: 'sqlite',
  };
}

export const useWorkspaceDataStore = create((set, get) => ({
  ...readLocalWorkspaceData(),
  isLoading: false,
  error: '',

  setRows: (rowsOrUpdater) => set((state) => {
    const rows = typeof rowsOrUpdater === 'function'
      ? rowsOrUpdater(state.rows)
      : rowsOrUpdater;

    return {
      rows,
      appliedCount: countAppliedRows(rows),
    };
  }),

  loadLatest: async () => {
    set({ isLoading: true, error: '' });

    try {
      let latest = await readLatestFromDatabase();

      if (!latest && window.api?.saveData) {
        await saveRowsToDatabase({
          columns: sampleColumns,
          rows: sampleRows,
          fileName: 'sample_sales_1200.xlsx',
          results: {},
        });
        latest = await readLatestFromDatabase();
      }

      if (!latest) latest = readLocalWorkspaceData();

      writeLocalWorkspaceData(latest);
      set({ ...latest, isLoading: false });
      return latest;
    } catch (error) {
      const fallback = readLocalWorkspaceData();
      set({ ...fallback, isLoading: false, error: error.message });
      return fallback;
    }
  },

  saveRows: async ({ rows, columns = get().columns, fileName = 'workspace-data.xlsx', results = {} }) => {
    set({ isLoading: true, error: '' });

    const savedAt = new Date().toISOString();
    const appliedCount = countAppliedRows(rows);
    const localData = {
      columns,
      rows,
      savedAt,
      appliedCount,
      sourceMode: 'browser-storage',
    };

    writeLocalWorkspaceData(localData);
    const databaseResult = await saveRowsToDatabase({ columns, rows, fileName, results });
    const latest = databaseResult.ok ? await get().loadLatest() : localData;

    if (!databaseResult.ok) {
      set({ ...localData, isLoading: false, error: databaseResult.message ?? '' });
    }

    return {
      ...databaseResult,
      latest,
    };
  },

  resetSample: async () => {
    localStorage.removeItem(storageKey);

    const result = await get().saveRows({
      rows: sampleRows,
      columns: sampleColumns,
      fileName: 'sample_sales_1200.xlsx',
      results: {},
    });

    return result.latest;
  },
}));
