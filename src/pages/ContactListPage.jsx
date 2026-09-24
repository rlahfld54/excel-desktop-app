import React, { useMemo, useState } from 'react';

import { FormField, SearchButton, StatusBadge } from '../components/common';
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
  taxStatus: 'UNKNOWN',
  departmentName: '',
  recipientName: '',
  recipientTitle: '',
  recipientEmail: '',
  recipientPhone: '',
  preferredChannel: 'EMAIL',
  status: 'ACTIVE',
  memo: '',
};

function normalizeContact(contact = {}) {
  return {
    ...emptyDraft,
    ...contact,
    contactId: contact.contactId ?? '',
    preferredChannel: contact.preferredChannel || 'EMAIL',
    status: contact.status || 'ACTIVE',
  };
}

function formatBusinessNumber(value) {
  const clean = value.replace(/\D/g, '').slice(0, 10);
  if (clean.length <= 3) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5)}`;
}

function formatPhoneNumber(value) {
  const clean = value.replace(/\D/g, '').slice(0, 11);
  if (clean.startsWith('02')) {
    if (clean.length <= 2) return clean;
    if (clean.length <= 5) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
    if (clean.length <= 9) return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5)}`;
    return `${clean.slice(0, 2)}-${clean.slice(2, 6)}-${clean.slice(6)}`;
  } else {
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    if (clean.length <= 10) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
    return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7)}`;
  }
}

function ContactForm({ draft = emptyDraft, disabled, onChange, onSubmit, onDelete }) {
  const update = (field, value) => {
    let formattedValue = value;
    if (field === 'businessNumber') {
      formattedValue = formatBusinessNumber(value);
    } else if (field === 'recipientPhone') {
      formattedValue = formatPhoneNumber(value);
    }
    onChange({ ...draft, [field]: formattedValue });
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <fieldset disabled={disabled} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <FormField key={field.key} label={field.label} required={field.required}>
              <input
                className="form-input w-full"
                type={field.type ?? 'text'}
                value={draft[field.key] ?? ''}
                required={field.required}
                placeholder={field.placeholder}
                onChange={(e) => update(field.key, e.target.value)}
              />
            </FormField>
          ))}
        </div>

        <FormField label="메모">
          <textarea
            className="form-textarea min-h-24 w-full"
            value={draft.memo ?? ''}
            onChange={(e) => update('memo', e.target.value)}
            placeholder="마감일, 연락 시 주의사항, 담당자 특이사항"
          />
        </FormField>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-primary w-full" type="submit" disabled={disabled}>
          수정
        </button>
        <button
          className="w-full rounded-md border border-rose-200 px-3 py-2 font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
          type="button"
          onClick={onDelete}
          disabled={disabled}
        >
          삭제
        </button>
      </div>
    </form>
  );
}

export default function ContactListPage() {
  const [contacts, setContacts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
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
  const [isSaving, setIsSaving] = useState(false);
  const [serverTotal, setServerTotal] = useState(0);

  const visibleContacts = useMemo(
    () => contacts.filter((contact) => String(contact.status ?? '').toUpperCase() !== 'INACTIVE'),
    [contacts],
  );

  const selectedContact = useMemo(
    () => visibleContacts.find((contact) => contact.contactId === selectedId) ?? null,
    [visibleContacts, selectedId],
  );

  const totalPages = Math.max(Math.ceil(serverTotal / params.pageSize), 1);

  const updateParams = (nextValues) => {
    setParams((current) => ({
      ...current,
      ...nextValues,
      page: nextValues.page ?? 1,
    }));
  };

  const handleSearch = async (targetPage = 1, mode = 'search', keepSelection = false) => {
    const isPageChange = mode === 'page';
    const currentSelectedId = selectedId;
    if (!window.api?.queryContacts || isSearching || isPaging) {
      if (!window.api?.queryContacts)
        setNotice('SQLite 조회는 Electron 데스크톱 앱에서만 사용할 수 있습니다.');
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
      if (!result?.ok || !Array.isArray(data?.rows)) {
        throw new Error(result?.error?.message || 'SQLite 조회에 실패했습니다.');
      }
      const nextContacts = data.rows
        .filter((contact) => String(contact.status ?? '').toUpperCase() !== 'INACTIVE')
        .map(normalizeContact);
      setContacts(nextContacts);
      setServerTotal(Number(data?.total) || 0);
      setParams((current) => ({ ...current, page: Number(data?.page) || targetPage }));
      setNotice(
        `SQLite에서 담당자 ${Number(data?.total || 0).toLocaleString('ko-KR')}명을 조회했습니다.`,
      );

      const nextSelected =
        (keepSelection &&
          nextContacts.find((contact) => contact.contactId === currentSelectedId)) ||
        nextContacts[0] ||
        null;
      setSelectedId(nextSelected?.contactId ?? '');
      setDraft(nextSelected ?? emptyDraft);
    } catch (error) {
      if (!keepSelection) {
        setContacts([]);
        setSelectedId('');
        setDraft(emptyDraft);
        setServerTotal(0);
        setParams((current) => ({ ...current, page: 1 }));
      }
      setNotice(`SQLite 조회 실패: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      if (isPageChange) {
        setIsPaging(false);
      } else {
        setIsSearching(false);
      }
    }
  };

  const handleSelect = (contact) => {
    setSelectedId(contact.contactId);
    setDraft(normalizeContact(contact));
    setNotice(`${contact.customerName} 담당자 정보를 선택했습니다.`);
  };

  const buildContactPayload = (contactId) =>
    normalizeContact({
      ...draft,
      contactId,
      customerName: String(draft.customerName ?? '').trim(),
      customerCode: String(draft.customerCode ?? '').trim(),
      businessNumber: String(draft.businessNumber ?? '').trim(),
      departmentName: String(draft.departmentName ?? '').trim(),
      recipientName: String(draft.recipientName ?? '').trim(),
      recipientTitle: String(draft.recipientTitle ?? '').trim(),
      recipientEmail: String(draft.recipientEmail ?? '').trim(),
      recipientPhone: String(draft.recipientPhone ?? '').trim(),
      memo: String(draft.memo ?? '').trim(),
    });

  const persistContact = async (nextContact) => {
    if (!nextContact.customerName || !nextContact.recipientName) {
      setNotice('거래처명과 담당자명은 꼭 입력해야 합니다.');
      return;
    }

    setIsSaving(true);

    try {
      if (!window.api?.saveContact) {
        throw new Error('Electron 데스크톱 앱에서만 저장할 수 있습니다.');
      }

      const result = await window.api.saveContact(nextContact);

      if (!result?.ok) {
        throw new Error('SQLite 저장에 실패했습니다.');
      }

      const savedContact = normalizeContact(result.contact);

      setContacts((current) =>
        current.map((contact) =>
          contact.contactId === savedContact.contactId ? savedContact : contact,
        ),
      );
      setSelectedId(savedContact.contactId);
      setDraft(savedContact);
      setNotice('담당자 정보가 수정되었습니다.');
    } catch (error) {
      setNotice(`저장 실패: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = (event) => {
    event.preventDefault();
    if (isSaving) return;
    if (!draft.contactId) {
      setNotice('수정할 담당자 ID를 찾을 수 없습니다. 목록에서 다시 선택해 주세요.');
      return;
    }
    void persistContact(buildContactPayload(draft.contactId));
  };

  const handleDelete = async (contact = selectedContact) => {
    if (!contact) return;

    const confirmed = window.confirm(
      `${contact.customerName} ${contact.recipientName} 담당자를 삭제할까요?`,
    );

    if (!confirmed) return;

    setIsSaving(true);

    try {
      if (!window.api?.deleteContact) {
        throw new Error('Electron 데스크톱 앱에서만 삭제할 수 있습니다.');
      }

      const result = await window.api.deleteContact(contact.contactId);

      if (!result?.ok) {
        throw new Error('담당자 미사용 처리에 실패했습니다.');
      }

      const remainingContacts = contacts.filter((item) => item.contactId !== contact.contactId);
      setContacts(remainingContacts);

      const wasSelected =
        selectedId === contact.contactId || selectedContact?.contactId === contact.contactId;
      if (wasSelected) {
        const nextContact = remainingContacts[0] ?? null;
        setSelectedId(nextContact?.contactId ?? '');
        setDraft(nextContact ? normalizeContact(nextContact) : emptyDraft);
      }

      setServerTotal((current) => Math.max(current - 1, 0));

      setNotice('담당자가 미사용 처리되었습니다.');
    } catch (error) {
      setNotice(`삭제 실패: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageShell
      title="거래처 담당자 관리"
      description="거래처 담당자를 조회하고, 목록에서 선택해 정보를 수정하거나 삭제합니다."
    >
      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(150px,1fr))_130px_130px_auto] xl:items-end">
          <FormField label="거래처">
            <input
              className="form-input w-full"
              value={params.customer}
              onChange={(event) => updateParams({ customer: event.target.value })}
              placeholder="거래처명 또는 코드"
              type="search"
            />
          </FormField>
          <FormField label="담당자">
            <input
              className="form-input w-full"
              value={params.contact}
              onChange={(event) => updateParams({ contact: event.target.value })}
              placeholder="담당자명"
              type="search"
            />
          </FormField>
          <FormField label="이메일">
            <input
              className="form-input w-full"
              value={params.email}
              onChange={(event) => updateParams({ email: event.target.value })}
              placeholder="이메일"
              type="search"
            />
          </FormField>
          <FormField label="전화번호">
            <input
              className="form-input w-full"
              value={params.phone}
              onChange={(event) => updateParams({ phone: event.target.value })}
              placeholder="전화번호"
              type="search"
            />
          </FormField>
          <div className="flex gap-2">
            <SearchButton onSearch={() => handleSearch(1)} disabled={isSearching} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-5">
        <section
          className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-8"
          data-table-tools="false"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100">거래처 담당자 목록</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                전체 {serverTotal.toLocaleString('ko-KR')}명 중{' '}
                {visibleContacts.length.toLocaleString('ko-KR')}명 표시
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {serverTotal > params.pageSize && (
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-secondary h-8 px-3 text-xs"
                    type="button"
                    disabled={params.page <= 1 || isPaging}
                    onClick={() => handleSearch(params.page - 1, 'page')}
                  >
                    이전
                  </button>
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                    {params.page} / {totalPages}
                  </span>
                  <button
                    className="btn btn-secondary h-8 px-3 text-xs"
                    type="button"
                    disabled={params.page >= totalPages || isPaging}
                    onClick={() => handleSearch(params.page + 1, 'page')}
                  >
                    다음
                  </button>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {visibleContacts.map((contact) => {
                  const selected = contact.contactId === selectedContact?.contactId;

                  return (
                    <tr
                      key={contact.contactId}
                      tabIndex={0}
                      aria-selected={selected}
                      onClick={() => handleSelect(contact)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleSelect(contact);
                        }
                      }}
                      className={`cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 ${selected ? 'bg-teal-50/70 dark:bg-teal-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="text-left">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {contact.customerName}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">
                            {contact.customerCode || '코드 없음'} ·{' '}
                            {contact.businessNumber || '사업자번호 없음'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        <p className="font-medium">{contact.recipientName}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {[contact.departmentName, contact.recipientTitle]
                            .filter(Boolean)
                            .join(' · ') || '부서/직함 없음'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        <p>{contact.recipientEmail || '이메일 없음'}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {contact.recipientPhone || '전화번호 없음'}
                        </p>
                      </td>
                    </tr>
                  );
                })}
                {visibleContacts.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-gray-500" colSpan="3">
                      조건에 맞는 담당자가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
                담당자 정보
              </p>
              <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                거래처 담당자 수정
              </h2>
            </div>
            <StatusBadge tone="teal">{selectedContact ? '선택됨' : '선택 대기'}</StatusBadge>
          </div>

          <ContactForm
            draft={draft}
            disabled={!selectedContact || isSaving}
            onChange={setDraft}
            onSubmit={handleUpdate}
            onDelete={() => handleDelete(selectedContact)}
          />
        </aside>
      </div>
    </PageShell>
  );
}
