import React, { useMemo, useState } from 'react';

import { FormField } from '../components/common';
import PageShell from './PageShell';
import { addActivityLog, getCurrentUser, updateUser } from '../utils/authSession';

function makeForm(user) {
  return {
    name: user.name ?? '',
    password: user.password ?? '0000',
    department: user.department ?? '',
    title: user.title ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    status: user.status ?? 'ACTIVE',
  };
}

export default function AdminPreferencesPage() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [form, setForm] = useState(() => makeForm(currentUser));
  const [stateText, setStateText] = useState('관리자 계정 정보와 운영 상태를 수정할 수 있습니다.');

  const profileRows = useMemo(() => [
    ['아이디', currentUser.id],
    ['권한', currentUser.role],
    ['계정 상태', currentUser.status],
    ['자동 로그인', currentUser.session?.autoLogin ? '유지 중' : '꺼짐'],
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
    addActivityLog('INFO', '관리자 마이페이지 수정', currentUser.id);
    refreshUser('관리자 계정 정보를 저장했습니다.');
  };

  const handleReset = () => {
    refreshUser('저장된 관리자 정보로 되돌렸습니다.');
  };

  return (
    <PageShell title="관리자 마이페이지" description="관리자 계정, 권한, 계정 상태를 별도 화면에서 관리합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Admin profile</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{currentUser.name} · {currentUser.role}</p>
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
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">관리자 계정 정보</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FormField label="아이디" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full bg-gray-50 dark:bg-gray-900/30" value={currentUser.id} disabled />
            </FormField>
            <FormField label="권한" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full bg-gray-50 dark:bg-gray-900/30" value={currentUser.role} disabled />
            </FormField>
            <FormField label="이름" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full" value={form.name} onChange={(event) => handleChange('name', event.target.value)} />
            </FormField>
            <FormField label="비밀번호" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full font-mono" value={form.password} onChange={(event) => handleChange('password', event.target.value)} />
            </FormField>
            <FormField label="부서" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full" value={form.department} onChange={(event) => handleChange('department', event.target.value)} />
            </FormField>
            <FormField label="직책" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full" value={form.title} onChange={(event) => handleChange('title', event.target.value)} />
            </FormField>
            <FormField label="이메일" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full" type="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} />
            </FormField>
            <FormField label="연락처" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full" value={form.phone} onChange={(event) => handleChange('phone', event.target.value)} />
            </FormField>
            <FormField label="계정 상태" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <select className="form-select w-full" value={form.status} onChange={(event) => handleChange('status', event.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </FormField>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">관리자 로그인 정보</h2>
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
    </PageShell>
  );
}
