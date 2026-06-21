import React, { useEffect, useState } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';

import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/noto-sans-kr/korean-400.css';
import '@fontsource/noto-sans-kr/korean-500.css';
import '@fontsource/noto-sans-kr/korean-600.css';
import '@fontsource/noto-sans-kr/korean-700.css';
import './css/style.css';
import './charts/ChartjsConfig';

import Dashboard from './pages/Dashboard';
import WelcomePage from './pages/WelcomePage';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import SignupPage from './pages/SignupPage';
import RecentTasksPage from './pages/RecentTasksPage';
import FileManagerPage from './pages/FileManagerPage';
import ExecutiveReportDashboardPage from './pages/ExecutiveReportDashboardPage';
import ReportGeneratorPage from './pages/ReportGeneratorPage';
import ReportTemplatesPage from './pages/ReportTemplatesPage';
import ClosingSendQueuePage from './pages/ClosingSendQueuePage';
import ClosingWorkspacePage from './pages/ClosingWorkspacePage';
import UploadValidationPage from './pages/UploadValidationPage';
import DataTablePage from './pages/DataTablePage';
import CodeMappingPage from './pages/CodeMappingPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import LocalBackupPage from './pages/LocalBackupPage';
import CloudBackupPage from './pages/CloudBackupPage';
import ContactListPage from './pages/ContactListPage';
import UserPreferencesPage from './pages/UserPreferencesPage';
import SchedulePage from './pages/SchedulePage';
import SaveSettingsPage from './pages/SaveSettingsPage';
import SyncSettingsPage from './pages/SyncSettingsPage';
import SecurityPage from './pages/SecurityPage';
import TaskHistoryPage from './pages/TaskHistoryPage';
import SystemStatusPage from './pages/SystemStatusPage';
import CacheManagerPage from './pages/CacheManagerPage';
import NotFoundPage from './pages/NotFoundPage';
import { getCurrentUser, hasActiveSession } from './utils/authSession';
import { saveUsers } from './utils/authSession';
import { getSession } from './utils/authSession';
import { hydratePersonalTodos } from './utils/todoSchedule';
import { menuGroups, pageRoutes } from './routesConfig'; // 메뉴 라우터 모음

const routeComponents = {
  ExecutiveReportDashboardPage,
  ClosingSendQueuePage,
  ClosingWorkspacePage,
  UploadValidationPage,
  RecentTasksPage,
  FileManagerPage,
  ReportGeneratorPage,
  ReportTemplatesPage,
  DataTablePage,
  CodeMappingPage,
  ActivityLogsPage,
  LocalBackupPage,
  CloudBackupPage,
  ContactListPage,
  UserPreferencesPage,
  SchedulePage,
  SaveSettingsPage,
  SyncSettingsPage,
  SecurityPage,
  TaskHistoryPage,
  SystemStatusPage,
  CacheManagerPage,
};

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();

  if (!hasActiveSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !allowedRoles.includes(getCurrentUser().role)) {
    return <Navigate to="/dashboard" replace />;
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
  const [setupState, setSetupState] = useState({
    loading: Boolean(window.api?.getSetupStatus),
    completed: !window.api?.getSetupStatus,
  });

  useEffect(() => {
    let mounted = true;
    const refreshSetupStatus = async () => {
      if (!window.api?.getSetupStatus) return;
      try {
        const result = await window.api.getSetupStatus();
        const usersResult = await window.api.listUsers?.();
        if (usersResult?.ok) saveUsers(usersResult.users ?? []);
        const session = getSession();
        if (session?.userId) await hydratePersonalTodos(session.userId);
        if (mounted) setSetupState({ loading: false, completed: Boolean(result.completed) });
      } catch {
        if (mounted) setSetupState({ loading: false, completed: false });
      }
    };
    const handleCompleted = () => setSetupState({ loading: false, completed: true });
    refreshSetupStatus();
    window.addEventListener('excel-workspace:setup-completed', handleCompleted);
    return () => {
      mounted = false;
      window.removeEventListener('excel-workspace:setup-completed', handleCompleted);
    };
  }, []);

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

  if (setupState.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-200">
        <p className="text-sm font-semibold">이 PC의 초기 설정을 확인하고 있습니다…</p>
      </main>
    );
  }

  if (!setupState.completed && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  return (
    <Routes>
      <Route exact path="/" element={<WelcomePage />} />
      <Route exact path="/setup" element={<SetupPage />} />
      <Route exact path="/login" element={<LoginPage />} />
      <Route exact path="/signup" element={<SignupPage />} />
      <Route exact path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      {menuGroups.map((group) => {
        const FirstPage = routeComponents[group.items[0].component];
        return <Route key={group.basePath} exact path={group.basePath} element={<ProtectedRoute><FirstPage /></ProtectedRoute>} />;
      })}

      {pageRoutes.map((route) => {
        const PageComponent = routeComponents[route.component];
        return <Route key={route.path} exact path={route.path} element={<ProtectedRoute allowedRoles={route.allowedRoles}><PageComponent /></ProtectedRoute>} />;
      })}

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
