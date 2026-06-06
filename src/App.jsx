import React, { useEffect } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';

import './css/style.css';
import './charts/ChartjsConfig';

import Dashboard from './pages/Dashboard';
import WelcomePage from './pages/WelcomePage';
import LoginPage from './pages/LoginPage';
import WorkspaceDashboardPage from './pages/WorkspaceDashboardPage';
import RecentTasksPage from './pages/RecentTasksPage';
import FileManagerPage from './pages/FileManagerPage';
import AutomationPage from './pages/AutomationPage';
import ReportGeneratorPage from './pages/ReportGeneratorPage';
import ReportTemplatesPage from './pages/ReportTemplatesPage';
import SalesClosingComparePage from './pages/SalesClosingComparePage';
import ExcelTemplatesPage from './pages/ExcelTemplatesPage';
import DataTablePage from './pages/DataTablePage';
import CodeMappingPage from './pages/CodeMappingPage';
import DuplicateCheckerPage from './pages/DuplicateCheckerPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import LocalBackupPage from './pages/LocalBackupPage';
import CloudBackupPage from './pages/CloudBackupPage';
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
import { hasActiveSession } from './utils/authSession';
import { menuGroups, pageRoutes } from './routesConfig'; // 메뉴 라우터 모음

const routeComponents = {
  SalesClosingComparePage,
  ExcelTemplatesPage,
  WorkspaceDashboardPage,
  RecentTasksPage,
  FileManagerPage,
  AutomationPage,
  ReportGeneratorPage,
  ReportTemplatesPage,
  DataTablePage,
  CodeMappingPage,
  DuplicateCheckerPage,
  ActivityLogsPage,
  LocalBackupPage,
  CloudBackupPage,
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

function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!hasActiveSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function App() {
  // import { Routes, Route, useLocation } from 'react-router-dom';
  // useLocation()을 호출하면 아래와 같은 객체가 반환됩니다
  // pathname: 현재 페이지의 경로(예: "/products/123")
  // search: URL 뒤에 붙는 쿼리 파라미터(예: "?sort=asc")
  // state: useNavigate 등을 통해 이전 페이지에서 전달받은 커스텀 데이터
  const location = useLocation();

  //useEffect는 라이프사이클에 해당하는 함수. 렌더링될때마다 실행된다. 업데이트될때
  useEffect(() => {
    //페이지 이동 시 스크롤을 최상단으로 올리기 위해 작성됨
    document.querySelector('html').style.scrollBehavior = 'auto';
    window.scroll({ top: 0 });
    document.querySelector('html').style.scrollBehavior = '';
  }, [location.pathname]);

  //useEffect가 마운트시 딱 한번만 생성되고, 변화가 있어도 실행되지 않게 할려면
  //아래와 같이 두 번째 인자(의존성 배열)에 빈 배열 []을 전달하면 된다.
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
      <Route exact path="/" element={<WelcomePage />} />
      <Route exact path="/login" element={<LoginPage />} />
      <Route exact path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      {menuGroups.map((group) => {
        const FirstPage = routeComponents[group.items[0].component];
        return <Route key={group.basePath} exact path={group.basePath} element={<ProtectedRoute><FirstPage /></ProtectedRoute>} />;
      })}

      {pageRoutes.map((route) => {
        const PageComponent = routeComponents[route.component];
        return <Route key={route.path} exact path={route.path} element={<ProtectedRoute><PageComponent /></ProtectedRoute>} />;
      })}

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
