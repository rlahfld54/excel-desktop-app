import React, { useEffect, useMemo, useState } from 'react';

import PageShell, { EmbeddedPageShellProvider } from './PageShell';
import UserPreferencesPage from './UserPreferencesPage';
import SecurityPage from './SecurityPage';
import SaveSettingsPage from './SaveSettingsPage';
import FileManagerPage from './FileManagerPage';
import LocalBackupPage from './LocalBackupPage';
import ActivityLogsPage from './ActivityLogsPage';
import SystemStatusPage from './SystemStatusPage';
import CacheManagerPage from './CacheManagerPage';
import TaskHistoryPage from './TaskHistoryPage';
import CloudMigrationPage from './CloudMigrationPage';
import { getCurrentUser } from '../utils/authSession';

const hubConfigs = {
  account: {
    title: '내 계정',
    description: '개인정보와 로그인 보안을 필요한 항목만 열어 관리합니다.',
    eyebrow: 'PERSONAL SETTINGS',
    cards: [
      {
        key: 'profile',
        title: '개인정보 및 메일 명함',
        description: '이름, 부서, 직급, 연락처와 메일 발송 시 표시되는 명함을 수정합니다.',
        detail: '개인정보',
        Component: UserPreferencesPage,
      },
      {
        key: 'security',
        title: '로그인 및 보안',
        description: '비밀번호, 자동 로그인, 로그아웃과 회원 탈퇴를 관리합니다.',
        detail: '계정 보안',
        Component: SecurityPage,
      },
    ],
  },
  storage: {
    title: '저장 및 백업',
    description: '로컬 SQLite와 업무 파일, 백업, AWS 연결을 한 흐름에서 관리합니다.',
    eyebrow: 'STORAGE & BACKUP',
    cards: [
      {
        key: 'backup',
        title: '백업 및 복구',
        description: '현재 SQLite 데이터를 백업하고 필요한 시점의 데이터로 복구합니다.',
        detail: '가장 자주 사용',
        Component: LocalBackupPage,
      },
      {
        key: 'files',
        title: '업무 폴더 관리',
        description: '보고서, 요청, 내보내기 폴더 구조를 확인하고 실제 폴더를 생성합니다.',
        detail: '로컬 파일',
        Component: FileManagerPage,
      },
      {
        key: 'paths',
        title: '저장 경로 및 AWS 연결',
        description: 'SQLite, 내보내기, ProgramData 백업 경로와 AWS 데이터 연결 및 보관 정책을 설정합니다.',
        detail: '관리자 설정',
        adminOnly: true,
        Component: SaveSettingsPage,
      },
      {
        key: 'cloud-migration',
        title: 'AWS 기존 데이터 이관',
        description: '이 PC SQLite의 고객, 제품, 업로드, 매출, 연락처를 AWS RDS로 복사합니다.',
        detail: 'AWS RDS',
        Component: CloudMigrationPage,
      },
    ],
  },
  users: {
    title: '사용자 관리',
    description: '사용자 계정과 권한, 부서, 상태 및 활동 기록을 관리합니다.',
    eyebrow: 'USER ADMINISTRATION',
    cards: [
      {
        key: 'accounts',
        title: '사용자 계정 및 활동',
        description: '계정 정보와 권한을 수정하고 탈퇴 처리하거나 사용자별 활동 기록을 확인합니다.',
        detail: '관리자 전용',
        adminOnly: true,
        Component: ActivityLogsPage,
      },
    ],
  },
  system: {
    title: '시스템 관리',
    description: '앱과 SQLite 상태를 점검하고 캐시와 작업 기록을 관리합니다.',
    eyebrow: 'SYSTEM ADMINISTRATION',
    cards: [
      {
        key: 'status',
        title: '시스템 상태',
        description: 'SQLite 테이블, 앱 저장소, 백업 서비스와 최근 DB 이벤트를 확인합니다.',
        detail: '상태 점검',
        adminOnly: true,
        Component: SystemStatusPage,
      },
      {
        key: 'cache',
        title: '캐시 관리',
        description: '임시 파일과 보조 데이터를 정리하고 필요한 경우 인덱스를 다시 만듭니다.',
        detail: '공간 정리',
        adminOnly: true,
        Component: CacheManagerPage,
      },
      {
        key: 'history',
        title: '작업 이력',
        description: '사용자와 시스템이 수행한 작업 결과 및 실패 기록을 확인합니다.',
        detail: '감사 기록',
        adminOnly: true,
        Component: TaskHistoryPage,
      },
    ],
  },
};

function SettingsModal({ card, onClose }) {
  useEffect(() => {
    if (!card) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [card, onClose]);

  if (!card) return null;
  const DetailPage = card.Component;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/60 p-3 backdrop-blur-[2px] sm:p-6" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="flex max-h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-[#f7faf9] shadow-2xl dark:border-gray-700 dark:bg-gray-900" role="dialog" aria-modal="true" aria-label={card.title}>
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700/60 dark:bg-gray-800">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-600 dark:text-accent-300">설정 수정</p>
            <h2 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">{card.title}</h2>
          </div>
          <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 text-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700" type="button" onClick={onClose} aria-label="설정 창 닫기">
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmbeddedPageShellProvider>
            <DetailPage />
          </EmbeddedPageShellProvider>
        </div>
      </section>
    </div>
  );
}

export default function SettingsHubPage({ section }) {
  const config = hubConfigs[section] ?? hubConfigs.account;
  const currentUser = getCurrentUser();
  const [selectedCard, setSelectedCard] = useState(null);
  const cards = useMemo(
    () => config.cards.filter((card) => !card.adminOnly || currentUser.role === 'ADMIN'),
    [config.cards, currentUser.role],
  );

  return (
    <PageShell title={config.title} description={config.description}>
      <section className="mb-5 rounded-xl border border-accent-200 bg-gradient-to-r from-accent-50 to-white px-5 py-5 shadow-xs dark:border-accent-500/30 dark:from-accent-500/10 dark:to-gray-800">
        <p className="text-xs font-bold tracking-[0.18em] text-accent-600 dark:text-accent-300">{config.eyebrow}</p>
        <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">필요한 항목을 선택해 설정하세요</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">각 기능은 별도의 큰 창에서 열리며, 저장하거나 작업을 마친 뒤 닫으면 이 화면으로 돌아옵니다.</p>
      </section>

      <div className={`grid gap-4 ${cards.length === 1 ? 'max-w-3xl' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
        {cards.map((card, index) => (
          <button
            key={card.key}
            className="group flex min-h-52 flex-col rounded-xl border border-gray-200 bg-white p-5 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-md dark:border-gray-700/60 dark:bg-gray-800 dark:hover:border-accent-500/50"
            type="button"
            onClick={() => setSelectedCard(card)}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-sm font-black text-accent-700 transition group-hover:bg-accent-600 group-hover:text-white dark:bg-accent-500/10 dark:text-accent-300">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="mt-5 text-lg font-bold text-gray-900 dark:text-gray-100">{card.title}</span>
            <span className="mt-2 grow text-sm leading-6 text-gray-500 dark:text-gray-400">{card.description}</span>
            <span className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-xs font-semibold text-gray-400 dark:border-gray-700/60 dark:text-gray-500">
              <span>{card.detail}</span>
              <span className="text-accent-600 group-hover:translate-x-1 dark:text-accent-300">설정 열기 →</span>
            </span>
          </button>
        ))}
      </div>

      <SettingsModal card={selectedCard} onClose={() => setSelectedCard(null)} />
    </PageShell>
  );
}

export function AccountSettingsHubPage() {
  return <SettingsHubPage section="account" />;
}

export function StorageSettingsHubPage() {
  return <SettingsHubPage section="storage" />;
}

export function UserSettingsHubPage() {
  return <SettingsHubPage section="users" />;
}

export function SystemSettingsHubPage() {
  return <SettingsHubPage section="system" />;
}
