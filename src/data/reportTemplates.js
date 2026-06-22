export const defaultReportTemplates = [
  {
    id: 'monthly-sales',
    title: '월간 매출 보고서',
    purpose: '월 매출액과 거래처별 비중을 임원 보고용으로 정리합니다.',
    color: '#0f766e',
    font: 'Pretendard',
    badge: '매출액',
    sections: ['매출 요약', '거래처 TOP 5', '검증 이슈', '담당자 메모'],
    tableStyle: '헤더 강조형',
    status: '사용 중',
  },
  {
    id: 'customer-ratio',
    title: '거래처별 거래 현황 비율',
    purpose: '거래처별 매출 비중과 집중 관리 대상을 비교합니다.',
    color: '#0ea5e9',
    font: 'Pretendard',
    badge: '거래처 비율',
    sections: ['거래처 비중', '누적 비율', '고액 거래', '관리 의견'],
    tableStyle: '비율 막대형',
    status: '사용 중',
  },
  {
    id: 'validation-issue',
    title: '데이터 오류 점검 보고서',
    purpose: '중복, 금액 불일치, 코드 누락, 단가 오류를 조치 순서대로 정리합니다.',
    color: '#f59e0b',
    font: 'Noto Sans KR',
    badge: '오류 관리',
    sections: ['오류 요약', '유형별 건수', '우선 조치', '완료 기준'],
    tableStyle: '상태 배지형',
    status: '사용 중',
  },
  {
    id: 'customer-closing-send',
    title: '거래처 발송용 마감 확인서',
    purpose: '거래처 담당자에게 발송할 마감 금액, 세금계산서 대조 결과, 확인 요청 사항을 정리합니다.',
    color: '#2563eb',
    font: 'Noto Sans KR',
    badge: '업체 발송',
    sections: ['마감 금액', '세금계산서 대조', '확인 요청', '담당자 서명'],
    tableStyle: '상태 배지형',
    status: '사용 중',
  },
  {
    id: 'purchase-admin',
    title: '총무 구매 집행 보고서',
    purpose: '사무용품, 소모품, 전산 장비 구매와 예산 사용률을 정리합니다.',
    color: '#4f46e5',
    font: 'Pretendard',
    badge: '구매 집행',
    sections: ['품목별 집행', '예산 대비', '거래처 검토', '다음 발주'],
    tableStyle: '예산 비교형',
    status: '초안',
  },
];

export function normalizeTemplate(template) {
  return {
    id: template.id || `custom-${Date.now()}`,
    title: template.title?.trim() || '새 보고서 템플릿',
    purpose: template.purpose?.trim() || '보고 목적을 입력하세요.',
    color: template.color || '#0f766e',
    font: template.font || 'Pretendard',
    badge: template.badge || template.title || '보고서',
    sections: Array.isArray(template.sections) && template.sections.length > 0
      ? template.sections.map((section) => section?.trim() || '섹션')
      : ['요약', '상세 표', '확인 사항', '의견'],
    tableStyle: template.tableStyle || '헤더 강조형',
    status: template.status || '초안',
  };
}

export function readReportTemplates() {
  return defaultReportTemplates;
}

export function saveReportTemplates(templates) {
  return templates.map(normalizeTemplate);
}

export function createEmptyReportTemplate() {
  return normalizeTemplate({
    id: `custom-${Date.now()}`,
    title: '',
    purpose: '',
    color: '#0f766e',
    font: 'Pretendard',
    sections: ['요약', '상세 표', '확인 사항', '의견'],
    tableStyle: '헤더 강조형',
    status: '초안',
  });
}
