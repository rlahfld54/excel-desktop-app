import React, { useState } from 'react';

import SearchModal from '../components/ModalSearch';
import Notifications from '../components/DropdownNotifications';
import Help from '../components/DropdownHelp';
import UserMenu from '../components/DropdownProfile';
import ThemeToggle from '../components/ThemeToggle';

const toolbarItems = [
  { label: '업로드', icon: 'M8 1 3 6h3v5h4V6h3L8 1ZM3 13v2h10v-2H3Z' },
  { label: '저장', icon: 'M2 2h10l2 2v10H2V2Zm3 1v4h6V3H5Zm-1 8v2h8v-2H4Z' },
  { label: '실행', icon: 'M4 2.5v11l9-5.5-9-5.5Z' },
];

function Header({
  sidebarOpen,
  setSidebarOpen,
  variant = 'default',
}) {
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  return (
    <header className={`sticky top-0 before:absolute before:inset-0 before:backdrop-blur-md max-lg:before:bg-white/90 dark:max-lg:before:bg-gray-800/90 before:-z-10 z-30 ${variant === 'v2' || variant === 'v3' ? 'before:bg-white after:absolute after:h-px after:inset-x-0 after:top-full after:bg-gray-200 dark:after:bg-gray-700/60 after:-z-10' : 'max-lg:shadow-xs lg:before:bg-gray-100/90 dark:lg:before:bg-gray-900/90'} ${variant === 'v2' ? 'dark:before:bg-gray-800' : ''} ${variant === 'v3' ? 'dark:before:bg-gray-900' : ''}`}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className={`flex items-center justify-between h-16 gap-4 ${variant === 'v2' || variant === 'v3' ? '' : 'lg:border-b border-gray-200 dark:border-gray-700/60'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="text-gray-500 hover:text-accent-600 dark:hover:text-accent-300 lg:hidden"
              aria-controls="sidebar"
              aria-expanded={sidebarOpen}
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }}
            >
              <span className="sr-only">Open sidebar</span>
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="5" width="16" height="2" />
                <rect x="4" y="11" width="16" height="2" />
                <rect x="4" y="17" width="16" height="2" />
              </svg>
            </button>

            <div className="hidden md:flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
              {toolbarItems.map((item) => (
                <button
                  key={item.label}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-gray-700 hover:bg-accent-50 hover:text-accent-700 dark:text-gray-200 dark:hover:bg-accent-500/10 dark:hover:text-accent-300"
                  type="button"
                >
                  <svg className="h-4 w-4 fill-current text-gray-500 dark:text-gray-400" viewBox="0 0 16 16" aria-hidden="true">
                    <path d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </button>
              ))}
              <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
              <button className="h-8 w-8 rounded-md text-gray-500 hover:bg-accent-50 hover:text-accent-700 dark:text-gray-400 dark:hover:bg-accent-500/10 dark:hover:text-accent-300" type="button" title="Undo">
                <span className="sr-only">Undo</span>
                <svg className="mx-auto h-4 w-4 fill-current" viewBox="0 0 16 16"><path d="M6.5 3 2 7.5 6.5 12V9H10a3 3 0 1 1 0 6H8v-2h2a1 1 0 1 0 0-2H6.5V3Z" /></svg>
              </button>
              <button className="h-8 w-8 rounded-md text-gray-500 hover:bg-accent-50 hover:text-accent-700 dark:text-gray-400 dark:hover:bg-accent-500/10 dark:hover:text-accent-300" type="button" title="Redo">
                <span className="sr-only">Redo</span>
                <svg className="mx-auto h-4 w-4 fill-current" viewBox="0 0 16 16"><path d="M9.5 3 14 7.5 9.5 12V9H6a3 3 0 1 0 0 6h2v-2H6a1 1 0 1 1 0-2h3.5V3Z" /></svg>
              </button>
            </div>

            <div className="hidden xl:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" />
              <span>자동 저장됨 · 방금 전</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div>
              <button
                className={`w-8 h-8 flex items-center justify-center hover:bg-accent-50 hover:text-accent-700 dark:hover:bg-accent-500/10 dark:hover:text-accent-300 rounded-full ml-3 ${searchModalOpen ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : ''}`}
                onClick={(e) => { e.stopPropagation(); setSearchModalOpen(true); }}
                aria-controls="search-modal"
              >
                <span className="sr-only">Search</span>
                <svg
                  className="fill-current"
                  width={16}
                  height={16}
                  viewBox="0 0 16 16"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M7 14c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7ZM7 2C4.243 2 2 4.243 2 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5Z" />
                  <path d="m13.314 11.9 2.393 2.393a.999.999 0 1 1-1.414 1.414L11.9 13.314a8.019 8.019 0 0 0 1.414-1.414Z" />
                </svg>
              </button>
              <SearchModal id="search-modal" searchId="search" modalOpen={searchModalOpen} setModalOpen={setSearchModalOpen} />
            </div>
            <Notifications align="right" />
            <Help align="right" />
            <ThemeToggle />
            <hr className="w-px h-6 bg-gray-200 dark:bg-gray-700/60 border-none" />
            <UserMenu align="right" />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
