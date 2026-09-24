# Excel Desktop App — AI Development Rules

이 프로젝트를 수정하는 모든 AI 에이전트는 아래 규칙을 우선적으로 따른다.

목표는 단순히 "동작하는 코드"를 만드는 것이 아니다.

**기존 설계를 이해하고 React의 정상적인 데이터 흐름을 유지하면서, 최소한의 변경으로 문제를 해결하는 것을 우선한다.**

---

# 1. 수정 전 기존 흐름부터 확인

코드를 수정하기 전에 반드시 관련 코드의 기존 흐름을 확인한다.

다음 순서로 추적한다.

`사용자 이벤트 → handler → Electron API → DB → state 변경 → render`

새로운 함수, state, useEffect, API 호출을 추가하기 전에 이미 같은 책임을 수행하는 코드가 있는지 먼저 찾는다.

기존 로직이 존재한다면 새 로직을 중복해서 만들지 말고 기존 로직을 재사용하거나 수정한다.

특히 같은 DB/API 호출을 여러 위치에서 실행하지 않는다.

---

# 2. React 기본 원칙

React 컴포넌트는 가능한 한 다음 구조를 유지한다.

`props/state → 파생값 계산 → render`

UI는 state와 props의 결과여야 한다.

React의 렌더링 문제를 해결하기 위해 임의의 우회 로직을 추가하지 않는다.

다음과 같은 코드는 특별한 이유가 없는 한 만들지 않는다.

* 강제 리렌더링
* 의미 없는 key 변경
* setTimeout을 이용한 렌더링 해결
* 동일 데이터를 여러 state에 중복 저장
* useEffect를 이용한 state 간 동기화
* 렌더링 결과를 다시 state로 복사

---

# 3. useEffect 사용 기준

useEffect는 기본 해결책이 아니다.

다음과 같이 React 외부 시스템과 동기화해야 할 때 사용한다.

* Electron API
* SQLite / DB
* 브라우저 이벤트
* IPC listener
* timer
* 외부 라이브러리
* 컴포넌트 생명주기에 맞춰 반드시 실행되어야 하는 작업

단순한 데이터 계산이나 사용자 이벤트 처리를 위해 useEffect를 추가하지 않는다.

새로운 useEffect를 작성하기 전에 반드시 확인한다.

1. 이 작업이 정말 컴포넌트 mount/update 시 자동 실행되어야 하는가?
2. 사용자 이벤트 handler에서 처리해야 하는 작업은 아닌가?
3. 기존 useEffect와 역할이 중복되지 않는가?
4. props/state에서 직접 계산할 수 없는가?

명확한 이유가 없다면 useEffect를 추가하지 않는다.

---

# 4. 사용자 액션을 자동 실행으로 변경하지 않는다

버튼이나 사용자 액션이 존재하는 기능은 해당 이벤트를 통해 실행한다.

예:

조회 버튼이 있다면:

`조회 클릭 → handleSearch → DB 조회 → setRows → render`

로 동작한다.

AI가 임의로 다음과 같이 변경하면 안 된다.

`페이지 mount → useEffect → DB 자동 조회`

제품 요구사항에 "페이지 진입 시 자동 조회"가 명시되어 있을 때만 자동 조회한다.

동일한 원칙을 다음 기능에도 적용한다.

* 조회
* 저장
* 삭제
* 업로드
* 다운로드
* 메일 발송
* 마감 처리
* 데이터 수정

사용자가 명시적으로 실행해야 하는 작업을 AI 판단으로 자동 실행하지 않는다.

---

# 5. 조회 화면 상태 모델

조회형 화면은 가능하면 다음 상태를 명확하게 구분한다.

1. 최초 진입
2. 조회 중
3. 조회 성공
4. 조회 결과 0건
5. 조회 실패

최초 진입과 조회 결과 0건은 서로 다른 상태다.

예를 들어 최초 진입 상태에서

"검색 결과가 없습니다."

라고 표시하지 않는다.

필요하다면 `hasSearched`, `isLoading`, `error` 등 의미가 명확한 UI state를 사용한다.

단, 기존 state로 충분히 표현할 수 있다면 불필요한 state를 추가하지 않는다.

---

# 6. State 추가 기준

새 state를 만들기 전에 다음을 확인한다.

1. 기존 state에서 계산 가능한가?
2. props에서 계산 가능한가?
3. useMemo 또는 일반 변수로 표현 가능한가?
4. 정말 독립적으로 변경되는 UI 상태인가?

계산 가능한 값을 별도의 state로 중복 저장하지 않는다.

예:

좋음:

```js
const filteredRows = useMemo(
  () => rows.filter((row) => row.status === status),
  [rows, status],
);
```

특별한 이유 없이 다음처럼 만들지 않는다.

```js
const [filteredRows, setFilteredRows] = useState([]);

useEffect(() => {
  setFilteredRows(rows.filter(...));
}, [rows]);
```

---

# 7. useMemo / useCallback 남용 금지

성능 최적화가 실제로 필요하지 않은 단순 계산에 useMemo 또는 useCallback을 기계적으로 추가하지 않는다.

다만 다음과 같은 경우에는 사용할 수 있다.

* 비교적 큰 데이터의 필터/정렬
* 참조 안정성이 실제로 필요한 경우
* dependency 변경에 따른 재계산을 명확하게 제한할 필요가 있는 경우

"React니까 useMemo/useCallback을 써야 한다"는 이유만으로 추가하지 않는다.

---

# 8. 기존 구조를 우선한다

요청받지 않은 리팩터링을 동시에 수행하지 않는다.

하나의 버그를 수정하면서 관련 없는 다음 작업을 하지 않는다.

* 파일 전체 구조 변경
* 함수 이름 대량 변경
* 컴포넌트 임의 분리
* 기존 API 인터페이스 변경
* DB schema 변경
* 스타일 시스템 변경

구조 변경이 정말 필요하다면 바로 수정하지 말고 이유와 영향을 먼저 설명한다.

---

# 9. Electron / React 책임 분리

Renderer(React)는 UI와 사용자 상호작용을 담당한다.

DB 접근이나 Node.js 기능은 기존 Electron IPC/API 구조를 따른다.

React 컴포넌트에서 SQLite에 직접 접근하는 새로운 구조를 만들지 않는다.

기존 `window.api` 인터페이스가 있다면 우선 재사용한다.

흐름은 가능한 한 다음과 같이 유지한다.

`React → window.api → IPC → backend/database`

보안 또는 구조상 특별한 이유가 없는 한 이 계층을 우회하지 않는다.

---

# 10. DB 데이터와 UI 데이터 구분

DB 원본 데이터와 화면에서 계산되는 파생 데이터를 구분한다.

DB에 저장할 필요가 없는 값을 편의를 위해 DB schema에 추가하지 않는다.

예:

* progress
* 표시용 status
* 화면 필터 결과
* 정렬 순서
* 임시 선택 상태

등이 기존 데이터에서 계산 가능한 값이라면 UI에서 계산하는 것을 우선한다.

단, 프로젝트의 기존 DB 설계상 영속화가 필요한 값은 기존 구조를 따른다.

---

# 11. DB/API 호출 중복 금지

같은 화면에서 같은 목적의 DB/API 호출이 여러 곳에 존재하지 않도록 한다.

예를 들어 `handleSearch()`가 조회를 담당한다면 별도의 useEffect에서 같은 조회 함수를 호출하지 않는다.

중복 호출이 발견되면 새 호출을 추가하기 전에 기존 호출의 역할을 확인한다.

---

# 12. 이벤트 Handler 책임

사용자 이벤트는 의미가 명확한 handler에서 처리한다.

예:

* handleSearch
* handleSave
* handleDelete
* handleUpload
* handleComplete
* handleSend

이벤트에서 발생해야 하는 동작을 useEffect로 옮기지 않는다.

하나의 handler가 너무 많은 책임을 가지게 된다면 내부 함수를 분리할 수 있지만 실행 시작점은 명확하게 유지한다.

---

# 13. 데이터 변경 시 불변성 유지

React state를 직접 수정하지 않는다.

금지:

```js
rows[index].status = 'DONE';
setRows(rows);
```

권장:

```js
setRows((current) =>
  current.map((row) =>
    row.id === id
      ? { ...row, status: 'DONE' }
      : row
  )
);
```

객체와 배열의 불변성을 유지한다.

---

# 14. 비동기 처리

비동기 작업은 다음 상태를 고려한다.

* loading
* success
* empty
* error

API 실패를 정상 데이터처럼 처리하지 않는다.

오류가 발생했는데 빈 배열을 반환하여 "데이터 없음"으로 위장하지 않는다.

사용자가 알아야 하는 오류라면 프로젝트의 기존 알림/에러 처리 방식을 사용한다.

---

# 15. 임시 해결책 금지

문제의 원인을 확인하지 않은 상태에서 다음 방식으로 해결하지 않는다.

```js
setTimeout(...)
```

```js
forceUpdate(...)
```

```js
key={Date.now()}
```

또는 의미 없는 추가 useEffect.

렌더링 문제가 있다면 먼저 다음을 확인한다.

* state 변경 위치
* state mutation 여부
* dependency
* 조건부 렌더링
* 컴포넌트 mount/unmount
* event handler
* 비동기 호출 순서

원인을 해결한다.

---

# 16. Console 디버깅 코드

개발 과정에서 console을 사용할 수 있다.

예:

* console.log
* console.table
* console.group
* console.warn
* console.error

하지만 임시 디버깅 로그는 문제 해결 후 제거한다.

사용자가 유지해 달라고 요청하지 않은 한 대량의 console 출력 코드를 남기지 않는다.

실제 오류 처리와 console 출력은 구분한다.

console.log가 있다고 해서 그것을 프로그램 기능으로 간주하지 않는다.

---

# 17. 기존 UI/UX 의미 유지

AI는 화면의 기존 의미를 임의로 변경하지 않는다.

예를 들어:

조회 버튼이 존재한다면 사용자는 "버튼을 눌러야 조회된다"고 예상할 수 있다.

삭제 버튼은 삭제 동작을 예상한다.

저장 버튼은 저장 시점을 의미한다.

UI가 표현하는 사용자 흐름과 실제 코드의 실행 흐름을 일치시킨다.

---

# 18. 코드 추가보다 삭제/수정을 먼저 검토

버그를 해결할 때 새로운 코드를 추가하기 전에 다음 질문을 한다.

"기존의 잘못된 코드 하나를 제거하거나 수정하면 해결되는 문제인가?"

그렇다면 새로운 state/useEffect/function을 추가하지 않는다.

최소 변경을 우선한다.

---

# 19. 요청 범위를 벗어난 변경 금지

사용자가 특정 문제를 요청했다면 해당 문제 해결에 필요한 범위만 수정한다.

다른 잠재적인 개선점을 발견했다면 임의로 수정하지 않는다.

필요하다면 별도로 알려준다.

특히 다음 항목은 명시적인 요청 없이 변경하지 않는다.

* DB schema
* IPC API
* 파일 구조
* 핵심 데이터 모델
* 저장 방식
* 인증 구조
* 공통 컴포넌트 API

---

# 20. 수정 완료 전 Self Review

코드를 수정한 뒤 반드시 스스로 확인한다.

### React

* 불필요한 useEffect를 추가하지 않았는가?
* 기존 useEffect와 역할이 중복되지 않는가?
* 계산 가능한 값을 state로 만들지 않았는가?
* state를 직접 mutation하지 않았는가?
* 최초 render 동작이 요구사항과 맞는가?

### Data

* 같은 DB/API를 중복 호출하지 않는가?
* 조회 전 데이터가 나타나지 않는가?
* 조회 결과 0건과 조회 전 상태를 구분하는가?
* async 처리 중 race condition 가능성이 없는가?

### UX

* 버튼을 누르기 전에 해당 기능이 실행되지 않는가?
* 사용자의 명시적 액션을 자동 실행으로 변경하지 않았는가?
* 기존 화면의 의미가 유지되는가?

### Scope

* 요청하지 않은 코드를 변경하지 않았는가?
* 더 작은 변경으로 해결할 수 있었던 것은 아닌가?
* 임시 workaround를 추가하지 않았는가?

---

# 21. 문제를 발견했을 때의 행동

기존 코드에 잘못된 구조가 발견되어도 요청과 무관하다면 무조건 수정하지 않는다.

다음과 같이 구분한다.

**현재 요청 해결에 반드시 필요함**
→ 함께 수정한다.

**관련은 있지만 필수는 아님**
→ 사용자에게 알려주고 유지한다.

**현재 요청과 무관함**
→ 건드리지 않는다.

---

# 22. 가장 중요한 원칙

AI는 코드를 많이 작성하는 것이 목적이 아니다.

**현재 코드가 왜 그렇게 동작하는지 먼저 이해하고, 가장 작은 올바른 변경으로 해결한다.**

새로운 코드가 필요하지 않다면 추가하지 않는다.

React에서는 특히:

**event-driven 로직은 event handler에 둔다.**

**외부 시스템과의 lifecycle 동기화만 useEffect에 둔다.**

**state/props에서 계산 가능한 값은 다시 state로 만들지 않는다.**

**사용자가 실행해야 하는 기능을 mount 시 자동 실행하지 않는다.**

이 원칙을 다른 편의성보다 우선한다.


AGENTS.md 규칙을 준수하고, 기존 데이터 흐름을 먼저 확인한 뒤 최소 범위만 수정해.

이 프로젝트에서 AI가 반드시 이해해야 하는 Electron + SQLite 아키텍처 규칙”으로 써야 해. 특히 AI가 흔히 하는 실수를 막아야 하고.

# Excel Desktop App — AI Development Rules

이 프로젝트를 수정하는 모든 AI 에이전트는 아래 규칙을 우선적으로 따른다.

목표는 단순히 "동작하는 코드"를 만드는 것이 아니다.

**기존 설계를 이해하고 React, Electron, SQLite의 역할을 구분하여 최소한의 변경으로 문제를 해결한다.**

---

# 1. 수정 전 전체 실행 경로부터 확인

코드를 수정하기 전에 관련 기능의 실행 경로를 먼저 추적한다.

이 프로젝트의 기본 흐름은 다음과 같다.

```text
사용자
↓
React Renderer
↓
event handler
↓
window.api
↓
preload / IPC
↓
Electron Main Process
↓
service / database function
↓
SQLite
```

조회 결과는 반대 방향으로 돌아온다.

```text
SQLite
↓
Main Process
↓
IPC
↓
window.api Promise
↓
React handler
↓
setState
↓
render
```

문제가 발생했다고 Renderer만 보고 판단하지 않는다.

반드시 데이터가 어느 계층에서 생성되고 변환되는지 추적한다.

---

# 2. Electron은 일반적인 React 웹앱이 아니다

이 프로젝트는 웹 서버 기반 React 애플리케이션이 아니라 Electron 데스크톱 애플리케이션이다.

React는 Electron의 Renderer Process에서 실행되는 UI 계층이다.

React 컴포넌트가 애플리케이션 전체가 아니다.

다음 계층을 구분한다.

### Renderer

담당:

* 화면 렌더링
* 사용자 입력
* React state
* 필터/정렬
* UI validation
* 사용자 이벤트 처리

### Preload / window.api

담당:

* Renderer와 Main 사이의 제한된 인터페이스
* IPC 호출 연결

### Main Process

담당:

* 데스크톱 애플리케이션 기능
* SQLite 접근
* 파일 시스템
* Excel 생성
* OS 기능
* Renderer에서 직접 접근하면 안 되는 Node.js 기능

### SQLite

담당:

* 영구 데이터 저장
* 관계형 데이터 조회
* 집계
* 데이터 무결성

각 계층의 책임을 섞지 않는다.

---

# 3. Renderer에서 SQLite에 직접 접근하지 않는다

React에서 다음과 같은 구조를 새로 만들지 않는다.

```text
React → SQLite
```

기존 Electron IPC 구조를 사용한다.

```text
React
↓
window.api.getSomething(params)
↓
IPC
↓
Main Process
↓
database function
↓
SQLite
```

기존 `window.api` 함수가 존재한다면 우선 재사용한다.

새로운 IPC API를 만들기 전에 동일하거나 유사한 기능이 이미 존재하는지 검색한다.

---

# 4. IPC는 함수 호출처럼 보이지만 Process 경계를 넘는다

Renderer에서 다음 코드가 있다고 해서 일반 JavaScript 함수 호출과 동일하게 생각하지 않는다.

```js
await window.api.getClosingCompanies(options);
```

이 호출은 Electron의 Process 경계를 넘을 수 있다.

따라서 다음을 고려한다.

* 비동기 처리
* 직렬화 가능한 데이터
* 오류 전달
* 중복 호출
* 불필요한 IPC 왕복
* Renderer와 Main 사이의 책임

React render 과정에서 IPC를 직접 실행하지 않는다.

다음과 같은 코드는 금지한다.

```js
function Component() {
  window.api.getClosingCompanies();

  return ...;
}
```

렌더링은 여러 번 실행될 수 있다.

IPC는 명확한 이벤트 handler 또는 의도된 lifecycle에서 실행한다.

---

# 5. React Strict Mode를 고려한다

개발 환경에서는 React가 잘못된 side effect를 찾기 위해 특정 lifecycle을 추가로 실행할 수 있다.

따라서

```js
useEffect(() => {
  window.api.saveSomething();
}, []);
```

같은 코드를 단순히 "`[]`니까 한 번만 실행된다"고 가정하지 않는다.

특히 다음 작업을 mount effect에 함부로 넣지 않는다.

* INSERT
* UPDATE
* DELETE
* 메일 발송
* 파일 생성
* 상태 확정
* 외부 시스템 변경

사용자 액션에 의해 발생해야 하는 side effect는 event handler에서 실행한다.

---

# 6. React 기본 데이터 흐름

React 컴포넌트는 가능한 한 다음 구조를 유지한다.

```text
state / props
↓
파생값 계산
↓
render
```

불필요한 useEffect로 state를 동기화하지 않는다.

계산 가능한 값을 다시 state로 만들지 않는다.

---

# 7. 조회 버튼이 있으면 조회 책임은 handler에 둔다

예:

```text
조회 클릭
↓
handleSearch()
↓
window.api.query...
↓
SQLite
↓
result
↓
setRows()
↓
render
```

제품 요구사항에 자동 조회가 명시되어 있지 않다면 다음 구조로 변경하지 않는다.

```text
mount
↓
useEffect
↓
자동 DB 조회
```

UI가 표현하는 사용자 흐름과 실제 실행 흐름을 일치시킨다.

---

# 8. 최초 화면과 조회 결과 없음은 다르다

다음 상태를 구분한다.

```text
INITIAL
LOADING
SUCCESS
EMPTY
ERROR
```

`rows.length === 0` 하나만으로 모든 상태를 판단하지 않는다.

최초 화면에서 DB 조회가 이루어지지 않았다면 "검색 결과 없음"이라고 판단하지 않는다.

---

# 9. 데이터의 Source of Truth를 먼저 확인한다

버그를 수정하기 전에 해당 값의 원본이 어디인지 확인한다.

예:

```text
SQLite column
↓
SQL alias
↓
normalize function
↓
IPC result
↓
React state
↓
UI
```

값이 잘못됐다고 마지막 React 화면에서 임의로 보정하지 않는다.

예를 들어 SQL에서 잘못된 값이 반환된다면 Renderer에 조건문을 추가하여 숨기기보다 SQL 또는 데이터 변환 계층의 원인을 확인한다.

---

# 10. 동일 개념의 이름을 계층마다 임의로 바꾸지 않는다

가능하면 DB → Backend → Renderer에서 의미가 일관된 이름을 사용한다.

예:

```text
customer_code
→ customerCode
```

처럼 snake_case → camelCase 변환은 허용한다.

하지만 의미 자체를 바꾸지 않는다.

예:

```text
sales_amount
→ confirmedAmount
```

처럼 서로 다른 의미의 필드를 편의상 연결하지 않는다.

필요하다면 명시적인 mapping/normalization 함수를 사용한다.

---

# 11. SQLite의 특성을 이해한다

이 프로젝트의 DB가 SQLite라면 MySQL, PostgreSQL, SQL Server의 문법과 동작을 무조건 적용하지 않는다.

SQL을 작성하기 전에 현재 프로젝트가 사용하는 SQLite 버전과 기존 쿼리 패턴을 확인한다.

SQLite에서 실제 지원되는 문법을 사용한다.

다른 DBMS 전용 기능을 추측해서 사용하지 않는다.

---

# 12. SQL을 작성하기 전에 Schema부터 확인한다

쿼리를 추측해서 작성하지 않는다.

반드시 먼저 확인한다.

* 실제 테이블 이름
* 실제 컬럼 이름
* Primary Key
* Foreign Key
* UNIQUE 조건
* NULL 가능 여부
* 데이터 타입
* status 값
* 관계 구조

예를 들어 이름만 보고 다음처럼 추측하지 않는다.

```sql
customers.customer_name
```

실제 schema가

```sql
customer_master.name
```

일 수도 있다.

기존 schema 또는 migration/create table 코드를 먼저 확인한다.

---

# 13. 기존 Query를 먼저 찾는다

새로운 SQL을 작성하기 전에 같은 데이터를 조회하는 기존 SQL이 있는지 검색한다.

특히 다음을 확인한다.

* 동일 테이블
* 동일 JOIN
* 동일 status 조건
* 동일 날짜 조건
* 동일 집계
* 동일 거래처 매핑

기존 쿼리가 존재하면 동일한 관계 정의를 재사용한다.

AI가 화면마다 서로 다른 방식으로 JOIN 관계를 새로 정의하지 않는다.

---

# 14. JOIN은 관계를 이해한 뒤 작성한다

JOIN을 작성할 때 "결과가 나오니까 맞다"고 판단하지 않는다.

각 JOIN에 대해 다음을 설명할 수 있어야 한다.

```text
A와 B는 어떤 관계인가?
1:1인가?
1:N인가?
N:M인가?
어떤 key로 연결되는가?
중복 row가 발생할 가능성이 있는가?
```

특히 집계 쿼리에서 1:N JOIN을 여러 개 연결하면 금액이 중복 집계될 수 있다.

예:

```text
customers
   ↓ 1:N
sales

customers
   ↓ 1:N
contacts
```

이 둘을 그대로 JOIN하면:

```text
customers
JOIN sales
JOIN contacts
```

sales row가 contacts 개수만큼 증식할 수 있다.

그 상태에서

```sql
SUM(sales.amount)
```

를 하면 잘못된 금액이 나올 수 있다.

이런 경우 필요한 테이블을 먼저 집계한 뒤 JOIN하는 방식을 검토한다.

---

# 15. 집계는 Grain을 먼저 정의한다

SUM, COUNT, GROUP BY를 사용하기 전에 결과 한 행이 무엇을 의미하는지 먼저 정의한다.

예:

```text
결과 1행 = 거래처 1개
```

라면 모든 JOIN과 GROUP BY가 그 grain을 유지해야 한다.

또는:

```text
결과 1행 = 거래처 + 업로드 파일
```

이라면 그 기준에 맞게 작성한다.

AI가 grain을 정의하지 않은 상태에서 GROUP BY를 추가하여 중복을 억지로 숨기지 않는다.

---

# 16. DISTINCT를 중복 해결책으로 남용하지 않는다

JOIN 후 데이터가 중복된다고 무조건 다음을 추가하지 않는다.

```sql
SELECT DISTINCT ...
```

먼저 중복이 발생한 이유를 찾는다.

DISTINCT는 실제 요구사항상 중복 제거가 맞을 때만 사용한다.

잘못된 JOIN으로 발생한 중복을 DISTINCT로 숨기지 않는다.

---

# 17. GROUP BY를 오류 제거용으로 사용하지 않는다

결과가 여러 건 나온다는 이유만으로 무작정 GROUP BY를 추가하지 않는다.

GROUP BY는 집계 기준이 명확할 때 사용한다.

먼저 결과 grain을 정의한다.

---

# 18. LEFT JOIN과 INNER JOIN의 의미를 구분한다

INNER JOIN:

```text
양쪽에 데이터가 있는 경우만 반환
```

LEFT JOIN:

```text
왼쪽 데이터는 유지하고 오른쪽 데이터가 없으면 NULL
```

담당자, 매핑 정보, 메일 발송 이력처럼 데이터가 없을 수도 있는 테이블을 INNER JOIN하면 거래처 자체가 결과에서 사라질 수 있다.

"데이터가 안 나온다"는 문제를 UI에서 해결하기 전에 JOIN 종류를 확인한다.

---

# 19. NULL과 0과 빈 문자열을 구분한다

다음을 같은 값으로 취급하지 않는다.

```text
NULL
0
''
```

각각 의미가 다를 수 있다.

SQL에서 무조건 `COALESCE(..., 0)`를 적용하지 않는다.

0이 실제 업무상 "값이 0"이라는 의미인지, 데이터 없음인지 확인한다.

---

# 20. 날짜 조건을 정확하게 처리한다

날짜 필터를 작성할 때 DB에 실제 저장된 형식을 확인한다.

예:

```text
YYYY-MM-DD
YYYY-MM-DD HH:mm:ss
Unix timestamp
```

형식을 확인하지 않고 문자열 비교를 추측해서 사용하지 않는다.

시작일/종료일의 포함 여부도 명확하게 한다.

특히 datetime에 대해 종료일을 다음처럼 작성하면:

```sql
date <= '2026-09-30'
```

시간이 포함된 데이터에서는 의도와 다르게 동작할 수 있다.

실제 저장 형식과 기존 프로젝트의 날짜 처리 규칙을 먼저 확인한다.

---

# 21. 상태값을 추측하지 않는다

예:

```text
ACTIVE
INACTIVE
PENDING
WAITING
DONE
```

같은 상태 문자열을 AI가 임의로 생성하지 않는다.

기존 코드와 schema에서 실제 사용되는 상태값을 확인한다.

대소문자도 기존 정의를 따른다.

---

# 22. Soft Delete를 이해한다

이 프로젝트에서 특정 데이터가 실제 DELETE가 아니라 상태 변경 방식으로 삭제된다면 해당 규칙을 유지한다.

예:

```sql
UPDATE contacts
SET status = 'INACTIVE'
WHERE contact_id = ?
```

이런 구조가 존재한다면 조회 쿼리에서도 필요에 따라:

```sql
WHERE status = 'ACTIVE'
```

조건을 고려해야 한다.

AI가 임의로 physical DELETE로 변경하지 않는다.

반대로 모든 테이블이 soft delete라고 가정하지도 않는다.

각 테이블의 기존 방식을 확인한다.

---

# 23. Parameter Binding을 사용한다

사용자 입력을 문자열 보간하여 SQL에 직접 삽입하지 않는다.

금지:

```js
db.prepare(`
  SELECT *
  FROM customers
  WHERE name = '${customerName}'
`);
```

권장:

```js
db.prepare(`
  SELECT *
  FROM customers
  WHERE name = ?
`).all(customerName);
```

또는 프로젝트에서 사용하는 named parameter 방식을 따른다.

---

# 24. SQL과 JavaScript의 책임을 구분한다

DB가 잘하는 작업:

* WHERE filtering
* JOIN
* SUM
* COUNT
* GROUP BY
* 필요한 데이터 범위 제한

React가 잘하는 작업:

* 화면 필터
* 선택 상태
* 정렬 UI
* 표시 형식
* 임시 상태

대량 DB 데이터를 전부 Renderer로 가져온 뒤 JavaScript에서 DB 역할을 다시 구현하지 않는다.

반대로 UI 표현을 위해 지나치게 복잡한 SQL을 만들지도 않는다.

---

# 25. CTE는 의미 있는 단계로 사용한다

복잡한 SQL에서는 CTE를 사용할 수 있다.

예:

```sql
WITH selected_upload AS (...),
sales_summary AS (...),
send_summary AS (...)
SELECT ...
```

각 CTE는 명확한 책임을 가져야 한다.

CTE를 많이 만드는 것이 좋은 SQL이라는 의미는 아니다.

각 CTE가 무엇을 계산하고 결과 grain이 무엇인지 이해한 상태에서 작성한다.

---

# 26. 쿼리 수정 시 결과 건수와 금액을 검증한다

SQL 수정 후 단순히 "에러가 안 난다"로 완료하지 않는다.

최소한 다음을 확인한다.

```text
예상 거래처 수
실제 row 수

예상 매출 건수
실제 매출 건수

예상 공급가액
실제 SUM

예상 부가세
실제 SUM

예상 합계
실제 SUM
```

JOIN 변경 후에는 특히 집계 금액이 증가하지 않았는지 확인한다.

---

# 27. JavaScript에서 SQL 오류를 숨기지 않는다

DB 쿼리가 잘못되었다면 다음과 같은 방식으로 Renderer에서 억지로 보정하지 않는다.

```js
rows.filter(...)
rows.reduce(...)
중복 제거
임의 기본값
```

먼저 SQL 결과 자체가 올바른지 확인한다.

단, 실제 UI 전용 필터링은 Renderer에서 수행한다.

---

# 28. 저장 작업과 조회 작업을 구분한다

조회:

```text
SELECT
```

저장:

```text
INSERT / UPDATE / DELETE
```

조회 함수가 예상치 못한 저장 side effect를 가지지 않도록 한다.

함수 이름과 실제 동작을 일치시킨다.

예:

```js
getClosingCompanies()
```

는 원칙적으로 조회 역할이어야 한다.

조회 과정에서 데이터를 자동 수정해야 하는 특별한 이유가 있다면 기존 설계를 먼저 확인한다.

---

# 29. Transaction이 필요한 작업을 확인한다

여러 DB 변경이 하나의 업무 단위라면 중간 실패로 일부만 저장되는 문제가 없는지 확인한다.

예:

```text
upload 생성
↓
upload rows 저장
↓
mapping 저장
↓
summary 갱신
```

전체가 하나의 작업이어야 한다면 transaction 사용을 검토한다.

하지만 모든 단일 UPDATE에 무조건 transaction wrapper를 추가하지 않는다.

---

# 30. 기존 DB 라이브러리 사용 방식을 유지한다

프로젝트에서 사용하는 SQLite 라이브러리와 패턴을 먼저 확인한다.

예:

```js
database.prepare(...).get()
database.prepare(...).all()
database.prepare(...).run()
```

각 메서드의 의미를 구분한다.

일반적으로:

```text
get() → 단일 row
all() → 여러 row
run() → INSERT / UPDATE / DELETE
```

기존 프로젝트의 실제 라이브러리 API를 우선한다.

다른 ORM이나 DB 라이브러리의 API를 섞지 않는다.

---

# 31. 변경 전 호출 관계를 검색한다

함수 하나를 수정하기 전에 그 함수가 어디에서 호출되는지 확인한다.

예:

```text
getClosingCompanies
```

를 수정한다면 먼저 프로젝트 전체에서 해당 함수의:

* 정의 위치
* IPC 등록 위치
* preload 노출 위치
* Renderer 호출 위치

를 확인한다.

함수 이름만 보고 역할을 추측하지 않는다.

---

# 32. 한 계층의 버그를 다른 계층에서 덮지 않는다

예:

SQL JOIN 문제
→ React filter로 숨기지 않는다.

React lifecycle 문제
→ SQL 조건을 변경해서 숨기지 않는다.

IPC 중복 호출
→ DB에서 DISTINCT로 숨기지 않는다.

DB NULL 문제
→ 무조건 UI에서 0으로 바꾸지 않는다.

**문제가 발생한 계층에서 원인을 해결한다.**

---

# 33. AI가 SQL을 수정할 때 반드시 수행할 사고 순서

SQL을 작성하거나 수정하기 전에 다음 순서로 확인한다.

```text
1. 사용자가 원하는 결과가 무엇인가?
2. 결과 1행의 의미(grain)는 무엇인가?
3. 어떤 테이블이 source of truth인가?
4. 실제 schema는 무엇인가?
5. 필요한 테이블 관계는 무엇인가?
6. 각 관계는 1:1 / 1:N 중 무엇인가?
7. JOIN으로 row multiplication이 발생하는가?
8. WHERE 조건이 LEFT JOIN을 사실상 INNER JOIN으로 바꾸지는 않는가?
9. NULL의 의미는 무엇인가?
10. 집계 전에 중복이 발생하지 않는가?
11. 기존 프로젝트에 같은 쿼리 패턴이 있는가?
12. 결과 건수와 금액을 어떻게 검증할 것인가?
```

이 과정을 생략하고 바로 SQL부터 작성하지 않는다.

---

# 34. AI가 React/Electron 기능을 수정할 때 반드시 수행할 사고 순서

```text
1. 사용자 액션은 무엇인가?
2. 어느 React handler에서 시작하는가?
3. 어떤 window.api가 호출되는가?
4. preload에서 어디로 연결되는가?
5. Main Process에서 어떤 handler가 받는가?
6. 어떤 DB 함수가 호출되는가?
7. 어떤 SQL이 실행되는가?
8. 결과가 어떤 형태로 반환되는가?
9. normalization/mapping 과정이 있는가?
10. 어떤 state가 변경되는가?
11. 그 state로 어떤 UI가 렌더링되는가?
```

중간 계층을 건너뛰고 추측하지 않는다.

---

# 35. 기존 코드를 먼저 읽고 수정한다

이 프로젝트에서는 새로운 코드를 빠르게 작성하는 것보다 기존 코드의 의도를 유지하는 것이 중요하다.

AI는 특히 다음 행동을 피한다.

* 이름만 보고 함수 역할 추측
* schema를 보지 않고 SQL 작성
* 화면만 보고 DB 구조 추측
* 기존 handler를 보지 않고 useEffect 추가
* 기존 IPC를 보지 않고 새로운 API 추가
* JOIN 문제를 DISTINCT로 해결
* 데이터 문제를 React에서 임의 보정
* 한 가지 문제를 해결하면서 관련 없는 구조까지 변경

---

# 36. 최종 원칙

이 프로젝트는 다음 네 계층을 명확하게 구분한다.

```text
React
= 화면과 사용자 상태

Electron IPC
= Process 사이의 통신 경계

Main / Backend
= 데스크톱 기능과 업무 로직

SQLite
= 영구 데이터와 관계형 조회
```

문제를 수정할 때 먼저 **어느 계층의 문제인지 판단한다.**

그리고 해당 계층에서 원인을 해결한다.

**React 문제를 DB로 해결하지 않는다.**

**DB 문제를 React로 숨기지 않는다.**

**IPC 문제를 중복 호출이나 임시 state로 우회하지 않는다.**

**SQL은 결과가 나오는 것이 아니라 결과가 정확해야 한다.**
