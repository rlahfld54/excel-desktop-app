import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';
import { DateRangeFields, FormField } from '../components/common';
import { getCurrentUser } from '../utils/authSession';
import { getCurrentMonthRange } from '../utils/dataFormat';
import { validateDateRange, validateSearchLength } from '../utils/queryValidation';

const sqlColumns = [
  '거래일',
  '거래처',
  '품목 코드',
  '품목명',
  '수량',
  '단가',
  '금액',
  '검증',
  '담당자',
];

function statusClass(status) {
  if (status === '정상' || status === '승인 완료') {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
  }
  if (status === '확인 필요') {
    return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
  }
  if (status === '반려') {
    return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200';
}


function getStatusIndex(columns) {
  return columns.findIndex((column) => ['검증', '상태', '결과'].includes(column));
}

function getDateIndex(columns) {
  return columns.findIndex((column) => ['거래일', '일자', '날짜', '마감일'].includes(column));
}

function getColumnIndex(columns, aliases) {
  return columns.findIndex((column) => aliases.includes(column));
}

function validateQueryParams(params) {
  const errors = validateDateRange(params);
  const customerError = validateSearchLength(params.customer, '거래처');
  const productError = validateSearchLength(params.product, '품목');
  if (customerError) errors.customer = customerError;
  if (productError) errors.product = productError;

  return errors;
}

export default function DataTablePage() {
  const currentUser = getCurrentUser();
  const [columns, setColumns] = useState(sqlColumns);
  const [rows, setRows] = useState([]);
  const [params, setParams] = useState(() => ({
    ...getCurrentMonthRange(),
    status: '전체',
    customer: '',
    product: '',
    owner: currentUser.name || currentUser.id || '전체',
    pageSize: 50,
  }));
  const [page, setPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [serverTotal, setServerTotal] = useState(0);
  const [queryMessage, setQueryMessage] = useState('');
  const [queryAction, setQueryAction] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [sortConfig, setSortConfig] = useState({
    column: '거래일',
    direction: 'desc',
  });

  const statusIndex = getStatusIndex(columns);
  const dateIndex = getDateIndex(columns);
  const customerIndex = getColumnIndex(columns, ['거래처', '거래처명', '고객명']);
  const productCodeIndex = getColumnIndex(columns, ['품목 코드', '품목코드', '상품코드', '제품코드']);
  const productNameIndex = getColumnIndex(columns, ['품목명', '상품명', '제품명']);
  const ownerIndex = getColumnIndex(columns, ['담당자', '담당자명', '소유자']);
  const [serverOwnerOptions, setServerOwnerOptions] = useState(() => (
    [currentUser.name || currentUser.id].filter(Boolean)
  ));

  useEffect(() => {
    let active = true;
    if (!window.api?.listUsers) return undefined;

    window.api.listUsers()
      .then((result) => {
        if (!active) return;
        const owners = (result?.users ?? [])
          .filter((user) => (
            user.status === 'ACTIVE'
            && (currentUser.role === 'ADMIN' || user.id === currentUser.id)
          ))
          .map((user) => user.name || user.id)
          .filter(Boolean);
        setServerOwnerOptions(Array.from(new Set(owners)));
      })
      .catch(() => {
        // Keep the current logged-in user when the SQLite user list is unavailable.
      });

    return () => {
      active = false;
    };
  }, [currentUser.id, currentUser.role]);

  const filteredRows = useMemo(() => {
    const customerQuery = params.customer.trim().toLowerCase();
    const productQuery = params.product.trim().toLowerCase();

    return rows.map((row, rowIndex) => ({ row, rowIndex })).filter(({ row }) => {
        const rowDate = dateIndex >= 0 ? String(row[dateIndex] ?? '').slice(0, 10) : '';
        const matchesDate = dateIndex < 0
          || ((!params.startDate || rowDate >= params.startDate) && (!params.endDate || rowDate <= params.endDate));
        const customerValue = customerIndex >= 0 ? String(row[customerIndex] ?? '').toLowerCase() : '';
        const productValue = [productCodeIndex, productNameIndex]
          .filter((index) => index >= 0)
          .map((index) => String(row[index] ?? '').toLowerCase())
          .join(' ');
        const ownerValue = ownerIndex >= 0 ? String(row[ownerIndex] ?? '') : '';
        const matchesCustomer = customerQuery === '' || customerValue.includes(customerQuery);
        const matchesProduct = productQuery === '' || productValue.includes(productQuery);
        const matchesOwner = params.owner === '전체' || ownerValue === params.owner;
        const rowStatus = statusIndex >= 0 ? row[statusIndex] : '';
        const matchesStatus = params.status === '전체' || rowStatus === params.status;
        return matchesDate && matchesCustomer && matchesProduct && matchesOwner && matchesStatus;
      });
  }, [customerIndex, dateIndex, ownerIndex, params.customer, params.endDate, params.owner, params.product, params.startDate, params.status, productCodeIndex, productNameIndex, rows, statusIndex]);

  const statusOptions = useMemo(() => {
    const detected = statusIndex >= 0 ? rows.map((row) => row[statusIndex]).filter(Boolean) : [];
    return ['전체', ...Array.from(new Set([...detected, '정상', '확인 필요', '반려', '승인 완료']))];
  }, [rows, statusIndex]);
  const ownerOptions = useMemo(() => {
    return currentUser.role === 'ADMIN'
      ? ['전체', ...serverOwnerOptions]
      : serverOwnerOptions;
  }, [currentUser.role, serverOwnerOptions]);
  const isSqlQueryMode = Boolean(window.api?.querySalesData);
  const sqlRows = useMemo(() => rows.map((row, rowIndex) => ({ row, rowIndex })), [rows]);
  const sortedRows = useMemo(() => {
    const sourceRows = isSqlQueryMode ? sqlRows : filteredRows;
    const sortIndex = columns.indexOf(sortConfig.column);
    if (sortIndex < 0) return sourceRows;

    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    return [...sourceRows].sort((a, b) => {
      const primaryCompare = String(a.row[sortIndex] ?? '').localeCompare(
        String(b.row[sortIndex] ?? ''),
        'ko-KR',
        { numeric: true },
      );
      if (primaryCompare !== 0) return primaryCompare * direction;

      if (sortConfig.column === '거래일' && customerIndex >= 0) {
        const customerCompare = String(a.row[customerIndex] ?? '').localeCompare(
          String(b.row[customerIndex] ?? ''),
          'ko-KR',
          { numeric: true },
        );
        if (customerCompare !== 0) return customerCompare * direction;
      }

      return (a.rowIndex - b.rowIndex) * direction;
    });
  }, [columns, customerIndex, filteredRows, isSqlQueryMode, sortConfig, sqlRows]);
  const totalRows = isSqlQueryMode ? serverTotal : filteredRows.length;
  const totalPages = Math.max(Math.ceil(totalRows / params.pageSize), 1);
  const visibleRows = isSqlQueryMode
    ? sortedRows
    : sortedRows.slice((page - 1) * params.pageSize, page * params.pageSize);

  const updateParams = (nextValues) => {
    setParams((current) => ({
      ...current,
      ...nextValues,
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      Object.keys(nextValues).forEach((key) => {
        delete next[key];
      });
      return next;
    });
    setPage(1);
  };

  const fetchPage = async (targetPage, action = 'page') => {
    const errors = validateQueryParams(params);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setQueryMessage('조회 조건을 확인해 주세요.');
      return;
    }
    setFieldErrors({});

    const nextPage = Math.min(Math.max(targetPage, 1), totalPages);
    const searchParams = {
      ...params,
      page: nextPage,
    };

    if (window.api?.querySalesData) {
      setQueryAction(action);
      if (action === 'search') setQueryMessage('');
      try {
        const result = await window.api.querySalesData(searchParams);
        const data = result?.data;
        if (result?.ok && Array.isArray(data?.rows)) {
          setColumns(Array.isArray(data.columns) && data.columns.length > 0 ? data.columns : sqlColumns);
          setRows(data.rows);
          setServerTotal(Number(data.total) || 0);
          setPage(Number(data.page) || nextPage);
          setSelectedIndex(0);
          setQueryMessage(Number(data.total) > 0
            ? `${Number(data.total).toLocaleString('ko-KR')}건을 SQLite에서 조회했습니다.`
            : '선택한 조건에 해당하는 매출 데이터가 없습니다.');
          return;
        }
      } catch (error) {
        setRows([]);
        setServerTotal(0);
        setQueryMessage(`SQLite 조회 실패: ${error.message}`);
        return;
      } finally {
        setQueryAction('');
      }
    }

    setRows([]);
    setServerTotal(0);
    setQueryMessage('설치된 Electron 앱에서 SQLite 조회를 사용할 수 있습니다.');
    setPage(nextPage);
  };

  const handleSearch = () => fetchPage(1, 'search');
  const handlePrevPage = () => fetchPage(page - 1, 'page');
  const handleNextPage = () => fetchPage(page + 1, 'page');
  const handleSort = (column) => {
    setSortConfig((current) => ({
      column,
      direction: current.column === column && current.direction === 'desc' ? 'asc' : 'desc',
    }));
    setPage(1);
  };

  return (
    <PageShell title="원본 데이터 조회" description="업로드한 원본 데이터를 조회하고, 반려 항목이 없는 데이터만 SQL에 저장합니다.">
      <div className="flex h-[calc(100vh-14rem)] flex-col">
      <section className="mb-3 shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[136px_136px_minmax(170px,1fr)_minmax(170px,1fr)_150px_auto] xl:items-end">
          <DateRangeFields
            startDate={params.startDate}
            endDate={params.endDate}
            errors={fieldErrors}
            onStartDateChange={(value) => updateParams({ startDate: value })}
            onEndDateChange={(value) => updateParams({ endDate: value })}
          />
          <FormField label="거래처" error={fieldErrors.customer}>
            <input
              className={`form-input w-full ${fieldErrors.customer ? 'border-rose-400 focus:border-rose-500' : ''}`}
              placeholder="거래처명 검색"
              type="search"
              maxLength={100}
              value={params.customer}
              aria-invalid={Boolean(fieldErrors.customer)}
              onChange={(event) => updateParams({ customer: event.target.value })}
            />
          </FormField>
          <FormField label="품목" error={fieldErrors.product}>
            <input
              className={`form-input w-full ${fieldErrors.product ? 'border-rose-400 focus:border-rose-500' : ''}`}
              placeholder="품목 코드 또는 품목명"
              type="search"
              maxLength={100}
              value={params.product}
              aria-invalid={Boolean(fieldErrors.product)}
              onChange={(event) => updateParams({ product: event.target.value })}
            />
          </FormField>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">담당자</span>
            <select className="form-select w-full" value={params.owner} onChange={(event) => updateParams({ owner: event.target.value })}>
              {ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button className="btn btn-primary w-full whitespace-nowrap" type="button" disabled={Boolean(queryAction)} onClick={handleSearch}>
              {queryAction === 'search' ? '조회 중…' : '조회'}
            </button>
          </div>
        </div>
        {queryMessage && (
          <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">{queryMessage}</p>
        )}
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800" data-table-tools="false">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-gray-100">원본 데이터</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {totalRows.toLocaleString('ko-KR')}건 중 {visibleRows.length.toLocaleString('ko-KR')}건 표시
            </p>
          </div>
          {totalRows > params.pageSize && (
            <div className="flex items-center gap-2">
              <button className="btn btn-secondary h-8 px-3 text-xs" type="button" disabled={page <= 1 || queryAction === 'page'} onClick={handlePrevPage}>이전</button>
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{page} / {totalPages}</span>
              <button className="btn btn-secondary h-8 px-3 text-xs" type="button" disabled={page >= totalPages || queryAction === 'page'} onClick={handleNextPage}>다음</button>
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-auto no-scrollbar">
          <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-14 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">#</th>
                {columns.map((column) => {
                  const isSorted = sortConfig.column === column;
                  return (
                    <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">
                      <button
                        className={`flex w-full items-center justify-between gap-2 text-left hover:text-accent-700 dark:hover:text-accent-300 ${isSorted ? 'text-accent-700 dark:text-accent-300' : ''}`}
                        type="button"
                        onClick={() => handleSort(column)}
                        title={`${column} 정렬`}
                      >
                        <span>{column}</span>
                        <span className="text-[10px]" aria-hidden="true">
                          {isSorted ? (sortConfig.direction === 'desc' ? '▼' : '▲') : '↕'}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ row, rowIndex }) => {
                const selected = rowIndex === selectedIndex;
                return (
                  <tr key={`${rowIndex}-${row.join('|')}`} className={`group cursor-pointer ${selected ? 'bg-accent-50/70 dark:bg-accent-500/10' : ''}`} onClick={() => setSelectedIndex(rowIndex)}>
                    <td className="border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs text-gray-400 dark:border-gray-700/60 dark:bg-gray-900/30">{rowIndex + 1}</td>
                    {columns.map((column, cellIndex) => {
                      const cell = row[cellIndex] ?? '';
                      return (
                        <td key={`${rowIndex}-${column}`} className="h-8 max-w-64 truncate border-b border-r border-gray-200 px-3 py-1.5 text-gray-700 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-200 dark:group-hover:bg-accent-500/10" title={cell}>
                          {cellIndex === statusIndex ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(cell)}`}>{cell}</span> : cell}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </PageShell>
  );
}
