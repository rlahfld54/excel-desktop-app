import React, { useState } from 'react';

import Sidebar from '../partials/Sidebar';
import Header from '../partials/Header';
import Breadcrumbs from '../useComponents/Breadcrumbs';

function PageShell({ title, description, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-gray-900">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="w-full max-w-9xl px-4 py-4 sm:px-6 lg:px-8">
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
