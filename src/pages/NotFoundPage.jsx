import React from 'react';
import { Link } from 'react-router-dom';

import PageShell from './PageShell';

function NotFoundPage() {
  return (
    <PageShell
      title="페이지를 찾을 수 없습니다"
      description="요청한 경로가 없거나 아직 연결되지 않은 메뉴입니다."
    >
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          사이드바 메뉴에서 다른 작업 공간으로 이동하거나 대시보드로 돌아가세요.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="btn btn-primary" to="/">
            대시보드로 이동
          </Link>
          <Link className="btn btn-secondary" to="/project/recent-tasks">
            최근 작업 보기
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

export default NotFoundPage;
