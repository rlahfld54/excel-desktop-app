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
    recipientPhone: '',
    preferredChannel: 'EMAIL',
    status: 'ACTIVE',
    memo: '샘플 연락처',
  },
  {
    contactId: 2,
    customerCode: 'CUST-003',
    customerName: '모블상사',
    departmentName: '관리팀',
    recipientName: '모블 관리담당',
    recipientEmail: 'admin@moble.example',
    recipientPhone: '',
    preferredChannel: 'KAKAO',
    status: 'ACTIVE',
    memo: '샘플 연락처',
  },
];

const sampleCsv = `거래처코드,거래처명,부서,담당자명,이메일,전화번호,선호채널,상태,메모
CUST-001,한빛유통,정산팀,한빛 정산담당,settle@hanbit.example,010-0000-0001,EMAIL,ACTIVE,월마감 담당
CUST-002,세종오피스,영업지원,세종 영업지원,sales@sejong.example,010-0000-0002,EMAIL,ACTIVE,정기 거래처
CUST-003,모블상사,관리팀,모블 관리담당,admin@moble.example,010-0000-0003,KAKAO,ACTIVE,카카오 공유 대상`;

const headerAliases = {
  customerCode: ['거래처코드', '거래처 코드', 'customer_code', 'customerCode'],
  customerName: ['거래처명', '거래처', 'customer_name', 'customerName'],
  departmentName: ['부서', '부서명', 'department', 'department_name'],
  recipientName: ['담당자명', '담당자', '수신자', 'recipient_name'],
  recipientEmail: ['이메일', '메일', 'email', 'recipient_email'],
  recipientPhone: ['전화번호', '연락처', 'phone', 'recipient_phone'],
  preferredChannel: ['선호채널', '채널', 'channel', 'preferred_channel'],
  status: ['상태', 'status'],
  memo: ['메모', 'memo'],
};

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

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  rows.push(row);
  return rows.filter((item) => item.some((value) => value !== ''));
}

function normalizeHeader(header) {
  return String(header ?? '').trim().replace(/\s/g, '').toLowerCase();
}

function findColumnIndex(headers, key) {
  const aliases = headerAliases[key].map(normalizeHeader);
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

function normalizeChannel(value) {
  const channel = String(value ?? 'EMAIL').trim().toUpperCase();
  if (channel.includes('KAKAO') || channel.includes('카카오')) return 'KAKAO';
  return 'EMAIL';
}

function normalizeStatus(value) {
  const status = String(value ?? 'ACTIVE').trim().toUpperCase();
  if (status === 'HOLD' || status === 'INACTIVE') return status;
  return 'ACTIVE';
}

function parseContactsFromCsv(text) {
  const rows = parseCsvText(text);
  if (rows.length === 0) return { contacts: [], issues: ['CSV 내용이 비어 있습니다.'] };

  const headers = rows[0];
  const indexes = Object.fromEntries(Object.keys(headerAliases).map((key) => [key, findColumnIndex(headers, key)]));
  const issues = [];

  if (indexes.customerName < 0) issues.push('필수 컬럼 누락: 거래처명');
  if (indexes.preferredChannel < 0) issues.push('필수 컬럼 누락: 선호채널');

  const contacts = rows.slice(1).map((row, index) => {
    const getValue = (key) => (indexes[key] >= 0 ? row[indexes[key]] ?? '' : '');
    const contact = {
      importId: `csv-${index + 1}`,
      customerCode: getValue('customerCode'),
      customerName: getValue('customerName'),
      departmentName: getValue('departmentName'),
      recipientName: getValue('recipientName'),
      recipientEmail: getValue('recipientEmail'),
      recipientPhone: getValue('recipientPhone'),
      preferredChannel: normalizeChannel(getValue('preferredChannel')),
      status: normalizeStatus(getValue('status')),
      memo: getValue('memo'),
      rowNo: index + 2,
      issues: [],
    };

    if (!contact.customerName) contact.issues.push('거래처명 누락');
    if (contact.preferredChannel === 'EMAIL' && !contact.recipientEmail) contact.issues.push('EMAIL 채널 이메일 누락');
    if (contact.recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.recipientEmail)) contact.issues.push('이메일 형식 확인');
    return contact;
  });

  const validContacts = contacts.filter((contact) => contact.customerName);
  return { contacts: validContacts, issues };
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
  const [csvText, setCsvText] = useState(sampleCsv);
  const [importState, setImportState] = useState('');
  const [showImporter, setShowImporter] = useState(false);

  const preview = useMemo(() => parseContactsFromCsv(csvText), [csvText]);
  const previewIssueCount = preview.contacts.reduce((sum, contact) => sum + contact.issues.length, preview.issues.length);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.contactId === selectedId) ?? contacts[0],
    [contacts, selectedId],
  );

  const metrics = useMemo(() => {
    const emailCount = contacts.filter((contact) => contact.preferredChannel === 'EMAIL').length;
    const kakaoCount = contacts.filter((contact) => contact.preferredChannel === 'KAKAO').length;
    const customerCount = new Set(contacts.map((contact) => contact.customerCode || contact.customerName).filter(Boolean)).size;
    const missingEmailCount = contacts.filter((contact) => contact.preferredChannel === 'EMAIL' && !contact.recipientEmail).length;

    return [
      { label: '연락처', value: `${contacts.length.toLocaleString('ko-KR')}건`, detail: `${customerCount.toLocaleString('ko-KR')}개 거래처 연결` },
      { label: '이메일', value: `${emailCount.toLocaleString('ko-KR')}건`, detail: 'send_list.csv 기본 대상' },
      { label: '카카오', value: `${kakaoCount.toLocaleString('ko-KR')}건`, detail: '수동 공유 문구 대상' },
      { label: '확인 필요', value: `${missingEmailCount.toLocaleString('ko-KR')}건`, detail: 'EMAIL 채널 이메일 누락' },
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

  const handleFileImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvText(await file.text());
    setShowImporter(true);
    event.target.value = '';
  };

  const handleImportContacts = async () => {
    if (preview.contacts.length === 0) {
      setImportState('가져올 연락처가 없습니다.');
      return;
    }

    if (previewIssueCount > 0) {
      setImportState('확인 필요 항목을 먼저 정리해주세요.');
      return;
    }

    if (!window.api?.importContacts) {
      setImportState('브라우저 미리보기에서는 SQLite 저장 대신 CSV 검증만 가능합니다.');
      return;
    }

    try {
      const result = await window.api.importContacts(preview.contacts);
      const nextContacts = result.contacts?.length ? result.contacts : fallbackContacts;
      setContacts(nextContacts);
      setSelectedId(nextContacts[0].contactId);
      setImportState(`가져오기 완료: 추가 ${result.summary.inserted}건 / 갱신 ${result.summary.updated}건`);
      setShowImporter(false);
    } catch (error) {
      setImportState(`가져오기 실패: ${error.message}`);
    }
  };

  return (
    <PageShell title="연락처 목록" description="문서 기준 CSV 컬럼으로 거래처별 담당자, 발송 채널, 이메일 상태를 가져오고 검증합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">Contacts</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{loadState}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">권장 컬럼: 거래처코드, 거래처명, 부서, 담당자명, 이메일, 전화번호, 선호채널, 상태, 메모</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" type="button" onClick={loadContacts}>
              새로고침
            </button>
            <label className="btn btn-secondary cursor-pointer">
              CSV 파일
              <input className="sr-only" type="file" accept=".csv,text/csv" onChange={handleFileImport} />
            </label>
            <button className="btn btn-secondary" type="button" onClick={() => setShowImporter((value) => !value)}>
              CSV 붙여넣기
            </button>
            <button className="btn btn-primary" type="button" onClick={handleSeed} disabled={isSeeding}>
              {isSeeding ? '준비 중' : '샘플 연락처 준비'}
            </button>
          </div>
        </div>
      </section>

      {importState && (
        <section className="mb-4 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-300">
          {importState}
        </section>
      )}

      {showImporter && (
        <section className="mb-4 grid grid-cols-12 gap-5">
          <div className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">CSV 입력</h2>
              <button className="text-sm font-semibold text-accent-600 hover:text-accent-700 dark:text-accent-300" type="button" onClick={() => setCsvText(sampleCsv)}>
                샘플 채우기
              </button>
            </div>
            <textarea
              className="form-textarea h-64 w-full resize-none font-mono text-xs"
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                미리보기 {preview.contacts.length.toLocaleString('ko-KR')}건 / 확인 필요 {previewIssueCount.toLocaleString('ko-KR')}건
              </p>
              <button className="btn btn-primary" type="button" onClick={handleImportContacts}>
                검증 통과 항목 저장
              </button>
            </div>
          </div>

          <div className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-7">
            <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">가져오기 미리보기</h2>
            </header>
            <div className="max-h-80 overflow-auto no-scrollbar">
              <table className="min-w-[840px] w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {['행', '거래처', '담당자', '이메일', '채널', '확인'].map((column) => (
                      <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.contacts.map((contact) => (
                    <tr key={contact.importId} className="group">
                      <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                        {contact.rowNo}
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 font-medium text-gray-800 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-100 dark:group-hover:bg-accent-500/10">
                        {contact.customerName}
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                        {contact.recipientName || '-'}
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 text-gray-600 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-300 dark:group-hover:bg-accent-500/10">
                        {contact.recipientEmail || '확인 필요'}
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:group-hover:bg-accent-500/10">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${channelClass(contact.preferredChannel)}`}>
                          {contact.preferredChannel}
                        </span>
                      </td>
                      <td className="border-b border-r border-gray-200 px-3 py-2 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:group-hover:bg-accent-500/10">
                        {contact.issues.length ? (
                          <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">{contact.issues.join(', ')}</span>
                        ) : (
                          <span className="text-xs font-semibold text-green-700 dark:text-green-300">통과</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.issues.length > 0 && (
                <div className="border-t border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200">
                  {preview.issues.join(' / ')}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

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
              ['메모', selectedContact?.memo],
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
