import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';

const fallbackCounts = [
  { tableName: 'products', count: 0 },
  { tableName: 'customers', count: 0 },
  { tableName: 'users', count: 0 },
  { tableName: 'sales_uploads', count: 0 },
  { tableName: 'sales', count: 0 },
  { tableName: 'validation_issues', count: 0 },
  { tableName: 'workspace_snapshots', count: 0 },
  { tableName: 'contacts', count: 0 },
  { tableName: 'message_templates', count: 0 },
  { tableName: 'email_history', count: 0 },
  { tableName: 'reports', count: 0 },
  { tableName: 'report_templates', count: 0 },
  { tableName: 'activity_logs', count: 0 },
  { tableName: 'notifications', count: 0 },
];

function statusClass(value) {
  if (value === '정상' || value === '연결됨') {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
  }

  if (value === '브라우저 모드') {
    return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
  }

  return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
}

export default function SystemStatusPage() {
  const [dbSummary, setDbSummary] = useState(null);
  const [dbError, setDbError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadDatabaseSummary() {
      if (!window.api?.getDatabaseSummary) {
        setDbSummary({
          ok: false,
          path: 'Electron 실행 시 확인 가능',
          counts: fallbackCounts,
          recentEvents: [],
        });
        return;
      }

      try {
        const summary = await window.api.getDatabaseSummary();
        if (mounted) {
          setDbSummary(summary);
          setDbError('');
        }
      } catch (error) {
        if (mounted) {
          setDbError(error.message);
          setDbSummary({
            ok: false,
            path: 'SQLite 연결 실패',
            counts: fallbackCounts,
            recentEvents: [],
          });
        }
      }
    }

    loadDatabaseSummary();
    return () => {
      mounted = false;
    };
  }, []);

  const status = dbError ? '오류' : dbSummary?.ok ? '연결됨' : '브라우저 모드';
  const totalRows = useMemo(() => (
    dbSummary?.counts?.reduce((sum, item) => sum + item.count, 0) ?? 0
  ), [dbSummary]);

  return (
    <PageShell title="시스템 상태" description="앱 성능, SQLite 저장소, 작업 큐, 백업 서비스 상태를 모니터링합니다.">
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">SQLite 상태</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{status}</p>
          <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(status)}`}>
            {status}
          </span>
        </section>
        <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">저장된 레코드</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{totalRows.toLocaleString('ko-KR')}건</p>
          <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{dbSummary?.path ?? '확인 중'}</p>
        </section>
        <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
          <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">운영 모드</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">로컬 우선</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Electron에서는 SQLite, 브라우저에서는 UI 검증 모드</p>
        </section>
      </div>

      {dbError && (
        <section className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          SQLite 연결 오류: {dbError}
        </section>
      )}

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8">
          <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">SQLite 테이블 현황</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {['테이블', '역할', '레코드'].map((column) => (
                    <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900/40 dark:text-gray-400">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(dbSummary?.counts ?? fallbackCounts).map((item) => (
                  <tr key={item.tableName} className="group">
                    <td className="border-b border-r border-gray-200 px-3 py-2 font-medium text-gray-800 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-100 dark:group-hover:bg-accent-500/10">
                      {item.tableName}
                    </td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                      {getTableRole(item.tableName)}
                    </td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                      {item.count.toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">최근 DB 이벤트</h2>
          <div className="mt-4 space-y-2">
            {(dbSummary?.recentEvents?.length ? dbSummary.recentEvents : [{ level: 'INFO', message: '아직 저장 이벤트가 없습니다.', createdAt: '-' }]).map((event, index) => (
              <div key={`${event.createdAt}-${index}`} className="rounded-md border border-gray-100 px-3 py-2 text-sm dark:border-gray-700/60">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold text-accent-700 dark:text-accent-300">{event.level}</span>
                  <span className="text-xs text-gray-400">{event.createdAt}</span>
                </div>
                <p className="text-gray-600 dark:text-gray-300">{event.message}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function getTableRole(tableName) {
  const roles = {
    customers: '거래처 기준 데이터',
    products: '제품 기준 데이터',
    users: '사용자와 부서 정보',
    sales_uploads: '업로드 파일 기록',
    sales: '매출 데이터',
    validation_issues: '행별 검증 오류',
    workspace_snapshots: '작업 스냅샷',
    email_history: '메일 발송과 상태 이력',
    reports: '보고서 작업·옵션·파일',
    report_templates: '보고서 양식',
    message_templates: '요청 문구 템플릿',
    contacts: '거래처 연락처',
    activity_logs: '로그인·감사·앱·백업 통합 기록',
    notifications: '앱 알림',
  };

  return roles[tableName] ?? '업무 데이터';
}
