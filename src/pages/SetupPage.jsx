import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Logo from '../images/logo.svg';
import { cloudConfig, isSharedApiEnabled } from '../config/cloud';
import { saveUsers } from '../utils/authSession';
import { initializePersonalTodos } from '../utils/todoSchedule';

const steps = [
  { title: '환영합니다', detail: '이 PC에서 사용할 환경을 확인합니다.' },
  { title: '관리자 계정', detail: '첫 사용자를 안전하게 등록합니다.' },
  { title: 'AWS 데이터', detail: '필요할 때 중앙 데이터를 내려받습니다.' },
  { title: '설정 완료', detail: '로컬 작업 환경을 시작합니다.' },
];

function StepBadge({ index, currentStep }) {
  const active = index === currentStep;
  const done = index < currentStep;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        active || done
          ? 'bg-teal-700 text-white dark:bg-accent-400 dark:text-gray-950'
          : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
      }`}>
        {done ? '✓' : index + 1}
      </span>
      <span className="hidden min-w-0 lg:block">
        <span className={`block truncate text-sm font-semibold ${active ? 'text-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
          {steps[index].title}
        </span>
        <span className="block truncate text-xs text-gray-400">{steps[index].detail}</span>
      </span>
    </div>
  );
}

export default function SetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);
  const [cloudImported, setCloudImported] = useState(null);
  const [account, setAccount] = useState({
    username: '',
    displayName: '',
    departmentName: '',
    password: '',
    passwordConfirm: '',
  });
  const [cloud, setCloud] = useState({
    apiBaseUrl: cloudConfig.apiBaseUrl,
    accessToken: '',
  });

  useEffect(() => {
    async function loadStatus() {
      if (!window.api?.getSetupStatus) {
        setMessage('설치된 데스크톱 앱에서 초기 설정을 진행해 주세요.');
        return;
      }
      const result = await window.api.getSetupStatus();
      setStatus(result);
      setCloud((current) => ({
        ...current,
        apiBaseUrl: result.settings?.cloudApiBaseUrl ?? '',
      }));
    }
    loadStatus().catch((error) => setMessage(error.message));
  }, []);

  const databaseCounts = useMemo(() => status?.database?.coreCounts ?? {}, [status]);
  const hasExistingUser = Number(databaseCounts.users) > 0;
  const usesSharedLogin = isSharedApiEnabled();

  const handleRegister = async () => {
    setMessage('');
    if (account.password !== account.passwordConfirm) {
      setMessage('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsBusy(true);
    try {
      const result = await window.api.registerUser(account);
      if (!result?.ok) throw new Error(result?.message || '계정을 만들지 못했습니다.');
      setRegisteredUser(result.user);
      initializePersonalTodos(result.user.id);
      const usersResult = await window.api.listUsers();
      saveUsers(usersResult.users ?? [result.user]);
      setStep(2);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownload = async () => {
    setMessage('');
    setIsBusy(true);
    try {
      const result = await window.api.downloadCloudData(cloud);
      if (!result?.ok) throw new Error(result?.message || 'AWS 데이터를 내려받지 못했습니다.');
      setCloudImported(result.imported);
      setMessage('AWS 데이터를 로컬 SQLite에 저장했습니다.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleComplete = async () => {
    setMessage('');
    setIsBusy(true);
    try {
      await window.api.completeSetup({
        cloudApiBaseUrl: cloud.apiBaseUrl,
        lastCloudSyncAt: cloudImported ? new Date().toISOString() : '',
      });
      window.dispatchEvent(new CustomEvent('excel-workspace:setup-completed'));
      setStep(3);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#e8faf5_0%,#eef7ff_48%,#fff7df_100%)] px-5 py-8 text-gray-950 dark:bg-[linear-gradient(135deg,#052820_0%,#071f34_52%,#2b2208_100%)] dark:text-white">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <img className="h-7 w-7" src={Logo} alt="" />
          </span>
          <div>
            <p className="font-bold">Excel Desktop App</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">처음 사용 설정</p>
          </div>
        </header>

        <section className="overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-teal-950/10 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
          <div className="grid gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:grid-cols-4">
            {steps.map((item, index) => <StepBadge key={item.title} index={index} currentStep={step} />)}
          </div>

          <div className="min-h-[520px] p-6 sm:p-10">
            {step === 0 && (
              <div className="mx-auto max-w-2xl">
                <p className="text-sm font-bold text-teal-700 dark:text-accent-300">WELCOME</p>
                <h1 className="mt-3 text-3xl font-bold sm:text-4xl">업무 환경을 함께 준비할게요.</h1>
                <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-300">
                  SQLite는 이 PC에 자동 생성되어 오프라인 작업과 로컬 백업에 사용됩니다.
                  AWS 연결은 선택 사항이며, 사용자가 요청할 때 중앙 데이터를 내려받아 SQLite에 저장합니다.
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  {[
                    ['SQLite', status?.database?.path || '앱 실행 시 자동 생성', '로컬 작업 데이터'],
                    ['백업', status?.settings?.backupPath || 'ProgramData 공용 폴더', 'PC 복구 지점'],
                    ['AWS', status?.settings?.cloudApiBaseUrl || '아직 연결되지 않음', '요청 시 데이터 동기화'],
                  ].map(([title, value, detail]) => (
                    <div key={title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                      <p className="text-sm font-bold">{title}</p>
                      <p className="mt-2 break-all text-sm text-gray-600 dark:text-gray-300">{value}</p>
                      <p className="mt-2 text-xs text-gray-400">{detail}</p>
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary mt-8 h-12 px-8" type="button" onClick={() => setStep(usesSharedLogin || hasExistingUser ? 2 : 1)}>
                  설정 시작
                </button>
              </div>
            )}

            {step === 1 && (
              <div className="mx-auto max-w-xl">
                <p className="text-sm font-bold text-teal-700 dark:text-accent-300">ADMIN ACCOUNT</p>
                <h1 className="mt-3 text-3xl font-bold">첫 관리자 계정을 만드세요.</h1>
                <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
                  첫 계정은 관리자 권한으로 생성됩니다. 비밀번호는 SQLite에 암호화된 해시로 저장됩니다.
                </p>
                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">로그인 아이디</span>
                    <input className="form-input w-full" value={account.username} onChange={(event) => setAccount({ ...account, username: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">이름</span>
                    <input className="form-input w-full" value={account.displayName} onChange={(event) => setAccount({ ...account, displayName: event.target.value })} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-semibold">부서</span>
                    <input className="form-input w-full" value={account.departmentName} onChange={(event) => setAccount({ ...account, departmentName: event.target.value })} placeholder="예: 총무팀" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">비밀번호</span>
                    <input className="form-input w-full" type="password" value={account.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">비밀번호 확인</span>
                    <input className="form-input w-full" type="password" value={account.passwordConfirm} onChange={(event) => setAccount({ ...account, passwordConfirm: event.target.value })} />
                  </label>
                </div>
                <button className="btn btn-primary mt-7 h-12 px-8" type="button" disabled={isBusy} onClick={handleRegister}>
                  {isBusy ? '계정 생성 중…' : '관리자 계정 만들기'}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="mx-auto max-w-2xl">
                <p className="text-sm font-bold text-teal-700 dark:text-accent-300">AWS DATA</p>
                <h1 className="mt-3 text-3xl font-bold">중앙 데이터를 지금 받을까요?</h1>
                <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
                  {usesSharedLogin
                    ? '이 앱은 AWS 로그인 방식을 사용합니다. 설정을 마친 뒤 기존 AWS 계정으로 로그인하면 중앙 데이터를 내려받아 이 PC의 SQLite에 저장합니다.'
                    : 'AWS 연결 없이도 로컬 SQLite로 정상 사용할 수 있습니다.'}
                </p>
                {!usesSharedLogin && <div className="mt-7 space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">AWS API 주소</span>
                    <input className="form-input w-full" value={cloud.apiBaseUrl} onChange={(event) => setCloud({ ...cloud, apiBaseUrl: event.target.value })} placeholder="https://api.example.com" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">일회용 접근 토큰</span>
                    <input className="form-input w-full" type="password" value={cloud.accessToken} onChange={(event) => setCloud({ ...cloud, accessToken: event.target.value })} placeholder="토큰은 설정 파일에 저장하지 않습니다" />
                  </label>
                  <button className="btn btn-secondary" type="button" disabled={isBusy || !cloud.apiBaseUrl} onClick={handleDownload}>
                    {isBusy ? '데이터 받는 중…' : 'AWS 데이터 내려받기'}
                  </button>
                  {cloudImported && (
                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                      거래처 {cloudImported.customers}건 · 제품 {cloudImported.products}건 · 연락처 {cloudImported.contacts}건 저장 완료
                    </p>
                  )}
                </div>}
                <div className="mt-7 flex flex-wrap gap-3">
                  <button className="btn btn-primary h-12 px-8" type="button" disabled={isBusy} onClick={handleComplete}>
                    {cloudImported ? '동기화하고 계속' : '지금은 로컬로 시작'}
                  </button>
                  {!hasExistingUser && !registeredUser && (
                    <button className="btn btn-secondary h-12" type="button" onClick={() => setStep(1)}>계정 단계로 돌아가기</button>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl text-green-700 dark:bg-green-500/15 dark:text-green-300">✓</span>
                <h1 className="mt-6 text-3xl font-bold">설정이 완료됐습니다.</h1>
                <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-300">
                  SQLite와 백업 폴더가 준비되었습니다. AWS 데이터는 설정 페이지에서 언제든 다시 내려받을 수 있습니다.
                </p>
                <button className="btn btn-primary mt-8 h-12 px-8" type="button" onClick={() => navigate('/login', { replace: true })}>
                  로그인 화면으로 이동
                </button>
              </div>
            )}

            {message && (
              <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                {message}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
