import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";

import SidebarLinkGroup from "./SidebarLinkGroup";
import { menuGroups } from "../routesConfig";
import logo from "../images/logo.svg";

const workspaceFiles = [
  { label: "sales_orders_2026.xlsx", status: "최근" },
  { label: "월간 매출 원본.xlsx", status: "고정" },
  { label: "오늘 15:02 자동 저장", status: "백업" },
];

const groupIcons = [
  (
    <path d="M6.5 1A1.5 1.5 0 0 0 5 2.5V4H2.5A1.5 1.5 0 0 0 1 5.5v7A1.5 1.5 0 0 0 2.5 14h11a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 4H11V2.5A1.5 1.5 0 0 0 9.5 1h-3ZM6 4V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V4H6Zm-3.5 6h11v2.5a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V10Z" />
  ),
  (
    <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5v-11ZM3 5v3h4V5H3Zm5 0v3h5V5H8Zm5 4H8v5h4.5a.5.5 0 0 0 .5-.5V9ZM7 14V9H3v4.5a.5.5 0 0 0 .5.5H7Z" />
  ),
  (
    <path d="M8 1a7 7 0 0 0-7 7h2a5 5 0 1 1 1.464 3.536L3 10.071V14h3.929l-1.05-1.05A7 7 0 1 0 8 1Zm1 3H7v5h4V7H9V4Z" />
  ),
  (
    <path d="M8 1.5 1.75 4v1.5h12.5V4L8 1.5ZM3 7v5H2v2h12v-2h-1V7h-2v5H9V7H7v5H5V7H3Z" />
  ),
  (
    <path d="M8 1a3 3 0 0 0-3 3v1H3.5A1.5 1.5 0 0 0 2 6.5v7A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 12.5 5H11V4a3 3 0 0 0-3-3ZM7 5V4a1 1 0 1 1 2 0v1H7Zm1 3a1.5 1.5 0 0 1 .75 2.799V12h-1.5v-1.201A1.5 1.5 0 0 1 8 8Z" />
  ),
  (
    <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6A1.5 1.5 0 0 1 12.5 11H6.25L3 14v-3.085A1.5 1.5 0 0 1 2 9.5v-6ZM3.5 3a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 .5.5H4v1.71L5.86 10h6.64a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 0-.5-.5h-9ZM5 5h6v1H5V5Zm0 2h4.5v1H5V7Z" />
  ),
];

function isGroupActive(pathname, group) {
  return pathname === group.basePath || pathname.startsWith(`${group.basePath}/`);
}

function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  variant = 'default',
}) {
  const { pathname } = useLocation();

  const trigger = useRef(null);
  const sidebar = useRef(null);

  const storedSidebarExpanded = localStorage.getItem("sidebar-expanded");
  const [sidebarExpanded, setSidebarExpanded] = useState(storedSidebarExpanded === null ? false : storedSidebarExpanded === "true");

  useEffect(() => {
    const clickHandler = ({ target }) => {
      if (!sidebar.current || !trigger.current) return;
      if (!sidebarOpen || sidebar.current.contains(target) || trigger.current.contains(target)) return;
      setSidebarOpen(false);
    };
    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  });

  useEffect(() => {
    const keyHandler = ({ keyCode }) => {
      if (!sidebarOpen || keyCode !== 27) return;
      setSidebarOpen(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  });

  useEffect(() => {
    localStorage.setItem("sidebar-expanded", sidebarExpanded);
    if (sidebarExpanded) {
      document.querySelector("body").classList.add("sidebar-expanded");
    } else {
      document.querySelector("body").classList.remove("sidebar-expanded");
    }
  }, [sidebarExpanded]);

  return (
    <div className="min-w-fit">
      <div
        className={`fixed inset-0 bg-gray-900/30 z-40 lg:hidden lg:z-auto transition-opacity duration-200 ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      ></div>

      <div
        id="sidebar"
        ref={sidebar}
        className={`flex lg:flex! flex-col absolute z-40 left-0 top-0 lg:static lg:left-auto lg:top-auto lg:translate-x-0 h-[100dvh] overflow-y-scroll lg:overflow-y-auto no-scrollbar w-64 lg:w-20 lg:sidebar-expanded:!w-64 2xl:w-64! shrink-0 bg-white dark:bg-gray-800 p-4 transition-all duration-200 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-64"} ${variant === 'v2' ? 'border-r border-gray-200 dark:border-gray-700/60' : 'rounded-r-2xl shadow-xs'}`}
      >
        <div className="flex justify-between mb-10 pr-3 sm:px-2">
          <button
            ref={trigger}
            className="lg:hidden text-gray-500 hover:text-gray-400"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-controls="sidebar"
            aria-expanded={sidebarOpen}
          >
            <span className="sr-only">Close sidebar</span>
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.7 18.7l1.4-1.4L7.8 13H20v-2H7.8l4.3-4.3-1.4-1.4L4 12z" />
            </svg>
          </button>

          <NavLink end to="/" className="block">
            <img className="h-9 w-9" src={logo} alt="Excel Desktop App" />
          </NavLink>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-xs uppercase text-gray-400 dark:text-gray-500 font-semibold pl-3">
              <span className="hidden lg:block lg:sidebar-expanded:hidden 2xl:hidden text-center w-6" aria-hidden="true">
                ...
              </span>
              <span className="lg:hidden lg:sidebar-expanded:block 2xl:block">메뉴</span>
            </h3>
            <ul className="mt-3">
              <li className={`pl-4 pr-3 py-2 rounded-lg mb-0.5 bg-linear-to-r ${pathname === "/" ? 'from-accent-500/[0.12] dark:from-accent-500/[0.24] to-accent-500/[0.04]' : ''}`}>
                <NavLink
                  end
                  to="/"
                  className={({ isActive }) =>
                    `block text-gray-800 dark:text-gray-100 truncate transition duration-150 ${isActive ? '' : 'hover:text-gray-900 dark:hover:text-white'}`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  {({ isActive }) => (
                    <div className="flex items-center">
                      <svg className={`shrink-0 fill-current ${isActive ? 'text-accent-500' : 'text-gray-400 dark:text-gray-500'}`} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                        <path d="M5.936.278A7.983 7.983 0 0 1 8 0a8 8 0 1 1-8 8c0-.722.104-1.413.278-2.064a1 1 0 1 1 1.932.516A5.99 5.99 0 0 0 2 8a6 6 0 1 0 6-6c-.53 0-1.045.076-1.548.21A1 1 0 1 1 5.936.278Z" />
                        <path d="M6.068 7.482A2.003 2.003 0 0 0 8 10a2 2 0 1 0-.518-3.932L3.707 2.293a1 1 0 0 0-1.414 1.414l3.775 3.775Z" />
                      </svg>
                      <span className="text-sm font-medium ml-4 lg:opacity-0 lg:sidebar-expanded:opacity-100 2xl:opacity-100 duration-200">
                        총무팀 대시보드
                      </span>
                    </div>
                  )}
                </NavLink>
              </li>

              {menuGroups.map((group, groupIndex) => {
                const active = isGroupActive(pathname, group);

                return (
                  <SidebarLinkGroup key={group.basePath} activecondition={active}>
                    {(handleClick, open) => (
                      <React.Fragment>
                        <a
                          href="#0"
                          className={`block text-gray-800 dark:text-gray-100 truncate transition duration-150 ${
                            active ? "" : "hover:text-gray-900 dark:hover:text-white"
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            handleClick();
                            setSidebarExpanded(true);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <svg className={`shrink-0 fill-current ${active ? 'text-accent-500' : 'text-gray-400 dark:text-gray-500'}`} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                                {groupIcons[groupIndex]}
                              </svg>
                              <span className="text-sm font-medium ml-4 lg:opacity-0 lg:sidebar-expanded:opacity-100 2xl:opacity-100 duration-200">
                                {group.title}
                              </span>
                            </div>
                            <div className="flex shrink-0 ml-2">
                              <svg className={`w-3 h-3 shrink-0 ml-1 fill-current text-gray-400 dark:text-gray-500 ${open && "rotate-180"}`} viewBox="0 0 12 12">
                                <path d="M5.9 11.4L.5 6l1.4-1.4 4 4 4-4L11.3 6z" />
                              </svg>
                            </div>
                          </div>
                        </a>
                        <div className="lg:hidden lg:sidebar-expanded:block 2xl:block">
                          <ul className={`pl-8 mt-1 ${!open && "hidden"}`}>
                            {group.items.map((item) => (
                              <li key={item.path} className="mb-1 last:mb-0">
                                <NavLink
                                  end
                                  to={item.path}
                                  className={({ isActive }) =>
                                    "block transition duration-150 truncate " + (isActive ? "text-accent-500" : "text-gray-500/90 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")
                                  }
                                  onClick={() => setSidebarOpen(false)}
                                >
                                  <span className="text-sm font-medium lg:opacity-0 lg:sidebar-expanded:opacity-100 2xl:opacity-100 duration-200">
                                    {item.label}
                                  </span>
                                </NavLink>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </React.Fragment>
                    )}
                  </SidebarLinkGroup>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-auto hidden pt-4 lg:sidebar-expanded:block 2xl:block">
          <div className="rounded-lg border border-accent-200/70 bg-accent-50/70 p-3 dark:border-accent-500/30 dark:bg-accent-500/10">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-accent-700 dark:text-accent-300">작업 보관함</p>
              <span className="h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              {workspaceFiles.map((file) => (
                <button
                  key={file.label}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs text-gray-600 hover:bg-white/80 hover:text-accent-700 dark:text-gray-300 dark:hover:bg-gray-800/70 dark:hover:text-accent-300"
                  type="button"
                >
                  <span className="truncate">{file.label}</span>
                  <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-accent-700 dark:bg-gray-800 dark:text-accent-300">
                    {file.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-3 hidden lg:inline-flex 2xl:hidden justify-end mt-auto">
          <div className="w-12 pl-4 pr-3 py-2">
            <button className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400" onClick={() => setSidebarExpanded(!sidebarExpanded)}>
              <span className="sr-only">Expand / collapse sidebar</span>
              <svg className="shrink-0 fill-current text-gray-400 dark:text-gray-500 sidebar-expanded:rotate-180" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                <path d="M15 16a1 1 0 0 1-1-1V1a1 1 0 1 1 2 0v14a1 1 0 0 1-1 1ZM8.586 7H1a1 1 0 1 0 0 2h7.586l-2.793 2.793a1 1 0 1 0 1.414 1.414l4.5-4.5A.997.997 0 0 0 12 8.01M11.924 7.617a.997.997 0 0 0-.217-.324l-4.5-4.5a1 1 0 0 0-1.414 1.414L8.586 7M12 7.99a.996.996 0 0 0-.076-.373Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
