export const menuGroups = [
  {
    title: "마감 워크스페이스",
    basePath: "/closing-workspace",
    items: [
      {
        label: "마감 워크스페이스",
        path: "/closing-workspace/overview",
        component: "ClosingWorkspacePage",
      },
      {
        label: "발송 큐",
        path: "/closing-workspace/send-queue",
        component: "ClosingSendQueuePage",
      },
    ],
  },
  {
    title: "데이터 취합",
    basePath: "/collect",
    items: [
      {
        label: "업로드 전 검증",
        path: "/collect/upload-validation",
        component: "UploadValidationPage",
      },
      {
        label: "원본 데이터 조회",
        path: "/collect/data-table",
        component: "DataTablePage",
      },
    ],
  },
  {
    title: "기준정보/연락처",
    basePath: "/master",
    items: [
      {
        label: "제품·거래처 매핑",
        path: "/validate/code-mapping",
        component: "CodeMappingPage",
      },
      {
        label: "담당자 연락처",
        path: "/request/contacts",
        component: "ContactListPage",
      },
    ],
  },
  {
    title: "보고서",
    basePath: "/results",
    items: [
      {
        label: "보고서 작성",
        path: "/results/report-generator",
        component: "ReportGeneratorPage",
      },
      {
        label: "보고서 템플릿",
        path: "/results/report-templates",
        component: "ReportTemplatesPage",
      },
      {
        label: "사장님 보고",
        path: "/results/executive-dashboard",
        component: "ExecutiveReportDashboardPage",
      },
    ],
  },
  {
    title: "일정관리",
    basePath: "/schedule",
    items: [
      {
        label: "투두·일정 기록",
        path: "/schedule/todos",
        component: "SchedulePage",
      },
    ],
  },
  {
    title: "설정",
    basePath: "/settings",
    items: [
      {
        label: "마이페이지",
        path: "/settings/preferences",
        component: "UserPreferencesPage",
      },
      {
        label: "저장 설정",
        path: "/settings/save",
        component: "SaveSettingsPage",
        allowedRoles: ["ADMIN"],
      },
      {
        label: "파일 관리",
        path: "/settings/file-manager",
        component: "FileManagerPage",
      },
      {
        label: "최근 작업",
        path: "/settings/recent-tasks",
        component: "RecentTasksPage",
      },
      {
        label: "동기화 설정",
        path: "/settings/sync",
        component: "SyncSettingsPage",
        allowedRoles: ["ADMIN"],
      },
      {
        label: "보안",
        path: "/settings/security",
        component: "SecurityPage",
        allowedRoles: ["ADMIN"],
      },
      {
        label: "백업 및 복구",
        path: "/settings/local-backup",
        component: "LocalBackupPage",
      },
      {
        label: "클라우드 백업",
        path: "/settings/cloud-backup",
        component: "CloudBackupPage",
      },
      {
        label: "시스템 상태",
        path: "/settings/system-status",
        component: "SystemStatusPage",
        allowedRoles: ["ADMIN"],
      },
      {
        label: "캐시 관리",
        path: "/settings/cache-manager",
        component: "CacheManagerPage",
        allowedRoles: ["ADMIN"],
      },
      {
        label: "활동 로그",
        path: "/results/activity-logs",
        component: "ActivityLogsPage",
        allowedRoles: ["ADMIN"],
      },
      {
        label: "작업 이력",
        path: "/results/task-history",
        component: "TaskHistoryPage",
        allowedRoles: ["ADMIN"],
      },
    ],
  },
];

export const pageRoutes = [
  ...menuGroups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      groupTitle: group.title,
      basePath: group.basePath,
    })),
  ),
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
