# 데이터 규칙

## 기본 원칙

기준 데이터는 업무 전체의 기준이므로 자주 바뀌면 안 된다.

다음 데이터는 승인 없이 변경하지 않는다.

- 거래처 코드
- 거래처명
- 사업자등록번호
- 제품 코드
- 제품명
- 영업 단가
- 날짜 형식
- 숫자 단위

기준 데이터가 변경될 때는 반드시 변경 전후 이력과 백업을 남긴다.

## 비교 기준

사람은 이름을 보고 이해하지만, 시스템은 이름으로 비교하지 않는다.

실제 비교 기준은 다음 값이다.

- customer_code
- product_code
- business_number
- sales_price
- closing_month
- row_no

거래처명과 제품명은 표시용 데이터로 취급한다.

## 핵심 테이블

### customers

거래처 기준 데이터.

- customer_code
- customer_name
- business_number
- tax_status
- status

사업자등록번호는 거래처 식별에 가장 강한 후보값이다.

### customer_aliases

거래처명이 흔들리는 현실을 보정하기 위한 별칭 테이블.

예:

- 삼성
- 삼성전자
- 삼성전자 본사
- (주)삼성전자

위 값들이 같은 customer_code로 연결될 수 있어야 한다.

### products

제품 기준 데이터.

- product_code
- product_name
- unit
- status

### product_aliases

제품명이 다르게 들어오는 경우를 정리하는 테이블.

### sales_prices

영업 단가 기준 데이터.

- customer_code
- product_code
- price
- start_date
- end_date
- version
- status

단가는 UPDATE보다 version과 end_date로 관리한다.

### sales_uploads

업로드 파일 1건의 메타 정보.

- file_name
- closing_month
- uploaded_department_code
- uploaded_at
- status

### sales_rows

업로드된 엑셀 행 데이터.

초기 MVP에서는 모든 원본 컬럼을 정규화하지 않아도 된다. 다만 검증에 필요한 핵심 값은 구조화한다.

- row_no
- raw_customer_name
- raw_product_name
- customer_code
- product_code
- quantity
- unit_price
- sales_amount
- validation_status
- review_status

### validation_issues

행별 상세 오류 목록.

- error_type
- severity
- message
- expected_value
- actual_value
- assigned_department_code
- status

## 검증 규칙

초기 MVP 검증 규칙은 다음 순서로 적용한다.

1. 거래처 코드 존재 여부
2. 제품 코드 존재 여부
3. 기준 단가와 업로드 단가 비교
4. 수량 곱하기 단가와 매출액 비교
5. 중복 행 검출
6. 대량 거래 확인
7. 고액 거래 확인
8. 오류 목록 생성

## 상태값

### validation_status

- 정상
- 확인 필요
- 중복 의심
- 수정 필요
- 보류
- 승인 완료

### review_status

- WAITING
- approved
- hold
- needsEdit

### issue status

- OPEN
- RESOLVED
- IGNORED

## 책임 소재 표현

앱은 개인 담당자 이름을 책임 추적의 중심으로 사용하지 않는다.

현장 반발을 줄이고 협업을 유도하기 위해 부서 단위로 표시한다.

권장 표현:

- 총무팀 확인 필요
- 물류팀 확인 요청
- 영업지원 확인 대기

피해야 할 표현:

- 김민서 오류
- 박준호 실수
- 담당자 책임

## 요청 센터 데이터

발송 준비는 다음 구조를 기준으로 한다.

### contacts

- customer_code
- department_name
- recipient_email
- recipient_phone
- preferred_channel
- status

### message_templates

- template_name
- channel
- subject_template
- body_template
- tone
- status

### send_packages

거래처별 확인 요청 파일 묶음.

### send_package_items

거래처별 발송 준비 항목.

### send_exports

send_list.csv, 첨부 폴더, 외부 발송 도구용 파일 기록.

## 문구 원칙

거래처 요청 문구는 책임 추궁이 아니라 협조 요청이어야 한다.

기본 톤:

- 바쁘신 와중에 확인 요청드립니다.
- 혹시 저희 쪽에서 추가로 맞춰드릴 내용이 있다면 알려주세요.
- 첨부 자료 기준으로 확인 부탁드립니다.

직접 대량 발송은 MVP에서 하지 않는다.
