const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { deleteLocalContact, getFilteredContacts, saveLocalContact } = require('../public/database/localDb.cjs');

const database = new Database(':memory:');
try {
  database.exec(`
    CREATE TABLE customers (
      customer_code TEXT PRIMARY KEY,
      customer_name TEXT,
      business_number TEXT,
      tax_status TEXT,
      status TEXT,
      memo TEXT,
      updated_at TEXT
    );
    CREATE TABLE contacts (
      contact_id INTEGER PRIMARY KEY,
      customer_code TEXT,
      department_name TEXT,
      recipient_name TEXT,
      recipient_email TEXT,
      recipient_phone TEXT,
      preferred_channel TEXT,
      status TEXT,
      memo TEXT,
      updated_at TEXT
    );
    INSERT INTO customers (customer_code, customer_name) VALUES ('A', '가온상사'), ('B', '누리상사');
    INSERT INTO contacts (contact_id, customer_code, recipient_name, recipient_email, preferred_channel, status)
    VALUES (1, 'A', '김담당', 'kim@example.com', 'EMAIL', 'ACTIVE'),
           (2, 'B', '이담당', 'lee@example.com', 'EMAIL', 'ACTIVE');
  `);

  const found = getFilteredContacts(database, { customer: '가온', email: 'lee@example.com' });
  assert.equal(found.data.total, 2, '입력된 검색어는 OR로 결합되어야 한다');
  assert.equal(getFilteredContacts(database, { customer: '%' }).data.total, 0, 'LIKE 특수문자는 문자 그대로 검색해야 한다');

  const updated = saveLocalContact(database, {
    contactId: 1,
    customerCode: 'A',
    customerName: '가온상사',
    recipientName: '박담당',
    recipientEmail: 'park@example.com',
  });
  assert.equal(updated.contactId, 1);
  assert.equal(updated.recipientName, '박담당');
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM contacts').get().count, 2);
  assert.throws(() => saveLocalContact(database, {
    contactId: 999,
    customerCode: 'A',
    customerName: '가온상사',
    recipientName: '새담당',
  }), /찾을 수 없습니다/);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM contacts').get().count, 2);
  deleteLocalContact(database, 1);
  assert.equal(database.prepare('SELECT status FROM contacts WHERE contact_id = 1').get().status, 'INACTIVE');
  assert.equal(database.prepare('SELECT status FROM contacts WHERE contact_id = 2').get().status, 'ACTIVE');
  assert.equal(getFilteredContacts(database, {}).data.total, 1);
  console.log('contact OR search, ID update, and ID deletion: OK');
} finally {
  database.close();
}
