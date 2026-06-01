export const menuGroups = [
  {
    title: '자료 취합',
    basePath: '/collect',
    items: [
      { label: '취합 대시보드', path: '/collect/workspace-dashboard', component: 'WorkspaceDashboardPage' },
      { label: '엑셀 요청 양식', path: '/collect/excel-templates', component: 'ExcelTemplatesPage' },
      { label: '파일 관리', path: '/collect/file-manager', component: 'FileManagerPage' },
      { label: '취합 데이터 보기', path: '/collect/data-table', component: 'DataTablePage' },
    ],
  },
  {
    title: '데이터 검증',
    basePath: '/validate',
    items: [
      { label: '매출 마감 비교', path: '/validate/sales-compare', component: 'SalesClosingComparePage' },
      { label: '제품·거래처 매핑', path: '/validate/code-mapping', component: 'CodeMappingPage' },
      { label: '중복 검사', path: '/validate/duplicate-checker', component: 'DuplicateCheckerPage' },
      { label: '검증 자동화', path: '/validate/automation', component: 'AutomationPage' },
    ],
  },
  {
    title: '확인 요청',
    basePath: '/request',
    items: [
      { label: '요청 대시보드', path: '/request/dashboard', component: 'RequestDashboardPage' },
      { label: '담당자 연락처', path: '/request/contacts', component: 'ContactListPage' },
      { label: '요청 문구', path: '/request/templates', component: 'MessageTemplatesPage' },
      { label: '발송 패키지', path: '/request/send-packages', component: 'SendPackagesPage' },
      { label: '발송 이력', path: '/request/send-history', component: 'SendHistoryPage' },
    ],
  },
  {
    title: '결과·이력',
    basePath: '/results',
    items: [
      { label: '보고서 작성', path: '/results/report-generator', component: 'ReportGeneratorPage' },
      { label: '보고서 템플릿', path: '/results/report-templates', component: 'ReportTemplatesPage' },
      { label: '최근 작업', path: '/results/recent-tasks', component: 'RecentTasksPage' },
      { label: '활동 로그', path: '/results/activity-logs', component: 'ActivityLogsPage' },
      { label: '작업 이력', path: '/results/task-history', component: 'TaskHistoryPage' },
    ],
  },
  {
    title: '운영 설정',
    basePath: '/settings',
    items: [
      { label: '마이페이지', path: '/settings/preferences', component: 'UserPreferencesPage' },
      { label: '저장 설정', path: '/settings/save', component: 'SaveSettingsPage' },
      { label: '동기화 설정', path: '/settings/sync', component: 'SyncSettingsPage' },
      { label: '보안', path: '/settings/security', component: 'SecurityPage' },
      { label: '백업 및 복구', path: '/settings/local-backup', component: 'LocalBackupPage' },
      { label: '클라우드 백업', path: '/settings/cloud-backup', component: 'CloudBackupPage' },
      { label: '시스템 상태', path: '/settings/system-status', component: 'SystemStatusPage' },
      { label: '캐시 관리', path: '/settings/cache-manager', component: 'CacheManagerPage' },
    ],
  },
];

export const legacyRedirects = [
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
  { label: '활동 로그', path: '/admin/activity-logs', component: 'ActivityLogsPage' },
  { label: '마이페이지', path: '/admin/preferences', component: 'UserPreferencesPage' },
  { label: '저장 설정', path: '/admin/save-settings', component: 'SaveSettingsPage' },
  { label: '동기화 설정', path: '/admin/sync-settings', component: 'SyncSettingsPage' },
  { label: '보안', path: '/admin/security', component: 'SecurityPage' },
  { label: '작업 이력', path: '/admin/task-history', component: 'TaskHistoryPage' },
  { label: '시스템 상태', path: '/admin/system-status', component: 'SystemStatusPage' },
  { label: '캐시 관리', path: '/admin/cache-manager', component: 'CacheManagerPage' },
  { label: '작업 대시보드', path: '/project/workspace-dashboard', component: 'WorkspaceDashboardPage' },
  { label: '최근 작업', path: '/project/recent-tasks', component: 'RecentTasksPage' },
  { label: '파일 관리', path: '/project/file-manager', component: 'FileManagerPage' },
  { label: '자동화 작업', path: '/project/automation', component: 'AutomationPage' },
  { label: '보고서 작성', path: '/project/report-generator', component: 'ReportGeneratorPage' },
  { label: '데이터 테이블', path: '/data/table', component: 'DataTablePage' },
  { label: '코드 매핑', path: '/data/code-mapping', component: 'CodeMappingPage' },
  { label: '중복 검사', path: '/data/duplicate-checker', component: 'DuplicateCheckerPage' },
  { label: '활동 로그', path: '/data/activity-logs', component: 'ActivityLogsPage' },
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
