export const todoStorageKey = 'excel-workspace:closingTodos';
export const todoChangedEvent = 'excel-workspace:todo-changed';
export const teamTodoUserId = 'team:general-affairs';

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
    itemType: 'TODO',
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
    itemType: 'TODO',
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
    itemType: 'SCHEDULE',
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
    itemType: 'TODO',
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
    itemType: 'TODO',
  },
];

export const defaultTeamTodos = [
  {
    id: 'team-closing-10',
    title: '10일 마감 회신 취합',
    detail: '거래처 회신, 미확정 사유, 담당자별 남은 업체를 총무팀 기준으로 정리',
    priority: 'HIGH',
    due: '총무팀',
    dueDate: '2026-06-10',
    reminderAt: '09:30',
    done: false,
    path: '/schedule/todos',
    scope: 'TEAM',
    itemType: 'TODO',
  },
  {
    id: 'team-department-requests',
    title: '타부서 요청 정리',
    detail: '영업/물류/구매팀에서 들어온 마감 관련 요청을 담당자별로 배정',
    priority: 'MEDIUM',
    due: '총무팀',
    dueDate: '2026-06-11',
    reminderAt: '11:00',
    done: false,
    path: '/schedule/todos',
    scope: 'TEAM',
    itemType: 'SCHEDULE',
  },
  {
    id: 'team-executive-report',
    title: '사장님 보고 자료 업데이트',
    detail: '위험 업체, 미확정 금액, 내부 검토 현황을 보고용으로 갱신',
    priority: 'HIGH',
    due: '총무팀',
    dueDate: '2026-06-12',
    reminderAt: '15:00',
    done: false,
    path: '/results/executive-dashboard',
    scope: 'TEAM',
    itemType: 'SCHEDULE',
  },
  {
    id: 'team-closing-25-precheck',
    title: '25일 마감 사전 점검',
    detail: '마감장 미발송, 금액 미확정, 세금계산서 발행 대기 업체 확인',
    priority: 'MEDIUM',
    due: '총무팀',
    dueDate: '2026-06-16',
    reminderAt: '09:00',
    done: false,
    path: '/closing-workspace/overview',
    scope: 'TEAM',
    itemType: 'TODO',
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeTodo(todo, fallbackType = 'TODO') {
  const dueDate = todo.dueDate || todo.due || todayKey();

  return {
    ...todo,
    dueDate,
    due: todo.due || dueDate,
    itemType: todo.itemType || fallbackType,
    done: Boolean(todo.done),
  };
}

export function getTodayKey() {
  return todayKey();
}

export function readTodos(userId) {
  const store = readStore();
  const userTodos = store[userId]?.todos;

  if (Array.isArray(userTodos)) {
    return userTodos.map((todo) => normalizeTodo(todo, todo.itemType));
  }

  return defaultTodos.map((todo) => normalizeTodo(todo, todo.itemType));
}

export function initializePersonalTodos(userId) {
  const store = readStore();
  if (store[userId]) return;
  writeStore({
    ...store,
    [userId]: {
      todos: [],
      history: [],
    },
  });
}

export function clearPersonalTodoData(userId) {
  const store = readStore();
  if (!store[userId]) return;
  const nextStore = { ...store };
  delete nextStore[userId];
  writeStore(nextStore);
}

export function readTeamTodos() {
  const store = readStore();
  const teamTodos = store[teamTodoUserId]?.todos;

  if (Array.isArray(teamTodos)) {
    const defaultIds = new Set(defaultTeamTodos.map((todo) => todo.id));
    const mergedDefaults = defaultTeamTodos.map((todo) => normalizeTodo({
      ...todo,
      ...(teamTodos.find((item) => item.id === todo.id) ?? {}),
    }, todo.itemType));
    const customTodos = teamTodos.filter((todo) => !defaultIds.has(todo.id)).map((todo) => normalizeTodo(todo, 'SCHEDULE'));
    return [...mergedDefaults, ...customTodos];
  }

  return defaultTeamTodos.map((todo) => normalizeTodo(todo, todo.itemType));
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

export function saveTeamTodos(todos) {
  const store = readStore();
  writeStore({
    ...store,
    [teamTodoUserId]: {
      ...(store[teamTodoUserId] ?? {}),
      todos,
    },
  });
}

export function readTodoHistory(userId) {
  return readStore()[userId]?.history ?? [];
}

export function readTeamTodoHistory() {
  return readStore()[teamTodoUserId]?.history ?? [];
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

export function saveTeamTodoHistory(history) {
  const store = readStore();
  writeStore({
    ...store,
    [teamTodoUserId]: {
      ...(store[teamTodoUserId] ?? {}),
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
    scope: input.scope || 'PERSONAL',
    itemType: input.itemType || 'TODO',
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

export function toggleTeamTodoDone(todos, todoId, done) {
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
    const history = readTeamTodoHistory();
    const nextHistory = [
      {
        id: `${todoId}-${now}`,
        todoId,
        title: todo.title,
        priority: todo.priority,
        done,
        date: todayKey(),
        changedAt: now,
        scope: 'TEAM',
      },
      ...history,
    ];
    saveTeamTodoHistory(nextHistory);
  }

  saveTeamTodos(nextTodos);
  return nextTodos;
}

export function getTodoSummary(userId, date = new Date()) {
  const todos = readTodos(userId);
  const todoItems = todos.filter((todo) => (todo.itemType || 'TODO') === 'TODO');
  const key = todayKey(date);
  const openTodos = todoItems.filter((todo) => !todo.done);
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
    completedCount: todoItems.length - openTodos.length,
    completionRate: todoItems.length ? Math.round(((todoItems.length - openTodos.length) / todoItems.length) * 100) : 100,
  };
}

export function getTeamTodoSummary(date = new Date()) {
  const todos = readTeamTodos();
  const todoItems = todos.filter((todo) => (todo.itemType || 'TODO') === 'TODO');
  const key = todayKey(date);
  const openTodos = todoItems.filter((todo) => !todo.done);
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
    completedCount: todoItems.length - openTodos.length,
    completionRate: todoItems.length ? Math.round(((todoItems.length - openTodos.length) / todoItems.length) * 100) : 100,
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
