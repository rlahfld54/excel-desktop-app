import React, { useEffect, useMemo, useState } from 'react';

import {
  createTodo,
  getCalendarDays,
  getTeamTodoSummary,
  getTodayKey,
  getTodoSummary,
  priorityMeta,
  readTeamTodoHistory,
  readTeamTodos,
  readTodoHistory,
  readTodos,
  saveTeamTodos,
  saveTodos,
  toggleTeamTodoDone,
  toggleTodoDone,
} from '../utils/todoSchedule';

function ProgressBar({ value }) {
  return (
    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
      <div className="h-2 rounded-full bg-teal-600 dark:bg-teal-400" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}

function TodoCard({ todo, onToggle, onEdit, onDelete }) {
  const meta = priorityMeta[todo.priority] ?? priorityMeta.LOW;

  return (
    <div className={`rounded-lg border border-gray-200 border-l-4 bg-white p-3 shadow-xs ${meta.accent} dark:border-gray-700/60 dark:bg-gray-800`}>
      <div className="flex items-start gap-3">
        <input
          className="form-checkbox mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
          type="checkbox"
          checked={todo.done}
          onChange={(event) => onToggle(todo.id, event.target.checked)}
          aria-label={`${todo.title} 완료`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-semibold ${todo.done ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>{todo.title}</p>
            <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${meta.className}`}>{meta.label}</span>
            {todo.reminderAt && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">알림 {todo.reminderAt}</span>}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{todo.detail}</p>
          <p className="mt-2 text-xs font-semibold text-gray-400 dark:text-gray-500">{todo.dueDate || todo.due}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button className="rounded-md px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" type="button" onClick={() => onEdit(todo)}>
            수정
          </button>
          <button className="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10" type="button" onClick={() => onDelete(todo.id)}>
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function makeEmptyDraft() {
  return {
    id: '',
    title: '',
    detail: '',
    priority: 'MEDIUM',
    dueDate: getTodayKey(),
    reminderAt: '',
  };
}

export default function ScheduleManager({ userId }) {
  const [scope, setScope] = useState('PERSONAL');
  const [todos, setTodos] = useState(() => readTodos(userId));
  const [history, setHistory] = useState(() => readTodoHistory(userId));
  const [draft, setDraft] = useState(makeEmptyDraft);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [filter, setFilter] = useState('OPEN');
  const isTeamScope = scope === 'TEAM';

  useEffect(() => {
    setTodos(isTeamScope ? readTeamTodos() : readTodos(userId));
    setHistory(isTeamScope ? readTeamTodoHistory() : readTodoHistory(userId));
    setDraft(makeEmptyDraft());
  }, [isTeamScope, userId]);

  const summary = isTeamScope ? getTeamTodoSummary() : getTodoSummary(userId);
  const calendarDays = getCalendarDays(calendarMonth.year, calendarMonth.month, todos, history);
  const sortedTodos = useMemo(() => {
    const weight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return [...todos]
      .filter((todo) => filter === 'ALL' || (filter === 'DONE' ? todo.done : !todo.done))
      .sort((a, b) => Number(a.done) - Number(b.done) || String(a.dueDate).localeCompare(String(b.dueDate)) || weight[b.priority] - weight[a.priority]);
  }, [filter, todos]);
  const overdueTodos = todos.filter((todo) => !todo.done && todo.dueDate && todo.dueDate < getTodayKey());
  const todayTodos = todos.filter((todo) => todo.dueDate === getTodayKey());

  const refreshState = (nextTodos) => {
    setTodos(nextTodos);
    setHistory(isTeamScope ? readTeamTodoHistory() : readTodoHistory(userId));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!draft.title.trim()) return;

    const nextTodos = draft.id
      ? todos.map((todo) => (
        todo.id === draft.id
          ? { ...todo, ...draft, due: draft.dueDate }
          : todo
      ))
      : [createTodo({ ...draft, due: draft.dueDate, path: '/schedule/todos', scope: isTeamScope ? 'TEAM' : 'PERSONAL' }), ...todos];

    if (isTeamScope) {
      saveTeamTodos(nextTodos);
    } else {
      saveTodos(userId, nextTodos);
    }
    setDraft(makeEmptyDraft());
    refreshState(nextTodos);
  };

  const handleToggle = (todoId, done) => {
    const nextTodos = isTeamScope
      ? toggleTeamTodoDone(todos, todoId, done)
      : toggleTodoDone(userId, todos, todoId, done);
    refreshState(nextTodos);
  };

  const handleDelete = (todoId) => {
    const nextTodos = todos.filter((todo) => todo.id !== todoId);
    if (isTeamScope) {
      saveTeamTodos(nextTodos);
    } else {
      saveTodos(userId, nextTodos);
    }
    refreshState(nextTodos);
    if (draft.id === todoId) setDraft(makeEmptyDraft());
  };

  const moveMonth = (offset) => {
    const nextDate = new Date(calendarMonth.year, calendarMonth.month + offset, 1);
    setCalendarMonth({ year: nextDate.getFullYear(), month: nextDate.getMonth() });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-gray-100">일정 범위</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              개인 일정은 내 업무만, 총무팀 일정은 팀 공용 마감/보고 일정을 따로 관리합니다.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900/40">
            {[
              ['PERSONAL', '개인 일정'],
              ['TEAM', '총무팀 일정'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`rounded-md px-4 py-2 text-sm font-bold transition ${scope === value ? 'bg-white text-teal-700 shadow-xs dark:bg-gray-800 dark:text-teal-300' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}`}
                type="button"
                onClick={() => setScope(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['오늘 일정', `${todayTodos.length}개`, '오늘 처리하거나 확인할 일정'],
          ['미완료', `${summary.openTodos.length}개`, '아직 체크되지 않은 업무'],
          ['중요', `${summary.highOpenCount}개`, '우선 확인해야 할 업무'],
          ['지연', `${overdueTodos.length}개`, '기한이 지난 미완료 업무'],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">{isTeamScope ? '총무팀 일정 등록' : '개인 일정 등록'}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isTeamScope ? '팀 공용으로 봐야 하는 마감, 보고, 요청 대응 일정을 등록합니다.' : '내 투두, 마감 일정, 알림 시간을 한 번에 등록하고 수정합니다.'}
            </p>
          </div>
          <div className="w-full xl:w-80">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span>전체 완료율</span>
              <span>{summary.completionRate}%</span>
            </div>
            <ProgressBar value={summary.completionRate} />
          </div>
        </div>

        <form className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_120px_150px_120px_auto]" onSubmit={handleSubmit}>
          <input className="form-input" placeholder="일정 제목" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          <input className="form-input" placeholder="메모 또는 처리 내용" value={draft.detail} onChange={(event) => setDraft((current) => ({ ...current, detail: event.target.value }))} />
          <select className="form-select" value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}>
            <option value="HIGH">중요</option>
            <option value="MEDIUM">보통</option>
            <option value="LOW">낮음</option>
          </select>
          <input className="form-input" type="date" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} />
          <input className="form-input" type="time" value={draft.reminderAt} onChange={(event) => setDraft((current) => ({ ...current, reminderAt: event.target.value }))} />
          <div className="flex gap-2">
            <button className="btn btn-primary whitespace-nowrap" type="submit">{draft.id ? '수정' : '추가'}</button>
            {draft.id && <button className="btn btn-secondary whitespace-nowrap" type="button" onClick={() => setDraft(makeEmptyDraft())}>취소</button>}
          </div>
        </form>
      </section>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100">일정 달력</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">일정과 체크 기록을 날짜별로 확인합니다.</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-secondary h-9" type="button" onClick={() => moveMonth(-1)}>이전</button>
              <span className="min-w-28 text-center text-sm font-bold text-gray-800 dark:text-gray-100">{calendarMonth.year}.{String(calendarMonth.month + 1).padStart(2, '0')}</span>
              <button className="btn btn-secondary h-9" type="button" onClick={() => moveMonth(1)}>다음</button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-lg border border-gray-200 text-sm dark:border-gray-700/60">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <div key={day} className="bg-gray-50 px-2 py-2 text-center text-xs font-bold text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">{day}</div>
            ))}
            {calendarDays.map((day, index) => (
              <button
                key={day?.key ?? `blank-${index}`}
                className="min-h-28 border-t border-r border-gray-100 p-2 text-left last:border-r-0 hover:bg-teal-50/50 dark:border-gray-700/60 dark:hover:bg-teal-500/10"
                type="button"
                onClick={() => day && setDraft((current) => ({ ...current, dueDate: day.key }))}
              >
                {day && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{day.day}</span>
                      {(day.todos.length > 0 || day.records.length > 0) && (
                        <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[11px] font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">{day.todos.length + day.records.length}</span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {day.todos.slice(0, 2).map((todo) => {
                        const meta = priorityMeta[todo.priority] ?? priorityMeta.LOW;
                        return <div key={todo.id} className={`truncate rounded border px-1.5 py-1 text-[11px] font-semibold ${meta.className}`}>{todo.title}</div>;
                      })}
                      {day.records.length > 0 && <div className="truncate rounded bg-gray-100 px-1.5 py-1 text-[11px] font-semibold text-gray-500 dark:bg-gray-700/60 dark:text-gray-300">완료 기록 {day.records.length}</div>}
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        </section>

        <aside className="col-span-12 space-y-5 xl:col-span-4">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-gray-900 dark:text-gray-100">투두 리스트</h2>
              <select className="form-select h-9 w-28 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="OPEN">미완료</option>
                <option value="DONE">완료</option>
                <option value="ALL">전체</option>
              </select>
            </div>
            <div className="mt-4 max-h-[560px] space-y-2 overflow-auto no-scrollbar">
              {sortedTodos.map((todo) => (
                <TodoCard key={todo.id} todo={todo} onToggle={handleToggle} onEdit={setDraft} onDelete={handleDelete} />
              ))}
              {sortedTodos.length === 0 && <p className="rounded-lg bg-gray-50 px-3 py-4 text-sm text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">표시할 일정이 없습니다.</p>}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">체크 기록</h2>
            <div className="mt-4 max-h-80 space-y-2 overflow-auto no-scrollbar">
              {history.slice(0, 12).map((record) => {
                const meta = priorityMeta[record.priority] ?? priorityMeta.LOW;
                return (
                  <div key={record.id} className="rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-gray-800 dark:text-gray-100">{record.title}</p>
                      <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${meta.className}`}>{record.done ? '완료' : '해제'}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{new Date(record.changedAt).toLocaleString('ko-KR', { hour12: false })}</p>
                  </div>
                );
              })}
              {history.length === 0 && <p className="rounded-lg bg-gray-50 px-3 py-4 text-sm text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">아직 체크 기록이 없습니다.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
