const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

let pool;

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
    summary.customers=rows('customers').length; summary.products=rows('products').length; summary.salesUploads=rows('salesUploads').length; summary.sales=rows('sales').length; summary.contacts=rows('contacts').length;
    await client.query('INSERT INTO cloud_migration_runs (created_by, summary_json) VALUES ($1,$2::jsonb)', [actor, JSON.stringify(summary)]);
    await client.query('COMMIT');
    return response(200,{ok:true,summary});
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
    if (method === 'POST' && path === '/migration/import') return await migrateWorkspace(body, actor);
    return response(404, { message: 'Route not found.' });
  } catch (error) {
    console.error('Request failed:', error.message);
    return response(error.statusCode || 500, { message: error.statusCode ? error.message : '서버 오류가 발생했습니다.' });
  }
};
