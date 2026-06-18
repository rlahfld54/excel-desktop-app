# Excel Automation Workspace

> 반복적인 Excel 마감 업무를 데이터 검증부터 보고서 작성과 발송까지 연결한 데스크톱 업무 자동화 앱입니다.

안녕하세요. 사용자의 실제 업무 흐름을 이해하고, 복잡한 과정을 안정적인 UI로 풀어내는 풀스택 개발자를 목표로 하고 있습니다.

이 프로젝트는 단순한 관리자 대시보드나 Excel 편집기가 아닙니다. 매출 자료 취합, 오류 검증, 코드 매핑, 거래처 확인, 마감장 생성, 보고서 작성처럼 여러 도구에 흩어진 업무를 하나의 워크스페이스에서 처리할 수 있도록 설계한 **React + Electron 기반 데스크톱 애플리케이션**입니다.

## 다운로드

Windows 설치 파일은 GitHub Releases에서 받을 수 있습니다.

[Excel Automation Workspace 다운로드](https://github.com/rlahfld54/excel-desktop-app/releases/tag/v1.0.0)

<p>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111111" alt="React" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=ffffff" alt="Vite" />
  <img src="https://img.shields.io/badge/Electron-37-47848F?style=for-the-badge&logo=electron&logoColor=ffffff" alt="Electron" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=ffffff" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/ExcelJS-4.4-217346?style=for-the-badge&logo=microsoftexcel&logoColor=ffffff" alt="ExcelJS" />
  <img src="https://img.shields.io/badge/SQLite-Local_DB-003B57?style=for-the-badge&logo=sqlite&logoColor=ffffff" alt="SQLite" />
</p>

![Excel Automation Workspace preview](docs/images/excel-automation-workspace.png)

## 프로젝트 한 줄 소개

Excel 파일 업로드부터 데이터 검증, 마감 진행 관리, 거래처 발송, 보고서 작성과 백업까지 하나의 흐름으로 연결한 로컬 우선 업무 자동화 앱입니다.

## 왜 만들었나요?

이 프로젝트는 단순히 업무를 편하게 만들고 싶다는 생각보다, 실제 현업에서 반복되던 매출 마감 업무와 검수 스트레스에서 출발했습니다.

마감 시즌에는 여러 담당자와 부서에서 작성한 파일이 동시에 들어옵니다. 하지만 사람마다 입력 방식이 달라 다음과 같은 문제가 반복됩니다.

- 거래처명과 품목명의 표기 불일치
- 날짜 형식과 필수 데이터 누락
- 중복 데이터 입력
- 수량·단가·금액 불일치
- 담당자와 거래처의 확인 상태 누락
- 보고 직전까지 이어지는 수정 파일 관리
- 업체별 마감장과 확인 요청 자료의 반복 생성

특히 마지막 검수 단계에서는 데이터를 분석하는 시간보다 **어디가 잘못됐는지 찾고 누구에게 확인해야 하는지 정리하는 일**에 더 많은 시간이 들기도 합니다.

그래서 사람이 모든 행을 반복해서 검사하는 대신, 시스템이 오류 후보와 확인 대상을 정리하고 사용자는 최종 판단에 집중할 수 있는 **마감 업무 전용 작업 공간**을 만들었습니다.

또한 인터넷이나 서버 사용이 제한된 업무 환경에서도 사용할 수 있도록 로컬 PC에서 주요 작업과 데이터를 처리하는 **로컬 우선(Offline First)** 구조를 적용했습니다.

궁극적인 목표는 다음과 같습니다.

> 사람은 최종 판단에 집중하고, 반복되는 검수와 정리 작업은 시스템이 대신하는 환경을 만든다.

## 주요 기능

| 영역 | 구현 내용 |
| --- | --- |
| 마감 워크스페이스 | 업체별 마감 금액, 진행 상태, 담당자, 미확정 사유와 다음 연락 일정을 관리합니다. |
| 업로드 전 검증 | Excel/XLSX 파일의 필수 항목, 누락값, 중복, 금액 및 단가 불일치를 확인합니다. |
| 원본 데이터 관리 | 검증한 데이터를 스프레드시트 형태로 조회하고 로컬 데이터베이스에 저장합니다. |
| 제품·거래처 매핑 | 서로 다르게 입력된 제품명과 거래처명을 기준 코드에 연결합니다. |
| 담당자 연락처 | 거래처 및 내부 담당자의 연락처와 업무 정보를 관리합니다. |
| 마감 발송 큐 | 업체별 마감 요청 자료와 문구를 검토하고 발송 대상을 단계별로 처리합니다. |
| Excel·PDF 생성 | 업체별 마감 요청서를 Excel과 PDF 파일로 생성합니다. |
| 이메일 발송 | 메일 제목과 본문을 미리 확인하고 Gmail 테스트 메일을 실제로 발송합니다. |
| 보고서 | 보고서 작성, 템플릿 관리, 경영진용 요약 대시보드를 제공합니다. |
| 일정 및 이력 | 투두·일정, 최근 작업, 활동 로그와 작업 이력을 관리합니다. |
| 백업 및 설정 | 로컬 백업·복구, 파일 관리, 저장 및 동기화 관련 설정을 제공합니다. |
| 권한 관리 | 관리자와 일반 사용자에 따라 접근 가능한 메뉴와 페이지 기능을 구분합니다. |

## 업무 흐름

1. Excel 파일 업로드
2. 업로드 전 데이터 검증
3. 제품·거래처 코드 매핑
4. 원본 데이터 저장
5. 업체별 마감 진행 관리
6. 마감장 Excel·PDF 생성
7. 확인 요청 및 발송 이력 저장
8. 보고서 작성 및 백업

## 상세 기술

### Frontend

- React 19
- React Router
- Tailwind CSS 4
- AG Grid
- Chart.js
- Radix UI
- Zustand

### Desktop & Data

- Electron
- Vite
- ExcelJS
- SheetJS
- better-sqlite3
- PDF-Lib
- Nodemailer
- electron-builder

## 개발 포인트

- 템플릿형 카드 대시보드를 실제 마감 업무 중심의 워크스페이스로 재설계
- Excel 업로드부터 검증, 저장, 보고, 발송까지 이어지는 업무 흐름 구성
- 비개발자 사무 사용자가 이해하기 쉬운 메뉴와 상태 표현 적용
- Electron IPC를 활용한 파일 저장, PDF 생성 및 이메일 발송 구현
- SQLite 기반 로컬 우선 구조로 오프라인 업무 환경 지원
- 사용자 권한에 따라 메뉴뿐 아니라 실제 페이지 기능도 분리
- 반복되는 업무 화면을 재사용 가능한 React 컴포넌트로 구성
- 작업 기록과 발송 이력을 로컬 데이터베이스에 저장

## 프로젝트 구조

```text
src
├─ components        # 공통 UI 컴포넌트
├─ data              # 표준 양식과 화면 데이터 정의
├─ pages             # 업무 메뉴별 페이지
├─ partials          # Header, Sidebar 등 공통 레이아웃
├─ stores            # Zustand 기반 작업 상태 관리
├─ useComponents     # ExcelTable 등 화면 전용 컴포넌트
├─ utils             # Excel 처리, 내보내기와 공통 유틸리티
└─ routesConfig.js   # 메뉴 및 권한별 라우팅 설정

public
├─ database          # SQLite 기반 로컬 데이터 처리
└─ electron          # Electron main process와 preload
```

## 실행 방법

### 개발 환경 실행

```bash
npm install
npm run dev
```

브라우저 화면만 확인하려면 다음 명령을 사용합니다.

```bash
npm run vite
```

### 빌드 확인

```bash
npm run build
```

### Windows 설치 파일 생성

```bash
npm run dist
```

생성된 설치 파일은 `release` 폴더에서 확인할 수 있습니다.

## 프로젝트 문서

- [브랜드 가이드](docs/brand-guide.md)
- [MVP 범위](docs/mvp-scope.md)
- [데이터 규칙](docs/data-rules.md)
- [화면 역할](docs/screen-map.md)
- [AI 작업 방식](docs/ai-workflow.md)

## 이 프로젝트를 통해 보여주고 싶은 점

이 프로젝트는 화려한 화면보다 사용자가 매일 겪는 불편을 줄이는 제품을 만드는 데 초점을 두고 있습니다.

- 실제 업무를 분석해 화면과 기능으로 바꾸는 능력
- 복잡한 작업을 단계적인 사용자 경험으로 정리하는 능력
- React와 Electron을 활용한 데스크톱 앱 개발
- Excel, SQLite, PDF, 이메일을 연결하는 실무형 기능 구현
- 사용자 관점에서 오류 상황과 작업 흐름을 계속 개선하는 태도

## Contact

<p>
  <a href="mailto:rlahfld54@naver.com">
    <img src="https://img.shields.io/badge/Email-rlahfld54%40naver.com-EA4335?style=for-the-badge&logo=gmail&logoColor=ffffff" alt="Email" />
  </a>
  <a href="https://normal-gom-jelly.tistory.com">
    <img src="https://img.shields.io/badge/Blog-normal--gom--jelly-FF5A4A?style=for-the-badge&logo=tistory&logoColor=ffffff" alt="Blog" />
  </a>
  <a href="https://github.com/rlahfld54">
    <img src="https://img.shields.io/badge/GitHub-rlahfld54-181717?style=for-the-badge&logo=github&logoColor=ffffff" alt="GitHub" />
  </a>
</p>
