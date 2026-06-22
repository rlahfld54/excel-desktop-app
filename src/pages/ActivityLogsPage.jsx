import React, { useEffect, useMemo, useState } from 'react';

import { StatusBadge } from '../components/common';
import PageShell from './PageShell';
import {
  addActivityLog,
  createLog,
  getLogs,
  getCurrentUser,
  getSession,
  saveLogs,
  saveUsers,
} from '../utils/authSession';
import { clearPersonalTodoData } from '../utils/todoSchedule';

export default function ActivityLogsPage() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser.role === 'ADMIN';
  const [users, setUsers] = useState([]);
  const [session, setSession] = useState(() => getSession());
  const [logs, setLogs] = useState(() => getLogs());
  const [filter, setFilter] = useState('전체');
  const [selectedUserId, setSelectedUserId] = useState(session.userId);
  const [userMessage, setUserMessage] = useState('');
  const [isSavingUsers, setIsSavingUsers] = useState(false);

  useEffect(() => {
    if (!isAdmin || !window.api?.listUsers) return;
    window.api.listUsers()
      .then((result) => {
        const nextUsers = result.users ?? [];
        setUsers(nextUsers);
        saveUsers(nextUsers);
      })
      .catch((error) => setUserMessage(error.message));
  }, [isAdmin]);

  useEffect(() => {
    saveLogs(logs);
  }, [logs]);

  const visibleLogs = useMemo(
    () => isAdmin ? logs : logs.filter((log) => log.userId === currentUser.id),
    [currentUser.id, isAdmin, logs],
  );
  const filteredLogs = useMemo(() => (
    filter === '전체' ? visibleLogs : visibleLogs.filter((log) => log.level === filter)
  ), [filter, visibleLogs]);

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? users[0];

  const metrics = useMemo(() => [
    { label: '현재 로그인', value: session.userId, detail: session.autoLogin ? '자동 로그인 유지' : '수동 로그인' },
    { label: isAdmin ? '사용자' : '계정', value: isAdmin ? `${users.length.toLocaleString('ko-KR')}명` : currentUser.name, detail: isAdmin ? '전체 계정 관리' : '현재 로그인 계정' },
    { label: '활동 로그', value: `${visibleLogs.length.toLocaleString('ko-KR')}건`, detail: isAdmin ? '전체 사용자 기록' : '내 기록만 표시' },
    { label: '관리 권한', value: session.role, detail: '관리자 기준 화면' },
  ], [currentUser.name, isAdmin, session, users.length, visibleLogs.length]);

  const appendLog = (level, action, target) => {
    const nextLogs = [createLog(level, action, target, session.userId), ...logs].slice(0, 200);
    setLogs(nextLogs);
    saveLogs(nextLogs);
  };

  const updateUserField = (userId, field, value) => {
    setUsers((current) => current.map((user) => (
      user.id === userId ? { ...user, [field]: value } : user
    )));
  };

  const reloadUsers = async () => {
    const result = await window.api.listUsers();
    const nextUsers = result.users ?? [];
    setUsers(nextUsers);
    saveUsers(nextUsers);
    return nextUsers;
  };

  const saveUser = async (user) => {
    setUserMessage('');
    try {
      await window.api.updateUserAccount({
        username: user.id,
        displayName: user.name,
        role: user.role,
        departmentName: user.department,
        status: user.status,
      });
      await reloadUsers();
      appendLog('INFO', '사용자 정보 수정', user.id);
      setUserMessage(`${user.id} 계정을 저장했습니다.`);
    } catch (error) {
      setUserMessage(error.message);
      await reloadUsers();
    }
  };

  const saveAllUsers = async () => {
    if (!window.api?.updateUserAccount || users.length === 0) return;

    setIsSavingUsers(true);
    setUserMessage('');
    try {
      await Promise.all(users.map((user) => window.api.updateUserAccount({
        username: user.id,
        displayName: user.name,
        role: user.role,
        departmentName: user.department,
        status: user.status,
      })));
      await reloadUsers();
      appendLog('INFO', '사용자 정보 일괄 저장', `${users.length}개 계정`);
      setUserMessage(`사용자 ${users.length}명의 변경사항을 저장했습니다.`);
    } catch (error) {
      setUserMessage(error.message);
      await reloadUsers();
    } finally {
      setIsSavingUsers(false);
    }
  };

  const deleteUser = async (user) => {
    if (user.id === currentUser.id) {
      setUserMessage('현재 로그인한 본인 계정은 보안 설정에서 탈퇴해 주세요.');
      return;
    }
    if (!window.confirm(`${user.name} (${user.id}) 계정을 탈퇴 처리할까요?\n개인 투두와 일정도 이 PC에서 삭제됩니다.`)) return;

    try {
      await window.api.deleteUserAccount({ username: user.id });
      clearPersonalTodoData(user.id);
      const nextUsers = await reloadUsers();
      setSelectedUserId(nextUsers[0]?.id ?? '');
      appendLog('WARN', '사용자 탈퇴', user.id);
      setUserMessage(`${user.id} 계정을 탈퇴 처리했습니다.`);
    } catch (error) {
      setUserMessage(error.message);
    }
  };

  const addCheckLog = () => {
    const nextLogs = addActivityLog('WARN', '수동 점검 로그 추가', '개발 확인', session.userId);
    setLogs(nextLogs);
  };

  return (
    <PageShell title="활동 로그" description={isAdmin ? '전체 사용자 활동과 계정을 관리합니다.' : '현재 로그인한 내 활동 기록만 확인합니다.'}>
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Admin session</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{session.userId} 로그인 기록</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isAdmin ? '전체 사용자 로그와 계정을 관리합니다.' : '다른 사용자의 기록은 표시되지 않습니다.'}</p>
          </div>
          {isAdmin && <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={addCheckLog}>점검 로그</button>
          </div>}
        </div>
      </section>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <section key={metric.label} className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{metric.label}</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{metric.value}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{metric.detail}</p>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">활동 로그</h2>
            <select className="form-select h-9" value={filter} onChange={(event) => setFilter(event.target.value)}>
              {['전체', 'INFO', 'WARN', 'ERROR'].map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </header>
          <div className="max-h-[440px] overflow-auto no-scrollbar">
            <table className="min-w-[760px] w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {['시간', '수준', '사용자', '활동', '대상'].map((column) => (
                    <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="group">
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{log.createdAt}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 dark:border-gray-700/60"><StatusBadge status={log.level} /></td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{log.userId}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{log.action}</td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700/60 dark:text-gray-200">{log.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {isAdmin && <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">사용자 관리</h2>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">선택: {selectedUser?.id}</span>
              <button
                className="btn btn-primary h-9 px-4 text-sm"
                type="button"
                disabled={isSavingUsers || users.length === 0}
                onClick={saveAllUsers}
              >
                {isSavingUsers ? '저장 중...' : '변경사항 저장'}
              </button>
            </div>
          </header>
          {userMessage && <p className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-accent-700 dark:border-gray-700/60 dark:text-accent-300">{userMessage}</p>}
          <div className="max-h-[440px] overflow-auto">
            <table className="min-w-[860px] w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {['아이디', '이름', '권한', '부서', '상태', '관리'].map((column) => (
                    <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={`group cursor-pointer ${selectedUserId === user.id ? 'bg-accent-50/70 dark:bg-accent-500/10' : ''}`} onClick={() => setSelectedUserId(user.id)}>
                    <td className="border-b border-r border-gray-200 px-3 py-2 font-semibold text-gray-800 dark:border-gray-700/60 dark:text-gray-100">{user.id}</td>
                    <td className="border-b border-r border-gray-200 px-2 py-1 dark:border-gray-700/60"><input className="form-input h-8 w-28" value={user.name} onChange={(event) => updateUserField(user.id, 'name', event.target.value)} /></td>
                    <td className="border-b border-r border-gray-200 px-2 py-1 dark:border-gray-700/60">
                      <select className="form-select h-8 w-28" value={user.role} onChange={(event) => updateUserField(user.id, 'role', event.target.value)}>
                        {['ADMIN', 'MANAGER', 'VIEWER'].map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td className="border-b border-r border-gray-200 px-2 py-1 dark:border-gray-700/60"><input className="form-input h-8 w-28" value={user.department ?? ''} onChange={(event) => updateUserField(user.id, 'department', event.target.value)} /></td>
                    <td className="border-b border-r border-gray-200 px-2 py-1 dark:border-gray-700/60">
                      <select className="form-select h-8 w-28" value={user.status} onChange={(event) => updateUserField(user.id, 'status', event.target.value)}>
                        {['ACTIVE', 'INACTIVE'].map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                    <td className="border-b border-r border-gray-200 px-2 py-1 dark:border-gray-700/60">
                      <div className="flex gap-2">
                        <button className="btn btn-secondary h-8 px-3 text-xs" type="button" onClick={() => saveUser(user)}>저장</button>
                        <button className="h-8 rounded-md border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-500/30 dark:text-rose-300" type="button" disabled={user.id === currentUser.id} onClick={() => deleteUser(user)}>탈퇴</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>}
      </div>
    </PageShell>
  );
}
