const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  closeDatabase,
  getDatabaseForInternalUse,
  registerDatabaseIpc,
  saveCustomerAliasMapping,
  setCustomerAliasMappingStatus,
  importCustomerAliasMappings,
} = require('../public/database/localDb.cjs');

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'excel-customer-alias-'));
const fakeApp = { getPath: () => testRoot };
const handlers = new Map();
const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) };

try {
  registerDatabaseIpc(ipcMain, fakeApp);
  assert.ok(handlers.has('customer-alias-mappings:import'));
  const database = getDatabaseForInternalUse(fakeApp);
  assert.ok(database.prepare("SELECT 1 FROM sqlite_master WHERE name = 'customer_alias_mappings'").get());
  database.prepare("INSERT INTO customers (customer_code, customer_name, status) VALUES ('C001', '대성산업', 'ACTIVE'), ('C002', '미사용 거래처', 'INACTIVE'), ('C003', '한빛상사', 'ACTIVE')").run();

  const save = (payload) => handlers.get('customer-alias-mappings:save')(null, payload).mapping;
  const setStatus = (payload) => handlers.get('customer-alias-mappings:set-status')(null, payload).mapping;
  const original = save({ sourceCustomerCode: ' 00123 ', sourceCustomerName: ' (주)대성 ', customerCode: 'C001' });
  assert.equal(original.sourceCustomerCode, '00123');
  assert.equal(original.customerName, '대성산업');
  assert.ok(original.syncKey);
  assert.equal(handlers.get('master-data:get')().customerAliases.length, 1);

  assert.throws(() => save({ sourceCustomerCode: '00123', sourceCustomerName: '(주)대성', customerCode: 'C001' }), /이미 있습니다/);
  assert.throws(() => save({ sourceCustomerCode: ' ', sourceCustomerName: '', customerCode: 'C001' }), /하나를 입력/);
  assert.throws(() => save({ sourceCustomerName: '신규', customerCode: 'UNKNOWN' }), /찾을 수 없습니다/);
  assert.throws(() => save({ sourceCustomerName: '신규', customerCode: 'C002' }), /사용 중인 기준/);
  assert.throws(() => save({ sourceType: 'INVALID', sourceCustomerName: '신규', customerCode: 'C001' }), /업로드 출처/);

  const updated = save({ mappingId: original.mappingId, sourceCustomerCode: '00124', sourceCustomerName: '(주)대성', customerCode: 'C001', status: 'ACTIVE' });
  assert.equal(updated.mappingId, original.mappingId);
  assert.equal(updated.syncKey, original.syncKey);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM customer_alias_mappings').get().count, 1);

  const importRows = Array.from({ length: 10 }, (_, index) => ({
    sourceCustomerCode: `B${index + 1}`,
    sourceCustomerName: '', customerCode: 'C001', status: 'ACTIVE',
  }));
  importRows[0] = { sourceCustomerCode: 'CODE-ONLY', customerCode: 'C001' };
  importRows[1] = { sourceCustomerName: 'NAME-ONLY', customerCode: 'C001' };
  const imported = handlers.get('customer-alias-mappings:import')(null, { rows: importRows, duplicateStrategy: 'SKIP' });
  assert.equal(imported.insertedCount, 10);
  assert.equal(imported.totalCount, 10);
  const countBeforeFailures = database.prepare('SELECT COUNT(*) AS count FROM customer_alias_mappings').get().count;
  const rejected = [
    [{ sourceCustomerName: 'valid', customerCode: 'C001' }, { sourceCustomerCode: '', sourceCustomerName: '', customerCode: 'C001' }],
    [{ sourceCustomerName: 'unknown', customerCode: 'MISSING' }],
    [{ sourceCustomerName: 'inactive', customerCode: 'C002' }],
    [{ sourceCustomerName: 'same', customerCode: 'C001' }, { sourceCustomerName: 'same', customerCode: 'C001' }],
  ];
  rejected.forEach((rows) => {
    assert.throws(() => importCustomerAliasMappings(database, { rows }));
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM customer_alias_mappings').get().count, countBeforeFailures);
  });
  const existingRow = { sourceCustomerCode: 'CODE-ONLY', customerCode: 'C003', status: 'INACTIVE', memo: 'updated' };
  const skipped = importCustomerAliasMappings(database, { rows: [existingRow], duplicateStrategy: 'SKIP' });
  assert.equal(skipped.skippedCount, 1);
  const existingBefore = database.prepare("SELECT mapping_id AS id, sync_key AS syncKey, created_at AS createdAt FROM customer_alias_mappings WHERE source_customer_code = 'CODE-ONLY'").get();
  const overwritten = importCustomerAliasMappings(database, { rows: [existingRow], duplicateStrategy: 'UPDATE' });
  assert.equal(overwritten.updatedCount, 1);
  const existingAfter = database.prepare("SELECT mapping_id AS id, sync_key AS syncKey, created_at AS createdAt, customer_code AS customerCode, status, memo FROM customer_alias_mappings WHERE source_customer_code = 'CODE-ONLY'").get();
  assert.equal(existingAfter.id, existingBefore.id);
  assert.equal(existingAfter.syncKey, existingBefore.syncKey);
  assert.equal(existingAfter.createdAt, existingBefore.createdAt);
  assert.equal(existingAfter.customerCode, 'C003');
  assert.equal(existingAfter.status, 'INACTIVE');
  assert.equal(existingAfter.memo, 'updated');
  assert.equal(setStatus({ mappingId: original.mappingId, status: 'INACTIVE' }).status, 'INACTIVE');
  assert.equal(setStatus({ mappingId: original.mappingId, status: 'ACTIVE' }).status, 'ACTIVE');
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM customer_alias_mappings').get().count, 11);
  closeDatabase();

  registerDatabaseIpc(ipcMain, fakeApp);
  assert.equal(handlers.get('master-data:get')().customerAliases.length, 11);
  assert.equal(handlers.get('master-data:get')().customers.length, 3);
  console.log('Customer alias mapping SQLite verification passed.');
} finally {
  closeDatabase();
  fs.rmSync(testRoot, { recursive: true, force: true });
}
