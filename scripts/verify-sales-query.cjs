const path = require("node:path");

const {
  closeDatabase,
  getDatabaseForInternalUse,
  getFilteredSalesData,
} = require("../public/database/localDb.cjs");

const userData = path.join(process.env.APPDATA, "excel-desktop-app");
const database = getDatabaseForInternalUse({ getPath: () => userData });

const ranges = [
  ["2026-06-01", "2026-06-30"],
  ["2026-07-01", "2026-07-31"],
  ["2026-08-01", "2026-08-31"],
  ["2026-09-01", "2026-09-30"],
  ["2026-06-01", "2026-09-30"],
];

const results = ranges.map(([startDate, endDate]) => {
  const result = getFilteredSalesData(database, {
    startDate,
    endDate,
    status: "전체",
    customer: "",
    product: "",
    owner: "전체",
    page: 1,
    pageSize: 50,
  });

  return {
    startDate,
    endDate,
    total: result.data.total,
    returnedRows: result.data.rows.length,
    owners: result.data.ownerOptions,
    fileName: result.data.fileName,
  };
});

console.log(JSON.stringify(results, null, 2));
closeDatabase();
