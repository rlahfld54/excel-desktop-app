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

export const defaultTodos = [];
export const defaultTeamTodos = [];

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

function savePersonalStateToDatabase(userId, patch) {
  if (!window.api?.savePersonalTodoState || !userId) return;
  window.api.savePersonalTodoState({
    username: userId,
    ...patch,
  }).catch(() => {
    // The local cache remains usable when SQLite is temporarily unavailable.
  });
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

  return [];
}

export function initializePersonalTodos(userId) {
  const store = readStore();
  const existing = store[userId];
  const legacyDefaultIds = new Set(defaultTodos.map((todo) => todo.id));
  const containsOnlyLegacyDefaults = Array.isArray(existing?.todos)
    && existing.todos.length > 0
    && existing.todos.every((todo) => legacyDefaultIds.has(todo.id) && !todo.custom);

  if (existing && !containsOnlyLegacyDefaults) return;
  writeStore({
    ...store,
    [userId]: {
      todos: [],
      history: [],
    },
  });
  savePersonalStateToDatabase(userId, { todos: [], history: [] });
}

export function clearPersonalTodoData(userId) {
  const store = readStore();
  if (!store[userId]) return;
  const nextStore = { ...store };
  delete nextStore[userId];
  writeStore(nextStore);
}

export async function hydratePersonalTodos(userId) {
  if (!userId || !window.api?.getPersonalTodoState) {
    initializePersonalTodos(userId);
    return readTodos(userId);
  }

  const result = await window.api.getPersonalTodoState({ username: userId });
  const state = result?.state ?? { todos: [], history: [] };
  const store = readStore();
  writeStore({
    ...store,
    [userId]: {
      todos: Array.isArray(state.todos) ? state.todos : [],
      history: Array.isArray(state.history) ? state.history : [],
    },
  });
  return readTodos(userId);
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
  savePersonalStateToDatabase(userId, { todos });
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
  savePersonalStateToDatabase(userId, { history: history.slice(0, 300) });
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
