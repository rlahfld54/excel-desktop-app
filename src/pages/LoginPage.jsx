import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import Logo from '../images/logo.svg';
import { isSharedApiEnabled } from '../config/cloud';
import { loginWithSharedApi } from '../services/authApiService';
import { sharedDataService } from '../services/sharedDataService';
import { addActivityLog, getOfflineProfile, saveOfflineProfile, saveSession, saveUsers } from '../utils/authSession';
import { hydratePersonalTodos } from '../utils/todoSchedule';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [offlineProfile] = useState(() => getOfflineProfile());
  const [canContinueOffline, setCanContinueOffline] = useState(false);
  const usesSharedLogin = isSharedApiEnabled();

  useEffect(() => {
    async function loadUsers() {
      if (usesSharedLogin) return;
      if (!window.api?.listUsers) return;
      const result = await window.api.listUsers();
      const activeUsers = (result.users ?? []).filter((user) => user.status !== 'INACTIVE');
      setUsers(activeUsers);
      saveUsers(activeUsers);
      setUserId(activeUsers[0]?.id ?? '');
    }
    loadUsers().catch((error) => setError(error.message));
  }, [usesSharedLogin]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!userId.trim() || !password) {
      setError('아이디와 비밀번호를 입력해 주세요.');
      return;
    }

    const result = usesSharedLogin
      ? await loginWithSharedApi({ username: userId.trim(), password })
      : await authenticateLocalUser(userId, password);

    if (!result?.ok) {
      if (usesSharedLogin && result?.status === 0 && offlineProfile && (!userId.trim() || userId.trim() === offlineProfile.username)) {
        setCanContinueOffline(true);
        setError('서버에 연결할 수 없습니다. 이 PC에 저장된 마지막 로그인 사용자로 오프라인 작업을 계속할 수 있습니다.');
        return;
      }
      addActivityLog('WARN', '로그인 실패', userId || 'unknown', userId || 'unknown');
      setError(result?.message || '아이디 또는 비밀번호가 틀렸습니다.');
      return;
    }

    // 로그인 입력값은 서버 계정명과 같으므로, 숫자 DB PK와 혼동하지 않도록
    // 로컬/오프라인 프로필에는 명시적으로 사용자명을 보존한다.
    const selectedUser = {
      ...result.user,
      username: result.user?.username || userId.trim(),
    };
    if (usesSharedLogin) saveOfflineProfile(selectedUser);
    await hydratePersonalTodos(selectedUser.id);
    const nextUsers = mergeAuthenticatedUser(users, selectedUser);
    saveUsers(nextUsers);
    saveSession({
      userId: selectedUser.id,
      role: selectedUser.role,
      autoLogin: true,
      accessToken: result.token,
      user: selectedUser,
    });
    // 새 PC도 기존 AWS 기준정보를 먼저 받아야 로컬 SQLite가 같은 업무 데이터를
    // 보여 준다. 실패해도 로그인 자체는 막지 않아 오프라인 작업은 가능하다.
    if (usesSharedLogin && window.api?.applyCloudWorkspace) {
      const cloudWorkspace = await sharedDataService.downloadWorkspace();
      if (cloudWorkspace.ok) {
        await window.api.applyCloudWorkspace(cloudWorkspace.data?.snapshot ?? {});
      }
    }
    addActivityLog('INFO', '로그인', selectedUser.id, selectedUser.id);
    navigate(location.state?.from || '/dashboard', { replace: true });
  };

  const continueOffline = async () => {
    if (!offlineProfile) return;
    saveUsers([offlineProfile]);
    saveSession({
      userId: offlineProfile.id,
      role: offlineProfile.role,
      autoLogin: true,
      offline: true,
      accessToken: '',
      user: offlineProfile,
      expiresAt: offlineProfile.offlineExpiresAt,
    });
    await hydratePersonalTodos(offlineProfile.id);
    addActivityLog('INFO', '오프라인 로그인', offlineProfile.id, offlineProfile.id);
    navigate(location.state?.from || '/dashboard', { replace: true });
  };

  async function authenticateLocalUser(username, userPassword) {
    if (!window.api?.authenticateUser) {
      return {
        ok: false,
        message: '설치된 데스크톱 앱에서 로그인해 주세요.',
      };
    }

    return window.api.authenticateUser({ username, password: userPassword });
  }

  function mergeAuthenticatedUser(currentUsers, selectedUser) {
    const exists = currentUsers.some((user) => user.id === selectedUser.id);
    if (!exists) return [selectedUser, ...currentUsers];
    return currentUsers.map((user) => user.id === selectedUser.id ? selectedUser : user);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-white text-gray-950 dark:bg-gray-950 dark:text-gray-100">
      <section className="relative min-h-screen">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,#effdf9_0%,#edf8ff_46%,#fff8df_100%)] dark:bg-[linear-gradient(115deg,#021f1a_0%,#081f31_48%,#241d08_100%)]" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
          <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
            <Link className="flex items-center gap-3 rounded-xl bg-white/45 p-1 pr-4 backdrop-blur-sm dark:bg-gray-900/35" to="/">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/80 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
                <img className="h-6 w-6" src={Logo} alt="" />
              </span>
              <span>
                <span className="block text-sm font-bold">Excel Workspace</span>
                <span className="block text-xs text-gray-600 dark:text-gray-400">매출 마감 자동화</span>
              </span>
            </Link>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-teal-800 dark:bg-accent-400 dark:text-gray-950 dark:hover:bg-accent-300"
              to="/"
            >
              처음 화면
            </Link>
          </header>

          <div className="flex flex-1 items-center justify-center py-12 lg:py-14">
            <div className="w-full max-w-[430px] rounded-2xl border border-gray-200/70 bg-white/94 px-6 py-8 shadow-lg shadow-gray-200/50 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/92 dark:shadow-black/20 sm:px-8">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
                  <img className="h-8 w-8" src={Logo} alt="" />
                </div>
                <h1 className="text-2xl font-bold tracking-normal text-gray-950 dark:text-white">
                  로그인
                </h1>
                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                  {usesSharedLogin ? '서버 계정으로 로그인하세요.' : '초기 설정에서 만든 계정으로 로그인하세요.'}
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200" htmlFor="userId">
                    사용자
                  </label>
                  {usesSharedLogin ? (
                    <input
                      className="form-input h-12 w-full rounded-md border-gray-200 bg-white px-3 text-base shadow-xs focus:border-teal-500 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-900"
                      id="userId"
                      value={userId}
                      onChange={(event) => setUserId(event.target.value)}
                      placeholder="아이디"
                      autoComplete="username"
                    />
                  ) : (
                    <select
                      className="form-select h-12 w-full rounded-md border-gray-200 bg-white px-3 text-base shadow-xs focus:border-teal-500 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-900"
                      id="userId"
                      value={userId}
                      onChange={(event) => setUserId(event.target.value)}
                    >
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} / {user.role}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200" htmlFor="password">
                      비밀번호
                    </label>
                  </div>
                  <input
                    className="form-input h-12 w-full rounded-md border-gray-200 bg-white px-3 font-mono text-base shadow-xs focus:border-teal-500 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-900"
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="비밀번호"
                    autoComplete="current-password"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    {error}
                  </div>
                )}

                {canContinueOffline && (
                  <button
                    className="inline-flex h-11 w-full items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-5 text-sm font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                    type="button"
                    onClick={continueOffline}
                  >
                    {offlineProfile?.name || offlineProfile?.username} 계정으로 오프라인 계속
                  </button>
                )}

                <button
                  className="inline-flex h-12 w-full items-center justify-center rounded-md bg-teal-700 px-5 text-sm font-bold text-white shadow-sm hover:bg-teal-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:bg-accent-400 dark:text-gray-950 dark:hover:bg-accent-300"
                  type="submit"
                >
                  로그인
                </button>
              </form>

              <p className="mt-6 text-center text-xs leading-5 text-gray-400 dark:text-gray-500">
                계정이 없다면 초기 설정을 먼저 완료해 주세요.
              </p>
              <Link className="mt-3 block text-center text-sm font-semibold text-teal-700 hover:text-teal-800 dark:text-accent-300" to="/setup">
                초기 설정 다시 열기
              </Link>
              <Link className="mt-2 block text-center text-sm font-semibold text-teal-700 hover:text-teal-800 dark:text-accent-300" to="/signup">
                새 사용자 회원가입
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
