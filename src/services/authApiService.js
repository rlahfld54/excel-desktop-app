import { requestSharedApi } from '../lib/apiClient';

function normalizeCloudUser(user = {}) {
  const id = user.id ?? user.userId ?? user.username ?? '';
  const username = user.username ?? id;

  return {
    id: String(id),
    username: String(username),
    name: user.name ?? user.displayName ?? username,
    role: user.role ?? 'USER',
    department: user.department ?? user.departmentName ?? '미지정',
    title: user.title ?? (user.role === 'ADMIN' ? '관리자' : '사용자'),
    email: user.email ?? '',
    phone: user.phone ?? '',
    status: user.status ?? 'ACTIVE',
  };
}

export async function loginWithSharedApi({ username, password }) {
  const result = await requestSharedApi('/auth/login', {
    method: 'POST',
    body: { username, password },
    auth: false,
  });

  if (!result.ok) return result;

  const payload = result.data ?? {};
  const token = payload.token ?? payload.accessToken;
  const user = normalizeCloudUser(payload.user ?? payload);

  if (!token || !user.id) {
    return {
      ok: false,
      status: result.status,
      message: '로그인 API 응답에 사용자 정보 또는 토큰이 없습니다.',
      data: payload,
    };
  }

  return {
    ok: true,
    status: result.status,
    token,
    user,
  };
}

export async function signupWithSharedApi({ username, displayName, departmentName, password }) {
  const result = await requestSharedApi('/auth/signup', {
    method: 'POST',
    body: {
      username,
      name: displayName,
      departmentName,
      password,
    },
    auth: false,
  });

  if (!result.ok) return result;

  return {
    ok: true,
    status: result.status,
    user: normalizeCloudUser(result.data?.user ?? result.data),
  };
}
