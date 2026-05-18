import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

import './css/style.css';
import './charts/ChartjsConfig';

import Dashboard from './pages/Dashboard';
import RecentTasksPage from './pages/RecentTasksPage';
import FileManagerPage from './pages/FileManagerPage';
import AutomationPage from './pages/AutomationPage';
import ReportGeneratorPage from './pages/ReportGeneratorPage';
import DataTablePage from './pages/DataTablePage';
import CodeMappingPage from './pages/CodeMappingPage';
import DuplicateCheckerPage from './pages/DuplicateCheckerPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import LocalBackupPage from './pages/LocalBackupPage';
import CloudBackupPage from './pages/CloudBackupPage';
import RestorePage from './pages/RestorePage';
import RequestDashboardPage from './pages/RequestDashboardPage';
import ContactListPage from './pages/ContactListPage';
import MessageTemplatesPage from './pages/MessageTemplatesPage';
import SendPackagesPage from './pages/SendPackagesPage';
import SendHistoryPage from './pages/SendHistoryPage';
import UserPreferencesPage from './pages/UserPreferencesPage';
import SaveSettingsPage from './pages/SaveSettingsPage';
import SyncSettingsPage from './pages/SyncSettingsPage';
import SecurityPage from './pages/SecurityPage';
import TaskHistoryPage from './pages/TaskHistoryPage';
import SystemStatusPage from './pages/SystemStatusPage';
import CacheManagerPage from './pages/CacheManagerPage';
import NotFoundPage from './pages/NotFoundPage';
import { menuGroups, pageRoutes } from './routesConfig';

const routeComponents = {
  RecentTasksPage,
  FileManagerPage,
  AutomationPage,
  ReportGeneratorPage,
  DataTablePage,
  CodeMappingPage,
  DuplicateCheckerPage,
  ActivityLogsPage,
  LocalBackupPage,
  CloudBackupPage,
  RestorePage,
  RequestDashboardPage,
  ContactListPage,
  MessageTemplatesPage,
  SendPackagesPage,
  SendHistoryPage,
  UserPreferencesPage,
  SaveSettingsPage,
  SyncSettingsPage,
  SecurityPage,
  TaskHistoryPage,
  SystemStatusPage,
  CacheManagerPage,
};

function App() {
  const location = useLocation();

  useEffect(() => {
    document.querySelector('html').style.scrollBehavior = 'auto';
    window.scroll({ top: 0 });
    document.querySelector('html').style.scrollBehavior = '';
  }, [location.pathname]);

  useEffect(() => {
    async function loadFiles() {
      if (!window.api?.getRecentFiles) return;

      await window.api.getRecentFiles();
    }

    loadFiles().catch(() => {
      // Electron preload APIs are optional during browser-only development.
    });
  }, []);

  return (
    <Routes>
      <Route exact path="/" element={<Dashboard />} />

      {menuGroups.map((group) => {
        const FirstPage = routeComponents[group.items[0].component];
        return <Route key={group.basePath} exact path={group.basePath} element={<FirstPage />} />;
      })}

      {pageRoutes.map((route) => {
        const PageComponent = routeComponents[route.component];
        return <Route key={route.path} exact path={route.path} element={<PageComponent />} />;
      })}

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
