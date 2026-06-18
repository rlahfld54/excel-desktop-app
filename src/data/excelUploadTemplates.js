export const excelUploadTemplates = [
  {
    id: "sales-closing-source",
    title: "매출 마감 원본",
    description:
      "월별 매출 원본을 업로드해 금액 재계산, 중복 검사, 단가 검증, 보고서 생성에 사용합니다.",
    fileName: "매출_마감_원본_양식",
    targetMenu: "마감 자료",
    requiredColumns: [
      "거래일",
      "거래처명",
      "거래처코드",
      "품목명",
      "품목코드",
      "수량",
      "단가",
      "금액",
      "담당자",
      "부서",
    ],
    optionalColumns: ["비고", "증빙번호", "세금계산서번호", "승인상태"],
    rules: [
      "거래일은 YYYY-MM-DD 형식으로 입력합니다.",
      "금액은 수량 × 단가와 일치해야 합니다.",
      "거래처코드와 품목코드는 기준정보 양식의 코드와 맞아야 합니다.",
      "담당자와 부서는 보고서 작성 및 활동 로그 기준으로 사용됩니다.",
    ],
  },
  {
    id: "sales-closing-compare",
    title: "마감 비교 기준",
    description:
      "전월/당월 또는 원본/수정본을 비교해 누락, 증감, 금액 차이를 자동 표시합니다.",
    fileName: "매출_마감_비교_기준_양식",
    targetMenu: "매출 마감 비교",
    requiredColumns: [
      "기준월",
      "거래처명",
      "거래처코드",
      "품목명",
      "품목코드",
      "전월수량",
      "전월금액",
      "당월수량",
      "당월금액",
    ],
    optionalColumns: ["담당자", "확인메모", "확정상태"],
    rules: [
      "기준월은 YYYY-MM 형식으로 입력합니다.",
      "전월/당월 금액 차이와 증감률 계산에 사용됩니다.",
      "확정상태는 미확정, 확정, 보류 중 하나로 입력합니다.",
      "거래처코드와 품목코드가 비어 있으면 이름 기준으로 비교합니다.",
    ],
  },
];

export function getTemplateColumns(template) {
  return [...template.requiredColumns, ...template.optionalColumns];
}
