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
