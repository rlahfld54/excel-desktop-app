import React, { useEffect, useMemo, useState } from 'react';

import PageShell from './PageShell';

const storageKey = 'excel-workspace:customerContacts';

const fallbackContacts = [
  {
    contactId: 'CONTACT-001',
    customerCode: 'CUST-001',
    customerName: '한빛유통',
    businessNumber: '120-81-00011',
    departmentName: '정산팀',
    recipientName: '오민지',
    recipientTitle: '대리',
    recipientEmail: 'settle@hanbit.example',
    recipientPhone: '010-4210-1842',
    preferredChannel: 'EMAIL',
    status: 'ACTIVE',
    memo: '10일 마감. 메일 회신이 빠른 거래처.',
  },
  {
    contactId: 'CONTACT-002',
    customerCode: 'CUST-002',
    customerName: '모블상사',
    businessNumber: '214-86-55021',
    departmentName: '관리팀',
    recipientName: '강지훈',
    recipientTitle: '대리',
    recipientEmail: 'admin@moble.example',
    recipientPhone: '010-3188-5502',
    preferredChannel: 'EMAIL',
    status: 'ACTIVE',
    memo: '금액 확인 재연락 대상.',
  },
  {
    contactId: 'CONTACT-003',
    customerCode: 'CUST-003',
    customerName: '그린물류',
    businessNumber: '109-87-43180',
    departmentName: '정산팀',
    recipientName: '서가은',
    recipientTitle: '팀장',
    recipientEmail: 'tax@greenlog.example',
    recipientPhone: '010-9402-6620',
    preferredChannel: 'KAKAO',
    status: 'HOLD',
    memo: '담당자 부재가 잦아 카톡 안내 후 메일 발송.',
  },
];

const emptyDraft = {
  contactId: '',
  customerCode: '',
  customerName: '',
  businessNumber: '',
  departmentName: '',
  recipientName: '',
  recipientTitle: '',
  recipientEmail: '',
  recipientPhone: '',
  preferredChannel: 'EMAIL',
  status: 'ACTIVE',
  memo: '',
};

const statusLabels = {
  ACTIVE: '사용',
  HOLD: '보류',
  INACTIVE: '미사용',
};

const channelLabels = {
  EMAIL: '메일',
  KAKAO: '카톡',
  PHONE: '전화',
};

function makeContactId() {
  return `CONTACT-${Date.now().toString(36).toUpperCase()}`;
}

function normalizeContact(contact) {
  return {
    ...emptyDraft,
    ...contact,
    contactId: String(contact.contactId ?? makeContactId()),
    preferredChannel: contact.preferredChannel || 'EMAIL',
    status: contact.status || 'ACTIVE',
  };
}

function readStoredContacts() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(saved) ? saved.map(normalizeContact) : [];
  } catch {
    return [];
  }
}

function saveStoredContacts(contacts) {
  localStorage.setItem(storageKey, JSON.stringify(contacts));
}

function statusClass(status) {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  if (status === 'HOLD') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
}

function channelClass(channel) {
  if (channel === 'EMAIL') return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
  if (channel === 'KAKAO') return 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300';
  return 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300';
}

function ContactPill({ children, className }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </section>
  );
}

function ContactForm({ draft, mode, onChange, onSubmit, onCancel }) {
  const update = (field, value) => onChange({ ...draft, [field]: value });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="거래처명">
          <input className="form-input w-full" value={draft.customerName} onChange={(event) => update('customerName', event.target.value)} required placeholder="거래처명을 입력" />
        </Field>
        <Field label="거래처 코드">
          <input className="form-input w-full" value={draft.customerCode} onChange={(event) => update('customerCode', event.target.value)} placeholder="CUST-001" />
        </Field>
        <Field label="사업자번호">
          <input className="form-input w-full" value={draft.businessNumber} onChange={(event) => update('businessNumber', event.target.value)} placeholder="000-00-00000" />
        </Field>
        <Field label="부서">
          <input className="form-input w-full" value={draft.departmentName} onChange={(event) => update('departmentName', event.target.value)} placeholder="정산팀" />
        </Field>
        <Field label="담당자명">
          <input className="form-input w-full" value={draft.recipientName} onChange={(event) => update('recipientName', event.target.value)} required placeholder="담당자명" />
        </Field>
        <Field label="직함">
          <input className="form-input w-full" value={draft.recipientTitle} onChange={(event) => update('recipientTitle', event.target.value)} placeholder="대리 / 팀장" />
        </Field>
        <Field label="이메일">
          <input className="form-input w-full" type="email" value={draft.recipientEmail} onChange={(event) => update('recipientEmail', event.target.value)} placeholder="name@company.com" />
        </Field>
        <Field label="전화번호">
          <input className="form-input w-full" value={draft.recipientPhone} onChange={(event) => update('recipientPhone', event.target.value)} placeholder="010-0000-0000" />
        </Field>
        <Field label="선호 채널">
          <select className="form-select w-full" value={draft.preferredChannel} onChange={(event) => update('preferredChannel', event.target.value)}>
            {Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="상태">
          <select className="form-select w-full" value={draft.status} onChange={(event) => update('status', event.target.value)}>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
      </div>

      <Field label="메모">
        <textarea className="form-textarea min-h-24 w-full" value={draft.memo} onChange={(event) => update('memo', event.target.value)} placeholder="마감일, 연락 시 주의사항, 담당자 특이사항" />
      </Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="btn btn-secondary" type="button" onClick={onCancel}>취소</button>
        <button className="btn btn-primary" type="submit">{mode === 'edit' ? '수정 저장' : '신규 등록'}</button>
      </div>
    </form>
  );
}

export default function ContactListPage() {
  const [contacts, setContacts] = useState(() => {
    const saved = readStoredContacts();
    return saved.length ? saved : fallbackContacts.map(normalizeContact);
  });
  const [selectedId, setSelectedId] = useState(() => contacts[0]?.contactId ?? '');
  const [draft, setDraft] = useState(emptyDraft);
  const [formMode, setFormMode] = useState('create');
  const [filters, setFilters] = useState({ query: '', channel: 'ALL', status: 'ALL' });
  const [notice, setNotice] = useState('거래처 담당자를 등록하거나 행을 선택해 바로 수정할 수 있습니다.');

  useEffect(() => {
    let isMounted = true;

    if (!window.api?.getMasterData || readStoredContacts().length > 0) return undefined;

    window.api.getMasterData()
      .then((data) => {
        if (!isMounted || !Array.isArray(data.contacts) || data.contacts.length === 0) return;
        const nextContacts = data.contacts.map(normalizeContact);
        setContacts(nextContacts);
        setSelectedId(nextContacts[0]?.contactId ?? '');
        saveStoredContacts(nextContacts);
      })
      .catch(() => {
        // Browser preview and Electron fallback both keep the local contacts.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    saveStoredContacts(contacts);
  }, [contacts]);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.contactId === selectedId) ?? contacts[0] ?? null,
    [contacts, selectedId],
  );

  const filteredContacts = useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return contacts.filter((contact) => {
      const matchesQuery = query === '' || [
        contact.customerName,
        contact.customerCode,
        contact.businessNumber,
        contact.departmentName,
        contact.recipientName,
        contact.recipientEmail,
        contact.recipientPhone,
        contact.memo,
      ].join(' ').toLowerCase().includes(query);
      const matchesChannel = filters.channel === 'ALL' || contact.preferredChannel === filters.channel;
      const matchesStatus = filters.status === 'ALL' || contact.status === filters.status;
      return matchesQuery && matchesChannel && matchesStatus;
    });
  }, [contacts, filters]);

  const metrics = useMemo(() => {
    const customerCount = new Set(contacts.map((contact) => contact.customerCode || contact.customerName).filter(Boolean)).size;
    const activeCount = contacts.filter((contact) => contact.status === 'ACTIVE').length;
    const emailCount = contacts.filter((contact) => contact.preferredChannel === 'EMAIL').length;
    const missingInfoCount = contacts.filter((contact) => !contact.recipientEmail && !contact.recipientPhone).length;

    return [
      { label: '등록 담당자', value: `${contacts.length.toLocaleString('ko-KR')}명`, detail: `${customerCount.toLocaleString('ko-KR')}개 거래처` },
      { label: '사용 중', value: `${activeCount.toLocaleString('ko-KR')}명`, detail: '발송/마감 작업에 사용' },
      { label: '메일 대상', value: `${emailCount.toLocaleString('ko-KR')}명`, detail: '메일 채널 우선' },
      { label: '정보 확인', value: `${missingInfoCount.toLocaleString('ko-KR')}명`, detail: '이메일 또는 전화번호 필요' },
    ];
  }, [contacts]);

  const startCreate = () => {
    setFormMode('create');
    setDraft(emptyDraft);
    setNotice('새 거래처 담당자 정보를 입력하세요.');
  };

  const startEdit = (contact = selectedContact) => {
    if (!contact) return;
    setFormMode('edit');
    setDraft(normalizeContact(contact));
    setSelectedId(contact.contactId);
    setNotice(`${contact.customerName} 담당자 정보를 수정 중입니다.`);
  };

  const handleSelect = (contact) => {
    setSelectedId(contact.contactId);
    setFormMode('edit');
    setDraft(normalizeContact(contact));
    setNotice(`${contact.customerName} 담당자 정보를 선택했습니다.`);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextContact = normalizeContact({
      ...draft,
      contactId: formMode === 'edit' && draft.contactId ? draft.contactId : makeContactId(),
      customerName: draft.customerName.trim(),
      customerCode: draft.customerCode.trim(),
      businessNumber: draft.businessNumber.trim(),
      departmentName: draft.departmentName.trim(),
      recipientName: draft.recipientName.trim(),
      recipientTitle: draft.recipientTitle.trim(),
      recipientEmail: draft.recipientEmail.trim(),
      recipientPhone: draft.recipientPhone.trim(),
      memo: draft.memo.trim(),
    });

    if (!nextContact.customerName || !nextContact.recipientName) {
      setNotice('거래처명과 담당자명은 꼭 입력해야 합니다.');
      return;
    }

    setContacts((current) => {
      if (formMode === 'edit') {
        return current.map((contact) => (contact.contactId === nextContact.contactId ? nextContact : contact));
      }
      return [nextContact, ...current];
    });
    setSelectedId(nextContact.contactId);
    setDraft(nextContact);
    setFormMode('edit');
    setNotice(formMode === 'edit' ? '담당자 정보가 수정되었습니다.' : '새 거래처 담당자가 등록되었습니다.');
  };

  const handleDelete = (contact = selectedContact) => {
    if (!contact) return;
    const confirmed = window.confirm(`${contact.customerName} ${contact.recipientName} 담당자를 삭제할까요?`);
    if (!confirmed) return;

    setContacts((current) => {
      const nextContacts = current.filter((item) => item.contactId !== contact.contactId);
      const nextSelected = nextContacts[0]?.contactId ?? '';
      setSelectedId(nextSelected);
      setDraft(nextContacts[0] ? normalizeContact(nextContacts[0]) : emptyDraft);
      setFormMode(nextContacts[0] ? 'edit' : 'create');
      return nextContacts;
    });
    setNotice('담당자 정보가 삭제되었습니다.');
  };

  const resetSample = () => {
    const nextContacts = fallbackContacts.map(normalizeContact);
    setContacts(nextContacts);
    setSelectedId(nextContacts[0].contactId);
    setDraft(normalizeContact(nextContacts[0]));
    setFormMode('edit');
    setNotice('샘플 담당자 목록으로 다시 채웠습니다.');
  };

  return (
    <PageShell title="거래처 담당자 관리" description="거래처별 담당자를 등록하고, 연락처와 발송 채널을 바로 수정하거나 삭제합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_150px_150px_auto] xl:items-end">
          <Field label="검색">
            <input
              className="form-input w-full"
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="거래처, 담당자, 이메일, 전화번호 검색"
              type="search"
            />
          </Field>
          <Field label="채널">
            <select className="form-select w-full" value={filters.channel} onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))}>
              <option value="ALL">전체</option>
              {Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="상태">
            <select className="form-select w-full" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="ALL">전체</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <div className="flex gap-2">
            <button className="btn btn-primary whitespace-nowrap" type="button" onClick={startCreate}>새 담당자</button>
            <button className="btn btn-secondary whitespace-nowrap" type="button" onClick={resetSample}>샘플 복구</button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8" data-table-tools="false">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100">거래처 담당자 목록</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{filteredContacts.length.toLocaleString('ko-KR')}명 표시 중</p>
            </div>
            {selectedContact && (
              <div className="flex gap-2">
                <button className="btn btn-secondary" type="button" onClick={() => startEdit(selectedContact)}>선택 수정</button>
                <button className="rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:bg-gray-800 dark:text-rose-300 dark:hover:bg-rose-500/10" type="button" onClick={() => handleDelete(selectedContact)}>
                  삭제
                </button>
              </div>
            )}
          </header>

          <div className="overflow-x-auto">
            <table className="min-w-[940px] w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">거래처</th>
                  <th className="px-4 py-3">담당자</th>
                  <th className="px-4 py-3">연락처</th>
                  <th className="px-4 py-3">채널</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredContacts.map((contact) => {
                  const selected = contact.contactId === selectedContact?.contactId;

                  return (
                    <tr key={contact.contactId} className={selected ? 'bg-teal-50/70 dark:bg-teal-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}>
                      <td className="px-4 py-3">
                        <button className="text-left" type="button" onClick={() => handleSelect(contact)}>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{contact.customerName}</span>
                          <span className="mt-1 block text-xs text-gray-500">{contact.customerCode || '코드 없음'} · {contact.businessNumber || '사업자번호 없음'}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        <p className="font-medium">{contact.recipientName}</p>
                        <p className="mt-1 text-xs text-gray-500">{[contact.departmentName, contact.recipientTitle].filter(Boolean).join(' · ') || '부서/직함 없음'}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        <p>{contact.recipientEmail || '이메일 없음'}</p>
                        <p className="mt-1 text-xs text-gray-500">{contact.recipientPhone || '전화번호 없음'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <ContactPill className={channelClass(contact.preferredChannel)}>{channelLabels[contact.preferredChannel] ?? contact.preferredChannel}</ContactPill>
                      </td>
                      <td className="px-4 py-3">
                        <ContactPill className={statusClass(contact.status)}>{statusLabels[contact.status] ?? contact.status}</ContactPill>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button className="btn btn-secondary h-8 px-3 text-xs" type="button" onClick={() => startEdit(contact)}>수정</button>
                          <button className="h-8 rounded-md border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10" type="button" onClick={() => handleDelete(contact)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-gray-500" colSpan="6">조건에 맞는 담당자가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{formMode === 'edit' ? '수정 모드' : '등록 모드'}</p>
              <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{formMode === 'edit' ? '담당자 정보 수정' : '거래처 담당자 등록'}</h2>
            </div>
            <ContactPill className={formMode === 'edit' ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300' : 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'}>
              {formMode === 'edit' ? '수정' : '신규'}
            </ContactPill>
          </div>

          <ContactForm
            draft={draft}
            mode={formMode}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onCancel={startCreate}
          />
        </aside>
      </div>
    </PageShell>
  );
}
