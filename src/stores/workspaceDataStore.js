import { create } from "zustand";

const defaultColumns = [
  "거래일",
  "거래처",
  "품목 코드",
  "품목명",
  "수량",
  "단가",
  "금액",
  "검증",
  "담당자",
];
const appliedStatuses = new Set(["수정 반영", "중복 검토", "검토 필요"]);

function countAppliedRows(rows) {
  return rows.filter((row) => appliedStatuses.has(row[7])).length;
}

function readLocalWorkspaceData() {
  return {
    fileName: "",
    columns: defaultColumns,
    rows: [],
    rowActions: {},
    validationIssues: {},
    savedAt: null,
    appliedCount: 0,
    sourceMode: "empty",
    isDirty: false,
  };
}

function buildValidationIssues(results = {}) {
  const validationIssues = {};

  Object.values(results).forEach((result) => {
    result.issues?.forEach((issue) => {
      const rowIndex = issue.rowNumber - 1;
      validationIssues[rowIndex] = [
        ...(validationIssues[rowIndex] ?? []),
        issue.message,
      ];
    });
  });

  return validationIssues;
}

function buildResultsFromValidationIssues(validationIssues = {}) {
  return {
    manual: {
      issues: Object.entries(validationIssues).flatMap(([rowIndex, messages]) =>
        (messages ?? []).map((message) => ({
          rowNumber: Number(rowIndex) + 1,
          message,
        })),
      ),
    },
  };
}

async function saveRowsToDatabase({
  columns,
  rows,
  fileName,
  rowActions,
  results,
}) {
  if (!window.api?.saveData) return { ok: false, mode: "browser-only" };

  try {
    return await window.api.saveData({
      fileName,
      columns,
      rows,
      rowActions,
      validationIssues: buildValidationIssues(results),
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    return { ok: false, mode: "sqlite-error", message: error.message };
  }
}

async function readLatestFromDatabase() {
  if (!window.api?.getLatestData) return null;

  const result = await window.api.getLatestData();
  const payload = result?.data?.payload;

  if (
    !result?.ok ||
    !Array.isArray(payload?.rows) ||
    payload.rows.length === 0
  ) {
    return null;
  }

  return {
    fileName: payload.fileName ?? result.data.fileName ?? "workspace-data.xlsx",
    columns:
      Array.isArray(payload.columns) && payload.columns.length > 0
        ? payload.columns
        : defaultColumns,
    rows: payload.rows,
    rowActions: payload.rowActions ?? {},
    validationIssues: payload.validationIssues ?? {},
    savedAt: result.data.savedAt ?? payload.savedAt ?? null,
    appliedCount: countAppliedRows(payload.rows),
    sourceMode: "sqlite",
    isDirty: false,
  };
}

export const useWorkspaceDataStore = create((set, get) => ({
  ...readLocalWorkspaceData(),
  isLoading: false,
  error: "",

  setRows: (rowsOrUpdater) =>
    set((state) => {
      const rows =
        typeof rowsOrUpdater === "function"
          ? rowsOrUpdater(state.rows)
          : rowsOrUpdater;

      return {
        rows,
        appliedCount: countAppliedRows(rows),
        isDirty: true,
        sourceMode: "draft",
      };
    }),

  stageWorkspace: ({
    fileName,
    columns,
    rows,
    rowActions = {},
    validationIssues = {},
  }) =>
    set({
      fileName,
      columns,
      rows,
      rowActions,
      validationIssues,
      savedAt: null,
      appliedCount: countAppliedRows(rows),
      sourceMode: "draft",
      isDirty: true,
      error: "",
    }),

  setRowActions: (rowActionsOrUpdater) =>
    set((state) => {
      const rowActions =
        typeof rowActionsOrUpdater === "function"
          ? rowActionsOrUpdater(state.rowActions)
          : rowActionsOrUpdater;

      return {
        rowActions,
        isDirty: true,
        sourceMode: "draft",
      };
    }),

  setValidationIssues: (validationIssuesOrUpdater) =>
    set((state) => {
      const validationIssues =
        typeof validationIssuesOrUpdater === "function"
          ? validationIssuesOrUpdater(state.validationIssues)
          : validationIssuesOrUpdater;

      return {
        validationIssues,
        isDirty: true,
        sourceMode: "draft",
      };
    }),

  loadLatest: async () => {
    set({ isLoading: true, error: "" });

    try {
      const latest = await readLatestFromDatabase();

      if (!latest && window.api?.getLatestData) {
        const empty = {
          fileName: "",
          columns: defaultColumns,
          rows: [],
          rowActions: {},
          validationIssues: {},
          savedAt: null,
          appliedCount: 0,
          sourceMode: "sqlite-empty",
          isDirty: false,
        };
        set({ ...empty, isLoading: false });
        return empty;
      }

      const resolved = latest ?? readLocalWorkspaceData();
      set({ ...resolved, isLoading: false });
      return resolved;
    } catch (error) {
      if (window.api?.getLatestData) {
        const empty = {
          fileName: "",
          columns: defaultColumns,
          rows: [],
          rowActions: {},
          validationIssues: {},
          savedAt: null,
          appliedCount: 0,
          sourceMode: "sqlite-error",
          isDirty: false,
        };
        set({ ...empty, isLoading: false, error: error.message });
        return empty;
      }
      const fallback = readLocalWorkspaceData();
      set({ ...fallback, isLoading: false, error: error.message });
      return fallback;
    }
  },

  saveRows: async ({
    rows = get().rows,
    columns = get().columns,
    fileName = get().fileName || "workspace-data.xlsx",
    rowActions = get().rowActions,
    validationIssues = get().validationIssues,
    results = {},
  } = {}) => {
    set({ isLoading: true, error: "" });

    const savedAt = new Date().toISOString();
    const appliedCount = countAppliedRows(rows);
    const localData = {
      fileName,
      columns,
      rows,
      rowActions,
      validationIssues,
      savedAt,
      appliedCount,
      sourceMode: "browser-storage",
      isDirty: false,
    };

    const databaseResult = await saveRowsToDatabase({
      columns,
      rows,
      fileName,
      rowActions,
      results:
        Object.keys(results).length > 0
          ? results
          : buildResultsFromValidationIssues(validationIssues),
    });
    const latest = databaseResult.ok ? await get().loadLatest() : localData;

    if (!databaseResult.ok) {
      set({
        ...localData,
        isLoading: false,
        error: databaseResult.message ?? "",
      });
    }

    return {
      ...databaseResult,
      latest,
    };
  },

  resetWorkspace: () => {
    const emptyWorkspace = {
      fileName: "",
      columns: defaultColumns,
      rows: [],
      rowActions: {},
      validationIssues: {},
      savedAt: null,
      appliedCount: 0,
      sourceMode: "empty",
      isDirty: false,
      error: "",
      isLoading: false,
    };
    set(emptyWorkspace);
    return emptyWorkspace;
  },
}));
