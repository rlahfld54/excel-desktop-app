import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { FormField } from '../components/common';
import PageShell from './PageShell';
import {
  addActivityLog,
  clearSession,
  getCurrentUser,
  getVisibleLogs,
  getSession,
  saveSession,
} from '../utils/authSession';
import { clearPersonalTodoData } from '../utils/todoSchedule';
import { getPasswordChecks, isPasswordValid, passwordHelpText } from '../utils/passwordPolicy';
import { useToast } from '../components/common';

function StatCard({ label, value, detail, tone = 'accent' }) {
  const toneClass = tone === 'red'
    ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200'
    : tone === 'yellow'
      ? 'bg-yellow-50 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-200'
      : 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-200';

  return (
    <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className={`mt-2 inline-flex rounded px-2 py-1 text-xs font-bold ${toneClass}`}>{detail}</p>
    </section>
  );
}

export default function SecurityPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [session, setSession] = useState(() => getSession());
  const [logs, setLogs] = useState(() => getVisibleLogs());
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('보안 설정을 확인하고 필요한 항목을 변경할 수 있습니다.');
  const [messageTone, setMessageTone] = useState('info');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const { showToast } = useToast();

  const securityLogs = useMemo(() => logs.filter((log) => (
    ['로그인', '로그인 실패', '로그아웃', '비밀번호 변경', '자동 로그인 켜짐', '자동 로그인 꺼짐'].includes(log.action)
    || String(log.action).includes('로그')
  )).slice(0, 8), [logs]);

  const failedLoginCount = useMemo(() => logs.filter((log) => log.action === '로그인 실패').length, [logs]);

  const updateMessage = (text, tone = 'info') => {
    setMessage(text);
    setMessageTone(tone);
  };

  const refreshState = () => {
    setCurrentUser(getCurrentUser());
    setSession(getSession());
    setLogs(getVisibleLogs());
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();

    if (!isPasswordValid(passwordForm.nextPassword)) {
      updateMessage(passwordHelpText(passwordForm.nextPassword), 'error');
      return;
    }

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      updateMessage('새 비밀번호 확인이 일치하지 않습니다.', 'error');
      return;
    }

    setIsChangingPassword(true);
    try {
      await window.api.changeUserPassword({
        username: currentUser.id,
        currentPassword: passwordForm.currentPassword,
        nextPassword: passwordForm.nextPassword,
      });
      addActivityLog('INFO', '비밀번호 변경', currentUser.id, currentUser.id);
      setPasswordForm({ currentPassword: '', nextPassword: '', confirmPassword: '' });
      refreshState();
      updateMessage('비밀번호를 변경했습니다.', 'success');
      showToast({ type: 'success', title: '비밀번호를 변경했습니다', message: '다음 로그인부터 새 비밀번호를 사용하세요.' });
    } catch (error) {
      updateMessage(error.message, 'error');
      showToast({ type: 'error', title: '비밀번호 변경에 실패했습니다', message: error.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAutoLoginToggle = () => {
    const nextAutoLogin = !session.autoLogin;
    saveSession({
      userId: currentUser.id,
      role: currentUser.role,
      autoLogin: nextAutoLogin,
    });
    addActivityLog('INFO', nextAutoLogin ? '자동 로그인 켜짐' : '자동 로그인 꺼짐', currentUser.id, currentUser.id);
    refreshState();
    updateMessage(nextAutoLogin ? '자동 로그인을 켰습니다.' : '자동 로그인을 껐습니다.', 'success');
  };

  const handleLogout = () => {
    addActivityLog('INFO', '로그아웃', currentUser.id, currentUser.id);
    clearSession();
    navigate('/login', { replace: true });
  };

  const handleWithdraw = async () => {
    if (!window.api?.deleteUserAccount) {
      updateMessage('설치된 데스크톱 앱에서 회원 탈퇴를 사용할 수 있습니다.', 'error');
      return;
    }
    if (!window.confirm(`현재 계정 ${currentUser.name} (${currentUser.id})을 탈퇴할까요?\n개인 투두와 일정도 이 PC에서 삭제됩니다.`)) return;

    try {
      await window.api.deleteUserAccount({ username: currentUser.id });
      clearPersonalTodoData(currentUser.id);
      clearSession();
      navigate('/login', { replace: true });
    } catch (error) {
      updateMessage(error.message, 'error');
    }
  };

  const messageClass = messageTone === 'error'
    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
    : messageTone === 'success'
      ? 'border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-200'
      : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700/60 dark:bg-gray-800 dark:text-gray-300';

  return (
    <PageShell title="보안 설정" description="로그인 세션, 비밀번호, 보안 이벤트를 관리합니다.">
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="현재 사용자" value={currentUser.name} detail={currentUser.role} />
        <StatCard label="자동 로그인" value={session.autoLogin ? '켜짐' : '꺼짐'} detail={session.autoLogin ? '세션 유지' : '수동 로그인'} tone={session.autoLogin ? 'accent' : 'yellow'} />
        <StatCard label="최근 로그인" value={session.loggedInAt ? new Date(session.loggedInAt).toLocaleString('ko-KR', { hour12: false }) : '-'} detail="현재 세션" />
        <StatCard label="로그인 실패" value={`${failedLoginCount.toLocaleString('ko-KR')}건`} detail={failedLoginCount > 0 ? '확인 필요' : '정상'} tone={failedLoginCount > 0 ? 'red' : 'accent'} />
      </div>

      <section className={`mb-4 rounded-lg border px-4 py-3 text-sm font-semibold shadow-xs ${messageClass}`}>
        {message}
      </section>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 rounded-lg border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-7">
          <div className="border-b border-gray-200 pb-4 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">비밀번호 변경</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">현재 계정의 로그인 비밀번호를 변경합니다.</p>
          </div>

          <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handlePasswordChange}>
            <FormField label="현재 비밀번호" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full font-mono" type={showPasswords ? 'text' : 'password'} value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" />
            </FormField>
            <div className="hidden md:block" />
            <FormField label="새 비밀번호" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full font-mono" type={showPasswords ? 'text' : 'password'} minLength="8" value={passwordForm.nextPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, nextPassword: event.target.value }))} autoComplete="new-password" />
              <div className="mt-2 flex flex-wrap gap-2">{getPasswordChecks(passwordForm.nextPassword).map((check) => <span key={check.key} className={`text-xs font-semibold ${check.passed ? 'text-accent-700 dark:text-accent-300' : 'text-gray-400'}`}>{check.passed ? '✓' : '○'} {check.label}</span>)}</div>
            </FormField>
            <FormField label="새 비밀번호 확인" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full font-mono" type={showPasswords ? 'text' : 'password'} minLength="8" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} autoComplete="new-password" />
              {passwordForm.confirmPassword && <p className={`mt-2 text-xs font-semibold ${passwordForm.nextPassword === passwordForm.confirmPassword ? 'text-accent-700 dark:text-accent-300' : 'text-red-600 dark:text-red-300'}`}>{passwordForm.nextPassword === passwordForm.confirmPassword ? '✓ 비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}</p>}
            </FormField>
            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center gap-3"><button className="btn btn-primary" type="submit" disabled={isChangingPassword}>{isChangingPassword ? '비밀번호 변경 중…' : '비밀번호 저장'}</button><button className="text-sm font-semibold text-gray-500 hover:text-teal-700" type="button" onClick={() => setShowPasswords((current) => !current)}>{showPasswords ? '비밀번호 숨기기' : '비밀번호 보기'}</button></div>
            </div>
          </form>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">세션 설정</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">자동 로그인 유지</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{session.autoLogin ? '현재 계정으로 세션을 유지합니다.' : '다음 접속 시 로그인 확인을 우선합니다.'}</p>
                </div>
                <button className={`relative h-6 w-11 rounded-full transition ${session.autoLogin ? 'bg-accent-600' : 'bg-gray-300 dark:bg-gray-700'}`} type="button" onClick={handleAutoLoginToggle} aria-pressed={session.autoLogin}>
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${session.autoLogin ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700/60">
              <p className="font-semibold text-gray-900 dark:text-gray-100">현재 세션 종료</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">로그인 화면으로 이동합니다.</p>
              <button className="btn mt-4 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" type="button" onClick={handleLogout}>
                로그아웃
              </button>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-500/30 dark:bg-red-500/10">
              <p className="font-semibold text-red-800 dark:text-red-200">회원 탈퇴</p>
              <p className="mt-1 text-sm text-red-700/80 dark:text-red-200/80">계정과 이 PC의 개인 투두·일정을 삭제합니다. 마지막 관리자 계정은 탈퇴할 수 없습니다.</p>
              <button className="mt-4 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-transparent dark:text-red-200" type="button" onClick={handleWithdraw}>
                회원 탈퇴
              </button>
            </div>
          </div>
        </aside>

        <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">최근 보안 이벤트</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {['시간', '수준', '사용자', '활동', '대상'].map((column) => (
                    <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {securityLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{log.createdAt}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{log.level}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{log.userId}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{log.action}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{log.target}</td>
                  </tr>
                ))}
                {securityLogs.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500 dark:text-gray-400" colSpan={5}>표시할 보안 이벤트가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
