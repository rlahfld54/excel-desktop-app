export const todoStorageKey = 'excel-workspace:closingTodos';
export const todoChangedEvent = 'excel-workspace:todo-changed';

export const priorityMeta = {
  HIGH: {
    label: '중요',
    className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
    accent: 'border-l-rose-500',
  },
  MEDIUM: {
    label: '보통',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    accent: 'border-l-amber-500',
  },
  LOW: {
    label: '낮음',
    className: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
    accent: 'border-l-gray-300 dark:border-l-gray-600',
  },
};

export const defaultTodos = [
  {
    id: 'customer-contact',
    title: '거래처 담당자 확인',
    detail: '확인 필요 업체에 마감 금액 기준 회신 받기',
    priority: 'HIGH',
    due: '10일 마감',
    dueDate: '2026-06-10',
    reminderAt: '09:00',
    done: false,
    path: '/closing-workspace/overview',
  },
  {
    id: 'amount-confirm',
    title: '마감 금액 확정',
    detail: '거래처 회신 금액과 내부 집계 금액 맞추기',
    priority: 'HIGH',
    due: '25일 마감',
    dueDate: '2026-06-25',
    reminderAt: '10:00',
    done: false,
    path: '/closing-workspace/overview',
  },
  {
    id: 'tax-invoice-check',
    title: '세금계산서 대조',
    detail: '세금계산서 발행 금액과 확정 금액 차이 확인',
    priority: 'HIGH',
    due: '30일 마감',
    dueDate: '2026-06-30',
    reminderAt: '14:00',
    done: false,
    path: '/closing-workspace/overview',
  },
  {
    id: 'remaining-customers',
    title: '남은 마감 업체 정리',
    detail: '대시보드 남은 업체 목록에서 지연 단계 확인',
    priority: 'MEDIUM',
    due: '오늘',
    dueDate: '2026-06-09',
    reminderAt: '16:00',
    done: false,
    path: '/dashboard',
  },
  {
    id: 'request-package',
    title: '확인 요청 패키지 준비',
    detail: '거래처별 PDF/XLSX와 발송 목록 점검',
    priority: 'LOW',
    due: '이번 주',
    dueDate: '2026-06-13',
    reminderAt: '',
    done: false,
    path: '/closing-workspace/overview',
  },
];

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(todoStorageKey)) ?? {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(todoStorageKey, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent(todoChangedEvent));
  } catch {
    // Todo state is helpful but not critical.
  }
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getTodayKey() {
  return todayKey();
}

export function readTodos(userId) {
  const store = readStore();
  const userTodos = store[userId]?.todos;

  if (Array.isArray(userTodos)) {
    const defaultIds = new Set(defaultTodos.map((todo) => todo.id));
    const mergedDefaults = defaultTodos.map((todo) => ({
      ...todo,
      ...(userTodos.find((item) => item.id === todo.id) ?? {}),
    }));
    const customTodos = userTodos.filter((todo) => !defaultIds.has(todo.id));
    return [...mergedDefaults, ...customTodos];
  }

  return defaultTodos;
}

export function saveTodos(userId, todos) {
  const store = readStore();
  writeStore({
    ...store,
    [userId]: {
      ...(store[userId] ?? {}),
      todos,
    },
  });
}

export function readTodoHistory(userId) {
  return readStore()[userId]?.history ?? [];
}

export function saveTodoHistory(userId, history) {
  const store = readStore();
  writeStore({
    ...store,
    [userId]: {
      ...(store[userId] ?? {}),
      history: history.slice(0, 300),
    },
  });
}

export function makeTodoId() {
  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createTodo(input) {
  const dueDate = input.dueDate || todayKey();
  return {
    id: makeTodoId(),
    title: input.title.trim(),
    detail: input.detail?.trim() || '직접 추가한 일정',
    priority: input.priority || 'MEDIUM',
    due: input.due || dueDate,
    dueDate,
    reminderAt: input.reminderAt || '',
    done: false,
    path: input.path || '/dashboard',
    createdAt: new Date().toISOString(),
    custom: true,
  };
}

export function toggleTodoDone(userId, todos, todoId, done) {
  const now = new Date().toISOString();
  const nextTodos = todos.map((todo) => (
    todo.id === todoId
      ? {
          ...todo,
          done,
          completedAt: done ? now : null,
        }
      : todo
  ));
  const todo = nextTodos.find((item) => item.id === todoId);

  if (todo) {
    const history = readTodoHistory(userId);
    const nextHistory = [
      {
        id: `${todoId}-${now}`,
        todoId,
        title: todo.title,
        priority: todo.priority,
        done,
        date: todayKey(),
        changedAt: now,
      },
      ...history,
    ];
    saveTodoHistory(userId, nextHistory);
  }

  saveTodos(userId, nextTodos);
  return nextTodos;
}

export function getTodoSummary(userId, date = new Date()) {
  const todos = readTodos(userId);
  const key = todayKey(date);
  const openTodos = todos.filter((todo) => !todo.done);
  const todayTodos = todos.filter((todo) => todo.dueDate === key);
  const reminders = todos
    .filter((todo) => !todo.done && todo.dueDate && todo.reminderAt)
    .sort((a, b) => `${a.dueDate} ${a.reminderAt}`.localeCompare(`${b.dueDate} ${b.reminderAt}`));
  const highOpenCount = openTodos.filter((todo) => todo.priority === 'HIGH').length;

  return {
    todos,
    openTodos,
    todayTodos,
    reminders,
    highOpenCount,
    completedCount: todos.length - openTodos.length,
    completionRate: todos.length ? Math.round(((todos.length - openTodos.length) / todos.length) * 100) : 100,
  };
}

export function getCalendarDays(year, monthIndex, todos, history) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const startOffset = first.getDay();
  const days = [];

  for (let index = 0; index < startOffset; index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(year, monthIndex, day);
    const key = todayKey(date);
    days.push({
      key,
      day,
      todos: todos.filter((todo) => todo.dueDate === key),
      records: history.filter((item) => item.date === key),
    });
  }

  return days;
}
