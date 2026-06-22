import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageShell from './PageShell';
import { getCurrentUser } from '../utils/authSession';

const emptyState = {
  contacts: [],
  templates: [],
  packages: [],
};

function MetricCard({ label, value, detail, tone = 'default' }) {
  const toneClass = tone === 'warning'
    ? 'border-yellow-200 bg-yellow-50/70 dark:border-yellow-500/30 dark:bg-yellow-500/10'
    : 'border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-800';

  return (
    <section className={`rounded-lg border px-4 py-3 shadow-xs ${toneClass}`}>
      <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </section>
  );
}

function StepCard({ index, title, detail, status, to }) {
  return (
    <Link
      className="group rounded-lg border border-gray-200 bg-white p-4 shadow-xs transition hover:border-accent-200 hover:bg-accent-50/70 dark:border-gray-700/60 dark:bg-gray-800 dark:hover:border-accent-500/40 dark:hover:bg-accent-500/10"
      to={to}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-600 text-sm font-semibold text-white">
          {index}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 group-hover:bg-white dark:bg-gray-700 dark:text-gray-300 dark:group-hover:bg-gray-800">
              {status}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{detail}</p>
        </div>
      </div>
    </Link>
  );
}

export default function RequestDashboardPage() {
  const currentUser = getCurrentUser();
  const [requestState, setRequestState] = useState(emptyState);
  const [loadState, setLoadState] = useState('SQLite 연결 확인 중');

  const loadRequestState = async () => {
    if (!window.api?.getMasterData || !window.api?.getMessageTemplates || !window.api?.getSendPackages) {
      setRequestState(emptyState);
      setLoadState('SQLite 조회는 Electron 데스크톱 앱에서만 사용할 수 있습니다.');
      return;
    }

    try {
      const [masterData, templateData, packageData] = await Promise.all([
        window.api.getMasterData(),
        window.api.getMessageTemplates(),
        window.api.getSendPackages({
          createdBy: currentUser.id,
          isAdmin: currentUser.role === 'ADMIN',
        }),
      ]);

      setRequestState({
        contacts: masterData.contacts ?? [],
        templates: templateData.templates ?? [],
        packages: packageData.packages ?? [],
      });
      setLoadState('SQLite 연결됨');
    } catch (error) {
      setRequestState(emptyState);
      setLoadState(`SQLite 확인 필요: ${error.message}`);
    }
  };

  useEffect(() => {
    loadRequestState();
  }, []);

  const summary = useMemo(() => {
    const contactCount = requestState.contacts.length;
    const emailCount = requestState.contacts.filter((contact) => contact.preferredChannel === 'EMAIL').length;
    const templateCount = requestState.templates.filter((template) => template.status === 'ACTIVE').length;
    const packageCount = requestState.packages.length;
    const packageItemCount = requestState.packages.reduce((sum, item) => sum + (item.itemCount ?? 0), 0);
    const missingEmailCount = requestState.packages.reduce((sum, item) => sum + (item.missingEmailCount ?? 0), 0);

    return {
      contactCount,
      emailCount,
      templateCount,
      packageCount,
      packageItemCount,
      missingEmailCount,
    };
  }, [requestState]);

  const recentPackage = requestState.packages[0];

  return (
    <PageShell title="요청 대시보드" description="거래처 확인 요청을 보내기 전 연락처, 문구, 발송 패키지 준비 상태를 한 번에 점검합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Request center</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{loadState}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">현재는 직접 발송 전 준비와 확인을 담당하는 단계입니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={loadRequestState}>
              새로고침
            </button>
            <Link className="btn btn-secondary" to="/request/templates">
              문구 확인
            </Link>
            <Link className="btn btn-primary" to="/request/send-packages">
              패키지 준비
            </Link>
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="연락처" value={`${summary.contactCount.toLocaleString('ko-KR')}건`} detail={`이메일 대상 ${summary.emailCount.toLocaleString('ko-KR')}건`} />
        <MetricCard label="문구 템플릿" value={`${summary.templateCount.toLocaleString('ko-KR')}개`} detail="활성 요청 문구" />
        <MetricCard label="발송 패키지" value={`${summary.packageCount.toLocaleString('ko-KR')}건`} detail={`대상 항목 ${summary.packageItemCount.toLocaleString('ko-KR')}건`} />
        <MetricCard label="확인 필요" value={`${summary.missingEmailCount.toLocaleString('ko-KR')}건`} detail="패키지 내 이메일 누락" tone={summary.missingEmailCount > 0 ? 'warning' : 'default'} />
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 grid gap-3 xl:col-span-7">
          <StepCard
            index="1"
            title="연락처 정리"
            detail="거래처별 수신자, 부서, 선호 채널을 먼저 확인합니다."
            status={`${summary.contactCount.toLocaleString('ko-KR')}건`}
            to="/request/contacts"
          />
          <StepCard
            index="2"
            title="요청 문구 점검"
            detail="협조 요청, 재확인 요청, 완료 안내 문구를 확인하고 변수 적용 결과를 검토합니다."
            status={`${summary.templateCount.toLocaleString('ko-KR')}개`}
            to="/request/templates"
          />
          <StepCard
            index="3"
            title="발송 패키지 준비"
            detail="거래처별 PDF/XLSX 첨부와 제목, 본문, 수신자 목록을 하나의 묶음으로 준비합니다."
            status={`${summary.packageItemCount.toLocaleString('ko-KR')}건`}
            to="/request/send-packages"
          />
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">최근 패키지</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{recentPackage?.packageName ?? '준비된 패키지 없음'}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{recentPackage?.closingMonth ?? '-'}</p>
            </div>
            <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
              {recentPackage?.status ?? 'EMPTY'}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">대상</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{(recentPackage?.itemCount ?? 0).toLocaleString('ko-KR')}건</p>
            </div>
            <div className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">준비 완료</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{(recentPackage?.readyCount ?? 0).toLocaleString('ko-KR')}건</p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-accent-200 bg-accent-50/70 p-4 dark:border-accent-500/30 dark:bg-accent-500/10">
            <p className="text-xs font-semibold uppercase text-accent-700 dark:text-accent-300">다음 연결 지점</p>
            <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
              실제 파일 생성 단계에서는 패키지 항목마다 거래처별 검수 결과를 PDF/XLSX로 저장하고, send_list.csv를 함께 내보내면 됩니다.
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
