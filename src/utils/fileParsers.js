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

class SpreadsheetParseError extends Error {
  constructor(code, message, originalError = null) {
    super(message);
    this.name = 'SpreadsheetParseError';
    this.code = code;
    this.originalError = originalError;
  }
}

export async function parseSpreadsheetFile(file) {
  if (!file) {
    throw new SpreadsheetParseError(
      'FILE_NOT_SELECTED',
      '선택된 파일이 없습니다.'
    );
  }

  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    try {
      const text = await file.text();

      return {
        fileName: file.name,
        ...splitHeaderAndRows(parseCsvText(text)),
      };
    } catch (error) {
      console.error('CSV 파일 읽기 실패:', error);

      throw new SpreadsheetParseError(
        'CSV_READ_FAILED',
        'CSV 파일을 읽지 못했습니다.',
        error
      );
    }
  }

  if (extension === 'xlsx') {
    const ExcelModule = await import('exceljs');
    const ExcelJS = ExcelModule.default ?? ExcelModule;
    const workbook = new ExcelJS.Workbook();

    let arrayBuffer;

    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (error) {
      console.error('파일 데이터 읽기 실패:', error);

      throw new SpreadsheetParseError(
        'FILE_READ_FAILED',
        '선택한 파일의 데이터를 읽지 못했습니다.',
        error
      );
    }

    try {
      await workbook.xlsx.load(arrayBuffer);
    } catch (error) {
      console.error('ExcelJS XLSX 로드 실패:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error,
      });

      throw new SpreadsheetParseError(
        'INCOMPATIBLE_XLSX',
        '현재 파일은 프로그램과 호환되는 Excel 형식으로 읽을 수 없습니다.',
        error
      );
    }

    const worksheet = workbook.worksheets?.[0];

    if (!worksheet) {
      throw new SpreadsheetParseError(
        'SHEET_NOT_FOUND',
        '엑셀 파일에 읽을 수 있는 시트가 없습니다.'
      );
    }

    const rawRows = [];

    worksheet.eachRow({ includeEmpty: false }, (worksheetRow) => {
      rawRows.push(
        worksheetRow.values
          .slice(1)
          .map(normalizeCell)
      );
    });

    const parsed = splitHeaderAndRows(
      trimEmptyEdges(rawRows)
    );

    if (parsed.columns.length === 0) {
      throw new SpreadsheetParseError(
        'EMPTY_SPREADSHEET',
        '엑셀 파일에서 컬럼을 찾지 못했습니다.'
      );
    }

    return {
      fileName: file.name,
      ...parsed,
    };
  }

  throw new SpreadsheetParseError(
    'UNSUPPORTED_EXTENSION',
    'CSV 또는 XLSX 파일만 업로드할 수 있습니다.'
  );
}
