function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text ?? '');
    if ('result' in value) return String(value.result ?? '');
    if (Array.isArray(value.richText)) return value.richText.map((item) => item.text).join('');
    return String(value.toString?.() ?? '');
  }
  return String(value);
}

function trimEmptyEdges(rows) {
  return rows
    .map((row) => {
      let lastIndex = row.length - 1;
      while (lastIndex >= 0 && row[lastIndex] === '') lastIndex -= 1;
      return row.slice(0, lastIndex + 1);
    })
    .filter((row) => row.some((cell) => cell !== ''));
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  rows.push(row);

  return trimEmptyEdges(rows);
}

function splitHeaderAndRows(rawRows) {
  if (rawRows.length === 0) {
    return { columns: [], rows: [] };
  }

  const knownHeaders = new Set([
    '거래일',
    '일자',
    '날짜',
    '거래처',
    '거래처명',
    '거래처코드',
    '품목명',
    '품목코드',
    '수량',
    '단가',
    '금액',
    '담당자',
    '부서',
    '비고',
    '검증',
    '상태',
    '결과',
  ]);
  const headerRowIndex = rawRows.findIndex((row) => (
    row.filter((cell) => knownHeaders.has(String(cell ?? '').trim())).length >= 3
  ));
  const resolvedHeaderIndex = headerRowIndex >= 0 ? headerRowIndex : 0;
  const headerRow = rawRows[resolvedHeaderIndex];
  const columns = headerRow.map((column, index) => column || `Column ${index + 1}`);
  const rows = rawRows.slice(resolvedHeaderIndex + 1).map((row) =>
    columns.map((_, index) => row[index] ?? '')
  ).filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));

  return { columns, rows };
}

export async function parseSpreadsheetFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    const text = await file.text();
    return {
      fileName: file.name,
      ...splitHeaderAndRows(parseCsvText(text)),
    };
  }

  if (extension === 'xlsx') {
    const ExcelModule = await import('exceljs');
    const ExcelJS = ExcelModule.default ?? ExcelModule;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return { fileName: file.name, columns: [], rows: [] };
    }

    const rawRows = [];
    worksheet.eachRow((worksheetRow) => {
      rawRows.push(worksheetRow.values.slice(1).map(normalizeCell));
    });

    return {
      fileName: file.name,
      ...splitHeaderAndRows(trimEmptyEdges(rawRows)),
    };
  }

  throw new Error('CSV 또는 XLSX 파일만 업로드할 수 있습니다.');
}
