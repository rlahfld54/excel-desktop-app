import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';

const fallbackContacts = [
  {
    contactId: 1,
    customerCode: 'CUST-001',
    customerName: '한빛유통',
    departmentName: '정산팀',
    recipientName: '한빛 정산담당',
    recipientEmail: 'settle@hanbit.example',
    preferredChannel: 'EMAIL',
    status: 'ACTIVE',
  },
  {
    contactId: 2,
    customerCode: 'CUST-003',
    customerName: '모블상사',
    departmentName: '관리팀',
    recipientName: '모블 관리담당',
    recipientEmail: 'admin@moble.example',
    preferredChannel: 'KAKAO',
    status: 'ACTIVE',
  },
];

function statusClass(status) {
  if (status === 'ACTIVE') {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
  }

  return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
}

function channelClass(channel) {
  if (channel === 'EMAIL') {
    return 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300';
  }

  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
}

function MetricCard({ label, value, detail }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </section>
  );
}

export default function ContactListPage() {
  const [contacts, setContacts] = useState(fallbackContacts);
  const [selectedId, setSelectedId] = useState(fallbackContacts[0].contactId);
  const [loadState, setLoadState] = useState('브라우저 미리보기');
  const [isSeeding, setIsSeeding] = useState(false);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.contactId === selectedId) ?? contacts[0],
    [contacts, selectedId],
  );

  const metrics = useMemo(() => {
    const emailCount = contacts.filter((contact) => contact.preferredChannel === 'EMAIL').length;
    const kakaoCount = contacts.filter((contact) => contact.preferredChannel === 'KAKAO').length;
    const customerCount = new Set(contacts.map((contact) => contact.customerCode).filter(Boolean)).size;
    const missingEmailCount = contacts.filter((contact) => !contact.recipientEmail).length;

    return [
      { label: '연락처', value: `${contacts.length.toLocaleString('ko-KR')}건`, detail: `${customerCount.toLocaleString('ko-KR')}개 거래처 연결` },
      { label: '이메일', value: `${emailCount.toLocaleString('ko-KR')}건`, detail: 'send_list.csv 기본 대상' },
      { label: '카카오', value: `${kakaoCount.toLocaleString('ko-KR')}건`, detail: '수동 공유 문구 대상' },
      { label: '확인 필요', value: `${missingEmailCount.toLocaleString('ko-KR')}건`, detail: '이메일 누락 또는 미확정' },
    ];
  }, [contacts]);

  const loadContacts = async () => {
    if (!window.api?.getMasterData) {
      setContacts(fallbackContacts);
      setSelectedId(fallbackContacts[0].contactId);
      setLoadState('브라우저 미리보기');
      return;
    }

    try {
      const data = await window.api.getMasterData();
      const nextContacts = data.contacts?.length ? data.contacts : [];
      setContacts(nextContacts.length ? nextContacts : fallbackContacts);
      setSelectedId((nextContacts[0] ?? fallbackContacts[0]).contactId);
      setLoadState(nextContacts.length ? 'SQLite 연결됨' : 'SQLite 연결됨 / 연락처 없음');
    } catch (error) {
      setContacts(fallbackContacts);
      setSelectedId(fallbackContacts[0].contactId);
      setLoadState(`SQLite 확인 필요: ${error.message}`);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleSeed = async () => {
    if (!window.api?.seedMasterData) {
      setLoadState('Electron 실행 후 샘플 연락처 준비 가능');
      return;
    }

    setIsSeeding(true);
    setLoadState('샘플 연락처 준비 중');
    try {
      const data = await window.api.seedMasterData();
      const nextContacts = data.contacts?.length ? data.contacts : fallbackContacts;
      setContacts(nextContacts);
      setSelectedId(nextContacts[0].contactId);
      setLoadState('샘플 연락처 준비 완료');
    } catch (error) {
      setLoadState(`샘플 준비 실패: ${error.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <PageShell title="연락처 목록" description="거래처별 담당자, 발송 채널, 이메일 상태를 관리해 요청 패키지 생성 전 누락을 줄입니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Contacts</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{loadState}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">발송 패키지는 이 연락처를 기준으로 수신자 목록을 구성합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={loadContacts}>
              새로고침
            </button>
            <button className="btn btn-secondary" type="button">
              CSV 가져오기
            </button>
            <button className="btn btn-primary" type="button" onClick={handleSeed} disabled={isSeeding}>
              {isSeeding ? '준비 중' : '샘플 연락처 준비'}
            </button>
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8">
          <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">거래처 연락처</h2>
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{contacts.length.toLocaleString('ko-KR')}건</span>
          </header>
          <div className="max-h-[31rem] overflow-auto no-scrollbar">
            <table className="min-w-[840px] w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {['거래처', '부서', '담당자', '이메일', '채널', '상태'].map((column) => (
                    <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const selected = contact.contactId === selectedContact?.contactId;

                  return (
                    <tr
                      key={contact.contactId}
                      className={`group cursor-pointer ${selected ? 'bg-accent-50/70 dark:bg-accent-500/10' : ''}`}
                      onClick={() => setSelectedId(contact.contactId)}
                    >
                      <td className="border-b border-r border-gray-200 px-3 py-2 font-medium text-gray-800 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-100 dark:group-hover:bg-accent-500/10">
                        {contact.customerName ?? contact.customerCode}
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                        {contact.departmentName ?? '-'}
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                        {contact.recipientName ?? '-'}
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                        {contact.recipientEmail ?? '확인 필요'}
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:group-hover:bg-accent-500/10">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${channelClass(contact.preferredChannel)}`}>
                          {contact.preferredChannel}
                        </span>
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:group-hover:bg-accent-500/10">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(contact.status)}`}>
                          {contact.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">선택 연락처</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedContact?.customerName}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedContact?.customerCode}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${channelClass(selectedContact?.preferredChannel)}`}>
              {selectedContact?.preferredChannel}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {[
              ['부서', selectedContact?.departmentName],
              ['담당자', selectedContact?.recipientName],
              ['이메일', selectedContact?.recipientEmail],
              ['상태', selectedContact?.status],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-700/60">
                <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">{value ?? '확인 필요'}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-accent-200 bg-accent-50/70 p-4 dark:border-accent-500/30 dark:bg-accent-500/10">
            <p className="text-xs font-semibold uppercase text-accent-700 dark:text-accent-300">패키지 적용</p>
            <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
              이 연락처는 요청 문구 템플릿의 수신자 정보와 send_list.csv 생성 기준으로 사용할 수 있습니다.
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
