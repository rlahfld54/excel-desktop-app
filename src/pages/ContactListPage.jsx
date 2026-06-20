import React, { useMemo, useState } from 'react';

import PageShell from './PageShell';


const fields = [
  {
    label: '거래처명',
    key: 'customerName',
    required: true,
    placeholder: '거래처명을 입력',
  },
  {
    label: '거래처 코드',
    key: 'customerCode',
    placeholder: 'CUST-001',
  },
  {
    label: '사업자번호',
    key: 'businessNumber',
    placeholder: '000-00-00000',
  },
  {
    label: '부서',
    key: 'departmentName',
    placeholder: '정산팀',
  },
  {
    label: '담당자명',
    key: 'recipientName',
    required: true,
    placeholder: '담당자명',
  },
  {
    label: '직함',
    key: 'recipientTitle',
    placeholder: '대리 / 팀장',
  },
  {
    label: '이메일',
    key: 'recipientEmail',
    type: 'email',
    placeholder: 'name@company.com',
  },
  {
    label: '전화번호',
    key: 'recipientPhone',
    placeholder: '010-0000-0000',
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



  
function ContactForm({ draft = emptyDraft, mode, onChange, onSubmit, onCancel }) {
  const update = (field, value) => {
    onChange({ ...draft, [field]: value });
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <Field key={field.key} label={field.label}>
            <input
              className="form-input w-full"
              type={field.type ?? 'text'}
              value={draft[field.key] ?? ''}
              required={field.required}
              placeholder={field.placeholder}
              onChange={(e) => update(field.key, e.target.value)}
            />
          </Field>
        ))}

        <Field label="선호 채널">
          <select
            className="form-select w-full"
            value={draft.preferredChannel ?? 'EMAIL'}
            onChange={(e) => update('preferredChannel', e.target.value)}
          >
            {Object.entries(channelLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="상태">
          <select
            className="form-select w-full"
            value={draft.status ?? 'ACTIVE'}
            onChange={(e) => update('status', e.target.value)}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="메모">
        <textarea
          className="form-textarea min-h-24 w-full"
          value={draft.memo ?? ''}
          onChange={(e) => update('memo', e.target.value)}
          placeholder="마감일, 연락 시 주의사항, 담당자 특이사항"
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="btn btn-secondary" type="button" onClick={onCancel}>
          취소
        </button>
        <button className="btn btn-primary" type="submit">
          {mode === 'edit' ? '수정 저장' : '신규 등록'}
        </button>
      </div>
    </form>
  );
}

export default function ContactListPage() {
  const [contacts, setContacts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
  const [formMode, setFormMode] = useState('create');
  const [params, setParams] = useState({
    customer: '',
    contact: '',
    email: '',
    phone: '',
    channel: 'ALL',
    status: 'ALL',
    page: 1,
    pageSize: 8,
  });
  const [notice, setNotice] = useState('조회 버튼을 눌러 SQLite 담당자 데이터를 불러오세요.');
  const [isSearching, setIsSearching] = useState(false);
  const [isPaging, setIsPaging] = useState(false);
  const [serverTotal, setServerTotal] = useState(0);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.contactId === selectedId) ?? contacts[0] ?? null,
    [contacts, selectedId],
  );

  const totalPages = Math.max(Math.ceil(serverTotal / params.pageSize), 1);

  const updateParams = (nextValues) => {
    setParams((current) => ({
      ...current,
      ...nextValues,
      page: nextValues.page ?? 1,
    }));
  };

  const handleSearch = async (targetPage = 1, mode = 'search') => {
    const isPageChange = mode === 'page';
    if (!window.api?.queryContacts || isSearching || isPaging) {
      if (!window.api?.queryContacts) setNotice('SQLite 조회는 Electron 데스크톱 앱에서만 사용할 수 있습니다.');
      return;
    }

    if (isPageChange) {
      setIsPaging(true);
    } else {
      setIsSearching(true);
    }
    try {
      const result = await window.api.queryContacts({
        ...params,
        page: targetPage,
      });
      const data = result?.data;
      const nextContacts = result?.ok && Array.isArray(data?.rows)
        ? data.rows.map(normalizeContact)
        : [];
      setContacts(nextContacts);
      setSelectedId(nextContacts[0]?.contactId ?? '');
      setDraft(emptyDraft);
      setFormMode('create');
      setServerTotal(Number(data?.total) || 0);
      setParams((current) => ({ ...current, page: Number(data?.page) || targetPage }));
      setNotice(`SQLite에서 담당자 ${Number(data?.total || 0).toLocaleString('ko-KR')}명을 조회했습니다.`);
    } catch (error) {
      setContacts([]);
      setSelectedId('');
      setDraft(emptyDraft);
      setFormMode('create');
      setServerTotal(0);
      setParams((current) => ({ ...current, page: 1 }));
      setNotice(`SQLite 조회 실패: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      if (isPageChange) {
        setIsPaging(false);
      } else {
        setIsSearching(false);
      }
    }
  };

  const metrics = useMemo(() => {
    const customerCount = new Set(contacts.map((contact) => contact.customerCode || contact.customerName).filter(Boolean)).size;
    const activeCount = contacts.filter((contact) => contact.status === 'ACTIVE').length;
    const emailCount = contacts.filter((contact) => contact.preferredChannel === 'EMAIL').length;
    const missingInfoCount = contacts.filter((contact) => !contact.recipientEmail && !contact.recipientPhone).length;

    return [
      { label: '등록 담당자', value: `${serverTotal.toLocaleString('ko-KR')}명`, detail: `현재 페이지 ${customerCount.toLocaleString('ko-KR')}개 거래처` },
      { label: '사용 중', value: `${activeCount.toLocaleString('ko-KR')}명`, detail: '발송/마감 작업에 사용' },
      { label: '메일 대상', value: `${emailCount.toLocaleString('ko-KR')}명`, detail: '메일 채널 우선' },
      { label: '정보 확인', value: `${missingInfoCount.toLocaleString('ko-KR')}명`, detail: '이메일 또는 전화번호 필요' },
    ];
  }, [contacts, serverTotal]);

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



  return (
    <PageShell title="거래처 담당자 관리" description="거래처별 담당자를 등록하고, 연락처와 발송 채널을 바로 수정하거나 삭제합니다.">
      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(150px,1fr))_130px_130px_auto] xl:items-end">
          <Field label="거래처">
            <input
              className="form-input w-full"
              value={params.customer}
              onChange={(event) => updateParams({ customer: event.target.value })}
              placeholder="거래처명 또는 코드"
              type="search"
            />
          </Field>
          <Field label="담당자">
            <input
              className="form-input w-full"
              value={params.contact}
              onChange={(event) => updateParams({ contact: event.target.value })}
              placeholder="담당자명"
              type="search"
            />
          </Field>
          <Field label="이메일">
            <input
              className="form-input w-full"
              value={params.email}
              onChange={(event) => updateParams({ email: event.target.value })}
              placeholder="이메일"
              type="search"
            />
          </Field>
          <Field label="전화번호">
            <input
              className="form-input w-full"
              value={params.phone}
              onChange={(event) => updateParams({ phone: event.target.value })}
              placeholder="전화번호"
              type="search"
            />
          </Field>
          <Field label="채널">
            <select className="form-select w-full" value={params.channel} onChange={(event) => updateParams({ channel: event.target.value })}>
              <option value="ALL">전체</option>
              {Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="상태">
            <select className="form-select w-full" value={params.status} onChange={(event) => updateParams({ status: event.target.value })}>
              <option value="ALL">전체</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <div className="flex gap-2">
            <button className="btn btn-primary whitespace-nowrap" type="button" onClick={() => handleSearch(1)} disabled={isSearching}>
              {isSearching ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8" data-table-tools="false">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100">거래처 담당자 목록</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                전체 {serverTotal.toLocaleString('ko-KR')}명 중 {contacts.length.toLocaleString('ko-KR')}명 표시
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {serverTotal > params.pageSize && (
                <div className="flex items-center gap-2">
                  <button className="btn btn-secondary h-8 px-3 text-xs" type="button" disabled={params.page <= 1 || isPaging} onClick={() => handleSearch(params.page - 1, 'page')}>이전</button>
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{params.page} / {totalPages}</span>
                  <button className="btn btn-secondary h-8 px-3 text-xs" type="button" disabled={params.page >= totalPages || isPaging} onClick={() => handleSearch(params.page + 1, 'page')}>다음</button>
                </div>
              )}
             
            </div>
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
                {contacts.map((contact) => {
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
                {contacts.length === 0 && (
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
