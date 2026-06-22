export function findDuplicateGroups(rows = []) {
  const groups = new Map();

  rows.forEach((row, index) => {
    const key = [row[0], row[1], row[2], row[4], row[6]].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, rowIndex: index });
  });

  return Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([key, items], index) => ({
      id: `D-${String(index + 1).padStart(3, '0')}`,
      key,
      items,
      rowNumbers: items.map((item) => item.rowIndex + 1).join(', '),
      customerName: items[0].row[1],
      productName: items[0].row[3],
      amount: items[0].row[6],
      confidence: items.length > 2 ? '매우 높음' : '높음',
      status: '검토',
    }));
}
