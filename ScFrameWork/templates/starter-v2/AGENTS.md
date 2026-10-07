# 생성 앱 개발 규칙

이 앱은 공개 배포된 @sc/ui/runtime/date/excel/i18n 및 서버 Starter를 소비합니다. 프레임워크의 src, 다른 앱, 원본 업무, DB·secret·runtime을 복사하거나 상대 import하지 않습니다.

- 화면은 Vue SFC template → script setup lang="ts" → style 순서입니다. JSX/render/h 화면은 사용하지 않습니다.
- 직접 만든 공통 UI만 Sc PascalCase 파일/import와 sc-kebab-case 태그를 사용합니다. 업무 DTO/API/composable에는 Sc를 붙이지 않습니다.
- URL은 Router, 서버 자료는 Vue Query, 작성 입력은 VeeValidate/ref, 세션 공유는 runtime이 원본입니다.
- 업무 HTTP는 runtime.client 하나만 사용합니다. 인증 쿠키·CSRF·세션 응답 폐기 계약을 보존합니다.
- 폼 규칙은 Zod safeParse를 VeeValidate 필드 오류에 직접 연결합니다. 409와 자동 재조회가 입력을 덮어쓰지 않게 합니다.
- H2 migration과 권한은 앱이 소유합니다. JPA 단순 읽기/쓰기, Querydsl 동적 목록, MyBatis 집계는 같은 DataSource/JpaTM을 사용합니다. JPA 변경 후 Mapper 조회 전에 flush합니다.
- 비밀 파일은 새 SC_HOME 안의 모드600으로만 생성하며 출력하거나 프런트 public/static에 넣지 않습니다.
- npm 잠금 파일은 이 앱의 package-lock.json 하나입니다. 최초 npm install 후 커밋하고 반복 설치는 npm ci를 사용합니다.
- 실제 dev 서버에서 api 타입을 생성합니다. 첫 통합 빌드는 scripts/build.sh를 사용하고 npm run api:check 및 서버 테스트를 통과시킵니다.
- 검증하지 않은 기능을 완료로 표시하지 않습니다. README의 optional 예제와 실제 저장 계약을 구분합니다.

- 생성 앱 자체 버전 1.0.0과 프레임워크 배포 버전은 구분한다. Notes generated API는 이 앱 업무 계약이며 운영 기술 DTO는 공개 runtime ApiComponents를 소비한다.
- operations는 명시적 선택 profile이다. 기본 빌드/실행에서 broker/운영 secret을 요구하지 않는다. messages V3/Quartz-browser V4는 앱 소유 migration이며 기본 Notes V1/감사 V2를 덮어쓰지 않는다.
- 브라우저 오류는 appVersion/등록 Router name/source/eventCode/UUID만 보내며 원문 message/stack/url/query/입력을 수집하지 않는다. secrets/operations의 기존 값을 덮어쓰지 않으며 원본 프로젝트 runtime은 복사하지 않는다. 연결 준비는 자신의 인프라에서 명시한 두 private 파일만 사용한다.
