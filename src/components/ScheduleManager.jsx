import React, { useEffect, useMemo, useState } from 'react';

import {
  createTodo,
  getCalendarDays,
  getTeamTodoSummary,
  getTodayKey,
  hydrateTeamTodos,
  priorityMeta,
  readTeamTodoHistory,
  readTeamTodos,
  saveTeamTodos,
  toggleTeamTodoDone,
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

function ItemModal({ draft, onChange, onClose, onSubmit, onDelete }) {
  if (!draft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-950/40 px-4 py-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {draft.id ? `${itemTypeLabels[draft.itemType]} 수정` : `${itemTypeLabels[draft.itemType]} 추가`}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              총무팀 공용 데이터에 바로 반영됩니다.
            </p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={onClose}>닫기</button>
        </div>

        <form className="min-h-0 space-y-4 overflow-y-auto p-5" onSubmit={onSubmit}>
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

function AgendaList({ items, emptyText, onEdit, onToggle }) {
  return (
    <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
      {items.map((item) => {
        const meta = priorityMeta[item.priority] ?? priorityMeta.LOW;

        return (
          <article key={item.id} className="rounded-lg border border-gray-100 bg-white px-3 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              {item.itemType !== 'SCHEDULE' && (
                <input
                  className="form-checkbox mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  type="checkbox"
                  checked={item.done}
                  onChange={(event) => onToggle(item.id, event.target.checked)}
                  aria-label={`${item.title} 완료`}
                />
              )}
              <button className="min-w-0 flex-1 text-left" type="button" onClick={() => onEdit(item)}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <TypeBadge type={item.itemType || 'TODO'} />
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${meta.className}`}>{meta.label}</span>
                  {item.reminderAt && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">{item.reminderAt}</span>}
                </div>
                <p className={`mt-2 font-bold ${item.done ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>{item.title}</p>
                {item.detail && <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{item.detail}</p>}
              </button>
            </div>
          </article>
        );
      })}
      {items.length === 0 && <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">{emptyText}</p>}
    </div>
  );
}

function TodayAgenda({ items, onEdit, onToggle }) {
  const todayKey = getTodayKey();
  const todayItems = items
    .filter((item) => item.dueDate === todayKey)
    .sort((a, b) => `${a.reminderAt || '99:99'} ${a.title}`.localeCompare(`${b.reminderAt || '99:99'} ${b.title}`));

  return (
    <section className="rounded-lg border border-teal-100 bg-teal-50/70 p-4 shadow-xs dark:border-teal-500/20 dark:bg-teal-500/10">

      <div className="mt-4 max-h-64 overflow-y-auto pr-1">
        <div className="grid gap-3 lg:grid-cols-3">
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
      </div>
    </section>
  );
}

function ItemTable({ items, emptyText, filter, onFilterChange, onToggle, onEdit, onDelete, showCheckbox = false }) {
  return (
    <section className="mt-4">
      {filter && (
        <div className="flex justify-end">
          <select className="form-select h-9 w-28 text-sm" value={filter} onChange={(event) => onFilterChange(event.target.value)}>
            <option value="OPEN">미완료</option>
            <option value="DONE">완료</option>
            <option value="ALL">전체</option>
          </select>
        </div>
      )}

      <div className={`${filter ? 'mt-3' : ''} max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-800`} data-table-tools="false">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50/90 text-left text-xs font-semibold text-gray-500 shadow-[0_1px_0_0_rgba(229,231,235,1)] backdrop-blur dark:bg-gray-900/90 dark:text-gray-400 dark:shadow-[0_1px_0_0_rgba(55,65,81,1)]">
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
                <tr key={item.id} className={`transition-colors hover:bg-teal-50/40 dark:hover:bg-teal-500/5 ${item.done ? 'bg-gray-50/70 dark:bg-gray-900/20' : ''}`}>
                  {showCheckbox && (
                    <td className="px-3 py-2.5 align-top">
                      <input className="form-checkbox h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" type="checkbox" checked={item.done} onChange={(event) => onToggle(item.id, event.target.checked)} aria-label={`${item.title} 완료`} />
                    </td>
                  )}
                  <td className="min-w-64 px-3 py-2.5 align-top">
                    <p className={`font-semibold ${item.done ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>{item.title}</p>
                    {item.detail && <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{item.detail}</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-semibold text-gray-600 dark:text-gray-300">{item.dueDate}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top"><span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${meta.className}`}>{meta.label}</span></td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top text-gray-500 dark:text-gray-400">{item.reminderAt || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top text-right">
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

export default function ScheduleManager() {
  const [items, setItems] = useState(() => readTeamTodos());
  const [history, setHistory] = useState(() => readTeamTodoHistory());
  const [editingDraft, setEditingDraft] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(() => getTodayKey());
  const [detailView, setDetailView] = useState('selected');
  const [todoFilter, setTodoFilter] = useState('OPEN');
  useEffect(() => {
    let mounted = true;
    const loadSchedule = async () => {
      await hydrateTeamTodos();
      if (!mounted) return;
      setItems(readTeamTodos());
      setHistory(readTeamTodoHistory());
    };
    loadSchedule();
    setEditingDraft(null);
    return () => { mounted = false; };
  }, []);

  const summary = getTeamTodoSummary();
  const calendarDays = getCalendarDays(calendarMonth.year, calendarMonth.month, items, history);
  const todoItems = items.filter((item) => (item.itemType || 'TODO') === 'TODO');
  const scheduleItems = items.filter((item) => item.itemType === 'SCHEDULE');
  const openTodos = todoItems.filter((item) => !item.done);
  const todayItems = items.filter((item) => item.dueDate === getTodayKey());
  const overdueTodos = todoItems.filter((item) => !item.done && item.dueDate && item.dueDate < getTodayKey());
  const selectedDayItems = useMemo(() => items
    .filter((item) => item.dueDate === selectedDate)
    .sort((a, b) => `${a.reminderAt || '99:99'} ${a.title}`.localeCompare(`${b.reminderAt || '99:99'} ${b.title}`)), [items, selectedDate]);
  const selectedDayHistory = useMemo(() => history
    .filter((record) => record.date === selectedDate)
    .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt))), [history, selectedDate]);

  const sortedTodos = useMemo(() => {
    const weight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return [...todoItems]
      .filter((todo) => todoFilter === 'ALL' || (todoFilter === 'DONE' ? todo.done : !todo.done))
      .sort((a, b) => Number(a.done) - Number(b.done) || String(a.dueDate).localeCompare(String(b.dueDate)) || weight[b.priority] - weight[a.priority]);
  }, [todoFilter, todoItems]);

  const sortedSchedules = useMemo(() => (
    [...scheduleItems].sort((a, b) => `${a.dueDate} ${a.reminderAt || '99:99'}`.localeCompare(`${b.dueDate} ${b.reminderAt || '99:99'}`))
  ), [scheduleItems]);
  const detailMeta = {
    selected: { label: '선택한 날짜', title: selectedDate, description: '선택한 날짜의 일정, 투두와 완료 기록을 확인합니다.' },
    today: { label: '오늘 항목', title: `${getTodayKey()} 확인 항목`, description: '오늘 처리하거나 확인할 일정과 투두입니다.' },
    todos: { label: '투두 목록', title: '투두 테이블', description: '체크 처리해야 하는 업무를 관리합니다.' },
    schedules: { label: '일정 목록', title: '일정 테이블', description: '회의, 보고, 마감 일정을 확인합니다.' },
    overdue: { label: '지연 항목', title: '기한이 지난 투두', description: '기한이 지났지만 아직 완료하지 않은 업무입니다.' },
    history: { label: '체크 기록', title: '체크 기록', description: '투두 완료와 해제 내역을 확인합니다.' },
  };
  const activeDetail = detailMeta[detailView];

  const refreshState = (nextItems) => {
    setItems(nextItems);
    setHistory(readTeamTodoHistory());
  };

  const saveItems = (nextItems) => {
    saveTeamTodos(nextItems);
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
            scope: 'TEAM',
          }),
          ...items,
        ];

    saveItems(nextItems);
    setEditingDraft(null);
  };

  const handleToggle = (itemId, done) => {
    const nextItems = toggleTeamTodoDone(items, itemId, done);
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
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['today', '오늘 항목', `${todayItems.length}개`, '오늘 처리하거나 확인할 일정/투두'],
          ['todos', '미완료 투두', `${openTodos.length}개`, '아직 체크되지 않은 업무'],
          ['schedules', '일정', `${scheduleItems.length}개`, '달력에 표시되는 일정'],
          ['overdue', '지연', `${overdueTodos.length}개`, '기한이 지난 미완료 투두'],
        ].map(([view, label, value, detail]) => (
          <button
            key={label}
            className={`rounded-lg border p-4 text-left shadow-xs transition ${detailView === view ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-100 dark:border-teal-400/70 dark:bg-teal-500/10 dark:ring-teal-500/10' : 'border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50/50 dark:border-gray-700/60 dark:bg-gray-800 dark:hover:border-teal-500/50 dark:hover:bg-teal-500/10'}`}
            type="button"
            onClick={() => setDetailView(view)}
            aria-pressed={detailView === view}
          >
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
          </button>
        ))}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">총무팀 일정·투두 관리</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              달력 날짜를 클릭하면 해당 날짜의 과거 일정·투두를 확인할 수 있고, 항목을 클릭하면 수정합니다.
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

      <div className="grid grid-cols-12 gap-4 xl:items-start">
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
                aria-label={day ? `${day.key} 일정 보기` : '빈 날짜'}
                onClick={() => {
                  if (!day) return;
                  setSelectedDate(day.key);
                  setDetailView('selected');
                }}
                onKeyDown={(event) => {
                  if (!day || !['Enter', ' '].includes(event.key)) return;
                  event.preventDefault();
                  setSelectedDate(day.key);
                  setDetailView('selected');
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

        <aside className="col-span-12 xl:col-span-6 xl:sticky xl:top-4">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">상세 보기</p>
                <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{activeDetail.title}</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{activeDetail.description}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-1.5 border-b border-gray-100 pb-4 dark:border-gray-700/60" role="tablist" aria-label="일정 관리 상세 보기">
              {[
                ['selected', '선택 날짜'],
                ['todos', '투두 목록'],
                ['schedules', '일정 목록'],
                ['history', '체크 기록'],
              ].map(([view, label]) => (
                <button
                  key={view}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${detailView === view ? 'bg-teal-600 text-white shadow-sm shadow-teal-900/15' : 'bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-800 dark:bg-gray-700/60 dark:text-gray-300 dark:hover:bg-teal-500/10 dark:hover:text-teal-200'}`}
                  type="button"
                  role="tab"
                  aria-selected={detailView === view}
                  onClick={() => setDetailView(view)}
                >
                  {label}
                </button>
              ))}
            </div>

            {detailView === 'selected' && (
              <>
                <AgendaList
                  items={selectedDayItems}
                  emptyText="이 날짜에 등록된 일정이나 투두가 없습니다."
                  onEdit={openEditModal}
                  onToggle={handleToggle}
                />
                {selectedDayHistory.length > 0 && (
                  <div className="mt-3 border-t border-sky-200 pt-3 dark:border-sky-500/20">
                    <p className="text-xs font-bold text-sky-700 dark:text-sky-300">해당 날짜의 체크 기록</p>
                    <div className="mt-2 space-y-2">
                      {selectedDayHistory.map((record) => <p key={record.id} className="rounded-md border border-dashed border-sky-200 bg-white/60 px-3 py-2 text-sm text-gray-600 dark:border-sky-500/20 dark:bg-gray-800/60 dark:text-gray-300">완료 기록 · {record.title} · {record.done ? '완료' : '완료 해제'}</p>)}
                    </div>
                  </div>
                )}
              </>
            )}

            {detailView === 'today' && (
              <AgendaList
                items={todayItems}
                emptyText="오늘 등록된 일정이나 투두가 없습니다."
                onEdit={openEditModal}
                onToggle={handleToggle}
              />
            )}

            {detailView === 'overdue' && (
              <AgendaList
                items={overdueTodos}
                emptyText="지연된 투두가 없습니다."
                onEdit={openEditModal}
                onToggle={handleToggle}
              />
            )}

            {detailView === 'todos' && (
              <ItemTable
                items={sortedTodos}
                emptyText="표시할 투두가 없습니다."
                filter={todoFilter}
                onFilterChange={setTodoFilter}
                onToggle={handleToggle}
                onEdit={openEditModal}
                onDelete={handleDelete}
                showCheckbox
              />
            )}

            {detailView === 'schedules' && (
              <ItemTable
                items={sortedSchedules}
                emptyText="등록된 일정이 없습니다."
                onToggle={handleToggle}
                onEdit={openEditModal}
                onDelete={handleDelete}
              />
            )}

            {detailView === 'history' && (
              <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {history.map((record) => {
                  const meta = priorityMeta[record.priority] ?? priorityMeta.LOW;
                  const target = items.find((item) => item.id === record.todoId);
                  const canUndo = record.done && target && target.done && target.itemType !== 'SCHEDULE';

                  return (
                    <div key={record.id} className="rounded-lg border border-gray-100 bg-white px-3 py-2 dark:border-gray-700/60 dark:bg-gray-800">
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
                {history.length === 0 && <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">아직 체크 기록이 없습니다.</p>}
              </div>
            )}
          </section>
        </aside>
      </div>

      <ItemModal
        draft={editingDraft}
        onChange={handleDraftChange}
        onClose={() => setEditingDraft(null)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </div>
  );
}
