import React, { useEffect, useState } from 'react';

import SearchModal from '../components/ModalSearch';
import Notifications from '../components/DropdownNotifications';
import Todo from '../components/DropdownTodo';
import Help from '../components/DropdownHelp';
import UserMenu from '../components/DropdownProfile';
import ThemeToggle from '../components/ThemeToggle';
import { addNotification, readNotifications } from '../utils/appNotifications';
import { authChangedEvent, getCurrentUser } from '../utils/authSession';
import { getTodoSummary, todoChangedEvent } from '../utils/todoSchedule';

const toolbarItems = [
  {
    label: '파일 업로드',
    icon: 'M8 1 3 6h3v5h4V6h3L8 1ZM3 13v2h10v-2H3Z',
    help: 'CSV/XLSX 파일을 업로드 전 검증 화면으로 불러옵니다. 검증 내용을 적용하기 전까지 SQLite에는 반영되지 않습니다.',
  },
  {
    label: '저장',
    icon: 'M2 2h10l2 2v10H2V2Zm3 1v4h6V3H5Zm-1 8v2h8v-2H4Z',
    help: '현재 화면의 작업 상태를 SQLite 테이블에 저장합니다.',
  },
];

function ToolbarHint({ children }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-64 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-xs leading-5 text-gray-600 shadow-lg group-hover:block group-focus-within:block dark:border-gray-700/60 dark:bg-gray-800 dark:text-gray-200">
      {children}
    </span>
  );
}

function Header({
  sidebarOpen,
  setSidebarOpen,
  variant = 'default',
  onFileUpload,
  onSave,
  lastSavedAt = '방금 전',
}) {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [reminderToast, setReminderToast] = useState(null);

  useEffect(() => {
    const refreshUser = () => setCurrentUser(getCurrentUser());
    window.addEventListener(authChangedEvent, refreshUser);
    window.addEventListener('storage', refreshUser);
    return () => {
      window.removeEventListener(authChangedEvent, refreshUser);
      window.removeEventListener('storage', refreshUser);
    };
  }, []);

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const dismissedKey = `excel-workspace:todoReminderDismissed:${currentUser.id}:${today}`;
      const dismissed = JSON.parse(localStorage.getItem(dismissedKey) ?? '[]');
      const dueReminder = getTodoSummary(currentUser.id).reminders.find((todo) => {
        if (todo.dueDate !== today || !todo.reminderAt || dismissed.includes(todo.id)) return false;
        const [hour, minute] = todo.reminderAt.split(':').map(Number);
        return currentMinutes >= hour * 60 + minute;
      });

      if (dueReminder) {
        const notifiedKey = `excel-workspace:todoReminderNotified:${currentUser.id}:${today}`;
        const notified = JSON.parse(localStorage.getItem(notifiedKey) ?? '[]');
        const existingNotification = readNotifications().some((notification) => (
          notification.target === '일정관리'
          && notification.title === dueReminder.title
          && notification.message?.includes(`${dueReminder.dueDate} ${dueReminder.reminderAt}`)
        ));

        if (!notified.includes(dueReminder.id) || !existingNotification) {
          addNotification({
            title: dueReminder.title,
            message: `${dueReminder.dueDate} ${dueReminder.reminderAt} 일정 알림`,
            level: dueReminder.priority === 'HIGH' ? 'WARN' : 'INFO',
            target: '일정관리',
            href: dueReminder.path || '/schedule/todos',
          });
          localStorage.setItem(notifiedKey, JSON.stringify([...notified, dueReminder.id]));
        }
      }

      setReminderToast(dueReminder ?? null);
    };

    checkReminders();
    window.addEventListener(todoChangedEvent, checkReminders);
    window.addEventListener('storage', checkReminders);
    const timer = window.setInterval(checkReminders, 60000);

    return () => {
      window.removeEventListener(todoChangedEvent, checkReminders);
      window.removeEventListener('storage', checkReminders);
      window.clearInterval(timer);
    };
  }, [currentUser.id]);

  const rememberReminderDismissed = (reminder) => {
    if (!reminder) return;
    const today = new Date().toISOString().slice(0, 10);
    const dismissedKey = `excel-workspace:todoReminderDismissed:${currentUser.id}:${today}`;
    const dismissed = JSON.parse(localStorage.getItem(dismissedKey) ?? '[]');
    localStorage.setItem(dismissedKey, JSON.stringify([...new Set([...dismissed, reminder.id])]));
  };

  useEffect(() => {
    if (!reminderToast) return undefined;

    const timer = window.setTimeout(() => {
      rememberReminderDismissed(reminderToast);
      setReminderToast(null);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [currentUser.id, reminderToast]);

  const dismissReminder = () => {
    if (!reminderToast) return;

    rememberReminderDismissed(reminderToast);
    setReminderToast(null);
  };

  const handleFileChange = (event) => {
    const [file] = event.target.files;
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    event.target.value = '';
  };

  return (
    <header className={`sticky top-0 before:absolute before:inset-0 before:backdrop-blur-md max-lg:before:bg-white/92 dark:max-lg:before:bg-gray-800/90 before:-z-10 z-30 ${variant === 'v2' || variant === 'v3' ? 'before:bg-white after:absolute after:h-px after:inset-x-0 after:top-full after:bg-gray-200 dark:after:bg-gray-700/60 after:-z-10' : 'before:bg-white/86 dark:before:bg-gray-900/88 after:absolute after:h-px after:inset-x-0 after:top-full after:bg-gray-200/80 dark:after:bg-gray-700/60 after:-z-10'} ${variant === 'v2' ? 'dark:before:bg-gray-800' : ''} ${variant === 'v3' ? 'dark:before:bg-gray-900' : ''}`}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="text-gray-500 hover:text-accent-600 dark:hover:text-accent-300 lg:hidden"
              aria-controls="sidebar"
              aria-expanded={sidebarOpen}
              onClick={(event) => {
                event.stopPropagation();
                setSidebarOpen(!sidebarOpen);
              }}
            >
              <span className="sr-only">사이드바 열기</span>
              <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="5" width="16" height="2" />
                <rect x="4" y="11" width="16" height="2" />
                <rect x="4" y="17" width="16" height="2" />
              </svg>
            </button>

            <div className="hidden items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 md:flex">
              <label className="group relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-gray-700 hover:bg-accent-50 hover:text-accent-700 dark:text-gray-200 dark:hover:bg-accent-500/10 dark:hover:text-accent-300">
                <svg className="h-4 w-4 fill-current text-gray-500 dark:text-gray-400" viewBox="0 0 16 16" aria-hidden="true">
                  <path d={toolbarItems[0].icon} />
                </svg>
                <span>{toolbarItems[0].label}</span>
                <ToolbarHint>{toolbarItems[0].help}</ToolbarHint>
                <input className="sr-only" type="file" accept=".csv,.xlsx" onChange={handleFileChange} />
              </label>
              <button
                className="group relative inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-gray-700 hover:bg-accent-50 hover:text-accent-700 dark:text-gray-200 dark:hover:bg-accent-500/10 dark:hover:text-accent-300"
                type="button"
                onClick={onSave}
              >
                <svg className="h-4 w-4 fill-current text-gray-500 dark:text-gray-400" viewBox="0 0 16 16" aria-hidden="true">
                  <path d={toolbarItems[1].icon} />
                </svg>
                <span>{toolbarItems[1].label}</span>
                <ToolbarHint>{toolbarItems[1].help}</ToolbarHint>
              </button>
            </div>

            <div className="hidden items-center gap-2 text-sm text-gray-500 dark:text-gray-400 xl:flex">
              <span className="h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" />
              <span>자동 저장됨 · {lastSavedAt}</span>
            </div>

            <div className="hidden items-center gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-1.5 text-sm text-accent-700 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-300 2xl:flex">
              <span className="h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" />
              <span>{currentUser.name} 로그인 · {currentUser.role}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div>
              <button
                className={`ml-3 flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent-50 hover:text-accent-700 dark:hover:bg-accent-500/10 dark:hover:text-accent-300 ${searchModalOpen ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSearchModalOpen(true);
                }}
                aria-controls="search-modal"
              >
                <span className="sr-only">검색</span>
                <svg className="fill-current" width={16} height={16} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 14c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7ZM7 2C4.243 2 2 4.243 2 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5Z" />
                  <path d="m13.314 11.9 2.393 2.393a.999.999 0 1 1-1.414 1.414L11.9 13.314a8.019 8.019 0 0 0 1.414-1.414Z" />
                </svg>
              </button>
              <SearchModal id="search-modal" searchId="search" modalOpen={searchModalOpen} setModalOpen={setSearchModalOpen} />
            </div>
            <Todo align="right" />
            <Notifications align="right" />
            <Help align="right" />
            <ThemeToggle />
            <hr className="h-6 w-px border-none bg-gray-200 dark:bg-gray-700/60" />
            <UserMenu align="right" />
          </div>
        </div>
      </div>
      {reminderToast && (
        <div className="absolute right-4 top-[4.5rem] z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-amber-200 bg-white p-4 shadow-lg dark:border-amber-500/30 dark:bg-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-amber-600 dark:text-amber-300">일정 알림</p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{reminderToast.title}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{reminderToast.dueDate} {reminderToast.reminderAt}</p>
            </div>
            <button className="rounded-md px-2 py-1 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" type="button" onClick={dismissReminder}>
              닫기
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
