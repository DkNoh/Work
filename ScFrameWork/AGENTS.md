# ScFramework 개발 규칙

ScFramework는 `/Users/dk/Work/WorkboardVue`의 업무·API·UI 계약을 참고해 만드는 독립 공통 프레임워크다. WorkboardVue와 `/Users/dk/Work/workboard`의 실행 코드·의존성·DB·업로드·비밀번호·`.runtime`을 수정하거나 복사하지 않는다. 레퍼런스의 문서 작업은 `WorkboardVue/docs/질의`에 기록할 수 있다.

- 개발 단계는 `001`~`012` 순서다. 실제 구현·실행 확인과 후속 업무 작업을 구분한다.
- 신규 기술 기준은 Vue 3/Vuetify·Spring Boot 3.5.16·JDK 21·H2다. JPA는 단순 조회·쓰기, MyBatis는 복잡 조회, OpenFeign은 서버의 외부 HTTP 연동을 맡는다.
- 사용자 요청에 따라 Redis·JWT·SSO는 제외한다. 서버 세션·CSRF를 유지한다.
- 조건부 기술도 모두 구현 대상이다. docs/질의/조건부기술-전체구현.md의 단계별 목록을 따른다. 소비 앱 활성은 선택 가능하나 실제 구현·예제·기능 테스트는 필수다.
- 공통 UI/runtime/서버 Starter는 업무 레퍼런스 앱을 import하지 않는다. 레퍼런스 앱과 최소 Starter 앱이 공통 모듈을 소비한다.
- UI는 SFC `<template>` → `<script setup lang="ts">` → `<style>` 순서로 작성한다. render/h/JSX/TSX 화면을 만들지 않는다.
- 자체 공통 UI는 파일/import `ScActionButton`, 템플릿 `<sc-action-button>`, CSS `.sc-*`를 사용한다. 업무/API/DTO/composable에는 Sc를 자동 적용하지 않는다.
- URL은 Router, 서버 자료는 Vue Query, 저장 전 입력은 해당 폼, 계산은 computed, 실제 공유 상태는 Pinia가 원본이다.
- 모든 업무 HTTP는 공통 runtime의 단일 client를 사용한다. 쿠키 세션·CSRF JSON `headerName/token`·30초 timeout·필드 오류·이전 세션 응답 폐기를 보존한다.
- VeeValidate 4/Zod 4는 safeParse를 직접 연결한다. 호환 범위 밖의 Zod 어댑터를 추가하지 않는다.
- props는 읽기 전용, 입력 변경은 model/emit, 업무 권한·상태 전이·revision은 앱의 Service와 기능 폴더가 소유한다.
- 성공 JSON을 일괄 success/data 봉투로 바꾸지 않는다. 서버 오류는 code/message/errors[], 프런트는 ApiError.fields로 연결한다.
- H2 migration은 앱이 소유한다. JPA/MyBatis는 같은 DataSource/트랜잭션을 사용하고 JPA 변경 후 Mapper 조회는 flush를 검증한다. DDL 커밋과 DML rollback을 구분한다.
- OpenFeign은 명시적인 client 목록·URL·timeout·오류 매핑으로 구성한다. 수신 사용자 cookie/CSRF를 외부로 자동 전달하지 않는다. 실제 외부 API 대신 loopback mock으로 테스트한다.
- npm workspaces와 루트 package-lock.json 하나를 사용한다. 정확한 직접 버전을 관리하고 `npm ci`로 재현한다.
- 신규 개발 기본값은 Vue 5175/Spring 18082다. E2E는 별도 포트·임시 H2/계정 자료를 사용한다. 실제 사용자 실행 자료를 테스트에 사용하지 않는다.
- 실행 자료·secret·DB는 frontend public와 Spring static에 넣지 않는다. Vite fs.deny의 /@fs 차단과 개발 실행 회귀 검사를 유지한다.
- 최초 개발 비밀번호는 새 `.runtime/dev/secrets/bootstrap.secret`에 파일 모드 600으로 생성한다. 값을 로그·코드·문서·응답에 남기지 않는다.
- 프런트 변경은 format/lint/typecheck/unit/build, 통합 변경은 `scripts/build.sh`와 관련 서버/JAR/E2E 검증을 수행한다. Storybook과 JAR 출력은 분리한다.
- `[x]`는 실제 확인한 항목만 표시하고 명령·결과·실패·미확인을 남긴다. 구조 변경 시 docs/folder-structure.md·maintenance-guide.md를 갱신한다.

먼저 README.md, docs/질의/001-프로젝트생성.md, docs/folder-structure.md, docs/maintenance-guide.md, docs/api.md, docs/operations.md를 읽는다.

초기 생성 때 참고할 설계는 `../WorkboardVue/docs/질의/기술스택-필수여부.md`, `신규프레임워크-구성안.md`, `개발가이드.md`, `네이밍룰.md`, `Storybook-테스트.md`다. 신규 실제 경로·실행 계약은 이 프로젝트의 docs가 원본이다.
