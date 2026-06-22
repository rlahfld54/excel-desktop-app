import React, { createContext, useContext, useEffect, useState } from 'react';

import Sidebar from '../partials/Sidebar';
import Header from '../partials/Header';
import Breadcrumbs from '../useComponents/Breadcrumbs';

const EmbeddedPageShellContext = createContext(false);

export function EmbeddedPageShellProvider({ children }) {
  return (
    <EmbeddedPageShellContext.Provider value>
      {children}
    </EmbeddedPageShellContext.Provider>
  );
}

function escapeOptionText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function bindTableTools(root) {
  const tables = Array.from(root.querySelectorAll('table:not([data-table-tools-bound="true"])'))
    .filter((table) => table.dataset.tableTools !== 'false' && !table.closest('[data-table-tools="false"]'));
  const cleanups = [];

  tables.forEach((table, tableIndex) => {
    const tbody = table.querySelector('tbody');
    const headers = Array.from(table.querySelectorAll('thead th')).map((header, index) => header.textContent.trim() || `Column ${index + 1}`);

    if (!tbody || headers.length === 0) return;

    table.dataset.tableToolsBound = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-wrap items-center gap-2 border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-700/60 dark:bg-gray-800';
    wrapper.dataset.tableTools = 'true';

    const columnSelect = document.createElement('select');
    columnSelect.className = 'form-select h-9 text-sm';
    columnSelect.innerHTML = [
      '<option value="__all__">전체 컬럼</option>',
      ...headers.map((header, index) => `<option value="${index}">${escapeOptionText(header)}</option>`),
    ].join('');

    const searchInput = document.createElement('input');
    searchInput.className = 'form-input h-9 w-full text-sm sm:w-56';
    searchInput.type = 'search';
    searchInput.placeholder = '테이블 검색';
    searchInput.setAttribute('aria-label', `테이블 ${tableIndex + 1} 검색`);

    const valueSelect = document.createElement('select');
    valueSelect.className = 'form-select h-9 max-w-56 text-sm';

    const resetButton = document.createElement('button');
    resetButton.className = 'h-9 rounded-md px-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/60';
    resetButton.type = 'button';
    resetButton.textContent = '초기화';

    const countText = document.createElement('span');
    countText.className = 'inline-flex h-9 items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900/30 dark:text-gray-400';

    wrapper.append(columnSelect, searchInput, valueSelect, resetButton, countText);

    const host = table.parentElement;
    host?.parentElement?.insertBefore(wrapper, host);

    const getRows = () => Array.from(tbody.querySelectorAll('tr'));

    const getCellText = (row, index) => {
      const cells = Array.from(row.children);
      if (index === '__all__') return cells.map((cell) => cell.textContent).join(' ');
      return cells[Number(index)]?.textContent ?? '';
    };

    const refreshValueOptions = () => {
      const selectedColumn = columnSelect.value;
      const values = selectedColumn === '__all__'
        ? []
        : Array.from(new Set(getRows().map((row) => getCellText(row, selectedColumn).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true })).slice(0, 120);

      valueSelect.innerHTML = [
        '<option value="__all__">필터 전체</option>',
        ...values.map((value) => `<option value="${escapeOptionText(value)}">${escapeOptionText(value)}</option>`),
      ].join('');
      valueSelect.disabled = selectedColumn === '__all__' || values.length === 0;
    };

    const applyFilter = () => {
      const selectedColumn = columnSelect.value;
      const query = searchInput.value.trim().toLowerCase();
      const filterValue = valueSelect.value;
      let visibleCount = 0;

      getRows().forEach((row) => {
        const rowText = getCellText(row, selectedColumn).toLowerCase();
        const filterText = selectedColumn === '__all__' ? '' : getCellText(row, selectedColumn).trim();
        const matchesQuery = query === '' || rowText.includes(query);
        const matchesValue = filterValue === '__all__' || filterText === filterValue;
        const isVisible = matchesQuery && matchesValue;

        row.hidden = !isVisible;
        if (isVisible) visibleCount += 1;
      });

      countText.textContent = `${visibleCount.toLocaleString('ko-KR')} / ${getRows().length.toLocaleString('ko-KR')}건`;
    };

    const resetTools = () => {
      columnSelect.value = '__all__';
      searchInput.value = '';
      refreshValueOptions();
      valueSelect.value = '__all__';
      applyFilter();
    };

    refreshValueOptions();
    applyFilter();

    columnSelect.addEventListener('change', () => {
      refreshValueOptions();
      applyFilter();
    });
    searchInput.addEventListener('input', applyFilter);
    valueSelect.addEventListener('change', applyFilter);
    resetButton.addEventListener('click', resetTools);

    cleanups.push(() => {
      columnSelect.removeEventListener('change', applyFilter);
      searchInput.removeEventListener('input', applyFilter);
      valueSelect.removeEventListener('change', applyFilter);
      resetButton.removeEventListener('click', resetTools);
      wrapper.remove();
      delete table.dataset.tableToolsBound;
      getRows().forEach((row) => {
        row.hidden = false;
      });
    });
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}

function PageShell({ title, description, children }) {
  const isEmbedded = useContext(EmbeddedPageShellContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contentNode, setContentNode] = useState(null);

  useEffect(() => {
    if (!contentNode) return undefined;

    const cleanups = [];
    const bindNewTables = () => {
      cleanups.push(bindTableTools(contentNode));
    };

    bindNewTables();
    const observer = new MutationObserver(() => {
      bindNewTables();
    });

    observer.observe(contentNode, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanups.forEach((cleanup) => cleanup?.());
    };
  }, [contentNode]);

  if (isEmbedded) {
    return (
      <div ref={setContentNode} className="min-w-0 p-4 sm:p-6">
        <div className="mb-5 border-b border-gray-200 pb-4 dark:border-gray-700/60">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 md:text-2xl">{title}</h1>
          {description && <p className="mt-2 max-w-4xl text-sm text-gray-600 dark:text-gray-400">{description}</p>}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[#f7faf9] dark:bg-gray-900">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div ref={setContentNode} className="w-full max-w-9xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 md:text-2xl">
                  {title}
                </h1>
                <div className="mt-2">
                  <Breadcrumbs />
                </div>
                {description && (
                  <p className="mt-3 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default PageShell;
