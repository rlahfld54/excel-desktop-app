import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import Transition from '../utils/Transition';
import { authChangedEvent, getCurrentUser } from '../utils/authSession';
import {
  createTodo,
  getTodoSummary,
  getTodayKey,
  priorityMeta,
  readTodos,
  saveTodos,
  todoChangedEvent,
  toggleTodoDone,
} from '../utils/todoSchedule';

function DropdownTodo({ align }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [todos, setTodos] = useState(() => readTodos(getCurrentUser().id));
  const [newTodo, setNewTodo] = useState({
    title: '',
    detail: '',
    priority: 'MEDIUM',
    dueDate: getTodayKey(),
    reminderAt: '',
  });

  const trigger = useRef(null);
  const dropdown = useRef(null);

  useEffect(() => {
    const clickHandler = ({ target }) => {
      if (!dropdown.current || !trigger.current) return;
      if (!dropdownOpen || dropdown.current.contains(target) || trigger.current.contains(target)) return;
      setDropdownOpen(false);
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  });

  useEffect(() => {
    const keyHandler = ({ keyCode }) => {
      if (!dropdownOpen || keyCode !== 27) return;
      setDropdownOpen(false);
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  });

  useEffect(() => {
    const refreshUser = () => {
      const nextUser = getCurrentUser();
      setCurrentUser(nextUser);
      setTodos(readTodos(nextUser.id));
    };
    window.addEventListener(authChangedEvent, refreshUser);
    window.addEventListener('storage', refreshUser);
    window.addEventListener(todoChangedEvent, refreshUser);
    return () => {
      window.removeEventListener(authChangedEvent, refreshUser);
      window.removeEventListener('storage', refreshUser);
      window.removeEventListener(todoChangedEvent, refreshUser);
    };
  }, []);

  const summary = getTodoSummary(currentUser.id);
  const todoItems = todos.filter((todo) => (todo.itemType || 'TODO') === 'TODO');
  const openTodos = todoItems.filter((todo) => !todo.done);
  const highOpenCount = openTodos.filter((todo) => todo.priority === 'HIGH').length;
  const completedCount = todoItems.length - openTodos.length;
  const completionRate = todoItems.length ? Math.round((completedCount / todoItems.length) * 100) : 100;

  const sortedTodos = useMemo(() => {
    const weight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return [...todos]
      .filter((todo) => (todo.itemType || 'TODO') === 'TODO')
      .sort((a, b) => Number(a.done) - Number(b.done) || weight[b.priority] - weight[a.priority] || String(a.dueDate).localeCompare(String(b.dueDate)));
  }, [todos]);

  const updateTodo = (todoId, patch) => {
    const nextTodos = todos.map((todo) => (
      todo.id === todoId ? { ...todo, ...patch } : todo
    ));
    setTodos(nextTodos);
    saveTodos(currentUser.id, nextTodos);
  };

  const handleToggle = (todoId, done) => {
    setTodos(toggleTodoDone(currentUser.id, todos, todoId, done));
  };

  const handleAddTodo = (event) => {
    event.preventDefault();
    if (!newTodo.title.trim()) return;

    const nextTodos = [
      createTodo({
        ...newTodo,
        due: newTodo.dueDate,
        itemType: 'TODO',
      }),
      ...todos,
    ];
    setTodos(nextTodos);
    saveTodos(currentUser.id, nextTodos);
    setNewTodo({
      title: '',
      detail: '',
      priority: 'MEDIUM',
      dueDate: getTodayKey(),
      reminderAt: '',
    });
    setComposerOpen(false);
  };

  return (
    <div className="relative inline-flex">
      <button
        ref={trigger}
        className={`relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent-50 hover:text-accent-700 dark:hover:bg-accent-500/10 dark:hover:text-accent-300 ${dropdownOpen ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : ''}`}
        aria-haspopup="true"
        onClick={() => {
          setDropdownOpen((open) => {
            if (open) setComposerOpen(false);
            return !open;
          });
        }}
        aria-expanded={dropdownOpen}
      >
        <span className="sr-only">마감 투두</span>
        <svg className="fill-current text-gray-500/80 dark:text-gray-400/80" width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 2h8v2H6V2Zm0 5h8v2H6V7Zm0 5h8v2H6v-2ZM2.5 4.5 0 2l1.4-1.4 1.1 1.1L4.6-.4 6 1 2.5 4.5Zm0 5L0 7l1.4-1.4 1.1 1.1 2.1-2.1L6 6 2.5 9.5Zm0 5L0 12l1.4-1.4 1.1 1.1 2.1-2.1L6 11l-3.5 3.5Z" />
        </svg>
        {openTodos.length > 0 && (
          <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${highOpenCount > 0 ? 'bg-rose-500' : 'bg-amber-500'}`}>
            {openTodos.length}
          </span>
        )}
      </button>

      <Transition
        className={`absolute top-full z-10 mt-1 min-w-80 origin-top-right overflow-visible rounded-lg border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-700/60 dark:bg-gray-800 sm:min-w-[36rem] xl:min-w-[42rem] ${align === 'right' ? 'right-0' : 'left-0'}`}
        show={dropdownOpen}
        enter="transition ease-out duration-200 transform"
        enterStart="opacity-0 -translate-y-2"
        enterEnd="opacity-100 translate-y-0"
        leave="transition ease-out duration-200"
        leaveStart="opacity-100"
        leaveEnd="opacity-0"
      >
        <div ref={dropdown} onFocus={() => setDropdownOpen(true)}>
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">마감 투두</p>
                <p className="mt-1 text-sm font-bold text-gray-900 dark:text-gray-100">
                  오늘 {summary.todayTodos.length.toLocaleString('ko-KR')}개 · 남은 일 {openTodos.length.toLocaleString('ko-KR')}개
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-md border px-2 py-1 text-xs font-bold ${highOpenCount > 0 ? priorityMeta.HIGH.className : priorityMeta.MEDIUM.className}`}>
                  중요 {highOpenCount}
                </span>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-lg font-bold leading-none text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400"
                  type="button"
                  onClick={() => setComposerOpen((open) => !open)}
                  aria-label="새 투두 추가"
                  title="새 투두 추가"
                >
                  +
                </button>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
                <span>완료율</span>
                <span>{completionRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                <div className="h-2 rounded-full bg-teal-600 dark:bg-teal-400" style={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>

          {composerOpen && (
            <div className="absolute right-3 top-[7.2rem] z-20 w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700/60 dark:bg-gray-800">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-bold text-gray-900 dark:text-gray-100">새 투두 추가</p>
                <button
                  className="rounded-md px-2 py-1 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  type="button"
                  onClick={() => setComposerOpen(false)}
                >
                  닫기
                </button>
              </div>
              <form onSubmit={handleAddTodo}>
                <div className="grid gap-2">
                  <div className="grid gap-2 sm:grid-cols-[1fr_0.9fr]">
                    <input
                      className="form-input h-9 w-full"
                      value={newTodo.title}
                      onChange={(event) => setNewTodo((current) => ({ ...current, title: event.target.value }))}
                      placeholder="새 투두 직접 입력"
                    />
                    <input
                      className="form-input h-9 w-full"
                      value={newTodo.detail}
                      onChange={(event) => setNewTodo((current) => ({ ...current, detail: event.target.value }))}
                      placeholder="메모 또는 세부 일정"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[0.8fr_1fr_1fr_auto]">
                    <select className="form-select h-9" value={newTodo.priority} onChange={(event) => setNewTodo((current) => ({ ...current, priority: event.target.value }))}>
                      <option value="HIGH">중요</option>
                      <option value="MEDIUM">보통</option>
                      <option value="LOW">낮음</option>
                    </select>
                    <input className="form-input h-9" type="date" value={newTodo.dueDate} onChange={(event) => setNewTodo((current) => ({ ...current, dueDate: event.target.value }))} />
                    <input className="form-input h-9" type="time" value={newTodo.reminderAt} onChange={(event) => setNewTodo((current) => ({ ...current, reminderAt: event.target.value }))} />
                    <button className="btn btn-primary h-9 px-5" type="submit">추가</button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <ul className="max-h-[460px] overflow-auto no-scrollbar">
            {sortedTodos.map((todo) => {
              const meta = priorityMeta[todo.priority] ?? priorityMeta.LOW;

              return (
                <li key={todo.id} className={`border-b border-l-4 border-b-gray-100 ${meta.accent} last:border-b-0 dark:border-b-gray-700/60`}>
                  <div className={`px-4 py-3 ${todo.done ? 'bg-gray-50/60 dark:bg-gray-900/20' : 'bg-white dark:bg-gray-800'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        className="form-checkbox mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        type="checkbox"
                        checked={todo.done}
                        onChange={(event) => handleToggle(todo.id, event.target.checked)}
                        aria-label={`${todo.title} 완료`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            className={`font-semibold hover:text-accent-700 dark:hover:text-accent-300 ${todo.done ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}
                            to={todo.path}
                            onClick={() => setDropdownOpen(false)}
                          >
                            {todo.title}
                          </Link>
                          <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${meta.className}`}>
                            {meta.label}
                          </span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-gray-700/60 dark:text-gray-300">
                            {todo.dueDate || todo.due}
                          </span>
                          {todo.reminderAt && (
                            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                              알림 {todo.reminderAt}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">{todo.detail}</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <select className="form-select h-7 rounded-md py-0 pl-2 pr-7 text-xs" value={todo.priority} onChange={(event) => updateTodo(todo.id, { priority: event.target.value })}>
                            <option value="HIGH">중요</option>
                            <option value="MEDIUM">보통</option>
                            <option value="LOW">낮음</option>
                          </select>
                          <input className="form-input h-7 text-xs" type="date" value={todo.dueDate ?? ''} onChange={(event) => updateTodo(todo.id, { dueDate: event.target.value, due: event.target.value })} />
                          <input className="form-input h-7 text-xs" type="time" value={todo.reminderAt ?? ''} onChange={(event) => updateTodo(todo.id, { reminderAt: event.target.value })} />
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Transition>
    </div>
  );
}

export default DropdownTodo;
