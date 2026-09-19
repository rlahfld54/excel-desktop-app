export const CLOSING_TAX_TYPES = {
  TAXABLE: '일반과세',
  TAX_FREE: '면세',
  ZERO_RATE: '영세율',
};

export const CLOSING_COLUMNS = [
  { key: 'transactionDate', label: '거래일' },
  { key: 'customer', label: '거래처' },
  { key: 'businessNumber', label: '사업자등록번호' },
  { key: 'productCode', label: '품목 코드' },
  { key: 'product', label: '품목' },
  { key: 'quantity', label: '수량' },
  { key: 'unitPrice', label: '단가' },
  { key: 'supplyAmount', label: '공급가액' },
  { key: 'taxAmount', label: '부가세' },
  { key: 'totalAmount', label: '합계' },
  { key: 'validationStatus', label: '검증' },
  { key: 'owner', label: '담당자' },
  { key: 'note', label: '비고' },
];

export const defaultClosingLogoUrl = `${import.meta.env.BASE_URL}temporary-company-logo.png`;
export const defaultClosingSealUrl = `${import.meta.env.BASE_URL}temporary-representative-seal.png`;

export const defaultClosingDocumentSettings = {
  companyName: '',
  businessNumber: '',
  address: '',
  representativeName: '',
  logoDataUrl: defaultClosingLogoUrl,
  sealDataUrl: defaultClosingSealUrl,
  businessCardDataUrl: '',
  primaryColor: '#17365D',
  manager: { name: '', phone: '', email: '' },
  visibleColumns: Object.fromEntries(CLOSING_COLUMNS.map(({ key }) => [key, true])),
  defaultMessage: '금액 및 거래내역 확인 후 이상이 있는 경우 담당자에게 연락 부탁드립니다.',
  emailSignature: { showBusinessCard: true, showTextContact: true },
};

export function normalizeClosingDocumentSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const manager = source.manager && typeof source.manager === 'object' ? source.manager : {};
  const emailSignature = source.emailSignature && typeof source.emailSignature === 'object'
    ? source.emailSignature
    : {};

  return {
    ...defaultClosingDocumentSettings,
    ...source,
    manager: { ...defaultClosingDocumentSettings.manager, ...manager },
    visibleColumns: {
      ...defaultClosingDocumentSettings.visibleColumns,
      ...(source.visibleColumns && typeof source.visibleColumns === 'object' ? source.visibleColumns : {}),
    },
    emailSignature: { ...defaultClosingDocumentSettings.emailSignature, ...emailSignature },
    primaryColor: /^#[0-9a-f]{6}$/i.test(String(source.primaryColor || ''))
      ? String(source.primaryColor)
      : defaultClosingDocumentSettings.primaryColor,
  };
}

export function getTaxTypeLabel(value) {
  return CLOSING_TAX_TYPES[value] || '과세 유형 미등록';
}

export function formatClosingCurrency(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`;
}

export function makeImageDataUrl(base64, fileName = '') {
  const extension = String(fileName).split('.').pop()?.toLowerCase();
  const mimeType = extension === 'jpg' || extension === 'jpeg'
    ? 'image/jpeg'
    : extension === 'svg'
      ? 'image/svg+xml'
      : 'image/png';
  return base64 ? `data:${mimeType};base64,${base64}` : '';
}
