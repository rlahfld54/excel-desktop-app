export const menuGroups = [
  {
    title: '마감 워크스페이스',
    basePath: '/closing-workspace',
    items: [
      { label: '마감 워크스페이스', path: '/closing-workspace/overview', component: 'ClosingWorkspacePage' },
    ],
  },
  {
    title: '데이터 취합',
    basePath: '/collect',
    items: [
      { label: '엑셀 요청 양식', path: '/collect/excel-templates', component: 'ExcelTemplatesPage' },
      { label: '파일 관리', path: '/collect/file-manager', component: 'FileManagerPage' },
      { label: '원본 데이터 조회', path: '/collect/data-table', component: 'DataTablePage' },
    ],
  },
  {
    title: '기준정보/연락처',
    basePath: '/master',
    items: [
      { label: '제품·거래처 매핑', path: '/validate/code-mapping', component: 'CodeMappingPage' },
      { label: '담당자 연락처', path: '/request/contacts', component: 'ContactListPage' },
    ],
  },
  {
    title: '보고서',
    basePath: '/results',
    items: [
      { label: '보고서 작성', path: '/results/report-generator', component: 'ReportGeneratorPage' },
      { label: '보고서 템플릿', path: '/results/report-templates', component: 'ReportTemplatesPage' },
      { label: '최근 작업', path: '/results/recent-tasks', component: 'RecentTasksPage' },
    ],
  },
  {
    title: '일정관리',
    basePath: '/schedule',
    items: [
      { label: '투두·일정 기록', path: '/schedule/todos', component: 'SchedulePage' },
    ],
  },
  {
    title: '설정',
    basePath: '/settings',
    items: [
      { label: '마이페이지', path: '/settings/preferences', component: 'UserPreferencesPage' },
      { label: '저장 설정', path: '/settings/save', component: 'SaveSettingsPage', allowedRoles: ['ADMIN'] },
      { label: '동기화 설정', path: '/settings/sync', component: 'SyncSettingsPage', allowedRoles: ['ADMIN'] },
      { label: '보안', path: '/settings/security', component: 'SecurityPage', allowedRoles: ['ADMIN'] },
      { label: '백업 및 복구', path: '/settings/local-backup', component: 'LocalBackupPage' },
      { label: '클라우드 백업', path: '/settings/cloud-backup', component: 'CloudBackupPage' },
      { label: '시스템 상태', path: '/settings/system-status', component: 'SystemStatusPage', allowedRoles: ['ADMIN'] },
      { label: '캐시 관리', path: '/settings/cache-manager', component: 'CacheManagerPage', allowedRoles: ['ADMIN'] },
      { label: '활동 로그', path: '/results/activity-logs', component: 'ActivityLogsPage', allowedRoles: ['ADMIN'] },
      { label: '작업 이력', path: '/results/task-history', component: 'TaskHistoryPage', allowedRoles: ['ADMIN'] },
    ],
  },
];

export const legacyRedirects = [
  { label: '취합 대시보드', path: '/collect/workspace-dashboard', component: 'WorkspaceDashboardPage' },
  { label: '매출 마감 비교', path: '/validate/sales-compare', component: 'SalesClosingComparePage' },
  { label: '중복 검사', path: '/validate/duplicate-checker', component: 'DuplicateCheckerPage' },
  { label: '검증 자동화', path: '/validate/automation', component: 'AutomationPage' },
  { label: '요청 대시보드', path: '/request/dashboard', component: 'RequestDashboardPage' },
  { label: '요청 문구', path: '/request/templates', component: 'MessageTemplatesPage' },
  { label: '발송 패키지', path: '/request/send-packages', component: 'SendPackagesPage' },
  { label: '발송 이력', path: '/request/send-history', component: 'SendHistoryPage' },
  { label: '엑셀 첨부 양식', path: '/closing/excel-templates', component: 'ExcelTemplatesPage' },
  { label: '매출 마감 비교', path: '/closing/sales-compare', component: 'SalesClosingComparePage' },
  { label: '데이터 테이블', path: '/closing/data-table', component: 'DataTablePage' },
  { label: '코드 매핑', path: '/closing/code-mapping', component: 'CodeMappingPage' },
  { label: '중복 검사', path: '/closing/duplicate-checker', component: 'DuplicateCheckerPage' },
  { label: '자동화 작업', path: '/automation/tasks', component: 'AutomationPage' },
  { label: '작업 대시보드', path: '/automation/workspace-dashboard', component: 'WorkspaceDashboardPage' },
  { label: '최근 작업', path: '/automation/recent-tasks', component: 'RecentTasksPage' },
  { label: '보고서 작성', path: '/reports/generator', component: 'ReportGeneratorPage' },
  { label: '보고서 템플릿', path: '/reports/templates', component: 'ReportTemplatesPage' },
  { label: '파일 관리', path: '/files/manager', component: 'FileManagerPage' },
  { label: '백업 및 복구', path: '/files/local-backup', component: 'LocalBackupPage' },
  { label: '클라우드 백업', path: '/files/cloud-backup', component: 'CloudBackupPage' },
  { label: '백업 및 복구', path: '/files/restore', component: 'LocalBackupPage' },
  { label: '활동 로그', path: '/admin/activity-logs', component: 'ActivityLogsPage', allowedRoles: ['ADMIN'] },
  { label: '관리자 마이페이지', path: '/admin/preferences', component: 'AdminPreferencesPage', allowedRoles: ['ADMIN'] },
  { label: '저장 설정', path: '/admin/save-settings', component: 'SaveSettingsPage', allowedRoles: ['ADMIN'] },
  { label: '동기화 설정', path: '/admin/sync-settings', component: 'SyncSettingsPage', allowedRoles: ['ADMIN'] },
  { label: '보안', path: '/admin/security', component: 'SecurityPage', allowedRoles: ['ADMIN'] },
  { label: '작업 이력', path: '/admin/task-history', component: 'TaskHistoryPage', allowedRoles: ['ADMIN'] },
  { label: '시스템 상태', path: '/admin/system-status', component: 'SystemStatusPage', allowedRoles: ['ADMIN'] },
  { label: '캐시 관리', path: '/admin/cache-manager', component: 'CacheManagerPage', allowedRoles: ['ADMIN'] },
  { label: '작업 대시보드', path: '/project/workspace-dashboard', component: 'WorkspaceDashboardPage' },
  { label: '최근 작업', path: '/project/recent-tasks', component: 'RecentTasksPage' },
  { label: '파일 관리', path: '/project/file-manager', component: 'FileManagerPage' },
  { label: '자동화 작업', path: '/project/automation', component: 'AutomationPage' },
  { label: '보고서 작성', path: '/project/report-generator', component: 'ReportGeneratorPage' },
  { label: '데이터 테이블', path: '/data/table', component: 'DataTablePage' },
  { label: '코드 매핑', path: '/data/code-mapping', component: 'CodeMappingPage' },
  { label: '중복 검사', path: '/data/duplicate-checker', component: 'DuplicateCheckerPage' },
  { label: '활동 로그', path: '/data/activity-logs', component: 'ActivityLogsPage', allowedRoles: ['ADMIN'] },
  { label: '백업 및 복구', path: '/backup/local', component: 'LocalBackupPage' },
  { label: '클라우드 백업', path: '/backup/cloud', component: 'CloudBackupPage' },
  { label: '백업 및 복구', path: '/backup/restore', component: 'LocalBackupPage' },
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

export function canAccessRoute(route, role) {
  return !route.allowedRoles || route.allowedRoles.includes(role);
}

export function getVisibleMenuGroups(role) {
  return menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessRoute(item, role)),
    }))
    .filter((group) => group.items.length > 0);
}
