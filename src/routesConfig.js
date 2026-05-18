export const menuGroups = [
  {
    title: '프로젝트',
    basePath: '/project',
    items: [
      { label: '최근 작업', path: '/project/recent-tasks', component: 'RecentTasksPage' },
      { label: '파일 관리', path: '/project/file-manager', component: 'FileManagerPage' },
      { label: '자동화 작업', path: '/project/automation', component: 'AutomationPage' },
      { label: '보고서 생성', path: '/project/report-generator', component: 'ReportGeneratorPage' },
    ],
  },
  {
    title: '데이터',
    basePath: '/data',
    items: [
      { label: '데이터 테이블', path: '/data/table', component: 'DataTablePage' },
      { label: '코드 매핑', path: '/data/code-mapping', component: 'CodeMappingPage' },
      { label: '중복 검사', path: '/data/duplicate-checker', component: 'DuplicateCheckerPage' },
      { label: '활동 로그', path: '/data/activity-logs', component: 'ActivityLogsPage' },
    ],
  },
  {
    title: '백업',
    basePath: '/backup',
    items: [
      { label: '로컬 백업', path: '/backup/local', component: 'LocalBackupPage' },
      { label: '클라우드 백업', path: '/backup/cloud', component: 'CloudBackupPage' },
      { label: '복원', path: '/backup/restore', component: 'RestorePage' },
    ],
  },
  {
    title: '설정',
    basePath: '/settings',
    items: [
      { label: '사용자 설정', path: '/settings/preferences', component: 'UserPreferencesPage' },
      { label: '저장 설정', path: '/settings/save', component: 'SaveSettingsPage' },
      { label: '동기화 설정', path: '/settings/sync', component: 'SyncSettingsPage' },
      { label: '보안', path: '/settings/security', component: 'SecurityPage' },
    ],
  },
  {
    title: '관리자',
    basePath: '/admin',
    items: [
      { label: '작업 이력', path: '/admin/task-history', component: 'TaskHistoryPage' },
      { label: '시스템 상태', path: '/admin/system-status', component: 'SystemStatusPage' },
      { label: '캐시 관리', path: '/admin/cache-manager', component: 'CacheManagerPage' },
    ],
  },
];

export const pageRoutes = menuGroups.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    groupTitle: group.title,
    basePath: group.basePath,
  }))
);
