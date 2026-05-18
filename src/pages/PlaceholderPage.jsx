import React from 'react';

import PageShell from './PageShell';

function PlaceholderPage({ title, description }) {
  return (
    <PageShell title={title} description={description}>
      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-full xl:col-span-8 bg-white dark:bg-gray-800 shadow-xs rounded-xl border border-gray-200 dark:border-gray-700/60 p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {title}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            이 페이지의 실제 기능을 연결할 수 있도록 라우터와 기본 컴포넌트가 준비되었습니다.
          </p>
        </section>

        <section className="col-span-full xl:col-span-4 bg-white dark:bg-gray-800 shadow-xs rounded-xl border border-gray-200 dark:border-gray-700/60 p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            다음 작업
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>필요한 데이터 로딩 로직 추가</li>
            <li>폼, 테이블, 액션 버튼 배치</li>
            <li>저장/동기화 상태 연결</li>
          </ul>
        </section>
      </div>
    </PageShell>
  );
}

export default PlaceholderPage;
