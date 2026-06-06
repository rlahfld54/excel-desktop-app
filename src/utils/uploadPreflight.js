function isBlank(value) {
  return String(value ?? '').trim() === '';
}

function parseDateValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const normalized = text
    .replace(/[.\/]/g, '-')
    .replace(/\s+.*/, '');

  const compactMatch = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
  }

  const dashedMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dashedMatch) {
    return `${dashedMatch[1]}-${dashedMatch[2].padStart(2, '0')}-${dashedMatch[3].padStart(2, '0')}`;
  }

  return null;
}

function buildColumnProfile(columns, rows, columnIndex) {
  const values = rows.map((row) => row[columnIndex]);
  const filledValues = values.filter((value) => !isBlank(value));
  const dateMatches = filledValues.filter((value) => parseDateValue(value));
  const uniqueCount = new Set(filledValues.map((value) => String(value))).size;
  const emptyCount = values.length - filledValues.length;
  const header = columns[columnIndex] ?? `Column ${columnIndex + 1}`;
  const headerLooksUnnecessary = /^(비고|메모|memo|note|notes|remark|remarks|unused|삭제|temp|임시)$/i.test(header.trim());

  return {
    index: columnIndex,
    name: header,
    filledCount: filledValues.length,
    emptyCount,
    uniqueCount,
    isEmpty: filledValues.length === 0,
    isMostlyEmpty: rows.length > 0 && emptyCount / rows.length >= 0.9,
    isDateLike: filledValues.length > 0 && dateMatches.length / filledValues.length >= 0.65,
    headerLooksUnnecessary,
    sampleValues: filledValues.slice(0, 4),
  };
}

export function analyzeUploadData({ columns = [], rows = [], fileName = '' }) {
  const profiles = columns.map((_, index) => buildColumnProfile(columns, rows, index));

  const warnings = [
    ...profiles.filter((profile) => profile.isEmpty).map((profile) => `${profile.name}: 값이 없는 빈 컬럼입니다.`),
    ...profiles.filter((profile) => profile.isMostlyEmpty && !profile.isEmpty).map((profile) => `${profile.name}: 비어 있는 행이 많습니다.`),
    ...profiles.filter((profile) => profile.isDateLike).map((profile) => `${profile.name}: 날짜 형식으로 정리할 수 있습니다.`),
    ...profiles.filter((profile) => profile.headerLooksUnnecessary).map((profile) => `${profile.name}: 불필요한 컬럼일 수 있습니다.`),
  ];

  return {
    fileName,
    columns,
    rows,
    profiles,
    warnings,
    suggestedExcludedIndexes: profiles
      .filter((profile) => profile.isEmpty || profile.headerLooksUnnecessary)
      .map((profile) => profile.index),
    suggestedDateIndexes: profiles
      .filter((profile) => profile.isDateLike)
      .map((profile) => profile.index),
  };
}

export function applyUploadPreflight({ parsed, includedIndexes, dateIndexes }) {
  const includedSet = new Set(includedIndexes);
  const dateSet = new Set(dateIndexes);
  const indexMap = parsed.columns
    .map((column, index) => ({ column, index }))
    .filter((item) => includedSet.has(item.index));

  return {
    fileName: parsed.fileName,
    columns: indexMap.map((item) => item.column),
    rows: parsed.rows.map((row) => indexMap.map((item) => {
      const value = row[item.index] ?? '';
      return dateSet.has(item.index) ? parseDateValue(value) ?? value : value;
    })),
  };
}
