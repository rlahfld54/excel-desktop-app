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
