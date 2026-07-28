import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Logo from '../images/logo.svg';
import { isSharedApiEnabled } from '../config/cloud';
import { signupWithSharedApi } from '../services/authApiService';
import { saveUsers } from '../utils/authSession';
import { getPasswordChecks, isPasswordValid, passwordHelpText } from '../utils/passwordPolicy';
import { useToast } from '../components/common';

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
  const [showPassword, setShowPassword] = useState(false);
  const { showToast } = useToast();
  const usesSharedSignup = isSharedApiEnabled();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!form.username.trim() || form.username.trim().length < 2) {
      setMessage('로그인 아이디는 2자 이상 입력해 주세요.');
      return;
    }
    if (!isPasswordValid(form.password)) {
      setMessage(passwordHelpText(form.password));
      return;
    }
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
      }
      showToast({ type: 'success', title: '계정이 생성되었습니다', message: '이제 만든 아이디와 비밀번호로 로그인하세요.' });
      navigate('/login', { replace: true });
    } catch (error) {
      setMessage(error.message);
      showToast({ type: 'error', title: '계정 생성에 실패했습니다', message: error.message });
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
              <input className="form-input w-full" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.replace(/\s/g, '') })} minLength="2" maxLength="50" required autoComplete="username" />
              <span className="mt-1 block text-xs text-gray-400">2~50자, 공백 없이 입력</span>
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
              <div className="relative"><input className="form-input w-full pr-12" type={showPassword ? 'text' : 'password'} minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required autoComplete="new-password" /><button className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-gray-500 hover:text-teal-700" type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? '숨김' : '보기'}</button></div>
              <div className="mt-2 flex flex-wrap gap-2">{getPasswordChecks(form.password).map((check) => <span key={check.key} className={`text-xs font-semibold ${check.passed ? 'text-accent-700 dark:text-accent-300' : 'text-gray-400'}`}>{check.passed ? '✓' : '○'} {check.label}</span>)}</div>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">비밀번호 확인</span>
              <input className="form-input w-full" type={showPassword ? 'text' : 'password'} minLength="8" value={form.passwordConfirm} onChange={(event) => setForm({ ...form, passwordConfirm: event.target.value })} required autoComplete="new-password" />
              {form.passwordConfirm && <span className={`mt-1 block text-xs font-semibold ${form.password === form.passwordConfirm ? 'text-accent-700 dark:text-accent-300' : 'text-red-600 dark:text-red-300'}`}>{form.password === form.passwordConfirm ? '✓ 비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}</span>}
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
