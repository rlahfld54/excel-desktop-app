import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Logo from '../images/logo.svg';
import { isSharedApiEnabled } from '../config/cloud';
import { signupWithSharedApi } from '../services/authApiService';
import { saveUsers } from '../utils/authSession';
import { initializePersonalTodos } from '../utils/todoSchedule';

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    departmentName: '',
    password: '',
    passwordConfirm: '',
  });
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const usesSharedSignup = isSharedApiEnabled();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    if (form.password !== form.passwordConfirm) {
      setMessage('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (!usesSharedSignup && !window.api?.registerUser) {
      setMessage('설치된 데스크톱 앱에서 회원가입해 주세요.');
      return;
    }

    setIsBusy(true);
    try {
      const result = usesSharedSignup
        ? await signupWithSharedApi(form)
        : await window.api.registerUser(form);
      if (!result?.ok) throw new Error(result?.message || '계정을 만들지 못했습니다.');
      if (!usesSharedSignup) {
        const usersResult = await window.api.listUsers();
        saveUsers(usersResult.users ?? []);
        initializePersonalTodos(result.user.id);
      }
      navigate('/login', { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(115deg,#effdf9_0%,#edf8ff_46%,#fff8df_100%)] px-5 py-8 text-gray-950 dark:bg-[linear-gradient(115deg,#021f1a_0%,#081f31_48%,#241d08_100%)] dark:text-gray-100">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-gray-900">
              <img className="h-7 w-7" src={Logo} alt="" />
            </span>
            <div>
              <p className="font-bold">Excel Desktop App</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">사용자 계정 등록</p>
            </div>
          </div>
          <Link className="btn btn-secondary" to="/login">로그인</Link>
        </header>

        <section className="rounded-3xl border border-white/80 bg-white/95 p-7 shadow-xl dark:border-gray-800 dark:bg-gray-950/95 sm:p-9">
          <h1 className="text-3xl font-bold">회원가입</h1>
          <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {usesSharedSignup
              ? '공유 서버에 업무 계정을 등록합니다. 추가 가입자는 기본 조회 권한으로 생성됩니다.'
              : '이 PC의 SQLite에 업무 계정을 등록합니다. 추가 가입자는 기본 조회 권한으로 생성되며 관리자가 이후 권한을 변경할 수 있습니다.'}
          </p>

          <form className="mt-7 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">로그인 아이디</span>
              <input className="form-input w-full" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">이름</span>
              <input className="form-input w-full" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold">부서</span>
              <input className="form-input w-full" value={form.departmentName} onChange={(event) => setForm({ ...form, departmentName: event.target.value })} placeholder="예: 영업지원팀" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">비밀번호</span>
              <input className="form-input w-full" type="password" minLength="6" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">비밀번호 확인</span>
              <input className="form-input w-full" type="password" minLength="6" value={form.passwordConfirm} onChange={(event) => setForm({ ...form, passwordConfirm: event.target.value })} required />
            </label>

            {message && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 sm:col-span-2">
                {message}
              </div>
            )}

            <button className="btn btn-primary h-12 sm:col-span-2" type="submit" disabled={isBusy}>
              {isBusy ? '계정 생성 중…' : '계정 만들기'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
