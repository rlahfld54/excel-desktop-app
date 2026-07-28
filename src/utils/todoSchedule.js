export const todoChangedEvent = 'excel-workspace:todo-changed';
export const teamTodoUserId = 'team:general-affairs';
let todoState = {};

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

export const defaultTeamTodos = [];

function createTeamScheduleSeed(year = new Date().getFullYear()) {
  const make = (id, itemType, dueDate, title, detail, priority, reminderAt) => ({
    id: `team-seed-${year}-${id}`,
    itemType,
    dueDate: `${year}-${dueDate}`,
    due: `${year}-${dueDate}`,
    title,
    detail,
    priority,
    reminderAt,
    done: false,
    custom: false,
    scope: 'TEAM',
    createdAt: new Date().toISOString(),
  });

  return [
    make('month-end-evidence', 'TODO', '07-29', '월말 마감 제출 현황 취합', '각 부서의 마감 자료 제출 여부를 확인하고 미제출 부서에 안내합니다.', 'HIGH', '10:00'),
    make('july-expense-evidence', 'TODO', '07-31', '7월 법인카드·지출 증빙 확인', '누락된 영수증과 세금계산서 여부를 확인해 월말 정산 목록을 정리합니다.', 'HIGH', '15:00'),
    make('august-closing', 'SCHEDULE', '08-03', '7월 비용 정산 마감', '취합된 비용 자료를 검토하고 회계 전달용 정산 파일을 확정합니다.', 'HIGH', '09:30'),
    make('august-stock', 'TODO', '08-07', '사무용 소모품 재고 점검', '복사용지·토너·문구류 재고를 확인하고 부족 품목을 발주 목록에 추가합니다.', 'MEDIUM', '14:00'),
    make('august-facility', 'SCHEDULE', '08-21', '사내 시설 정기 점검', '회의실 장비, 공용 프린터, 냉난방 설비의 이상 여부를 점검합니다.', 'MEDIUM', '10:00'),
    make('september-collection', 'TODO', '09-01', '8월 근태·비용 자료 취합', '근태 현황과 부서별 비용 증빙을 취합해 정산 전 누락을 확인합니다.', 'HIGH', '10:00'),
    make('september-contracts', 'TODO', '09-11', '정기 계약 갱신 대상 확인', '임대·렌탈·정기 서비스 계약의 만료일과 갱신 조건을 확인합니다.', 'MEDIUM', '14:00'),
    make('september-quarter-review', 'SCHEDULE', '09-25', '3분기 비용 집계 및 보고 일정 확정', '3분기 집행 현황을 정리하고 경영 보고용 자료 준비 일정을 공유합니다.', 'HIGH', '11:00'),
    make('october-evidence', 'TODO', '10-05', '9월 증빙 누락 확인', '부서별 누락 증빙과 미처리 비용을 확인해 보완 요청합니다.', 'HIGH', '10:00'),
    make('october-assets', 'TODO', '10-16', '비품·자산 현황 점검', '공용 장비와 주요 비품의 이동·수리·교체 필요 여부를 업데이트합니다.', 'MEDIUM', '15:00'),
    make('october-planning', 'SCHEDULE', '10-30', '월말 마감 및 11월 소모품 발주', '10월 마감 상태를 점검하고 다음 달 소모품 발주 수량을 확정합니다.', 'HIGH', '13:00'),
    make('november-review', 'TODO', '11-03', '10월 정산자료 검토', '마감 파일, 세금계산서, 법인카드 사용 내역을 대조해 검토합니다.', 'HIGH', '10:00'),
    make('november-safety', 'SCHEDULE', '11-13', '동절기 시설 안전 점검', '난방기, 소화기, 전기 설비와 비상물품 상태를 점검합니다.', 'MEDIUM', '14:00'),
    make('november-budget', 'TODO', '11-24', '연말 예산 집행 현황 취합', '부서별 잔여 예산과 연내 집행 예정 항목을 취합합니다.', 'MEDIUM', '11:00'),
    make('december-evidence', 'TODO', '12-01', '연말 지출 증빙·세금계산서 정리', '연말 정산 전 누락 증빙과 세금계산서 발행 현황을 최종 확인합니다.', 'HIGH', '09:30'),
    make('december-inventory', 'SCHEDULE', '12-11', '사무기기·비품 재고 실사', '공용 비품과 장비의 수량·상태를 확인해 다음 연도 관리대장을 갱신합니다.', 'MEDIUM', '10:00'),
    make('december-contracts', 'TODO', '12-18', '다음 연도 계약 갱신 목록 확정', '정기 계약의 갱신 여부, 담당자, 예산을 확정해 결재 자료를 준비합니다.', 'HIGH', '14:00'),
    make('december-contact', 'SCHEDULE', '12-23', '연말 휴무·비상연락망 공지', '휴무 기간 담당자와 긴급 연락 체계를 정리해 전사에 안내합니다.', 'MEDIUM', '11:00'),
    make('december-handover', 'TODO', '12-29', '연말 마감 및 미결 업무 인수인계', '미결 업무, 계약 갱신, 보관 문서를 점검하고 다음 연도 담당자에게 인계합니다.', 'HIGH', '15:00'),
  ];
}

function readStore() {
  return todoState;
}

function writeStore(store) {
  todoState = store;
  window.dispatchEvent(new CustomEvent(todoChangedEvent));
}

function savePersonalStateToDatabase(userId, patch) {
  if (!window.api?.savePersonalTodoState || !userId) return Promise.resolve();
  return window.api.savePersonalTodoState({
    username: userId,
    ...patch,
  }).catch((error) => {
    // 저장 실패를 숨기면 재시작 후 일정이 사라진 것처럼 보인다.
    window.dispatchEvent(new CustomEvent('excel-workspace:todo-save-failed', {
      detail: { message: error?.message || '일정을 로컬 SQLite에 저장하지 못했습니다.' },
    }));
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

export async function hydrateTeamTodos() {
  if (!window.api?.getPersonalTodoState) return readTeamTodos();
  const result = await window.api.getPersonalTodoState({ username: teamTodoUserId });
  const state = result?.state ?? { todos: [], history: [] };
  const store = readStore();
  writeStore({
    ...store,
    [teamTodoUserId]: {
      todos: Array.isArray(state.todos) ? state.todos : [],
      history: Array.isArray(state.history) ? state.history : [],
    },
  });
  await ensureTeamScheduleSeed();
  return readTeamTodos();
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

export function saveTeamTodos(todos) {
  const store = readStore();
  writeStore({
    ...store,
    [teamTodoUserId]: {
      ...(store[teamTodoUserId] ?? {}),
      todos,
    },
  });
  return savePersonalStateToDatabase(teamTodoUserId, { todos });
}

export async function ensureTeamScheduleSeed() {
  const store = readStore();
  const current = Array.isArray(store[teamTodoUserId]?.todos) ? store[teamTodoUserId].todos : [];
  const existingIds = new Set(current.map((item) => item.id));
  const additions = createTeamScheduleSeed().filter((item) => !existingIds.has(item.id));
  if (!additions.length) return current;

  const nextTodos = [...current, ...additions];
  await saveTeamTodos(nextTodos);
  return nextTodos;
}

export function readTeamTodoHistory() {
  return readStore()[teamTodoUserId]?.history ?? [];
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
  savePersonalStateToDatabase(teamTodoUserId, { history: history.slice(0, 300) });
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
    scope: 'TEAM',
    itemType: input.itemType || 'TODO',
  };
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
