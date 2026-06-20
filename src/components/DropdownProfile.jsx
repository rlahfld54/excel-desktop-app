import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Transition } from './common';
import { addActivityLog, authChangedEvent, clearSession, getCurrentUser, saveSession } from '../utils/authSession';

import UserAvatar from '../images/user-avatar-32.png';

function DropdownProfile({
  align
}) {

  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());

  const trigger = useRef(null);
  const dropdown = useRef(null);

  // close on click outside
  useEffect(() => {
    const clickHandler = ({ target }) => {
      if (!dropdown.current) return;
      if (!dropdownOpen || dropdown.current.contains(target) || trigger.current.contains(target)) return;
      setDropdownOpen(false);
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  });

  useEffect(() => {
    const refreshUser = () => setCurrentUser(getCurrentUser());
    window.addEventListener(authChangedEvent, refreshUser);
    window.addEventListener('storage', refreshUser);
    return () => {
      window.removeEventListener(authChangedEvent, refreshUser);
      window.removeEventListener('storage', refreshUser);
    };
  }, []);

  const handleKeepLogin = () => {
    saveSession({ userId: currentUser.id });
    addActivityLog('INFO', '자동 로그인 유지', currentUser.id);
    setCurrentUser(getCurrentUser());
    setDropdownOpen(false);
  };

  const handleLogout = () => {
    addActivityLog('INFO', '로그아웃', currentUser.id, currentUser.id);
    clearSession();
    setDropdownOpen(false);
    navigate('/login', { replace: true });
  };

  const isAdmin = currentUser.role === 'ADMIN';

  // close if the esc key is pressed
  useEffect(() => {
    const keyHandler = ({ keyCode }) => {
      if (!dropdownOpen || keyCode !== 27) return;
      setDropdownOpen(false);
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  });

  return (
    <div className="relative inline-flex">
      <button
        ref={trigger}
        className="inline-flex justify-center items-center group"
        aria-haspopup="true"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
      >
        <img className="w-8 h-8 rounded-full" src={UserAvatar} width="32" height="32" alt="User" />
        <div className="flex items-center truncate">
          <span className="truncate ml-2 text-sm font-medium text-gray-600 dark:text-gray-100 group-hover:text-gray-800 dark:group-hover:text-white">
            {currentUser.name}
          </span>
          <svg className="w-3 h-3 shrink-0 ml-1 fill-current text-gray-400 dark:text-gray-500" viewBox="0 0 12 12">
            <path d="M5.9 11.4L.5 6l1.4-1.4 4 4 4-4L11.3 6z" />
          </svg>
        </div>
      </button>

      <Transition
        className={`origin-top-right z-10 absolute top-full min-w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 py-1.5 rounded-lg shadow-lg overflow-hidden mt-1 ${align === 'right' ? 'right-0' : 'left-0'}`}
        show={dropdownOpen}
        enter="transition ease-out duration-200 transform"
        enterStart="opacity-0 -translate-y-2"
        enterEnd="opacity-100 translate-y-0"
        leave="transition ease-out duration-200"
        leaveStart="opacity-100"
        leaveEnd="opacity-0"
      >
        <div
          ref={dropdown}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setDropdownOpen(false)}
        >
          <div className="pt-0.5 pb-2 px-3 mb-1 border-b border-gray-200 dark:border-gray-700/60">
            <div className="font-medium text-gray-800 dark:text-gray-100">{currentUser.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {currentUser.role} · {currentUser.department}
            </div>
          </div>
          <ul>
            <li>
              <Link
                className="font-medium text-sm text-accent-500 hover:text-accent-600 dark:hover:text-accent-400 flex items-center py-1 px-3"
                to="/settings/preferences"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                마이페이지
              </Link>
            </li>
            {isAdmin && (
              <li>
                <Link
                  className="font-medium text-sm text-accent-500 hover:text-accent-600 dark:hover:text-accent-400 flex items-center py-1 px-3"
                  to="/results/activity-logs"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  사용자 관리
                </Link>
              </li>
            )}
            <li>
              <button
                className="w-full font-medium text-sm text-accent-500 hover:text-accent-600 dark:hover:text-accent-400 flex items-center py-1 px-3"
                type="button"
                onClick={handleKeepLogin}
              >
                자동 로그인 유지
              </button>
            </li>
            <li className="mt-1 border-t border-gray-200 pt-1 dark:border-gray-700/60">
              <button
                className="flex w-full items-center px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
                type="button"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </li>
          </ul>
        </div>
      </Transition>
    </div>
  )
}

export default DropdownProfile;
