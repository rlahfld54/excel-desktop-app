export const sessionStorageKey = 'excel-workspace:adminSession';
export const authChangedEvent = 'excel-workspace:auth-changed';
let usersCache = [];
let logsCache = [];

export const adminUserId = '';
export const defaultUsers = [];

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

function removeJson(key) {
  localStorage.removeItem(key);
}

function notifyAuthChanged() {
  window.dispatchEvent(new CustomEvent(authChangedEvent));
}

export function createAdminSession() {
  return null;
}

export function createUserSession(user) {
  return {
    userId: user?.id ?? '',
    role: user?.role ?? 'VIEWER',
    accessToken: user?.accessToken,
    user,
    autoLogin: true,
    loggedInAt: new Date().toISOString(),
  };
}

export function ensureAdminUser(users) {
  const source = Array.isArray(users) ? users : [];
  return source.map((user) => ({
    department: '미지정',
    title: user.role === 'ADMIN' ? '관리자' : '사용자',
    email: '',
    phone: '',
    status: 'ACTIVE',
    ...user,
  }));
}

export function getUsers() {
  return ensureAdminUser(usersCache);
}

export function saveUsers(users) {
  const normalized = ensureAdminUser(users);
  usersCache = normalized;
  notifyAuthChanged();
  return normalized;
}

export function clearUserCache() {
  usersCache = [];
  notifyAuthChanged();
}

export function getSession() {
  const saved = readJson(sessionStorageKey, null);
  if (saved?.userId && saved?.role) return saved;
  return null;
}

export function hasActiveSession() {
  const saved = readJson(sessionStorageKey, null);
  if (!saved?.userId || !saved?.role) return false;

  const user = getUsers().find((item) => item.id === saved.userId);
  const sessionUser = saved.user?.id === saved.userId ? saved.user : null;
  return Boolean((user || sessionUser || saved.accessToken) && user?.status !== 'INACTIVE' && sessionUser?.status !== 'INACTIVE');
}

export function saveSession(session) {
  const users = getUsers();
  const requestedUser = users.find((user) => user.id === session?.userId) ?? session?.user ?? users[0];
  const nextSession = {
    ...createUserSession(requestedUser),
    ...session,
    autoLogin: session?.autoLogin ?? true,
  };
  writeJson(sessionStorageKey, nextSession);
  notifyAuthChanged();
  return nextSession;
}

export function clearSession() {
  removeJson(sessionStorageKey);
}

export function getCurrentUser() {
  const session = getSession();
  const users = getUsers();
  const user = users.find((item) => item.id === session?.userId) ?? session?.user ?? {
    id: '',
    name: '사용자',
    role: 'VIEWER',
    department: '미지정',
    status: 'INACTIVE',
  };

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
          id: patch.id ?? user.id,
          role: patch.role ?? user.role,
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
  return logsCache;
}

export function getVisibleLogs(user = getCurrentUser()) {
  const logs = getLogs();
  return user.role === 'ADMIN'
    ? logs
    : logs.filter((log) => log.userId === user.id);
}

export function saveLogs(logs) {
  logsCache = Array.isArray(logs) ? logs : [];
  return logsCache;
}

export function addActivityLog(level, action, target, userId = getSession()?.userId ?? '') {
  const logs = [
    createLog(level, action, target, userId),
    ...getLogs(),
  ].slice(0, 200);
  saveLogs(logs);
  notifyAuthChanged();
  return logs;
}
