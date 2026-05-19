export const menuGroups = [
  {
    title: '마감 자료',
    basePath: '/closing',
    items: [
      { label: '매출 마감 비교', path: '/closing/sales-compare', component: 'SalesClosingComparePage' },
      { label: '데이터 테이블', path: '/closing/data-table', component: 'DataTablePage' },
      { label: '코드 매핑', path: '/closing/code-mapping', component: 'CodeMappingPage' },
      { label: '중복 검사', path: '/closing/duplicate-checker', component: 'DuplicateCheckerPage' },
    ],
  },
  {
    title: '자동화',
    basePath: '/automation',
    items: [
      { label: '자동화 작업', path: '/automation/tasks', component: 'AutomationPage' },
      { label: '작업 대시보드', path: '/automation/workspace-dashboard', component: 'WorkspaceDashboardPage' },
      { label: '최근 작업', path: '/automation/recent-tasks', component: 'RecentTasksPage' },
    ],
  },
  {
    title: '보고서',
    basePath: '/reports',
    items: [
      { label: '보고서 작성', path: '/reports/generator', component: 'ReportGeneratorPage' },
      { label: '보고서 템플릿', path: '/reports/templates', component: 'ReportTemplatesPage' },
    ],
  },
  {
    title: '요청·확인',
    basePath: '/request',
    items: [
      { label: '요청 대시보드', path: '/request/dashboard', component: 'RequestDashboardPage' },
      { label: '연락처 목록', path: '/request/contacts', component: 'ContactListPage' },
      { label: '문구 템플릿', path: '/request/templates', component: 'MessageTemplatesPage' },
      { label: '발송 패키지', path: '/request/send-packages', component: 'SendPackagesPage' },
      { label: '발송 이력', path: '/request/send-history', component: 'SendHistoryPage' },
    ],
  },
  {
    title: '파일·백업',
    basePath: '/files',
    items: [
      { label: '파일 관리', path: '/files/manager', component: 'FileManagerPage' },
      { label: '로컬 백업', path: '/files/local-backup', component: 'LocalBackupPage' },
      { label: '클라우드 백업', path: '/files/cloud-backup', component: 'CloudBackupPage' },
      { label: '복원', path: '/files/restore', component: 'RestorePage' },
    ],
  },
  {
    title: '관리',
    basePath: '/admin',
    items: [
      { label: '활동 로그', path: '/admin/activity-logs', component: 'ActivityLogsPage' },
      { label: '마이페이지', path: '/admin/preferences', component: 'UserPreferencesPage' },
      { label: '저장 설정', path: '/admin/save-settings', component: 'SaveSettingsPage' },
      { label: '동기화 설정', path: '/admin/sync-settings', component: 'SyncSettingsPage' },
      { label: '보안', path: '/admin/security', component: 'SecurityPage' },
      { label: '작업 이력', path: '/admin/task-history', component: 'TaskHistoryPage' },
      { label: '시스템 상태', path: '/admin/system-status', component: 'SystemStatusPage' },
      { label: '캐시 관리', path: '/admin/cache-manager', component: 'CacheManagerPage' },
    ],
  },
];

export const legacyRedirects = [
  { path: '/project/workspace-dashboard', component: 'WorkspaceDashboardPage' },
  { path: '/project/recent-tasks', component: 'RecentTasksPage' },
  { path: '/project/file-manager', component: 'FileManagerPage' },
  { path: '/project/automation', component: 'AutomationPage' },
  { path: '/project/report-generator', component: 'ReportGeneratorPage' },
  { path: '/data/table', component: 'DataTablePage' },
  { path: '/data/code-mapping', component: 'CodeMappingPage' },
  { path: '/data/duplicate-checker', component: 'DuplicateCheckerPage' },
  { path: '/data/activity-logs', component: 'ActivityLogsPage' },
  { path: '/backup/local', component: 'LocalBackupPage' },
  { path: '/backup/cloud', component: 'CloudBackupPage' },
  { path: '/backup/restore', component: 'RestorePage' },
  { path: '/settings/preferences', component: 'UserPreferencesPage' },
  { path: '/settings/save', component: 'SaveSettingsPage' },
  { path: '/settings/sync', component: 'SyncSettingsPage' },
  { path: '/settings/security', component: 'SecurityPage' },
];

export const pageRoutes = [
  ...menuGroups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      groupTitle: group.title,
      basePath: group.basePath,
    }))
  ),
  ...legacyRedirects.map((route) => ({
    ...route,
    groupTitle: '이전 경로',
    basePath: route.path.split('/').slice(0, 2).join('/'),
  })),
];
