import React, { useMemo, useState } from 'react';

import PageShell from './PageShell';
import { addActivityLog, getCurrentUser, updateUser } from '../utils/authSession';
import { getBusinessCard } from '../utils/businessCard';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function makeForm(user) {
  return {
    name: user.name ?? '',
    password: user.password ?? '0000',
    department: user.department ?? '',
    title: user.title ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
  };
}

export default function UserPreferencesPage() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [form, setForm] = useState(() => makeForm(currentUser));
  const [stateText, setStateText] = useState('개인 정보와 메일 명함 정보를 관리합니다.');
  const [copyText, setCopyText] = useState('');
  const businessCard = getBusinessCard(currentUser);

  const profileRows = useMemo(() => [
    ['아이디', currentUser.id],
    ['권한', currentUser.role],
    ['부서', currentUser.department || '-'],
    ['직책', currentUser.title || '-'],
    ['최근 로그인', currentUser.session?.loggedInAt ? new Date(currentUser.session.loggedInAt).toLocaleString('ko-KR', { hour12: false }) : '-'],
  ], [currentUser]);

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const refreshUser = (message) => {
    const nextUser = getCurrentUser();
    setCurrentUser(nextUser);
    setForm(makeForm(nextUser));
    setStateText(message);
  };

  const handleSave = () => {
    updateUser(currentUser.id, form);
    addActivityLog('INFO', '사용자 마이페이지 수정', currentUser.id);
    refreshUser('프로필 정보가 저장되었습니다. 메일 명함에도 반영됩니다.');
  };

  const handleReset = () => {
    refreshUser('저장된 정보로 되돌렸습니다.');
  };

  const copyValue = async (label, value) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopyText(`${label} 복사됨`);
    } catch {
      setCopyText(`${label} 복사 실패`);
    }
  };

  return (
    <PageShell title="마이페이지" description="내 개인정보와 메일 발송 시 붙는 명함 정보를 관리합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">My profile</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{currentUser.name}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{stateText}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={handleReset}>되돌리기</button>
            <button className="btn btn-primary" type="button" onClick={handleSave}>저장</button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 rounded-lg border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">기본 정보</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="아이디">
              <input className="form-input w-full bg-gray-50 dark:bg-gray-900/30" value={currentUser.id} disabled />
            </Field>
            <Field label="이름">
              <input className="form-input w-full" value={form.name} onChange={(event) => handleChange('name', event.target.value)} />
            </Field>
            <Field label="비밀번호">
              <input className="form-input w-full font-mono" value={form.password} onChange={(event) => handleChange('password', event.target.value)} />
            </Field>
            <Field label="부서">
              <input className="form-input w-full" value={form.department} onChange={(event) => handleChange('department', event.target.value)} />
            </Field>
            <Field label="직책">
              <input className="form-input w-full" value={form.title} onChange={(event) => handleChange('title', event.target.value)} />
            </Field>
            <Field label="이메일">
              <input className="form-input w-full" type="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} />
            </Field>
            <Field label="전화번호">
              <input className="form-input w-full" value={form.phone} onChange={(event) => handleChange('phone', event.target.value)} />
            </Field>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">계정 정보</h2>
          <div className="mt-5 space-y-3">
            {profileRows.map(([label, value]) => (
              <div key={label} className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
                <p className="mt-1 break-all text-sm font-medium text-gray-800 dark:text-gray-100">{value}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className="mt-5 rounded-lg border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">메일 명함 미리보기</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">개인 정보를 저장하면 거래처 메일 하단 명함에 반영됩니다.</p>
          </div>
          {copyText && <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">{copyText}</span>}
        </div>

        <div className="mt-4 max-w-xl overflow-hidden rounded-lg border border-gray-200 bg-[linear-gradient(135deg,#ffffff_0%,#f3fbf8_100%)] shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
          <div className="border-l-4 border-teal-600 p-5">
            <p className="text-xs font-bold uppercase text-teal-700 dark:text-teal-300">{businessCard.company}</p>
            <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-gray-100">{businessCard.name || '이름'}</p>
            <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{businessCard.department || '부서'} · {businessCard.title || '직책'}</p>
            <div className="mt-5 grid gap-2 text-sm">
              <button className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-left text-gray-700 shadow-xs hover:bg-teal-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-teal-500/10" type="button" onClick={() => copyValue('이메일', businessCard.email)}>
                <span>E. {businessCard.email || '-'}</span>
                <span className="text-xs font-bold text-teal-700 dark:text-teal-300">복사</span>
              </button>
              <button className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-left text-gray-700 shadow-xs hover:bg-teal-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-teal-500/10" type="button" onClick={() => copyValue('전화번호', businessCard.phone)}>
                <span>T. {businessCard.phone || '-'}</span>
                <span className="text-xs font-bold text-teal-700 dark:text-teal-300">복사</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
