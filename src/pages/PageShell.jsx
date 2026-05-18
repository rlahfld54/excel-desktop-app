import React, { useState } from 'react';
//공통 페이지 레이아웃 추가
import Sidebar from '../partials/Sidebar';
import Header from '../partials/Header';
import Banner from '../partials/Banner';
import Breadcrumbs from '../useComponents/Breadcrumbs';

function PageShell({ title, description, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                {title}
              </h1>
              <div className="mt-2">
                <Breadcrumbs />
              </div>
              {description && (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>

            {children}
          </div>
        </main>

        <Banner />
      </div>
    </div>
  );
}

export default PageShell;
