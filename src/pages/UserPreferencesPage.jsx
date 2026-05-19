import React, { useMemo, useState } from 'react';

import PageShell from './PageShell';
import { addActivityLog, getCurrentUser, updateUser } from '../utils/authSession';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function UserPreferencesPage() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [form, setForm] = useState(() => ({
    name: currentUser.name ?? '',
    password: currentUser.password ?? '0000',
    department: currentUser.department ?? '',
    title: currentUser.title ?? '',
    email: currentUser.email ?? '',
    phone: currentUser.phone ?? '',
    status: currentUser.status ?? 'ACTIVE',
  }));
  const [stateText, setStateText] = useState('본인 정보를 수정할 수 있습니다.');

  const profileRows = useMemo(() => [
    ['아이디', currentUser.id],
    ['권한', currentUser.role],
    ['자동 로그인', currentUser.session?.autoLogin ? '유지 중' : '꺼짐'],
    ['최근 로그인', currentUser.session?.loggedInAt ? new Date(currentUser.session.loggedInAt).toLocaleString('ko-KR', { hour12: false }) : '-'],
  ], [currentUser]);

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = () => {
    updateUser(currentUser.id, form);
    addActivityLog('INFO', '마이페이지 정보 수정', currentUser.id);
    const nextUser = getCurrentUser();
    setCurrentUser(nextUser);
    setForm({
      name: nextUser.name ?? '',
      password: nextUser.password ?? '0000',
      department: nextUser.department ?? '',
      title: nextUser.title ?? '',
      email: nextUser.email ?? '',
      phone: nextUser.phone ?? '',
      status: nextUser.status ?? 'ACTIVE',
    });
    setStateText('프로필 정보를 저장했습니다. 헤더와 사용자 관리 화면에도 반영됩니다.');
  };

  const handleReset = () => {
    const freshUser = getCurrentUser();
    setCurrentUser(freshUser);
    setForm({
      name: freshUser.name ?? '',
      password: freshUser.password ?? '0000',
      department: freshUser.department ?? '',
      title: freshUser.title ?? '',
      email: freshUser.email ?? '',
      phone: freshUser.phone ?? '',
      status: freshUser.status ?? 'ACTIVE',
    });
    setStateText('저장된 정보로 되돌렸습니다.');
  };

  return (
    <PageShell title="마이페이지" description="로그인한 사용자의 이름, 연락처, 부서, 직책 등 기본 정보를 수정합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">My profile</p>
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
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">기본 정보</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="아이디">
              <input className="form-input w-full bg-gray-50 dark:bg-gray-900/30" value={currentUser.id} disabled />
            </Field>
            <Field label="권한">
              <input className="form-input w-full bg-gray-50 dark:bg-gray-900/30" value={currentUser.role} disabled />
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
            <Field label="연락처">
              <input className="form-input w-full" value={form.phone} onChange={(event) => handleChange('phone', event.target.value)} />
            </Field>
            <Field label="상태">
              <select className="form-select w-full" value={form.status} onChange={(event) => handleChange('status', event.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </Field>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">로그인 정보</h2>
          <div className="mt-5 space-y-3">
            {profileRows.map(([label, value]) => (
              <div key={label} className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
                <p className="mt-1 break-all text-sm font-medium text-gray-800 dark:text-gray-100">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-accent-200 bg-accent-50/70 p-4 dark:border-accent-500/30 dark:bg-accent-500/10">
            <p className="text-xs font-semibold uppercase text-accent-700 dark:text-accent-300">개발 단계 안내</p>
            <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
              현재는 자동 로그인 상태를 유지하며, 사용자 정보는 브라우저 저장소에 보관됩니다. Electron 연결 단계에서 SQLite 사용자 테이블과 동기화하면 됩니다.
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
