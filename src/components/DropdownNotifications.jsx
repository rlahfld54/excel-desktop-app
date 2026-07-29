import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Transition } from './common';
import {
  clearNotifications,
  markNotificationRead,
  notificationChangedEvent,
  readNotifications,
  refreshNotificationsFromDatabase,
} from '../utils/appNotifications';

function levelClass(level) {
  if (level === 'ERROR') return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
  if (level === 'WARN') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  if (level === 'SUCCESS') return 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300';
  return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
}

function formatTime(value) {
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function DropdownNotifications({ align }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => readNotifications());
  const [clearError, setClearError] = useState('');
  const [clearing, setClearing] = useState(false);

  const trigger = useRef(null);
  const dropdown = useRef(null);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

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
    const refreshNotifications = () => setNotifications(readNotifications());

    refreshNotificationsFromDatabase().then(setNotifications).catch(refreshNotifications);
    window.addEventListener(notificationChangedEvent, refreshNotifications);
    window.addEventListener('storage', refreshNotifications);
    return () => {
      window.removeEventListener(notificationChangedEvent, refreshNotifications);
      window.removeEventListener('storage', refreshNotifications);
    };
  }, []);

  const handleOpenNotification = (notification) => {
    markNotificationRead(notification.id);
    setNotifications(readNotifications());
    setDropdownOpen(false);
  };

  const handleClear = async () => {
    setClearing(true);
    setClearError('');
    try {
      await clearNotifications();
      setNotifications([]);
    } catch (error) {
      setClearError(error?.message || '알림을 비우지 못했습니다.');
      setNotifications(readNotifications());
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="relative inline-flex">
      <button
        ref={trigger}
        className={`relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent-50 hover:text-accent-700 dark:hover:bg-accent-500/10 dark:hover:text-accent-300 ${dropdownOpen ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : ''}`}
        aria-haspopup="true"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
      >
        <span className="sr-only">알림</span>
        <svg className="fill-current text-gray-500/80 dark:text-gray-400/80" width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 16a2.5 2.5 0 0 0 2.45-2H5.55A2.5 2.5 0 0 0 8 16Zm6-4-1.4-1.4V6.7A4.61 4.61 0 0 0 9 2.2V1a1 1 0 1 0-2 0v1.2a4.61 4.61 0 0 0-3.6 4.5v3.9L2 12v1h12v-1Z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      <Transition
        className={`absolute top-full z-10 mt-1 min-w-80 origin-top-right overflow-hidden rounded-lg border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-700/60 dark:bg-gray-800 sm:min-w-96 ${align === 'right' ? 'right-0' : 'left-0'}`}
        show={dropdownOpen}
        enter="transition ease-out duration-200 transform"
        enterStart="opacity-0 -translate-y-2"
        enterEnd="opacity-100 translate-y-0"
        leave="transition ease-out duration-200"
        leaveStart="opacity-100"
        leaveEnd="opacity-0"
      >
        <div ref={dropdown} onFocus={() => setDropdownOpen(true)}>
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">알림</p>
              <p className="mt-1 text-sm font-bold text-gray-900 dark:text-gray-100">작업 진행 상태 {notifications.length.toLocaleString('ko-KR')}건</p>
            </div>
            {notifications.length > 0 && (
              <button className="rounded-md px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700" type="button" onClick={handleClear} disabled={clearing}>
                {clearing ? '비우는 중…' : '비우기'}
              </button>
            )}
          </div>
          {clearError && <p className="mx-4 mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{clearError}</p>}
          <ul className="max-h-[420px] overflow-auto no-scrollbar">
            {notifications.length > 0 ? notifications.map((notification) => {
              const content = (
                <div className={`block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/20 ${notification.read ? 'opacity-70' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{notification.title}</p>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${levelClass(notification.level)}`}>
                      {notification.level}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">{notification.message}</p>
                  <p className="mt-2 text-xs font-medium text-gray-400 dark:text-gray-500">{formatTime(notification.createdAt)} {notification.target ? `· ${notification.target}` : ''}</p>
                </div>
              );

              return (
                <li key={notification.id} className="border-b border-gray-200 last:border-0 dark:border-gray-700/60">
                  {notification.href ? (
                    <Link to={notification.href} onClick={() => handleOpenNotification(notification)}>
                      {content}
                    </Link>
                  ) : (
                    <button className="w-full text-left" type="button" onClick={() => handleOpenNotification(notification)}>
                      {content}
                    </button>
                  )}
                </li>
              );
            }) : (
              <li className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">아직 표시할 작업 알림이 없습니다.</li>
            )}
          </ul>
        </div>
      </Transition>
    </div>
  );
}

export default DropdownNotifications;
