export const usersStorageKey = 'excel-workspace:users';
export const sessionStorageKey = 'excel-workspace:adminSession';
export const logsStorageKey = 'excel-workspace:activityLogs';
export const authChangedEvent = 'excel-workspace:auth-changed';

export const adminUserId = '황주은';

export const defaultUsers = [
  {
    id: '황주은',
    name: '황주은',
    password: '0000',
    role: 'ADMIN',
    department: '총무팀',
    title: '관리자',
    email: 'hwang.jueun@example.com',
    phone: '010-0000-0000',
    status: 'ACTIVE',
  },
  {
    id: '박지훈',
    name: '박지훈',
    password: '0000',
    role: 'MANAGER',
    department: '영업지원팀',
    title: '매니저',
    email: 'park.jihoon@example.com',
    phone: '010-0000-0001',
    status: 'ACTIVE',
  },
  {
    id: '이서연',
    name: '이서연',
    password: '0000',
    role: 'MANAGER',
    department: '정산팀',
    title: '매니저',
    email: 'lee.seoyeon@example.com',
    phone: '010-0000-0002',
    status: 'ACTIVE',
  },
  {
    id: '최현우',
    name: '최현우',
    password: '0000',
    role: 'VIEWER',
    department: '물류팀',
    title: '사용자',
    email: 'choi.hyunu@example.com',
    phone: '010-0000-0003',
    status: 'ACTIVE',
  },
];

function readJson(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return saved ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function notifyAuthChanged() {
  window.dispatchEvent(new CustomEvent(authChangedEvent));
}

export function createAdminSession() {
  return {
    userId: adminUserId,
    role: 'ADMIN',
    autoLogin: true,
    loggedInAt: new Date().toISOString(),
  };
}

export function createUserSession(user) {
  return {
    userId: user.id,
    role: user.role,
    autoLogin: true,
    loggedInAt: new Date().toISOString(),
  };
}

export function ensureAdminUser(users) {
  const source = Array.isArray(users) ? users : defaultUsers;
  const normalized = source.map((user) => ({
    password: '0000',
    department: '미지정',
    title: user.role === 'ADMIN' ? '관리자' : '사용자',
    email: '',
    phone: '',
    status: 'ACTIVE',
    ...user,
  }));
  const adminIndex = normalized.findIndex((user) => user.id === adminUserId);

  if (adminIndex >= 0) {
    normalized[adminIndex] = {
      ...normalized[adminIndex],
      id: adminUserId,
      name: adminUserId,
      password: '0000',
      role: 'ADMIN',
      status: 'ACTIVE',
    };
    return normalized;
  }

  return [
    defaultUsers[0],
    ...normalized,
  ];
}

export function getUsers() {
  const users = ensureAdminUser(readJson(usersStorageKey, defaultUsers));
  writeJson(usersStorageKey, users);
  return users;
}

export function saveUsers(users) {
  const normalized = ensureAdminUser(users);
  writeJson(usersStorageKey, normalized);
  notifyAuthChanged();
  return normalized;
}

export function getSession() {
  const saved = readJson(sessionStorageKey, null);
  if (saved?.userId && saved?.role) return saved;

  const session = createAdminSession();
  writeJson(sessionStorageKey, session);
  return session;
}

export function saveSession(session) {
  const users = getUsers();
  const requestedUser = users.find((user) => user.id === session?.userId) ?? users[0];
  const nextSession = {
    ...createUserSession(requestedUser),
    ...session,
    autoLogin: true,
  };
  writeJson(sessionStorageKey, nextSession);
  notifyAuthChanged();
  return nextSession;
}

export function getCurrentUser() {
  const session = getSession();
  const users = getUsers();
  const user = users.find((item) => item.id === session.userId) ?? users[0];

  return {
    ...user,
    session,
  };
}

export function updateUser(userId, patch) {
  const users = getUsers().map((user) => (
    user.id === userId
      ? {
          ...user,
          ...patch,
          id: userId === adminUserId ? adminUserId : patch.id ?? user.id,
          role: userId === adminUserId ? 'ADMIN' : patch.role ?? user.role,
          password: patch.password ?? user.password ?? '0000',
        }
      : user
  ));

  return saveUsers(users);
}

export function createLog(level, action, target, userId = adminUserId) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    userId,
    action,
    target,
    createdAt: new Date().toLocaleString('ko-KR', { hour12: false }),
  };
}

export function getLogs() {
  return readJson(logsStorageKey, [
    createLog('INFO', '앱 실행', 'Dashboard'),
    createLog('INFO', '샘플 데이터 로드', '1,200건'),
    createLog('WARN', '중복 후보 감지', '중복 검사'),
  ]);
}

export function saveLogs(logs) {
  writeJson(logsStorageKey, logs);
  return logs;
}

export function addActivityLog(level, action, target, userId = getSession().userId) {
  const logs = [
    createLog(level, action, target, userId),
    ...getLogs(),
  ].slice(0, 200);
  saveLogs(logs);
  notifyAuthChanged();
  return logs;
}
