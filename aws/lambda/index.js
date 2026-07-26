const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

let pool;
let s3;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing Lambda environment variable: ${name}`);
  return value;
}

function getPool() {
  if (pool) return pool;
  pool = new Pool({
    host: requiredEnv('DB_HOST'),
    port: Number(process.env.DB_PORT || 5432),
    database: requiredEnv('DB_NAME'),
    user: requiredEnv('DB_USER'),
    password: requiredEnv('DB_PASSWORD'),
    max: 2,
    connectionTimeoutMillis: 10000,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
  return pool;
}

function getS3() {
  if (!s3) s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-2' });
  return s3;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type,authorization,x-api-key',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    },
    body: statusCode === 204 ? '' : JSON.stringify(body),
  };
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    throw httpError(400, 'Request body must be valid JSON.');
  }
}

function requestInfo(event) {
  return {
    method: event.requestContext?.http?.method || event.httpMethod || 'GET',
    path: event.rawPath || event.path || '/',
    headers: event.headers || {},
    query: event.queryStringParameters || {},
  };
}

function authenticate(headers) {
  const authorization = headers.authorization || headers.Authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) throw httpError(401, '로그인이 필요합니다.');
  try {
    return jwt.verify(token, requiredEnv('JWT_SECRET'));
  } catch {
    throw httpError(401, '로그인 토큰이 유효하지 않거나 만료되었습니다.');
  }
}

function toCamelCase(key) {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toClientRecord(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [toCamelCase(key), value]));
}

function safeUser(row) {
  return {
    userId: String(row.user_id),
    username: row.username,
    name: row.name || row.username,
    role: row.role,
    departmentName: row.department_name || '',
    email: row.email || '',
    phone: row.phone || '',
    status: row.status,
  };
}

function idFromPath(path) {
  const value = path.split('/').filter(Boolean).at(-1);
  if (!/^\d+$/.test(value || '')) throw httpError(400, '올바른 ID가 필요합니다.');
  return Number(value);
}

function pickFields(body, fields) {
  return fields.reduce((result, [clientKey, column]) => {
    if (Object.prototype.hasOwnProperty.call(body, clientKey)) result[column] = body[clientKey];
    return result;
  }, {});
}

async function updateById(table, idColumn, id, changes, actor) {
  const entries = Object.entries(changes);
  if (!entries.length) throw httpError(400, '수정할 값이 없습니다.');
  const values = entries.map(([, value]) => value);
  const sets = entries.map(([column], index) => `${column} = $${index + 1}`);
  if (actor) {
    values.push(actor);
    sets.push(`updated_by = $${values.length}`);
  }
  sets.push('updated_at = now()');
  sets.push('version = version + 1');
  values.push(id);
  const result = await getPool().query(
    `UPDATE ${table} SET ${sets.join(', ')} WHERE ${idColumn} = $${values.length} RETURNING *`,
    values,
  );
  if (!result.rows[0]) throw httpError(404, '대상을 찾을 수 없습니다.');
  return result.rows[0];
}

async function signup(body) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const name = String(body.name || body.displayName || '').trim();
  const departmentName = String(body.departmentName || '').trim();
  if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
    throw httpError(400, '아이디는 3~50자의 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.');
  }
  if (password.length < 8) throw httpError(400, '비밀번호는 8자 이상이어야 합니다.');
  if (!name) throw httpError(400, '이름을 입력해 주세요.');
  try {
    const result = await getPool().query(
      `INSERT INTO users (username, password_hash, name, department_name)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, username, name, role, department_name, email, phone, status`,
      [username, await bcrypt.hash(password, 12), name, departmentName || null],
    );
    return response(201, { user: safeUser(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') throw httpError(409, '이미 사용 중인 아이디입니다.');
    throw error;
  }
}

async function login(body) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) throw httpError(400, '아이디와 비밀번호를 입력해 주세요.');
  const result = await getPool().query(
    `SELECT user_id, username, password_hash, name, role, department_name, email, phone, status
     FROM users WHERE username = $1`, [username],
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw httpError(401, '아이디 또는 비밀번호가 틀렸습니다.');
  }
  if (user.status !== 'ACTIVE') throw httpError(403, '사용할 수 없는 계정입니다.');
  await getPool().query('UPDATE users SET last_login_at = now(), updated_at = now() WHERE user_id = $1', [user.user_id]);
  const profile = safeUser(user);
  return response(200, {
    token: jwt.sign({ sub: profile.userId, username: profile.username, role: profile.role }, requiredEnv('JWT_SECRET'), { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }),
    user: profile,
  });
}

const contactFields = [
  ['customerCode', 'customer_code'], ['customerName', 'customer_name'], ['businessNumber', 'business_number'],
  ['departmentName', 'department_name'], ['recipientName', 'recipient_name'], ['recipientTitle', 'recipient_title'],
  ['recipientEmail', 'recipient_email'], ['recipientPhone', 'recipient_phone'], ['preferredChannel', 'preferred_channel'],
  ['status', 'status'], ['memo', 'memo'],
];

async function contacts(method, path, body, actor) {
  if (method === 'GET') {
    const result = await getPool().query('SELECT * FROM contacts ORDER BY updated_at DESC, contact_id DESC');
    return response(200, { contacts: result.rows.map(toClientRecord) });
  }
  if (method === 'POST') {
    if (!String(body.customerName || '').trim() || !String(body.recipientName || '').trim()) throw httpError(400, '거래처명과 담당자명은 필수입니다.');
    const fields = pickFields(body, contactFields);
    const keys = Object.keys(fields);
    const values = keys.map((key) => fields[key]);
    const result = await getPool().query(
      `INSERT INTO contacts (${[...keys, 'created_by', 'updated_by'].join(', ')}) VALUES (${values.map((_, index) => `$${index + 1}`).join(', ')}, $${values.length + 1}, $${values.length + 2}) RETURNING *`,
      [...values, actor, actor],
    );
    return response(201, { contact: toClientRecord(result.rows[0]) });
  }
  if (method === 'PATCH') return response(200, { contact: toClientRecord(await updateById('contacts', 'contact_id', idFromPath(path), pickFields(body, contactFields), actor)) });
  if (method === 'DELETE') {
    const result = await getPool().query('DELETE FROM contacts WHERE contact_id = $1 RETURNING contact_id', [idFromPath(path)]);
    if (!result.rows[0]) throw httpError(404, '대상을 찾을 수 없습니다.');
    return response(204, {});
  }
  return response(405, { message: 'Method not allowed.' });
}

const closingFields = [
  ['companyName', 'company_name'], ['customerCode', 'customer_code'], ['ownerName', 'owner_name'], ['deadlineDay', 'deadline_day'],
  ['closingMonth', 'closing_month'], ['confirmedAmount', 'confirmed_amount'], ['taxAmount', 'tax_amount'], ['progress', 'progress'],
  ['status', 'status'], ['reason', 'reason'], ['memo', 'memo'],
];

async function closingCompanies(method, path, body, actor, query) {
  if (method === 'GET') {
    const values = query.closingMonth ? [query.closingMonth] : [];
    const result = await getPool().query(
      `SELECT * FROM closing_companies${values.length ? ' WHERE closing_month = $1' : ''} ORDER BY closing_month DESC, company_id DESC`, values,
    );
    return response(200, { closingCompanies: result.rows.map(toClientRecord) });
  }
  if (method === 'PATCH') return response(200, { closingCompany: toClientRecord(await updateById('closing_companies', 'company_id', idFromPath(path), pickFields(body, closingFields), actor)) });
  return response(405, { message: 'Method not allowed.' });
}

const todoFields = [
  ['itemType', 'item_type'], ['title', 'title'], ['description', 'description'], ['priority', 'priority'], ['status', 'status'],
  ['dueDate', 'due_date'], ['reminderAt', 'reminder_at'], ['completedAt', 'completed_at'],
];

async function todos(method, path, body, actor) {
  if (method === 'GET') {
    const result = await getPool().query('SELECT * FROM todo_items WHERE created_by = $1 ORDER BY due_date NULLS LAST, todo_id DESC', [actor]);
    return response(200, { todos: result.rows.map(toClientRecord) });
  }
  if (method === 'POST') {
    if (!String(body.title || '').trim()) throw httpError(400, '할 일 제목은 필수입니다.');
    const fields = pickFields(body, todoFields);
    const keys = Object.keys(fields);
    const values = keys.map((key) => fields[key]);
    const result = await getPool().query(
      `INSERT INTO todo_items (${[...keys, 'created_by', 'updated_by'].join(', ')}) VALUES (${values.map((_, index) => `$${index + 1}`).join(', ')}, $${values.length + 1}, $${values.length + 2}) RETURNING *`,
      [...values, actor, actor],
    );
    return response(201, { todo: toClientRecord(result.rows[0]) });
  }
  if (method === 'PATCH') return response(200, { todo: toClientRecord(await updateById('todo_items', 'todo_id', idFromPath(path), pickFields(body, todoFields), actor)) });
  if (method === 'DELETE') {
    const result = await getPool().query('DELETE FROM todo_items WHERE todo_id = $1 AND created_by = $2 RETURNING todo_id', [idFromPath(path), actor]);
    if (!result.rows[0]) throw httpError(404, '대상을 찾을 수 없습니다.');
    return response(204, {});
  }
  return response(405, { message: 'Method not allowed.' });
}

async function backups(method, body, actor) {
  if (method === 'GET') {
    const result = await getPool().query('SELECT * FROM backup_history ORDER BY created_at DESC, backup_id DESC');
    return response(200, { backups: result.rows.map(toClientRecord) });
  }
  if (method === 'POST') {
    const result = await getPool().query(
      `INSERT INTO backup_history (backup_type, s3_bucket, s3_key, file_name, size_bytes, message, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.backupType || 'MANUAL', body.s3Bucket || null, body.s3Key || null, body.fileName || null, Number(body.sizeBytes || 0), body.message || null, actor],
    );
    return response(201, { backup: toClientRecord(result.rows[0]) });
  }
  return response(405, { message: 'Method not allowed.' });
}

function safeFileName(value) {
  const name = String(value || 'file').split(/[\\/]/).pop().replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
  return name.slice(0, 180) || 'file';
}

function encodeRfc5987FileName(value) {
  return encodeURIComponent(String(value || 'file'))
    .replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function cloudFiles(method, path, body, actor) {
  const bucket = requiredEnv('S3_BUCKET');
  if (method === 'GET') {
    const result = await getPool().query('SELECT * FROM cloud_files WHERE uploaded_by = $1 ORDER BY uploaded_at DESC, file_id DESC', [actor]);
    return response(200, { files: result.rows.map(toClientRecord) });
  }
  if (method === 'POST' && path === '/files/presign') {
    const fileName = safeFileName(body.fileName);
    const extension = fileName.toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'pdf', 'csv'].includes(extension)) throw httpError(400, '엑셀, CSV, PDF 파일만 업로드할 수 있습니다.');
    const sizeBytes = Number(body.sizeBytes || 0);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > 100 * 1024 * 1024) throw httpError(400, '파일 크기는 100MB 이하만 허용됩니다.');
    const key = `user-files/${actor}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${fileName}`;
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: body.contentType || 'application/octet-stream' });
    const uploadUrl = await getSignedUrl(getS3(), command, { expiresIn: 900 });
    return response(200, { uploadUrl, key, fileName, contentType: body.contentType || 'application/octet-stream', expiresIn: 900 });
  }
  if (method === 'POST' && path === '/files/complete') {
    if (!String(body.key || '').startsWith(`user-files/${actor}/`)) throw httpError(403, '파일 소유자가 아닙니다.');
    const result = await getPool().query(`INSERT INTO cloud_files (object_key,file_name,content_type,size_bytes,uploaded_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (object_key) DO UPDATE SET size_bytes=EXCLUDED.size_bytes,status='AVAILABLE' RETURNING *`, [body.key, safeFileName(body.fileName), body.contentType || 'application/octet-stream', Number(body.sizeBytes || 0), actor]);
    return response(201, { file: toClientRecord(result.rows[0]) });
  }
  if (method === 'POST' && path === '/files/download-url') {
    const result = await getPool().query('SELECT * FROM cloud_files WHERE object_key = $1 AND uploaded_by = $2 AND status = $3', [body.key, actor, 'AVAILABLE']);
    if (!result.rows[0]) throw httpError(404, '파일을 찾을 수 없습니다.');
    const file = result.rows[0];
    const extension = safeFileName(file.file_name).split('.').pop().replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const encodedFileName = encodeRfc5987FileName(file.file_name);
    const contentDisposition = `attachment; filename="download.${extension}"; filename*=UTF-8''${encodedFileName}`;
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: file.object_key,
      ResponseContentDisposition: contentDisposition,
    });
    const downloadUrl = await getSignedUrl(getS3(), command, { expiresIn: 900 });
    return response(200, { downloadUrl, expiresIn: 900 });
  }
  return response(405, { message: 'Method not allowed.' });
}

async function saveExtendedWorkspace(client, source, actor) {
  const closingStatuses = Array.isArray(source?.closingStatuses) ? source.closingStatuses : [];
  for (const row of closingStatuses) {
    if (!row.closingMonth || !row.customerCode) continue;
    await client.query(`INSERT INTO closing_status (closing_month,customer_code,owner_name,deadline,contact_confirmed,amount_confirmed,confirmed_amount,tax_issued,tax_matched,request_ready,request_sent,closing_sheet_sent,reason,memo,history_json,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,COALESCE($16::timestamptz,now()),COALESCE($17::timestamptz,now()))
      ON CONFLICT (closing_month,customer_code) DO UPDATE SET owner_name=EXCLUDED.owner_name,deadline=EXCLUDED.deadline,contact_confirmed=EXCLUDED.contact_confirmed,amount_confirmed=EXCLUDED.amount_confirmed,confirmed_amount=EXCLUDED.confirmed_amount,tax_issued=EXCLUDED.tax_issued,tax_matched=EXCLUDED.tax_matched,request_ready=EXCLUDED.request_ready,request_sent=EXCLUDED.request_sent,closing_sheet_sent=EXCLUDED.closing_sheet_sent,reason=EXCLUDED.reason,memo=EXCLUDED.memo,history_json=EXCLUDED.history_json,updated_at=EXCLUDED.updated_at`,
      [row.closingMonth,row.customerCode,row.ownerName || null,row.deadline || '30일',Boolean(row.contactConfirmed),Boolean(row.amountConfirmed),Number(row.confirmedAmount || 0),Boolean(row.taxIssued),Boolean(row.taxMatched),Boolean(row.requestReady),Boolean(row.requestSent),Boolean(row.closingSheetSent),row.reason || '회신 대기',row.memo || null,JSON.stringify(row.historyJson || []),row.createdAt || null,row.updatedAt || null]);
  }
  const archives = Array.isArray(source?.archives) ? source.archives : [];
  for (const record of archives) {
    if (!record.table || record.key == null) continue;
    await client.query(`INSERT INTO local_sync_records (record_table,record_key,payload_json,updated_at,updated_by)
      VALUES ($1,$2,$3::jsonb,COALESCE($4::timestamptz,now()),$5)
      ON CONFLICT (record_table,record_key) DO UPDATE SET payload_json=EXCLUDED.payload_json,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by
      WHERE EXCLUDED.updated_at >= local_sync_records.updated_at`,
      [record.table,String(record.key),JSON.stringify(record.payload || {}),record.updatedAt || null,actor]);
  }
  return { closingStatuses: closingStatuses.length, archives: archives.length };
}

async function migrateWorkspace(body, actor) {
  const client = await getPool().connect();
  const source = body || {};
  const rows = (key) => Array.isArray(source[key]) ? source[key] : [];
  const summary = {};
  try {
    await client.query('BEGIN');
    for (const row of rows('customers')) {
      await client.query(`INSERT INTO customers (customer_code, customer_name, business_number, tax_status, status, memo, closing_json)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
        ON CONFLICT (customer_code) DO UPDATE SET customer_name=EXCLUDED.customer_name,business_number=EXCLUDED.business_number,tax_status=EXCLUDED.tax_status,status=EXCLUDED.status,memo=EXCLUDED.memo,closing_json=EXCLUDED.closing_json,updated_at=now()`,
      [row.customerCode, row.customerName, row.businessNumber || null, row.taxStatus || 'UNKNOWN', row.status || 'ACTIVE', row.memo || null, JSON.stringify(row.closingJson || null)]);
    }
    for (const row of rows('products')) {
      await client.query(`INSERT INTO products (product_code,product_name,unit,unit_price,currency,status,memo) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (product_code) DO UPDATE SET product_name=EXCLUDED.product_name,unit=EXCLUDED.unit,unit_price=EXCLUDED.unit_price,currency=EXCLUDED.currency,status=EXCLUDED.status,memo=EXCLUDED.memo,updated_at=now()`,
      [row.productCode,row.productName,row.unit || 'EA',Number(row.unitPrice || 0),row.currency || 'KRW',row.status || 'ACTIVE',row.memo || null]);
    }
    for (const row of rows('salesUploads')) {
      await client.query(`INSERT INTO sales_uploads (upload_key,file_name,closing_month,uploaded_department_code,uploaded_at,status,memo) VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz,now()),$6,$7)
        ON CONFLICT (upload_key) DO UPDATE SET file_name=EXCLUDED.file_name,closing_month=EXCLUDED.closing_month,status=EXCLUDED.status,memo=EXCLUDED.memo`,
      [row.uploadKey,row.fileName,row.closingMonth,row.uploadedDepartmentCode || null,row.uploadedAt || null,row.status || 'UPLOADED',row.memo || null]);
    }
    for (const row of rows('sales')) {
      await client.query(`INSERT INTO sales (upload_key,row_no,transaction_date,raw_customer_name,raw_product_name,customer_code,product_code,quantity,unit_price,sales_amount,validation_status,review_status,owner_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (upload_key,row_no) DO UPDATE SET transaction_date=EXCLUDED.transaction_date,raw_customer_name=EXCLUDED.raw_customer_name,raw_product_name=EXCLUDED.raw_product_name,customer_code=EXCLUDED.customer_code,product_code=EXCLUDED.product_code,quantity=EXCLUDED.quantity,unit_price=EXCLUDED.unit_price,sales_amount=EXCLUDED.sales_amount,validation_status=EXCLUDED.validation_status,review_status=EXCLUDED.review_status,owner_name=EXCLUDED.owner_name`,
      [row.uploadKey,row.rowNo,row.transactionDate || null,row.rawCustomerName || null,row.rawProductName || null,row.customerCode || null,row.productCode || null,row.quantity || null,row.unitPrice || null,row.salesAmount || null,row.validationStatus || 'PENDING',row.reviewStatus || 'WAITING',row.ownerName || null]);
    }
    for (const row of rows('contacts')) {
      const found = await client.query(`SELECT contact_id FROM contacts WHERE COALESCE(customer_code,'')=COALESCE($1,'') AND COALESCE(recipient_email,'')=COALESCE($2,'') AND recipient_name=$3 LIMIT 1`, [row.customerCode || null,row.recipientEmail || null,row.recipientName]);
      if (found.rows[0]) await client.query(`UPDATE contacts SET customer_name=$1,business_number=$2,department_name=$3,recipient_phone=$4,preferred_channel=$5,status=$6,memo=$7,updated_by=$8,updated_at=now(),version=version+1 WHERE contact_id=$9`, [row.customerName || row.customerCode || '미지정',row.businessNumber || null,row.departmentName || null,row.recipientPhone || null,row.preferredChannel || 'EMAIL',row.status || 'ACTIVE',row.memo || null,actor,found.rows[0].contact_id]);
      else await client.query(`INSERT INTO contacts (customer_code,customer_name,business_number,department_name,recipient_name,recipient_email,recipient_phone,preferred_channel,status,memo,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`, [row.customerCode || null,row.customerName || row.customerCode || '미지정',row.businessNumber || null,row.departmentName || null,row.recipientName,row.recipientEmail || null,row.recipientPhone || null,row.preferredChannel || 'EMAIL',row.status || 'ACTIVE',row.memo || null,actor]);
    }
    const extended = await saveExtendedWorkspace(client, source, actor);
    summary.customers=rows('customers').length; summary.products=rows('products').length; summary.salesUploads=rows('salesUploads').length; summary.sales=rows('sales').length; summary.contacts=rows('contacts').length;
    summary.closingStatuses = extended.closingStatuses; summary.archives = extended.archives;
    await client.query('INSERT INTO cloud_migration_runs (created_by, summary_json) VALUES ($1,$2::jsonb)', [actor, JSON.stringify(summary)]);
    await client.query('COMMIT');
    return response(200,{ok:true,summary});
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

function isNewerOrSame(candidate, current) {
  const candidateTime = Date.parse(candidate || '');
  const currentTime = Date.parse(current || '');
  return Number.isFinite(candidateTime) && (!Number.isFinite(currentTime) || candidateTime >= currentTime);
}

async function workspaceSnapshot(client = getPool()) {
  const [customers, products, contacts, closingStatuses, salesUploads, sales] = await Promise.all([
    client.query('SELECT * FROM customers ORDER BY customer_code'),
    client.query('SELECT * FROM products ORDER BY product_code'),
    client.query('SELECT * FROM contacts ORDER BY updated_at DESC, contact_id DESC'),
    client.query('SELECT * FROM closing_status ORDER BY closing_month DESC, customer_code'),
    client.query('SELECT * FROM sales_uploads ORDER BY uploaded_at DESC, upload_key'),
    client.query('SELECT * FROM sales ORDER BY upload_key, row_no'),
  ]);
  return {
    customers: customers.rows.map(toClientRecord),
    products: products.rows.map(toClientRecord),
    contacts: contacts.rows.map(toClientRecord),
    closingStatuses: closingStatuses.rows.map(toClientRecord),
    salesUploads: salesUploads.rows.map(toClientRecord),
    sales: sales.rows.map(toClientRecord),
  };
}

// Pull -> merge -> push back a single authoritative snapshot. The timestamp is
// retained from the writer, so the next PC can make the same deterministic choice.
async function syncWorkspace(method, body, actor) {
  if (method === 'GET') return response(200, { ok: true, snapshot: await workspaceSnapshot() });
  if (method !== 'POST') return response(405, { message: 'Method not allowed.' });

  const client = await getPool().connect();
  const rows = (key) => Array.isArray(body?.[key]) ? body[key] : [];
  const summary = { customers: 0, products: 0, contacts: 0 };
  try {
    await client.query('BEGIN');
    for (const row of rows('customers')) {
      if (!row.customerCode) continue;
      const existing = await client.query('SELECT updated_at FROM customers WHERE customer_code = $1', [row.customerCode]);
      if (existing.rows[0] && !isNewerOrSame(row.updatedAt, existing.rows[0].updated_at)) continue;
      await client.query(`INSERT INTO customers (customer_code,customer_name,business_number,tax_status,status,memo,closing_json,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,COALESCE($8::timestamptz,now()),COALESCE($9::timestamptz,now()))
        ON CONFLICT (customer_code) DO UPDATE SET customer_name=EXCLUDED.customer_name,business_number=EXCLUDED.business_number,tax_status=EXCLUDED.tax_status,status=EXCLUDED.status,memo=EXCLUDED.memo,closing_json=EXCLUDED.closing_json,updated_at=EXCLUDED.updated_at`,
      [row.customerCode,row.customerName || row.customerCode,row.businessNumber || null,row.taxStatus || 'UNKNOWN',row.status || 'ACTIVE',row.memo || null,JSON.stringify(row.closingJson || null),row.createdAt || null,row.updatedAt || null]);
      summary.customers += 1;
    }
    for (const row of rows('products')) {
      if (!row.productCode) continue;
      const existing = await client.query('SELECT updated_at FROM products WHERE product_code = $1', [row.productCode]);
      if (existing.rows[0] && !isNewerOrSame(row.updatedAt, existing.rows[0].updated_at)) continue;
      await client.query(`INSERT INTO products (product_code,product_name,unit,unit_price,currency,status,memo,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,now()),COALESCE($9::timestamptz,now()))
        ON CONFLICT (product_code) DO UPDATE SET product_name=EXCLUDED.product_name,unit=EXCLUDED.unit,unit_price=EXCLUDED.unit_price,currency=EXCLUDED.currency,status=EXCLUDED.status,memo=EXCLUDED.memo,updated_at=EXCLUDED.updated_at`,
      [row.productCode,row.productName || row.productCode,row.unit || 'EA',Number(row.unitPrice || 0),row.currency || 'KRW',row.status || 'ACTIVE',row.memo || null,row.createdAt || null,row.updatedAt || null]);
      summary.products += 1;
    }
    for (const row of rows('salesUploads')) {
      if (!row.uploadKey || !row.fileName || !row.closingMonth) continue;
      await client.query(`INSERT INTO sales_uploads (upload_key,file_name,closing_month,uploaded_department_code,uploaded_at,status,memo)
        VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz,now()),$6,$7)
        ON CONFLICT (upload_key) DO UPDATE SET file_name=EXCLUDED.file_name,closing_month=EXCLUDED.closing_month,uploaded_department_code=EXCLUDED.uploaded_department_code,status=EXCLUDED.status,memo=EXCLUDED.memo`,
      [row.uploadKey,row.fileName,row.closingMonth,row.uploadedDepartmentCode || null,row.uploadedAt || null,row.status || 'UPLOADED',row.memo || null]);
      summary.salesUploads = (summary.salesUploads || 0) + 1;
    }
    for (const row of rows('sales')) {
      if (!row.uploadKey || !row.rowNo) continue;
      await client.query(`INSERT INTO sales (upload_key,row_no,transaction_date,raw_customer_name,raw_product_name,customer_code,product_code,quantity,unit_price,sales_amount,validation_status,review_status,owner_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (upload_key,row_no) DO UPDATE SET transaction_date=EXCLUDED.transaction_date,raw_customer_name=EXCLUDED.raw_customer_name,raw_product_name=EXCLUDED.raw_product_name,customer_code=EXCLUDED.customer_code,product_code=EXCLUDED.product_code,quantity=EXCLUDED.quantity,unit_price=EXCLUDED.unit_price,sales_amount=EXCLUDED.sales_amount,validation_status=EXCLUDED.validation_status,review_status=EXCLUDED.review_status,owner_name=EXCLUDED.owner_name`,
      [row.uploadKey,row.rowNo,row.transactionDate || null,row.rawCustomerName || null,row.rawProductName || null,row.customerCode || null,row.productCode || null,row.quantity || null,row.unitPrice || null,row.salesAmount || null,row.validationStatus || 'PENDING',row.reviewStatus || 'WAITING',row.ownerName || null]);
      summary.sales = (summary.sales || 0) + 1;
    }
    for (const row of rows('contacts')) {
      if (!String(row.recipientName || '').trim()) continue;
      const found = await client.query(`SELECT contact_id,updated_at FROM contacts WHERE COALESCE(customer_code,'')=COALESCE($1,'') AND COALESCE(recipient_email,'')=COALESCE($2,'') AND recipient_name=$3 LIMIT 1`, [row.customerCode || null,row.recipientEmail || null,row.recipientName]);
      if (found.rows[0] && !isNewerOrSame(row.updatedAt, found.rows[0].updated_at)) continue;
      if (found.rows[0]) {
        await client.query(`UPDATE contacts SET customer_name=$1,business_number=$2,department_name=$3,recipient_phone=$4,preferred_channel=$5,status=$6,memo=$7,updated_by=$8,updated_at=COALESCE($9::timestamptz,now()),version=version+1 WHERE contact_id=$10`, [row.customerName || row.customerCode || '미지정',row.businessNumber || null,row.departmentName || null,row.recipientPhone || null,row.preferredChannel || 'EMAIL',row.status || 'ACTIVE',row.memo || null,actor,row.updatedAt || null,found.rows[0].contact_id]);
      } else {
        await client.query(`INSERT INTO contacts (customer_code,customer_name,business_number,department_name,recipient_name,recipient_email,recipient_phone,preferred_channel,status,memo,created_by,updated_by,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,COALESCE($12::timestamptz,now()),COALESCE($13::timestamptz,now()))`, [row.customerCode || null,row.customerName || row.customerCode || '미지정',row.businessNumber || null,row.departmentName || null,row.recipientName,row.recipientEmail || null,row.recipientPhone || null,row.preferredChannel || 'EMAIL',row.status || 'ACTIVE',row.memo || null,actor,row.createdAt || null,row.updatedAt || null]);
      }
      summary.contacts += 1;
    }
    const extended = await saveExtendedWorkspace(client, body, actor);
    summary.closingStatuses = extended.closingStatuses;
    summary.archives = extended.archives;
    const snapshot = await workspaceSnapshot(client);
    await client.query('COMMIT');
    return response(200, { ok: true, summary, snapshot });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

exports.handler = async (event) => {
  try {
    const { method, path, headers, query } = requestInfo(event);
    if (method === 'OPTIONS') return response(204, {});
    if (method === 'GET' && path === '/health') {
      await getPool().query('SELECT 1');
      return response(200, { ok: true });
    }
    if (method === 'POST' && path === '/auth/signup') return await signup(parseBody(event));
    if (method === 'POST' && path === '/auth/login') return await login(parseBody(event));

    const actor = String(authenticate(headers).sub);
    const body = parseBody(event);
    if (path === '/contacts' || path.startsWith('/contacts/')) return await contacts(method, path, body, actor);
    if (path === '/closing-companies' || path.startsWith('/closing-companies/')) return await closingCompanies(method, path, body, actor, query);
    if (path === '/todos' || path.startsWith('/todos/')) return await todos(method, path, body, actor);
    if (path === '/backups') return await backups(method, body, actor);
    if (path === '/files' || path === '/files/presign' || path === '/files/complete' || path === '/files/download-url') return await cloudFiles(method, path, body, actor);
    if (path === '/sync/workspace') return await syncWorkspace(method, body, actor);
    if (method === 'POST' && path === '/migration/import') return await migrateWorkspace(body, actor);
    return response(404, { message: 'Route not found.' });
  } catch (error) {
    console.error('Request failed:', error.message);
    return response(error.statusCode || 500, { message: error.statusCode ? error.message : '서버 오류가 발생했습니다.' });
  }
};
