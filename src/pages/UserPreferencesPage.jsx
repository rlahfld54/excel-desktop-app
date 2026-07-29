import React, { useEffect, useMemo, useState } from 'react';

import { FormField } from '../components/common';
import PageShell from './PageShell';
import { isSharedApiEnabled } from '../config/cloud';
import { sharedDataService } from '../services/sharedDataService';
import { addActivityLog, getCurrentUser, saveOfflineProfile, saveSession, saveUsers } from '../utils/authSession';
import { getBusinessCard } from '../utils/businessCard';

function makeForm(user) {
  return {
    name: user.name ?? '',
    department: user.department ?? '',
    title: user.title ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
  };
}

function makeMailSettings(user = {}) {
  return {
    gmailSenderName: user.name ?? '',
    gmailAddress: user.email ?? '',
    gmailAppPassword: '',
    gmailTestEmail: '',
    gmailReplyToEmail: user.email ?? '',
  };
}

export default function UserPreferencesPage() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [form, setForm] = useState(() => makeForm(currentUser));
  const [appSettings, setAppSettings] = useState(null);
  const [mailSettings, setMailSettings] = useState(() => makeMailSettings(currentUser));
  const [stateText, setStateText] = useState('개인 정보와 메일 명함 정보를 관리합니다.');
  const [copyText, setCopyText] = useState('');
  const [isSavingMailSettings, setIsSavingMailSettings] = useState(false);
  const businessCard = getBusinessCard(currentUser);

  useEffect(() => {
    let isMounted = true;

    if (!window.api?.getAppSettings) return undefined;

    window.api.getAppSettings()
      .then((result) => {
        const settings = result?.settings ?? result;
        if (!isMounted || !settings) return;
        setAppSettings(settings);
        setMailSettings({
          gmailSenderName: settings.gmailSenderName || currentUser.name || '',
          gmailAddress: settings.gmailAddress || currentUser.email || '',
          gmailAppPassword: settings.gmailAppPassword || '',
          gmailTestEmail: settings.gmailTestEmail || '',
          gmailReplyToEmail: settings.gmailReplyToEmail || currentUser.email || '',
        });
      })
      .catch(() => {
        setStateText('앱 설정을 불러오지 못했습니다. 프로필 정보는 계속 수정할 수 있습니다.');
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser.email, currentUser.name]);

  const profileRows = useMemo(() => [
    ['아이디', currentUser.username || currentUser.id],
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

  const handleMailSettingChange = (field, value) => {
    setMailSettings((current) => ({
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

  const handleSave = async () => {
    // 로그인한 AWS 계정(RDS users)을 먼저 갱신한다. 이 PC의 SQLite users에는
    // 같은 username이 있을 때만 함께 저장하며, 없다고 새 계정을 만들지는 않는다.
    let nextUser = currentUser;
    if (isSharedApiEnabled()) {
      try {
        const result = await sharedDataService.updateMyProfile({
          name: form.name,
          departmentName: form.department,
          title: form.title,
          email: form.email,
          phone: form.phone,
        });
        if (!result.ok) throw new Error(result.message || 'AWS 프로필 저장에 실패했습니다.');
        const remoteUser = result.data?.user ?? {};
        nextUser = {
          ...currentUser,
          ...remoteUser,
          id: String(remoteUser.userId ?? currentUser.id),
          username: remoteUser.username ?? currentUser.username,
          department: remoteUser.departmentName ?? form.department,
          title: remoteUser.title ?? form.title,
        };
        saveOfflineProfile(nextUser);
        saveSession({ ...(currentUser.session ?? {}), userId: nextUser.id, role: nextUser.role, user: nextUser });
      } catch (error) {
        setStateText(`AWS 프로필 저장 실패: ${error.message}`);
        return;
      }
    }

    if (window.api?.updateUserAccount && nextUser.username) {
      try {
        const localUsers = (await window.api.listUsers())?.users ?? [];
        if (localUsers.some((user) => user.id === nextUser.username)) {
          await window.api.updateUserAccount({
            username: nextUser.username,
            displayName: form.name,
            role: nextUser.role,
            departmentName: form.department,
            title: form.title,
            email: form.email,
            phone: form.phone,
            status: nextUser.status,
          });
        }
        saveUsers([nextUser, ...localUsers.filter((user) => user.id !== nextUser.id)]);
        setCurrentUser(nextUser);
      } catch (error) {
        // RDS 저장은 이미 완료된 상태다. 로컬 계정이 없어도 자동 생성하지 않는다.
        console.warn('로컬 SQLite 프로필 반영 실패:', error);
      }
    }
    if (window.api?.saveAppSettings) {
      try {
        const nextSettings = {
          ...(appSettings ?? {}),
          ...mailSettings,
        };
        const result = await window.api.saveAppSettings(nextSettings);
        if (result?.ok && result.settings) {
          setAppSettings(result.settings);
        }
      } catch {
        setStateText('프로필은 저장했지만 Gmail 설정 저장은 실패했습니다.');
        return;
      }
    }
    addActivityLog('INFO', '사용자 마이페이지 수정', currentUser.id);
    refreshUser('프로필 정보와 Gmail 테스트 조건이 저장되었습니다.');
  };

  const handleMailSettingsSave = async () => {
    if (isSavingMailSettings) return;
    if (!window.api?.saveAppSettings) {
      setStateText('Gmail 설정 저장은 Electron 데스크톱 앱에서 사용할 수 있습니다.');
      return;
    }

    setIsSavingMailSettings(true);
    setStateText('Gmail 테스트 조건을 저장하는 중입니다.');

    try {
      const nextSettings = {
        ...(appSettings ?? {}),
        ...mailSettings,
      };
      const result = await window.api.saveAppSettings(nextSettings);
      if (!result?.ok) {
        throw new Error(result?.message || 'Gmail 설정 저장에 실패했습니다.');
      }

      setAppSettings(result.settings ?? nextSettings);
      addActivityLog('INFO', 'Gmail 테스트 조건 저장', currentUser.id);
      setStateText('Gmail 테스트 조건이 저장되었습니다.');
    } catch (error) {
      setStateText(error?.message || 'Gmail 설정 저장에 실패했습니다.');
    } finally {
      setIsSavingMailSettings(false);
    }
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
            <FormField label="아이디" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full bg-gray-50 dark:bg-gray-900/30" value={currentUser.username || currentUser.id} disabled />
            </FormField>
            <FormField label="이름" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full" value={form.name} onChange={(event) => handleChange('name', event.target.value)} />
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
            <FormField label="전화번호" labelClassName="uppercase text-gray-400 dark:text-gray-500">
              <input className="form-input w-full" value={form.phone} onChange={(event) => handleChange('phone', event.target.value)} />
            </FormField>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Gmail 테스트 조건</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">마감 발송 큐의 전송 전 점검과 테스트 발송에서 이 값을 사용합니다.</p>
          </div>
          <button
            className="btn btn-primary shrink-0 whitespace-nowrap"
            type="button"
            onClick={handleMailSettingsSave}
            disabled={isSavingMailSettings}
          >
            {isSavingMailSettings ? '저장 중...' : 'Gmail 설정 저장'}
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <FormField label="발송자 이름" labelClassName="uppercase text-gray-400 dark:text-gray-500">
            <input className="form-input w-full" value={mailSettings.gmailSenderName} onChange={(event) => handleMailSettingChange('gmailSenderName', event.target.value)} />
          </FormField>
          <FormField label="Gmail 주소" labelClassName="uppercase text-gray-400 dark:text-gray-500">
            <input className="form-input w-full" type="email" value={mailSettings.gmailAddress} onChange={(event) => handleMailSettingChange('gmailAddress', event.target.value)} />
          </FormField>
          <FormField label="앱 비밀번호" labelClassName="uppercase text-gray-400 dark:text-gray-500">
            <input className="form-input w-full" type="password" value={mailSettings.gmailAppPassword} onChange={(event) => handleMailSettingChange('gmailAppPassword', event.target.value)} autoComplete="new-password" />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Windows 보안 저장소로 암호화되며 로컬 백업에는 포함되지 않습니다.</p>
          </FormField>
          <FormField label="테스트 수신 이메일" labelClassName="uppercase text-gray-400 dark:text-gray-500">
            <input className="form-input w-full" type="email" value={mailSettings.gmailTestEmail} onChange={(event) => handleMailSettingChange('gmailTestEmail', event.target.value)} />
          </FormField>
          <FormField label="회신 받을 이메일" labelClassName="uppercase text-gray-400 dark:text-gray-500">
            <input className="form-input w-full" type="email" value={mailSettings.gmailReplyToEmail} onChange={(event) => handleMailSettingChange('gmailReplyToEmail', event.target.value)} />
          </FormField>
        </div>
      </section>

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
