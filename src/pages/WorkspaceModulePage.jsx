import React from 'react';

import PageShell from './PageShell';

const moduleConfigs = {
  recentTasks: {
    title: '최근 작업',
    description: '최근 실행한 자동화, 파일 수정, 검증 결과를 한 곳에서 확인합니다.',
    actions: ['다시 실행', '작업 열기', '결과 내보내기'],
    stats: [
      ['오늘 작업', '18건', '성공 15 · 확인 3'],
      ['평균 처리 시간', '42초', '전일 대비 12% 단축'],
      ['대기 중', '4건', '예약 자동화 포함'],
    ],
    columns: ['시간', '작업명', '파일', '상태', '담당자'],
    rows: [
      ['15:04', '매출 원본 정리', 'sales_orders_2026.xlsx', '성공', '김민서'],
      ['14:38', '거래처 코드 매핑', 'supplier_codes.csv', '확인 필요', '박준호'],
      ['13:12', '중복 행 검사', 'monthly_sales.xlsx', '성공', '이서연'],
      ['11:47', '보고서 생성', 'may_report.xlsx', '대기', '최현우'],
    ],
    sideTitle: '다음 작업',
    sideItems: ['확인 필요 항목 검토', '보고서 초안 승인', '예약 작업 4건 실행'],
  },
  fileManager: {
    title: '파일 관리',
    description: '업로드한 Excel/CSV 파일, 고정 파일, 프로젝트 폴더를 관리합니다.',
    actions: ['파일 업로드', '폴더 만들기', '선택 백업'],
    stats: [
      ['전체 파일', '126개', 'Excel 84 · CSV 42'],
      ['최근 업로드', '8개', '오늘 추가됨'],
      ['사용 용량', '2.4GB', '로컬 저장소 31%'],
    ],
    columns: ['파일명', '형식', '크기', '수정일', '상태'],
    rows: [
      ['sales_orders_2026.xlsx', 'Excel', '4.8MB', '2026-05-18', '동기화됨'],
      ['supplier_codes.csv', 'CSV', '860KB', '2026-05-18', '검토 필요'],
      ['monthly_sales.xlsx', 'Excel', '8.1MB', '2026-05-17', '동기화됨'],
      ['backup_0518.xlsx', 'Excel', '5.3MB', '2026-05-18', '백업됨'],
    ],
    sideTitle: '프로젝트 폴더',
    sideItems: ['매출 자동화', '거래처 코드표', '월간 보고서', '백업 보관함'],
  },
  automation: {
    title: '자동화 작업',
    description: '반복되는 정리, 검증, 변환 규칙을 실행 순서대로 관리합니다.',
    actions: ['자동화 실행', '규칙 추가', '예약 설정'],
    stats: [
      ['활성 규칙', '12개', '정리 5 · 검증 4 · 출력 3'],
      ['오늘 실행', '31회', '실패 1건'],
      ['예약 작업', '6건', '다음 실행 16:30'],
    ],
    columns: ['단계', '자동화명', '트리거', '최근 결과', '상태'],
    rows: [
      ['1', '빈 행 제거', '파일 업로드', '성공', '활성'],
      ['2', '코드표 매핑', '수동 실행', '성공', '활성'],
      ['3', '중복 거래 검사', '저장 전', '확인 필요', '활성'],
      ['4', 'PDF 보고서 생성', '매주 월요일', '대기', '예약됨'],
    ],
    sideTitle: '실행 큐',
    sideItems: ['데이터 정리 72%', '코드 매핑 대기', '검증 대기', '보고서 생성 대기'],
  },
  reportGenerator: {
    title: '보고서 생성',
    description: '정제된 데이터를 기반으로 월간 보고서와 검증 리포트를 생성합니다.',
    actions: ['보고서 생성', '템플릿 선택', 'PDF 내보내기'],
    stats: [
      ['보고서 템플릿', '9개', '매출 · 재고 · 오류'],
      ['이번 달 생성', '24건', '승인 19 · 초안 5'],
      ['최근 출력', '15:02', 'PDF와 XLSX 저장'],
    ],
    columns: ['보고서', '데이터 소스', '형식', '최근 생성', '상태'],
    rows: [
      ['월간 매출 요약', 'sales_orders_2026.xlsx', 'PDF/XLSX', '2026-05-18', '완료'],
      ['거래처별 오류 목록', 'supplier_codes.csv', 'XLSX', '2026-05-18', '초안'],
      ['중복 검사 리포트', 'monthly_sales.xlsx', 'PDF', '2026-05-17', '완료'],
      ['백업 검증 리포트', 'backup_0518.xlsx', 'PDF', '대기', '대기'],
    ],
    sideTitle: '출력 옵션',
    sideItems: ['표지 포함', '오류 행 강조', '담당자별 분리', '클라우드 백업 첨부'],
  },
  dataTable: {
    title: '데이터 테이블',
    description: '원본 데이터를 표 형태로 확인하고 필터, 정렬, 검증을 수행합니다.',
    actions: ['필터', '열 설정', '변경 저장'],
    stats: [
      ['현재 행', '2,184개', '표시 120개'],
      ['현재 열', '10개', '고정 열 2개'],
      ['검증 이슈', '23건', '중복 12 · 누락 7 · 코드 4'],
    ],
    columns: ['행', '거래일', '거래처', '품목 코드', '검증'],
    rows: [
      ['1', '2026-05-18', '한빛유통', 'A-1024', '정상'],
      ['2', '2026-05-18', '세종오피스', 'B-2108', '확인 필요'],
      ['3', '2026-05-17', '노블상사', 'C-0412', '정상'],
      ['4', '2026-05-17', '에이원물류', 'A-1180', '중복 의심'],
    ],
    sideTitle: '표 도구',
    sideItems: ['필터 조건 3개', '숨김 열 없음', '선택 셀 H2', '합계 3,550,300원'],
  },
  codeMapping: {
    title: '코드 매핑',
    description: '품목 코드, 거래처 코드, 분류값을 표준 코드로 변환하는 규칙을 관리합니다.',
    actions: ['규칙 추가', '매핑 실행', '미매핑 보기'],
    stats: [
      ['매핑 규칙', '428개', '활성 421 · 중지 7'],
      ['미매핑 코드', '14개', '신규 코드 포함'],
      ['정확도', '98.7%', '최근 7일 기준'],
    ],
    columns: ['원본 코드', '표준 코드', '분류', '적용 범위', '상태'],
    rows: [
      ['A-1024', 'PAPER-A4-001', '소모품', '전체 프로젝트', '활성'],
      ['B-2108', 'TONER-BLK-2108', '전산소모품', '매출 자동화', '활성'],
      ['C-0412', 'USB-HUB-04', '전산기기', '전체 프로젝트', '확인 필요'],
      ['G-5022', 'CABLE-MEET-01', '회의실', '월간 보고서', '활성'],
    ],
    sideTitle: '미매핑 후보',
    sideItems: ['H-1100', 'J-4201', 'TEMP-09', 'OLD-CODE-77'],
  },
  duplicateChecker: {
    title: '중복 검사',
    description: '거래번호, 품목 코드, 금액 조합을 기준으로 중복 데이터를 찾습니다.',
    actions: ['검사 실행', '중복 병합', '예외 등록'],
    stats: [
      ['중복 후보', '12건', '강함 5 · 약함 7'],
      ['검사 기준', '4개', '거래일 · 코드 · 수량 · 금액'],
      ['예외 규칙', '6개', '반복 주문 제외'],
    ],
    columns: ['그룹', '행 번호', '중복 기준', '신뢰도', '처리'],
    rows: [
      ['D-001', '4, 7', 'C-0412 · 16개 · 312,000', '높음', '검토'],
      ['D-002', '12, 18', 'A-1024 · 60개', '중간', '대기'],
      ['D-003', '31, 32', '거래처/금액 일치', '높음', '병합 가능'],
      ['D-004', '45, 49', '품목 코드 일치', '낮음', '예외 후보'],
    ],
    sideTitle: '검사 기준',
    sideItems: ['거래일 ±1일', '거래처 일치', '품목 코드 일치', '금액 오차 0원'],
  },
  activityLogs: {
    title: '활동 로그',
    description: '파일 열기, 자동화 실행, 저장, 백업 등 모든 활동을 기록합니다.',
    actions: ['로그 검색', 'CSV 내보내기', '보관 정책'],
    stats: [
      ['오늘 로그', '384건', '오류 2 · 경고 11'],
      ['감사 보관', '90일', '자동 삭제 예정 없음'],
      ['최근 오류', '15:04', '금액 누락 2건'],
    ],
    columns: ['시간', '사용자', '활동', '대상', '수준'],
    rows: [
      ['15:04:27', '김민서', '검증 오류 감지', 'sales_orders_2026.xlsx', 'ERROR'],
      ['15:04:21', '박준호', '매핑 규칙 로드', 'supplier_codes.csv', 'INFO'],
      ['15:04:18', '이서연', '중복 후보 감지', 'monthly_sales.xlsx', 'WARN'],
      ['15:04:12', '시스템', '파일 스키마 분석', 'sales_orders_2026.xlsx', 'INFO'],
    ],
    sideTitle: '로그 필터',
    sideItems: ['오류만 보기', '오늘 활동', '자동화 로그', '사용자 작업'],
  },
  localBackup: {
    title: '로컬 백업',
    description: '현재 작업 데이터와 설정을 로컬 저장소에 안전하게 백업합니다.',
    actions: ['즉시 백업', '백업 위치', '복원 지점 만들기'],
    stats: [
      ['최근 백업', '15:02', '성공'],
      ['보관 개수', '38개', '30일 정책'],
      ['저장 위치', 'D:/ExcelBackups', '사용 가능 118GB'],
    ],
    columns: ['백업명', '파일 수', '크기', '생성일', '상태'],
    rows: [
      ['auto_20260518_1502', '12개', '82MB', '2026-05-18 15:02', '정상'],
      ['manual_20260518_1100', '9개', '61MB', '2026-05-18 11:00', '정상'],
      ['auto_20260517_1800', '11개', '79MB', '2026-05-17 18:00', '정상'],
      ['auto_20260516_1800', '10개', '74MB', '2026-05-16 18:00', '만료 예정'],
    ],
    sideTitle: '백업 정책',
    sideItems: ['매일 18:00 자동 백업', '최근 30일 보관', '오류 시 알림', '압축 저장 사용'],
  },
  cloudBackup: {
    title: '클라우드 백업',
    description: '작업 파일과 백업 버전을 클라우드 저장소와 동기화합니다.',
    actions: ['동기화 시작', '연결 설정', '충돌 해결'],
    stats: [
      ['동기화 상태', '정상', '방금 전 확인'],
      ['업로드 대기', '3개', '총 18MB'],
      ['클라우드 용량', '64%', '200GB 중 128GB'],
    ],
    columns: ['파일', '대상', '크기', '동기화', '상태'],
    rows: [
      ['sales_orders_2026.xlsx', 'Cloud/Projects', '4.8MB', '완료', '정상'],
      ['supplier_codes.csv', 'Cloud/Data', '860KB', '대기', '업로드 예정'],
      ['may_report.pdf', 'Cloud/Reports', '2.1MB', '완료', '정상'],
      ['backup_0518.zip', 'Cloud/Backups', '11MB', '진행 중', '42%'],
    ],
    sideTitle: '연결 상태',
    sideItems: ['계정 연결됨', '암호화 업로드', '충돌 파일 0개', '자동 재시도 켜짐'],
  },
  restore: {
    title: '복원',
    description: '로컬 또는 클라우드 백업에서 파일과 설정을 선택적으로 복원합니다.',
    actions: ['복원 시작', '미리보기', '복원 로그'],
    stats: [
      ['복원 가능 지점', '38개', '로컬 31 · 클라우드 7'],
      ['선택된 지점', '15:02', '오늘 자동 백업'],
      ['예상 복원 시간', '1분 20초', '12개 파일'],
    ],
    columns: ['복원 지점', '소스', '파일 수', '크기', '상태'],
    rows: [
      ['2026-05-18 15:02', '로컬', '12개', '82MB', '권장'],
      ['2026-05-18 11:00', '로컬', '9개', '61MB', '사용 가능'],
      ['2026-05-17 18:00', '클라우드', '11개', '79MB', '사용 가능'],
      ['2026-05-16 18:00', '로컬', '10개', '74MB', '만료 예정'],
    ],
    sideTitle: '복원 옵션',
    sideItems: ['현재 파일 백업 후 복원', '설정 포함', '로그 보존', '충돌 파일 이름 변경'],
  },
  requestDashboard: {
    title: '요청 대시보드',
    description: '거래처 확인 요청에 필요한 PDF/XLSX 첨부, 메일 문구, 발송 목록을 패키지로 준비합니다.',
    actions: ['패키지 생성', '오류별 묶기', 'CSV 내보내기'],
    stats: [
      ['확인 요청 대상', '18개 거래처', '오류 행 83건 기준'],
      ['패키지 준비율', '72%', 'PDF 18 · XLSX 18'],
      ['수동 확인 대기', '6건', '연락처 또는 문구 확인 필요'],
    ],
    columns: ['거래처', '오류 건수', '첨부 파일', '발송 채널', '상태'],
    rows: [
      ['한빛유통', '12건', 'PDF/XLSX', 'EMAIL', 'READY'],
      ['세종오피스', '8건', 'PDF/XLSX', 'EMAIL', '검토 필요'],
      ['노블상사', '6건', 'XLSX', 'KAKAO', '문구 준비'],
      ['대원시스템', '4건', 'PDF/XLSX', 'EMAIL', 'READY'],
    ],
    sideTitle: '추천 흐름',
    sideItems: ['거래처별 오류 묶기', 'PDF/XLSX 생성', '메일 문구 생성', '발송 완료 체크'],
  },
  contactList: {
    title: '연락처 목록',
    description: '거래처별 이메일, 카카오톡 연락처, 선호 채널, 담당 부서를 관리합니다.',
    actions: ['연락처 추가', '중복 정리', 'CSV 가져오기'],
    stats: [
      ['등록 연락처', '126개', '이메일 92 · 카톡 34'],
      ['확인 필요', '9개', '이메일 누락 또는 휴면'],
      ['사업자번호 매칭', '87%', '거래처 기준 데이터와 연결'],
    ],
    columns: ['거래처', '부서', '이메일', '선호 채널', '상태'],
    rows: [
      ['한빛유통', '정산팀', 'settle@hanbit.co.kr', 'EMAIL', '정상'],
      ['세종오피스', '영업지원', 'sales@sejongoffice.co.kr', 'EMAIL', '정상'],
      ['노블상사', '관리팀', '카톡 공유', 'KAKAO', '확인 필요'],
      ['대원시스템', '총무팀', 'admin@daewon.co.kr', 'EMAIL', '정상'],
    ],
    sideTitle: '관리 기준',
    sideItems: ['사업자번호 우선 매칭', '담당자명 대신 부서 표시', '휴면 연락처 분리', '변경 이력 보관'],
  },
  messageTemplates: {
    title: '문구 템플릿',
    description: '책임 소재보다 협조 요청에 초점을 둔 부드러운 이메일/카톡 문구를 관리합니다.',
    actions: ['템플릿 추가', '미리보기', '기본 문구 적용'],
    stats: [
      ['활성 템플릿', '7개', '이메일 4 · 카톡 3'],
      ['기본 말투', '협조 요청형', '부드럽고 낮은 톤'],
      ['최근 수정', '오늘', '거래처 검수 요청 문구'],
    ],
    columns: ['템플릿', '채널', '사용 상황', '말투', '상태'],
    rows: [
      ['거래처 검수 협조 요청', 'EMAIL', '오류 확인', '협조형', '활성'],
      ['첨부 확인 재요청', 'EMAIL', '미회신', '정중함', '활성'],
      ['카톡 공유 문구', 'KAKAO', '수동 발송', '간결함', '활성'],
      ['마감 완료 감사 문구', 'EMAIL', '완료 안내', '감사형', '초안'],
    ],
    sideTitle: '문구 원칙',
    sideItems: ['책임 추궁 표현 금지', '협조 요청 중심', '부서 단위 표현', '첨부 확인 경로 명확화'],
  },
  sendPackages: {
    title: '발송 패키지',
    description: '거래처별 첨부 폴더, send_list.csv, 메일 제목/본문을 생성해 외부 발송 도구와 연결합니다.',
    actions: ['패키지 만들기', '폴더 열기', 'send_list.csv 생성'],
    stats: [
      ['생성 패키지', '5개', '이번 마감 기준'],
      ['준비 완료', '18건', '수동 발송 가능'],
      ['첨부 누락', '2건', 'PDF 생성 필요'],
    ],
    columns: ['패키지', '마감월', '대상', '출력 폴더', '상태'],
    rows: [
      ['REQ-202605-01', '2026-05', '18개 거래처', 'exports/request/202605', 'READY'],
      ['REQ-202604-02', '2026-04', '12개 거래처', 'exports/request/202604', '발송 완료'],
      ['REQ-202603-01', '2026-03', '9개 거래처', 'exports/request/202603', '보관'],
      ['REQ-TEST-01', '테스트', '3개 거래처', 'exports/request/test', '검토 필요'],
    ],
    sideTitle: '패키지 구성',
    sideItems: ['send_list.csv', '거래처별 PDF', '거래처별 XLSX', '카톡 복사용 문구'],
  },
  sendHistory: {
    title: '발송 이력',
    description: '외부 도구로 발송한 요청의 완료 체크, 회신 상태, 후속 조치를 기록합니다.',
    actions: ['완료 체크', '회신 등록', '이력 내보내기'],
    stats: [
      ['이번 달 발송', '42건', '완료 36 · 대기 6'],
      ['미회신', '5건', '재요청 후보'],
      ['평균 회신', '1.8일', '최근 3개월 기준'],
    ],
    columns: ['거래처', '채널', '발송일', '회신', '상태'],
    rows: [
      ['한빛유통', 'EMAIL', '2026-05-18', '대기', 'SENT'],
      ['세종오피스', 'EMAIL', '2026-05-18', '확인 완료', 'CLOSED'],
      ['노블상사', 'KAKAO', '2026-05-17', '추가 자료 요청', 'REPLIED'],
      ['대원시스템', 'EMAIL', '2026-05-17', '대기', '재요청'],
    ],
    sideTitle: '후속 작업',
    sideItems: ['미회신 재요청', '회신 파일 첨부', '완료 처리', '마감 보고서 반영'],
  },
  preferences: {
    title: '사용자 설정',
    description: '화면 표시, 기본 작업 폴더, 알림 방식 등 개인 환경을 설정합니다.',
    actions: ['설정 저장', '기본값 복원', '프로필 동기화'],
    stats: [
      ['테마', '시스템 설정', '다크 모드 지원'],
      ['기본 폴더', '매출 자동화', '최근 사용'],
      ['알림', '켜짐', '오류/완료 알림'],
    ],
    columns: ['설정 항목', '현재 값', '권장 값', '적용 범위', '상태'],
    rows: [
      ['시작 화면', 'Dashboard', 'Dashboard', '전체', '적용됨'],
      ['기본 파일 형식', 'XLSX', 'XLSX', '사용자', '적용됨'],
      ['표시 행 수', '120', '100-200', '사용자', '적용됨'],
      ['알림 소리', '꺼짐', '선택', '사용자', '대기'],
    ],
    sideTitle: '빠른 설정',
    sideItems: ['마지막 파일 자동 열기', '표 헤더 고정', '오류 행 강조', '작업 완료 알림'],
  },
  saveSettings: {
    title: '저장 설정',
    description: '자동 저장 주기, 저장 형식, 충돌 처리 규칙을 관리합니다.',
    actions: ['저장 정책 적용', '테스트 저장', '충돌 규칙'],
    stats: [
      ['자동 저장', '켜짐', '5분 주기'],
      ['저장 형식', 'XLSX + CSV', '원본 보존'],
      ['충돌 처리', '사본 생성', '덮어쓰기 방지'],
    ],
    columns: ['정책', '값', '대상', '최근 적용', '상태'],
    rows: [
      ['자동 저장 주기', '5분', '모든 프로젝트', '2026-05-18', '활성'],
      ['원본 파일 보존', '켜짐', 'Excel 파일', '2026-05-18', '활성'],
      ['저장 전 검증', '켜짐', '작업 파일', '2026-05-18', '활성'],
      ['충돌 파일 처리', '사본 생성', '동기화 파일', '2026-05-17', '활성'],
    ],
    sideTitle: '저장 흐름',
    sideItems: ['임시 저장', '검증 실행', '원본 백업', '최종 저장'],
  },
  syncSettings: {
    title: '동기화 설정',
    description: '로컬 파일과 클라우드 백업의 동기화 방향과 주기를 설정합니다.',
    actions: ['동기화 적용', '연결 테스트', '충돌 목록'],
    stats: [
      ['동기화 방식', '양방향', '로컬 우선'],
      ['주기', '10분', '네트워크 안정 시'],
      ['충돌 파일', '0개', '최근 24시간'],
    ],
    columns: ['대상', '방향', '주기', '마지막 동기화', '상태'],
    rows: [
      ['작업 파일', '양방향', '10분', '방금 전', '정상'],
      ['백업 파일', '업로드', '30분', '15:02', '정상'],
      ['설정 파일', '양방향', '즉시', '14:58', '정상'],
      ['로그 파일', '업로드', '1시간', '14:00', '대기'],
    ],
    sideTitle: '네트워크 정책',
    sideItems: ['와이파이에서만 업로드', '실패 시 3회 재시도', '대용량 파일 확인', '충돌 시 사용자 선택'],
  },
  security: {
    title: '보안',
    description: '파일 접근, 암호화, 권한, 감사 로그 보존 정책을 관리합니다.',
    actions: ['권한 검토', '암호화 설정', '감사 로그'],
    stats: [
      ['암호화', '활성', '백업 파일 적용'],
      ['권한 그룹', '4개', '관리자 2명'],
      ['보안 이벤트', '1건', '검토 완료'],
    ],
    columns: ['항목', '정책', '대상', '최근 변경', '상태'],
    rows: [
      ['백업 암호화', 'AES-256', '로컬/클라우드', '2026-05-18', '활성'],
      ['파일 열람 권한', '프로젝트별', '작업 파일', '2026-05-17', '활성'],
      ['감사 로그', '90일 보관', '전체 활동', '2026-05-16', '활성'],
      ['외부 내보내기', '확인 필요', '보고서', '2026-05-16', '활성'],
    ],
    sideTitle: '보안 체크',
    sideItems: ['암호화 정상', '권한 충돌 없음', '외부 공유 0건', '감사 로그 기록 중'],
  },
  taskHistory: {
    title: '작업 이력',
    description: '관리자 관점에서 전체 사용자와 자동화의 실행 이력을 확인합니다.',
    actions: ['이력 검색', '감사 내보내기', '실패 재처리'],
    stats: [
      ['이번 주 작업', '1,284건', '성공률 98.9%'],
      ['실패 작업', '14건', '재처리 가능 9건'],
      ['활성 사용자', '12명', '오늘 접속 8명'],
    ],
    columns: ['작업 ID', '사용자', '작업 유형', '완료 시간', '결과'],
    rows: [
      ['JOB-5821', '김민서', '데이터 정리', '15:04', '성공'],
      ['JOB-5820', '박준호', '코드 매핑', '14:38', '확인 필요'],
      ['JOB-5819', '이서연', '중복 검사', '13:12', '성공'],
      ['JOB-5818', '시스템', '자동 백업', '12:00', '성공'],
    ],
    sideTitle: '관리 작업',
    sideItems: ['실패 작업 재실행', '사용자별 필터', '감사 자료 다운로드', '오래된 이력 보관'],
  },
  systemStatus: {
    title: '시스템 상태',
    description: '앱 성능, 저장소, 작업 큐, 백업 서비스 상태를 모니터링합니다.',
    actions: ['상태 새로고침', '진단 실행', '로그 열기'],
    stats: [
      ['앱 상태', '정상', '오류 없음'],
      ['작업 큐', '4건', '평균 대기 18초'],
      ['저장소', '31%', '118GB 사용 가능'],
    ],
    columns: ['서비스', '상태', '응답 시간', '최근 확인', '메모'],
    rows: [
      ['파일 인덱서', '정상', '24ms', '방금 전', '대기 없음'],
      ['자동화 엔진', '정상', '31ms', '방금 전', '4건 대기'],
      ['백업 서비스', '정상', '42ms', '15:02', '최근 백업 성공'],
      ['동기화 서비스', '정상', '55ms', '방금 전', '충돌 없음'],
    ],
    sideTitle: '리소스',
    sideItems: ['CPU 18%', '메모리 1.2GB', '디스크 31%', '네트워크 정상'],
  },
  cacheManager: {
    title: '캐시 관리',
    description: '미리보기, 임시 파일, 인덱스 캐시를 점검하고 정리합니다.',
    actions: ['캐시 정리', '인덱스 재생성', '임시 파일 보기'],
    stats: [
      ['전체 캐시', '486MB', '정리 가능 320MB'],
      ['파일 인덱스', '12,480개', '최신 상태'],
      ['임시 파일', '38개', '7일 이상 12개'],
    ],
    columns: ['캐시 유형', '크기', '항목 수', '최근 사용', '처리'],
    rows: [
      ['표 미리보기', '180MB', '46개', '오늘', '유지'],
      ['파일 인덱스', '72MB', '12,480개', '방금 전', '유지'],
      ['임시 업로드', '210MB', '28개', '어제', '정리 가능'],
      ['오류 덤프', '24MB', '4개', '3일 전', '검토'],
    ],
    sideTitle: '정리 정책',
    sideItems: ['7일 지난 임시 파일 삭제', '최근 파일 캐시 유지', '오류 덤프 보존', '정리 전 백업'],
  },
};

function statusClass(value) {
  if (['성공', '완료', '정상', '활성', '적용됨', '권장', '동기화됨', '백업됨', 'READY', '발송 완료', 'CLOSED'].includes(value)) {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300';
  }

  if (['확인 필요', '중복 의심', '검토', '검토 필요', '초안', '만료 예정', '정리 가능', 'WARN', '대기', '문구 준비', 'SENT', 'REPLIED', '재요청'].includes(value)) {
    return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
  }

  if (['ERROR', '실패'].includes(value)) {
    return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
  }

  return 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300';
}

function WorkspaceModulePage({ moduleKey }) {
  const config = moduleConfigs[moduleKey] || moduleConfigs.recentTasks;
  const primaryMetric = config.stats[0];
  const secondaryMetric = config.stats[1];

  return (
    <PageShell title={config.title} description={config.description}>
      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">{config.title} workspace</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{primaryMetric[1]} · {primaryMetric[0]}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{primaryMetric[2]} / {secondaryMetric[0]} {secondaryMetric[1]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {config.actions.map((action, index) => (
              <button
                key={action}
                className={`btn ${index === 0 ? 'btn-primary' : 'btn-secondary'}`}
                type="button"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {config.stats.map(([label, value, detail]) => (
          <section key={label} className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-9">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">{config.title} 목록</h2>
            <div className="flex items-center gap-2">
              {['검색', '필터', '내보내기'].map((action) => (
                <button key={action} className="h-8 rounded-md border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700 dark:border-gray-700/60 dark:text-gray-300 dark:hover:border-accent-500/40 dark:hover:bg-accent-500/10 dark:hover:text-accent-300" type="button">
                  {action}
                </button>
              ))}
            </div>
          </header>

          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {config.columns.map((column) => (
                    <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700/60 dark:bg-gray-900/40 dark:text-gray-400">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.rows.map((row, rowIndex) => (
                  <tr key={`${config.title}-${rowIndex}`} className="group">
                    {row.map((cell, cellIndex) => {
                      const isLast = cellIndex === row.length - 1;

                      return (
                        <td key={`${cell}-${cellIndex}`} className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 group-hover:bg-accent-50/60 dark:border-gray-700/60 dark:text-gray-200 dark:group-hover:bg-accent-500/10">
                          {isLast ? (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(cell)}`}>
                              {cell}
                            </span>
                          ) : (
                            cell
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800 xl:col-span-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{config.sideTitle}</h2>
          <div className="mt-4 space-y-2">
            {config.sideItems.map((item) => (
              <button key={item} className="flex w-full items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-left text-sm text-gray-600 hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700 dark:border-gray-700/60 dark:text-gray-300 dark:hover:border-accent-500/40 dark:hover:bg-accent-500/10 dark:hover:text-accent-300" type="button">
                <span className="truncate">{item}</span>
                <span className="ml-3 h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" />
              </button>
            ))}
          </div>
        </aside>
      </div>

      <section className="mt-5 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">운영 의도</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              이 화면은 {config.title} 업무를 빠르게 파악하고, 첫 번째 액션을 바로 실행하는 작업대 역할입니다.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">사용자 흐름</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              목록에서 대상을 고르고, 우측 패널에서 조건을 확인한 뒤, 상단 주요 버튼으로 처리합니다.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">다음 고도화</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              실제 데이터 연결, 권한 처리, 실행 결과 저장을 붙이면 바로 업무 화면으로 확장됩니다.
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

export default WorkspaceModulePage;
