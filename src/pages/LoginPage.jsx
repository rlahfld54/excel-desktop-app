import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Logo from '../images/logo.svg';
import { addActivityLog, getUsers, saveSession } from '../utils/authSession';

export default function LoginPage() {
  const navigate = useNavigate();
  const users = useMemo(() => getUsers().filter((user) => user.status !== 'INACTIVE'), []);
  const [userId, setUserId] = useState(users[0]?.id ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const selectedUser = users.find((user) => user.id === userId);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    if (!selectedUser || selectedUser.password !== password) {
      setError('아이디 또는 비밀번호를 확인해주세요.');
      return;
    }

    saveSession({
      userId: selectedUser.id,
      role: selectedUser.role,
      autoLogin: true,
    });
    addActivityLog('INFO', '로그인', selectedUser.id, selectedUser.id);
    navigate('/dashboard');
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <section className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex min-h-[42vh] flex-col justify-between bg-[linear-gradient(135deg,#ecfdf7_0%,#e3f3ff_52%,#fff2c9_100%)] p-6 dark:bg-[linear-gradient(135deg,#022c22_0%,#0b324f_55%,#342809_100%)] sm:p-8 lg:min-h-screen lg:p-10">
          <Link className="flex w-fit items-center gap-3" to="/">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/80 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
              <img className="h-6 w-6" src={Logo} alt="" />
            </span>
            <span>
              <span className="block text-sm font-bold text-gray-950 dark:text-white">Excel Workspace</span>
              <span className="block text-xs text-gray-600 dark:text-gray-400">매출 마감 자동화</span>
            </span>
          </Link>

          <div className="max-w-lg py-12">
            <p className="mb-4 inline-flex rounded bg-white/80 px-3 py-1 text-xs font-bold uppercase text-accent-700 shadow-sm ring-1 ring-accent-200 dark:bg-gray-900/80 dark:text-accent-200 dark:ring-accent-500/30">
              Secure Access
            </p>
            <h1 className="text-3xl font-bold leading-tight text-gray-950 dark:text-white md:text-4xl">
              로그인 후 작업 공간으로 이동합니다.
            </h1>
            <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
              사용자 관리 화면에서 등록한 계정과 비밀번호로 접속할 수 있습니다. 초기 비밀번호는 계정별로 설정된 값을 사용합니다.
            </p>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {['사용자 권한', '활동 로그', '자동 로그인'].map((item) => (
              <div key={item} className="rounded-md border border-white/70 bg-white/70 px-3 py-2 font-semibold text-gray-700 shadow-sm dark:border-gray-700/60 dark:bg-gray-900/70 dark:text-gray-200">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-sm font-bold uppercase text-accent-600 dark:text-accent-300">Login</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">계정으로 로그인</h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">비밀번호를 입력하면 기존 대시보드로 이동합니다.</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-200" htmlFor="userId">사용자</label>
                <select
                  className="form-select h-11 w-full rounded-md border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900"
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
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-200" htmlFor="password">비밀번호</label>
                <input
                  className="form-input h-11 w-full rounded-md border-gray-300 bg-white font-mono dark:border-gray-700 dark:bg-gray-900"
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="비밀번호 입력"
                  autoComplete="current-password"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">개발 기본값은 0000입니다.</p>
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </div>
              )}

              <button
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-accent-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-accent-700"
                type="submit"
              >
                로그인
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between gap-4 text-sm">
              <Link className="font-semibold text-gray-500 hover:text-accent-700 dark:text-gray-400 dark:hover:text-accent-200" to="/">
                처음 화면
              </Link>
              <Link className="font-semibold text-accent-700 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200" to="/results/activity-logs">
                사용자 관리
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
