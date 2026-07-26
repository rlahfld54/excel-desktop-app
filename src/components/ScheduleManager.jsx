import React, { useEffect, useMemo, useState } from 'react';

import {
  createTodo,
  getCalendarDays,
  getTeamTodoSummary,
  getTodayKey,
  hydrateTeamTodos,
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

const itemTypeLabels = {
  TODO: '투두',
  SCHEDULE: '일정',
};

function ProgressBar({ value }) {
  return (
    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
      <div className="h-2 rounded-full bg-teal-600 dark:bg-teal-400" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}

function makeEmptyDraft({ itemType = 'TODO', dueDate = getTodayKey() } = {}) {
  return {
    id: '',
    title: '',
    detail: '',
    priority: 'MEDIUM',
    dueDate,
    reminderAt: '',
    itemType,
  };
}

function ItemModal({ draft, isTeamScope, onChange, onClose, onSubmit, onDelete }) {
  if (!draft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4">
      <div className="w-full max-w-2xl rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {draft.id ? `${itemTypeLabels[draft.itemType]} 수정` : `${itemTypeLabels[draft.itemType]} 추가`}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isTeamScope ? '총무팀 공용 데이터에 바로 반영됩니다.' : '내 개인 데이터에 바로 반영됩니다.'}
            </p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={onClose}>닫기</button>
        </div>

        <form className="space-y-4 p-5" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">종류</span>
              <select className="form-select w-full" value={draft.itemType} onChange={(event) => onChange({ itemType: event.target.value })}>
                <option value="TODO">투두</option>
                <option value="SCHEDULE">일정</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">제목</span>
              <input className="form-input w-full" value={draft.title} onChange={(event) => onChange({ title: event.target.value })} placeholder={`${itemTypeLabels[draft.itemType]} 제목`} autoFocus />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">메모 또는 처리 내용</span>
            <textarea className="form-textarea min-h-28 w-full" value={draft.detail} onChange={(event) => onChange({ detail: event.target.value })} placeholder="담당자가 확인할 내용을 입력하세요." />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">중요도</span>
              <select className="form-select w-full" value={draft.priority} onChange={(event) => onChange({ priority: event.target.value })}>
                <option value="HIGH">중요</option>
                <option value="MEDIUM">보통</option>
                <option value="LOW">낮음</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">날짜</span>
              <input className="form-input w-full" type="date" value={draft.dueDate} onChange={(event) => onChange({ dueDate: event.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">알림 시간</span>
              <input className="form-input w-full" type="time" value={draft.reminderAt} onChange={(event) => onChange({ reminderAt: event.target.value })} />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4 dark:border-gray-700/60">
            <div>
              {draft.id && (
                <button className="rounded-md px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10" type="button" onClick={() => onDelete(draft.id)}>
                  삭제
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary" type="button" onClick={onClose}>취소</button>
              <button className="btn btn-primary" type="submit">{draft.id ? '수정 저장' : '등록'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function TypeBadge({ type }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${type === 'SCHEDULE' ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' : 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300'}`}>
      {itemTypeLabels[type] ?? '투두'}
    </span>
  );
}

function TodayAgenda({ items, onAddSchedule, onAddTodo, onEdit, onToggle }) {
  const todayKey = getTodayKey();
  const todayItems = items
    .filter((item) => item.dueDate === todayKey)
    .sort((a, b) => `${a.reminderAt || '99:99'} ${a.title}`.localeCompare(`${b.reminderAt || '99:99'} ${b.title}`));

  return (
    <section className="rounded-lg border border-teal-100 bg-teal-50/70 p-4 shadow-xs dark:border-teal-500/20 dark:bg-teal-500/10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-teal-700 dark:text-teal-300">오늘의 일정</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{todayKey} 확인 항목</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">오늘 처리할 일정과 투두를 먼저 확인하고, 필요한 항목은 바로 수정합니다.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" type="button" onClick={onAddSchedule}>일정 추가</button>
          <button className="btn btn-primary" type="button" onClick={onAddTodo}>투두 추가</button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {todayItems.map((item) => {
          const meta = priorityMeta[item.priority] ?? priorityMeta.LOW;
          return (
            <article key={item.id} className="rounded-lg border border-white/80 bg-white p-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
              <div className="flex items-start gap-3">
                {item.itemType !== 'SCHEDULE' && (
                  <input className="form-checkbox mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" type="checkbox" checked={item.done} onChange={(event) => onToggle(item.id, event.target.checked)} aria-label={`${item.title} 완료`} />
                )}
                <button className="min-w-0 flex-1 text-left" type="button" onClick={() => onEdit(item)}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TypeBadge type={item.itemType || 'TODO'} />
                    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${meta.className}`}>{meta.label}</span>
                    {item.reminderAt && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">{item.reminderAt}</span>}
                  </div>
                  <p className={`mt-2 font-bold ${item.done ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{item.detail}</p>
                </button>
              </div>
            </article>
          );
        })}
        {todayItems.length === 0 && (
          <div className="rounded-lg border border-dashed border-teal-200 bg-white/70 p-4 text-sm font-semibold text-gray-500 dark:border-teal-500/30 dark:bg-gray-800/70 dark:text-gray-400 lg:col-span-3">
            오늘 등록된 일정이나 투두가 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}

function ItemTable({ title, description, items, emptyText, filter, onFilterChange, onAdd, onToggle, onEdit, onDelete, showCheckbox = false }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        <div className="flex gap-2">
          {filter && (
            <select className="form-select h-9 w-28 text-sm" value={filter} onChange={(event) => onFilterChange(event.target.value)}>
              <option value="OPEN">미완료</option>
              <option value="DONE">완료</option>
              <option value="ALL">전체</option>
            </select>
          )}
          <button className="btn btn-primary h-9" type="button" onClick={onAdd}>추가</button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto" data-table-tools="false">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
            <tr>
              {showCheckbox && <th className="w-10 px-3 py-2">완료</th>}
              <th className="px-3 py-2">제목</th>
              <th className="px-3 py-2">날짜</th>
              <th className="px-3 py-2">중요도</th>
              <th className="px-3 py-2">알림</th>
              <th className="w-24 px-3 py-2 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {items.map((item) => {
              const meta = priorityMeta[item.priority] ?? priorityMeta.LOW;
              return (
                <tr key={item.id} className={item.done ? 'bg-gray-50/70 dark:bg-gray-900/20' : ''}>
                  {showCheckbox && (
                    <td className="px-3 py-3 align-top">
                      <input className="form-checkbox h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" type="checkbox" checked={item.done} onChange={(event) => onToggle(item.id, event.target.checked)} aria-label={`${item.title} 완료`} />
                    </td>
                  )}
                  <td className="min-w-64 px-3 py-3 align-top">
                    <p className={`font-semibold ${item.done ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>{item.title}</p>
                    <p className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">{item.detail}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-top font-semibold text-gray-600 dark:text-gray-300">{item.dueDate}</td>
                  <td className="whitespace-nowrap px-3 py-3 align-top"><span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${meta.className}`}>{meta.label}</span></td>
                  <td className="whitespace-nowrap px-3 py-3 align-top text-gray-500 dark:text-gray-400">{item.reminderAt || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-3 align-top text-right">
                    <button className="rounded-md px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" type="button" onClick={() => onEdit(item)}>
                      수정
                    </button>
                    <button className="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10" type="button" onClick={() => onDelete(item.id)}>
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500 dark:text-gray-400" colSpan={showCheckbox ? 6 : 5}>{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ScheduleManager({ userId }) {
  const [scope, setScope] = useState('TEAM');
  const [items, setItems] = useState(() => readTeamTodos());
  const [history, setHistory] = useState(() => readTeamTodoHistory());
  const [editingDraft, setEditingDraft] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [todoFilter, setTodoFilter] = useState('OPEN');
  const isTeamScope = scope === 'TEAM';

  useEffect(() => {
    let mounted = true;
    const loadSchedule = async () => {
      if (isTeamScope) await hydrateTeamTodos();
      if (!mounted) return;
      setItems(isTeamScope ? readTeamTodos() : readTodos(userId));
      setHistory(isTeamScope ? readTeamTodoHistory() : readTodoHistory(userId));
    };
    loadSchedule();
    setEditingDraft(null);
    return () => { mounted = false; };
  }, [isTeamScope, userId]);

  const summary = isTeamScope ? getTeamTodoSummary() : getTodoSummary(userId);
  const calendarDays = getCalendarDays(calendarMonth.year, calendarMonth.month, items, history);
  const todoItems = items.filter((item) => (item.itemType || 'TODO') === 'TODO');
  const scheduleItems = items.filter((item) => item.itemType === 'SCHEDULE');
  const openTodos = todoItems.filter((item) => !item.done);
  const todayItems = items.filter((item) => item.dueDate === getTodayKey());
  const overdueTodos = todoItems.filter((item) => !item.done && item.dueDate && item.dueDate < getTodayKey());

  const sortedTodos = useMemo(() => {
    const weight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return [...todoItems]
      .filter((todo) => todoFilter === 'ALL' || (todoFilter === 'DONE' ? todo.done : !todo.done))
      .sort((a, b) => Number(a.done) - Number(b.done) || String(a.dueDate).localeCompare(String(b.dueDate)) || weight[b.priority] - weight[a.priority]);
  }, [todoFilter, todoItems]);

  const sortedSchedules = useMemo(() => (
    [...scheduleItems].sort((a, b) => `${a.dueDate} ${a.reminderAt || '99:99'}`.localeCompare(`${b.dueDate} ${b.reminderAt || '99:99'}`))
  ), [scheduleItems]);

  const refreshState = (nextItems) => {
    setItems(nextItems);
    setHistory(isTeamScope ? readTeamTodoHistory() : readTodoHistory(userId));
  };

  const saveItems = (nextItems) => {
    if (isTeamScope) {
      saveTeamTodos(nextItems);
    } else {
      saveTodos(userId, nextItems);
    }
    refreshState(nextItems);
  };

  const handleDraftChange = (patch) => {
    setEditingDraft((current) => ({ ...current, ...patch }));
  };

  const openNewModal = (itemType, dueDate = getTodayKey()) => {
    setEditingDraft(makeEmptyDraft({ itemType, dueDate }));
  };

  const openEditModal = (item) => {
    setEditingDraft({ ...item, itemType: item.itemType || 'TODO' });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!editingDraft?.title?.trim()) return;

    const nextItems = editingDraft.id
      ? items.map((item) => (
        item.id === editingDraft.id
          ? { ...item, ...editingDraft, due: editingDraft.dueDate }
          : item
      ))
      : [
          createTodo({
            ...editingDraft,
            due: editingDraft.dueDate,
            path: '/schedule/todos',
            scope: isTeamScope ? 'TEAM' : 'PERSONAL',
          }),
          ...items,
        ];

    saveItems(nextItems);
    setEditingDraft(null);
  };

  const handleToggle = (itemId, done) => {
    const nextItems = isTeamScope
      ? toggleTeamTodoDone(items, itemId, done)
      : toggleTodoDone(userId, items, itemId, done);
    refreshState(nextItems);
  };

  const handleDelete = (itemId) => {
    const nextItems = items.filter((item) => item.id !== itemId);
    saveItems(nextItems);
    if (editingDraft?.id === itemId) setEditingDraft(null);
  };

  const handleUndoComplete = (record) => {
    const target = items.find((item) => item.id === record.todoId);
    if (!target || target.itemType === 'SCHEDULE') return;
    handleToggle(record.todoId, false);
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
              개인 업무와 총무팀 공용 업무를 나누고, 일정과 투두는 별도 테이블로 관리합니다.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900/40">
            {[
              ['TEAM', '총무팀 일정'],
              ['PERSONAL', '개인 일정'],
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

      <TodayAgenda
        items={items}
        onAddSchedule={() => openNewModal('SCHEDULE')}
        onAddTodo={() => openNewModal('TODO')}
        onEdit={openEditModal}
        onToggle={handleToggle}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['오늘 항목', `${todayItems.length}개`, '오늘 처리하거나 확인할 일정/투두'],
          ['미완료 투두', `${openTodos.length}개`, '아직 체크되지 않은 업무'],
          ['일정', `${scheduleItems.length}개`, '달력에 표시되는 일정'],
          ['지연', `${overdueTodos.length}개`, '기한이 지난 미완료 투두'],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">{isTeamScope ? '총무팀 일정·투두 관리' : '개인 일정·투두 관리'}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              달력 날짜를 클릭하면 해당 날짜로 일정 등록 모달이 열리고, 달력 항목을 클릭하면 수정합니다.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-80">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
                <span>전체 완료율</span>
                <span>{summary.completionRate}%</span>
              </div>
              <ProgressBar value={summary.completionRate} />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary" type="button" onClick={() => openNewModal('SCHEDULE')}>일정 추가</button>
              <button className="btn btn-primary" type="button" onClick={() => openNewModal('TODO')}>투두 추가</button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100">일정 달력</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">날짜별 일정과 투두를 빠르게 확인합니다.</p>
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
              <div
                key={day?.key ?? `blank-${index}`}
                className="min-h-20 border-t border-r border-gray-100 p-1.5 text-left hover:bg-teal-50/50 dark:border-gray-700/60 dark:hover:bg-teal-500/10"
                role={day ? 'button' : undefined}
                tabIndex={day ? 0 : undefined}
                aria-label={day ? `${day.key} 일정 추가` : '빈 날짜'}
                onClick={() => day && openNewModal('SCHEDULE', day.key)}
                onKeyDown={(event) => {
                  if (!day || !['Enter', ' '].includes(event.key)) return;
                  event.preventDefault();
                  openNewModal('SCHEDULE', day.key);
                }}
              >
                {day && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{day.day}</span>
                      {(day.todos.length > 0 || day.records.length > 0) && (
                        <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[11px] font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">{day.todos.length + day.records.length}</span>
                      )}
                    </div>
                    <div className="mt-1 space-y-1">
                      {day.todos.slice(0, 3).map((item) => {
                        const meta = priorityMeta[item.priority] ?? priorityMeta.LOW;
                        const typeClass = item.itemType === 'SCHEDULE' ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300' : meta.className;
                        return (
                          <button
                            key={item.id}
                            className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-semibold ${typeClass}`}
                            type="button"
                            aria-label={`${item.title} 수정`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditModal(item);
                            }}
                          >
                            {item.itemType === 'SCHEDULE' ? '일정 · ' : '투두 · '}{item.title}
                          </button>
                        );
                      })}
                      {day.todos.length > 3 && <div className="text-[11px] font-semibold text-gray-400">+{day.todos.length - 3}개 더보기</div>}
                      {day.records.length > 0 && <div className="truncate rounded bg-gray-100 px-1.5 py-1 text-[11px] font-semibold text-gray-500 dark:bg-gray-700/60 dark:text-gray-300">완료 기록 {day.records.length}</div>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <aside className="col-span-12 space-y-5 xl:col-span-6">
          <ItemTable
            title="투두 테이블"
            description="체크 처리해야 하는 업무만 관리합니다."
            items={sortedTodos}
            emptyText="표시할 투두가 없습니다."
            filter={todoFilter}
            onFilterChange={setTodoFilter}
            onAdd={() => openNewModal('TODO')}
            onToggle={handleToggle}
            onEdit={openEditModal}
            onDelete={handleDelete}
            showCheckbox
          />

          <ItemTable
            title="일정 테이블"
            description="회의, 보고, 마감 일정처럼 시간표에 남길 항목입니다."
            items={sortedSchedules}
            emptyText="등록된 일정이 없습니다."
            onAdd={() => openNewModal('SCHEDULE')}
            onToggle={handleToggle}
            onEdit={openEditModal}
            onDelete={handleDelete}
          />

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-900 dark:text-gray-100">체크 기록</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">투두 완료/해제 내역을 확인하고, 완료 처리는 되돌릴 수 있습니다.</p>
              </div>
            </div>
            <div className="mt-4 max-h-80 space-y-2 overflow-auto no-scrollbar">
              {history.slice(0, 12).map((record) => {
                const meta = priorityMeta[record.priority] ?? priorityMeta.LOW;
                const target = items.find((item) => item.id === record.todoId);
                const canUndo = record.done && target && target.done && target.itemType !== 'SCHEDULE';

                return (
                  <div key={record.id} className="rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 dark:text-gray-100">{record.title}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{new Date(record.changedAt).toLocaleString('ko-KR', { hour12: false })}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${meta.className}`}>{record.done ? '완료' : '해제'}</span>
                        {canUndo && (
                          <button className="rounded-md px-2 py-1 text-xs font-bold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-500/10" type="button" onClick={() => handleUndoComplete(record)}>
                            완료 되돌리기
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {history.length === 0 && <p className="rounded-lg bg-gray-50 px-3 py-4 text-sm text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">아직 체크 기록이 없습니다.</p>}
            </div>
          </section>
        </aside>
      </div>

      <ItemModal
        draft={editingDraft}
        isTeamScope={isTeamScope}
        onChange={handleDraftChange}
        onClose={() => setEditingDraft(null)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </div>
  );
}
