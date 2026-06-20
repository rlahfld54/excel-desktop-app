function sanitizeFileName(value) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    || 'excel-sample-data';
}

function getColumnWidth(column, rows, index) {
  const maxLength = rows.reduce((max, row) => {
    const length = String(row[index] ?? '').length;
    return Math.max(max, length);
  }, String(column).length);

  return Math.min(Math.max(maxLength + 2, 10), 28);
}

function hexToArgb(hexColor, fallback = 'FF0F766E') {
  const normalized = String(hexColor || '').replace('#', '').trim();
  return normalized.length === 6 ? `FF${normalized.toUpperCase()}` : fallback;
}

function sanitizeSheetName(value, fallback = 'Sheet') {
  return (String(value || fallback).replace(/[\\/?*[\]:]/g, ' ').trim() || fallback).slice(0, 31);
}

async function saveWorkbook(workbook, suggestedName) {
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  if (window.api?.saveFileAs) {
    const result = await window.api.saveFileAs({
      fileName: suggestedName,
      bytes: Array.from(bytes),
      openFolder: true,
    });

    if (result?.canceled) {
      const error = new Error('다운로드가 취소되었습니다.');
      error.name = 'AbortError';
      throw error;
    }

    return {
      fileName: suggestedName,
      saveMode: 'electron-dialog',
      filePath: result?.filePath,
    };
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { fileName: suggestedName, saveMode: 'browser-downloads' };
}

function styleTableWorksheet(worksheet, headerRowNumber = 1, errorExcelRows = new Set()) {
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: worksheet.columnCount },
  };

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < headerRowNumber) return;
    const hasError = errorExcelRows.has(rowNumber);
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      if (hasError && rowNumber !== headerRowNumber) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
        cell.font = { ...(cell.font ?? {}), bold: true, color: { argb: 'FFFF0000' } };
      }
    });
  });
}

function addRowsSheet(workbook, sheetName, columns, rows, errorRowNumbers = new Set(), startRow = 1) {
  const worksheet = workbook.addWorksheet(sanitizeSheetName(sheetName));
  worksheet.columns = columns.map((column, index) => ({
    header: column,
    key: `col_${index}`,
    width: getColumnWidth(column, rows, index),
  }));
  if (startRow > 1) {
    worksheet.spliceRows(1, 0, ...Array.from({ length: startRow - 1 }, () => []));
  }
  worksheet.addRows(rows);
  styleTableWorksheet(
    worksheet,
    startRow,
    new Set([...errorRowNumbers].map((rowNumber) => rowNumber + startRow))
  );
  return worksheet;
}

function addPlainRowsSheet(workbook, sheetName, columns, rows) {
  const worksheet = workbook.addWorksheet(sanitizeSheetName(sheetName));
  worksheet.columns = columns.map((column, index) => ({
    header: column,
    key: `col_${index}`,
    width: getColumnWidth(column, rows, index),
  }));
  worksheet.addRows(rows);
  return worksheet;
}

function getIssueRows(validation) {
  return Object.values(validation?.issuesByRow ?? {}).flat();
}

function getCellByIndex(row, index) {
  return index >= 0 ? row[index] : '';
}

function toExportNumber(value) {
  const number = Number(String(value ?? '').replaceAll(',', ''));
  return Number.isFinite(number) ? number : 0;
}

function findColumnIndexByNames(columns, names) {
  const normalizedNames = names.map((name) => String(name).replace(/\s+/g, '').toLowerCase());
  return columns.findIndex((column) => normalizedNames.includes(String(column ?? '').replace(/\s+/g, '').toLowerCase()));
}

function buildReviewSummaryRows({ issues, columns, rows, indexes }) {
  const reviewIssues = issues.filter((issue) => issue.severity === 'review');
  const groups = new Map();

  reviewIssues.forEach((issue) => {
    const row = rows[issue.rowIndex] ?? [];
    const date = getCellByIndex(row, indexes.date);
    const productCode = getCellByIndex(row, indexes.productCode);
    const productName = getCellByIndex(row, indexes.productName);
    const customerName = getCellByIndex(row, indexes.customerName);
    const quantity = toExportNumber(getCellByIndex(row, indexes.quantity));
    const amount = toExportNumber(getCellByIndex(row, indexes.amount));
    const key = [date, productCode, productName, customerName, issue.type].join('|');
    const previous = groups.get(key) ?? {
      date,
      productCode,
      productName,
      customerName,
      quantityTotal: 0,
      amountTotal: 0,
      count: 0,
      types: new Set(),
      rowNumbers: [],
    };

    previous.quantityTotal += Number.isFinite(quantity) ? quantity : 0;
    previous.amountTotal += Number.isFinite(amount) ? amount : 0;
    previous.count += 1;
    previous.types.add(issue.type);
    previous.rowNumbers.push(issue.rowNumber);
    groups.set(key, previous);
  });

  return [...groups.values()].map((group) => [
    group.date,
    group.productCode,
    group.productName,
    group.customerName,
    group.quantityTotal,
    group.amountTotal,
    group.count,
    [...group.types].join(', '),
    group.rowNumbers.join(', '),
  ]);
}

function getReviewActionText(issue) {
  if (issue.type === '대량 거래 확인') return '수량이 기준을 넘었습니다. 실제 주문/출고 수량이 맞는지 확인해주세요.';
  if (issue.type === '고액 거래 확인') return '금액이 기준을 넘었습니다. 거래 금액 승인 또는 계약 기준을 확인해주세요.';
  if (issue.type === '기타 확인') return '상태/비고에 검토 문구가 있습니다. 담당자 확인 결과를 남겨주세요.';
  return issue.message;
}

function getRowFields(row, indexes) {
  return {
    date: getCellByIndex(row, indexes.date),
    customerCode: getCellByIndex(row, indexes.customerCode),
    customerName: getCellByIndex(row, indexes.customerName),
    productCode: getCellByIndex(row, indexes.productCode),
    productName: getCellByIndex(row, indexes.productName),
    quantity: getCellByIndex(row, indexes.quantity),
    unitPrice: getCellByIndex(row, indexes.unitPrice),
    amount: getCellByIndex(row, indexes.amount),
  };
}

function getComparisonText(issue, row, indexes) {
  if (issue.type !== '금액 불일치') return issue.message;

  const quantity = toExportNumber(getCellByIndex(row, indexes.quantity));
  const unitPrice = toExportNumber(getCellByIndex(row, indexes.unitPrice));
  const amount = toExportNumber(getCellByIndex(row, indexes.amount));
  const expected = quantity * unitPrice;

  return `수량 ${quantity.toLocaleString('ko-KR')} x 단가 ${unitPrice.toLocaleString('ko-KR')} = ${expected.toLocaleString('ko-KR')} / 업로드 금액 ${amount.toLocaleString('ko-KR')}`;
}

function buildFixRows(issues, rows, indexes, autoFixes) {
  return issues
    .filter((issue) => issue.severity === 'block')
    .map((issue) => {
      const fields = getRowFields(rows[issue.rowIndex] ?? [], indexes);
      return [
        issue.rowNumber,
        issue.type,
        issue.message,
        getComparisonText(issue, rows[issue.rowIndex] ?? [], indexes),
        fields.date,
        fields.customerCode,
        fields.customerName,
        fields.productCode,
        fields.productName,
        fields.quantity,
        fields.unitPrice,
        fields.amount,
        autoFixes[issue.rowIndex]?.summary ?? '',
        '',
        '',
        '',
      ];
    });
}

function buildReviewRows(issues, rows, indexes) {
  return issues
    .filter((issue) => issue.severity === 'review')
    .map((issue) => {
      const fields = getRowFields(rows[issue.rowIndex] ?? [], indexes);
      return [
        issue.type,
        issue.rowNumber,
        fields.date,
        fields.customerCode,
        fields.customerName,
        fields.productCode,
        fields.productName,
        fields.quantity,
        fields.unitPrice,
        fields.amount,
        getReviewActionText(issue),
        '',
        '',
        '',
      ];
    });
}

function buildOriginalDataRows({ originalColumns, originalRows }) {
  const indexes = {
    date: findColumnIndexByNames(originalColumns, ['거래일', '일자', '매출일', '마감일']),
    customerName: findColumnIndexByNames(originalColumns, ['거래처명', '거래처', '업체명', '고객사명']),
    customerCode: findColumnIndexByNames(originalColumns, ['거래처코드', '거래처 코드', '고객코드', '업체코드']),
    productName: findColumnIndexByNames(originalColumns, ['품목명', '상품명', '제품명']),
    productCode: findColumnIndexByNames(originalColumns, ['품목코드', '품목 코드', '상품코드', '제품코드']),
    quantity: findColumnIndexByNames(originalColumns, ['수량', '거래수량', '판매수량']),
    unitPrice: findColumnIndexByNames(originalColumns, ['단가', '판매단가', '기준단가']),
    amount: findColumnIndexByNames(originalColumns, ['금액', '매출금액', '합계금액', '요청금액']),
    owner: findColumnIndexByNames(originalColumns, ['담당자', '담당', '소유자']),
  };

  return originalRows.map((row) => [
    getCellByIndex(row, indexes.date),
    getCellByIndex(row, indexes.customerName),
    getCellByIndex(row, indexes.customerCode),
    getCellByIndex(row, indexes.productName),
    getCellByIndex(row, indexes.productCode),
    getCellByIndex(row, indexes.quantity),
    getCellByIndex(row, indexes.unitPrice),
    getCellByIndex(row, indexes.amount),
    getCellByIndex(row, indexes.owner),
  ]);
}

function buildIssueCountRows(issueRows) {
  const counts = issueRows.reduce((map, issue) => {
    map[issue.type] = (map[issue.type] ?? 0) + 1;
    return map;
  }, {});

  return Object.entries(counts).map(([type, count]) => [type, `${count.toLocaleString('ko-KR')}건`]);
}

function addGuideSheet(workbook, { title, totalIssues, fixCount, reviewCount, issueCountRows }) {
  const worksheet = workbook.addWorksheet('검토 안내');
  worksheet.columns = [
    { width: 20 },
    { width: 76 },
  ];
  worksheet.addRows([
    [`${title} 검토 요청`],
    ['파일명', title],
    ['생성일', new Date().toLocaleString('ko-KR')],
    ['수정 필요', `${fixCount.toLocaleString('ko-KR')}건`],
    ['재확인 필요', `${reviewCount.toLocaleString('ko-KR')}건`],
    ['전체 요청', `${totalIssues.toLocaleString('ko-KR')}건`],
    [],
    ['작성 방법', '수정 필요 시트는 담당자 수정값, 담당자 메모, 처리상태를 입력해주세요.'],
    ['작성 방법', '재확인 필요 시트는 담당자 확인결과, 담당자 메모, 처리상태를 입력해주세요.'],
    ['처리상태 예시', '수정 완료 / 정상 확인 / 보류 / 확인 불가'],
    [],
    ['유형별 건수', '건수'],
    ...issueCountRows,
  ]);

  worksheet.mergeCells('A1:B1');
  worksheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF064E3B' } };
  worksheet.getCell('A1').alignment = { vertical: 'middle' };
  worksheet.getRow(1).height = 28;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || rowNumber === 7 || rowNumber === 11) return;
    row.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      if (colNumber === 1) {
        cell.font = { bold: true, color: { argb: 'FF111827' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4F1' } };
      }
    });
  });
}

function styleResponseColumns(worksheet, headerRowNumber, labels) {
  const headerValues = worksheet.getRow(headerRowNumber).values;
  labels.forEach((label) => {
    const columnIndex = headerValues.findIndex((value) => value === label);
    if (columnIndex < 1) return;
    worksheet.getColumn(columnIndex).eachCell((cell, rowNumber) => {
      if (rowNumber === headerRowNumber) return;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7CC' } };
    });
  });
}

export async function exportValidationWorkbookToXlsx({
  title,
  originalColumns,
  originalRows,
  editedColumns,
  editedRows,
  validation,
  originalValidation,
  autoFixes = {},
}) {
  const ExcelModule = await import('exceljs');
  const ExcelJS = ExcelModule.default ?? ExcelModule;
  const workbook = new ExcelJS.Workbook();
  const displayTitle = title?.trim() || 'upload-validation-result';
  const suggestedName = `${sanitizeFileName(displayTitle)}.xlsx`;
  const baseValidation = originalValidation ?? validation;
  const issueRows = getIssueRows(baseValidation);
  const editedIndexes = validation?.indexes ?? baseValidation?.indexes ?? {};

  workbook.creator = 'Excel Desktop App';
  workbook.created = new Date();
  workbook.modified = new Date();

  const fixRows = buildFixRows(issueRows, editedRows, editedIndexes, autoFixes);
  const reviewRows = buildReviewRows(issueRows, editedRows, editedIndexes);

  const reviewSummaryRows = buildReviewSummaryRows({
    issues: issueRows,
    columns: editedColumns,
    rows: editedRows,
    indexes: editedIndexes,
  });

  addGuideSheet(workbook, {
    title: displayTitle,
    totalIssues: fixRows.length + reviewRows.length,
    fixCount: fixRows.length,
    reviewCount: reviewRows.length,
    issueCountRows: buildIssueCountRows(issueRows),
  });

  const fixSheet = addRowsSheet(
    workbook,
    '수정 필요',
    ['원본행', '오류유형', '오류내용', '비교', '거래일', '거래처코드', '거래처명', '품목코드', '품목명', '수량', '단가', '금액', '자동수정값', '담당자 수정값', '담당자 메모', '처리상태'],
    fixRows
  );
  styleResponseColumns(fixSheet, 1, ['담당자 수정값', '담당자 메모', '처리상태']);

  addRowsSheet(
    workbook,
    '재확인 요약',
    ['날짜', '품목코드', '품목명', '거래처', '수량합계', '금액합계', '건수', '확인유형', '원본 행'],
    reviewSummaryRows
  );

  const reviewSheet = addRowsSheet(
    workbook,
    '재확인 필요',
    ['확인유형', '원본행', '거래일', '거래처코드', '거래처명', '품목코드', '품목명', '수량', '단가', '금액', '확인 포인트', '담당자 확인결과', '담당자 메모', '처리상태'],
    reviewRows
  );
  styleResponseColumns(reviewSheet, 1, ['담당자 확인결과', '담당자 메모', '처리상태']);

  addPlainRowsSheet(
    workbook,
    '원본 데이터',
    ['거래일', '거래처명', '거래처코드', '품목명', '품목코드', '수량', '단가', '금액', '담당자'],
    buildOriginalDataRows({ originalColumns, originalRows })
  );

  return saveWorkbook(workbook, suggestedName);
}

export async function exportRowsToXlsx({
  columns,
  rows,
  title,
  sheetName = 'Sample Data',
}) {
  const displayTitle = title?.trim() || 'excel-sample-data';
  const suggestedName = `${sanitizeFileName(displayTitle)}.xlsx`;
  let browserFileHandle = null;

  if (!window.api?.saveFileAs && 'showSaveFilePicker' in window) {
    try {
      browserFileHandle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Excel Workbook',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            },
          },
        ],
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      browserFileHandle = null;
    }
  }

  const ExcelModule = await import('exceljs');
  const ExcelJS = ExcelModule.default ?? ExcelModule;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  workbook.creator = 'Excel Desktop App';
  workbook.created = new Date();
  workbook.modified = new Date();

  worksheet.columns = columns.map((column, index) => ({
    header: column,
    key: `col_${index}`,
    width: getColumnWidth(column, rows, index),
  }));

  worksheet.spliceRows(1, 0, [displayTitle]);
  worksheet.mergeCells(1, 1, 1, columns.length);
  worksheet.getRow(1).height = 24;
  worksheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF064E3B' } };
  worksheet.getCell(1, 1).alignment = { vertical: 'middle' };
  worksheet.addRows(rows);

  worksheet.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(2).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF059669' },
  };
  worksheet.getRow(2).alignment = { vertical: 'middle' };
  worksheet.views = [{ state: 'frozen', ySplit: 2 }];
  worksheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  if (window.api?.saveFileAs) {
    const result = await window.api.saveFileAs({
      fileName: suggestedName,
      bytes: Array.from(bytes),
      openFolder: true,
    });

    if (result?.canceled) {
      const error = new Error('다운로드가 취소되었습니다.');
      error.name = 'AbortError';
      throw error;
    }

    return {
      fileName: suggestedName,
      saveMode: 'electron-dialog',
      filePath: result?.filePath,
    };
  }

  if (browserFileHandle) {
    const writable = await browserFileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { fileName: suggestedName, saveMode: 'location-picker' };
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { fileName: suggestedName, saveMode: 'browser-downloads' };
}

export async function exportStyledReportToXlsx({
  title,
  company,
  template,
  summary,
  customerRows,
  statusRows,
}) {
  const ExcelModule = await import('exceljs');
  const ExcelJS = ExcelModule.default ?? ExcelModule;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('보고서');
  const accent = hexToArgb(template.color);
  const lightAccent = 'FFE6F4F1';
  const suggestedName = `${sanitizeFileName(`${company.koreanName}_${template.title}_${title}`)}.xlsx`;

  workbook.creator = 'Excel Desktop App';
  workbook.created = new Date();
  workbook.modified = new Date();

  worksheet.columns = [
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];
  worksheet.views = [{ state: 'frozen', ySplit: 7 }];
  worksheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };

  worksheet.mergeCells('A1:F2');
  worksheet.getCell('A1').value = `${company.koreanName} · ${company.department}`;
  worksheet.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' }, name: template.font };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } };

  worksheet.mergeCells('A3:F4');
  worksheet.getCell('A3').value = title;
  worksheet.getCell('A3').font = { bold: true, size: 20, color: { argb: 'FF111827' }, name: template.font };
  worksheet.getCell('A3').alignment = { vertical: 'middle', horizontal: 'left' };

  worksheet.mergeCells('A5:F5');
  worksheet.getCell('A5').value = template.purpose;
  worksheet.getCell('A5').font = { size: 10, color: { argb: 'FF4B5563' }, name: template.font };

  const summaryRow = worksheet.getRow(7);
  summaryRow.values = summary.flatMap((item) => [item.label, item.value]).slice(0, 6);
  summaryRow.height = 30;
  summaryRow.eachCell((cell, colNumber) => {
    cell.font = { bold: colNumber % 2 === 1, color: { argb: colNumber % 2 === 1 ? accent : 'FF111827' }, name: template.font };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNumber % 2 === 1 ? lightAccent : 'FFFFFFFF' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });

  worksheet.mergeCells('A9:F9');
  worksheet.getCell('A9').value = '거래처별 거래 현황';
  worksheet.getCell('A9').font = { bold: true, size: 14, color: { argb: accent }, name: template.font };

  worksheet.getRow(10).values = ['거래처', '매출액', '비율', '관리 포인트', '상태', '비고'];
  customerRows.forEach((row) => worksheet.addRow(row));

  const statusStart = 12 + customerRows.length;
  worksheet.mergeCells(`A${statusStart}:F${statusStart}`);
  worksheet.getCell(`A${statusStart}`).value = '검증 종류별 현황';
  worksheet.getCell(`A${statusStart}`).font = { bold: true, size: 14, color: { argb: accent }, name: template.font };
  worksheet.getRow(statusStart + 1).values = ['검증 종류', '건수', '비율', '처리 기준', '담당', '완료 예정'];
  statusRows.forEach((row) => worksheet.addRow(row));

  [10, statusStart + 1].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: template.font };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < 10) return;
    row.eachCell((cell) => {
      cell.font = { ...cell.font, name: template.font };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });

  return saveWorkbook(workbook, suggestedName);
}

function styleTemplateWorksheet(worksheet, accent = 'FF0F766E') {
  worksheet.getRow(1).height = 28;
  worksheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } };
  worksheet.getRow(1).alignment = { vertical: 'middle' };

  worksheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
  worksheet.getRow(3).alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.views = [{ state: 'frozen', ySplit: 3 }];
  worksheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: worksheet.columnCount },
  };

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < 3) return;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });
}

function addTemplateSheet(workbook, template) {
  const accent = 'FF0F766E';
  const requiredColumns = Array.isArray(template.requiredColumns) ? template.requiredColumns : [];
  const optionalColumns = Array.isArray(template.optionalColumns) ? template.optionalColumns : [];
  const sampleRows = Array.isArray(template.sampleRows) ? template.sampleRows : [];
  const rules = Array.isArray(template.rules) ? template.rules : [];
  const columns = [...requiredColumns, ...optionalColumns];
  const worksheet = workbook.addWorksheet(template.title.slice(0, 30));

  worksheet.columns = columns.map((column) => ({
    header: column,
    key: column,
    width: Math.min(Math.max(column.length + 8, 14), 26),
  }));
  worksheet.spliceRows(1, 0, [`${template.title} 업로드 양식`]);
  worksheet.mergeCells(1, 1, 1, columns.length);
  worksheet.spliceRows(2, 0, [template.description]);
  worksheet.mergeCells(2, 1, 2, columns.length);
  worksheet.addRows(sampleRows);
  styleTemplateWorksheet(worksheet, accent);

  requiredColumns.forEach((_, index) => {
    worksheet.getCell(3, index + 1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: accent },
    };
  });

  const guide = workbook.addWorksheet(`${template.title.slice(0, 24)}_작성규칙`);
  guide.columns = [
    { header: '구분', key: 'type', width: 16 },
    { header: '내용', key: 'content', width: 80 },
  ];
  guide.addRows([
    ['양식명', template.title],
    ['사용 메뉴', template.targetMenu],
    ['필수 컬럼', requiredColumns.join(', ')],
    ['선택 컬럼', optionalColumns.join(', ')],
    ...rules.map((rule, index) => [`규칙 ${index + 1}`, rule]),
  ]);
  guide.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  guide.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } };
  guide.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });
}

export async function exportUploadTemplateToXlsx(template) {
  const ExcelModule = await import('exceljs');
  const ExcelJS = ExcelModule.default ?? ExcelModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Excel Desktop App';
  workbook.created = new Date();
  workbook.modified = new Date();
  addTemplateSheet(workbook, template);
  return saveWorkbook(workbook, `${sanitizeFileName(template.fileName)}.xlsx`);
}

export async function exportAllUploadTemplatesToXlsx(templates) {
  const ExcelModule = await import('exceljs');
  const ExcelJS = ExcelModule.default ?? ExcelModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Excel Desktop App';
  workbook.created = new Date();
  workbook.modified = new Date();

  templates.forEach((template) => addTemplateSheet(workbook, template));

  return saveWorkbook(workbook, '엑셀_첨부_표준_양식_전체.xlsx');
}
