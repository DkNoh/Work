# `__APP_NAME__`

ScFramework 배포 파일을 소비하는 독립 앱입니다. 자신의 소스·npm 잠금 파일·H2·마이그레이션을 소유하며 프레임워크 저장소의 workspaces나 상대 import를 사용하지 않습니다. 라이선스는 UNLICENSED/internal입니다. 공개 npm 배포를 수행하지 않습니다.

```bash
npm install
bash scripts/build.sh
bash scripts/run.sh
```

첫 `npm install`은 이 앱만의 package-lock.json을 만듭니다. 검토 후 커밋하고 이후에는 `npm ci`를 사용합니다. 생성기는 설치를 실행하지 않습니다. Node 24.16.0/npm 11.13.0/JDK 21이 기준입니다. JAVA21_HOME 또는 JAVA_BIN으로 JDK를 선택할 수 있습니다.

서버 빌드는 generated `backend/mvnw`를 사용합니다. Wrapper는 자신의 위치에서 `vendor/maven` URI를 계산해 SC_GENERATED_VENDOR_URI 환경 변수로 전달하고, 기본으로 앱의 `.mvn/sc-vendor-settings.xml`을 `--settings`로 사용합니다. settings의 활성 profile은 부모 POM을 찾기 전에 file repository를 등록합니다. 고정 절대 경로·framework reactor·개인 Maven 캐시에 의존하지 않습니다. `scripts/build.sh`는 앱 root에서 실행하고 내부에서 backend로 이동하며, Wrapper는 다른 cwd에서도 자신의 위치로 URI를 계산합니다.

사용자가 `-s`, `--settings`, `--settings=...`, `-s...`를 지정하면 Wrapper는 기본 settings를 덧붙이지 않습니다. 이 경우 자신이 지정한 settings에 같은 vendor repository 및 active profile을 포함해야 합니다. SC_GENERATED_VENDOR_URI는 계속 제공됩니다. bare `mvn`은 환경 URI와 이 settings를 모두 명시해야 합니다. 사용자 mirror가 file repository까지 대체하지 않도록 자신의 Maven settings 정책을 확인하세요. 기본 settings는 localRepository를 지정하지 않으므로 외부 검증의 `MAVEN_OPTS=-Dmaven.repo.local=...` 독립 캐시 설정을 유지합니다. Windows Wrapper는 같은 선택을 구현했지만 Windows에서 실제 실행한 결과는 별도 확인 대상입니다.

첫 빌드는 backend metadata JAR → 새 임시 H2/600 secret의 dev 서버 → 실제 OpenAPI 및 타입 생성 → 프런트 검증·빌드 → 서버 테스트 및 최종 JAR 순서입니다. `docs/openapi.json`과 `frontend/src/generated/api.d.ts`는 이 앱의 실제 서버가 생성합니다. 초기 `npm run build`만 실행하면 아직 생성되지 않은 API 타입 때문에 실패할 수 있으므로 먼저 통합 빌드를 실행하세요. `npm run api:check`는 수집한 명세와 생성 타입의 차이를 검사하며 원격 서버 명세를 자동 신뢰하지 않습니다.

```bash
bash scripts/dev.sh
bash scripts/stop.sh
SC_PROFILE=dev,audit,file-storage bash scripts/run.sh
```

프런트 포트는 `__FRONTEND_PORT__`, 서버 포트는 __SERVER_PORT__입니다. dev는 Vite 프록시를 사용합니다. JAR는 프런트 정적 파일을 포함합니다. 기본 prod는 Swagger를 끄며 dev에서 `/swagger-ui/index.html` 및 `/v3/api-docs`를 제공합니다. `audit`와 `file-storage`는 앱이 명시적으로 선택하는 프로필입니다. 기본 Notes V1과 선택 감사 V2는 앱이 소유합니다. 감사는 선택 프로필의 새 H2에 저장합니다. file-storage의 storage-demo는 현재 기동의 메타데이터만 유지하고 정상 종료 때 파일을 정리하는 소비 예제이며, 재기동할 업무 파일 metadata를 만들지는 않습니다. operations에서 선택하는 durable 정리 전달은 아래 별도 경계를 따릅니다. 개발 기본 자료는 `.runtime/dev`, JAR 기본 자료는 `.runtime/local`입니다.

비밀번호는 새 `.runtime/<환경>/secrets/bootstrap.secret`에 모드 600으로만 생성됩니다. 값을 로그나 문서에 쓰지 않습니다. 운영에서는 별도로 준비한 secret과 SC_HOME을 지정하세요. 초기 username은 admin이며 SC_BOOTSTRAP_USERNAME으로 변경할 수 있습니다. 이 Starter는 파일 기반 계정을 사용하므로 기존 로그인 세션이나 비밀번호/DB 파일을 복사하지 않습니다. 파일 기반 secret 변경의 재인증·운영 정책은 소비 앱이 정합니다. 비밀번호 확인이 필요하면 자신의 새 파일만 로컬에서 확인하세요.

Notes는 세션 계정별 자료만 읽고 작성합니다. 제목은 앞뒤 공백 제거 후 1~200자, 최초 revision 1, 변경 후 증가, 동일 제목 저장은 revision 유지입니다. stale revision은 409이며 폼 입력을 보존합니다. 조회는 JPA/Querydsl, 읽기 DTO는 MapStruct, 저장 뒤 집계는 같은 DataSource/JpaTM의 MyBatis를 사용합니다. 성공 응답은 `{item,stats}`입니다. 서버 테스트는 CSRF·실제 신규 파일 로그인·owner 범위·literal 검색·stale revision·혼합 rollback·loopback Feign 실패를 확인합니다. 프런트는 VeeValidate 상태와 Zod 규칙을 직접 연결하며 Vue Query/URL을 원본으로 사용합니다.

선택 `/patterns`는 board/image/table/chart/editor/date/Excel의 공통 공개 API 예제입니다. 이 화면의 편집 자료는 로컬 예제이며 영속화 완료라고 표시하지 않습니다. `VITE_SC_PATTERNS_ENABLED=false npm run build`로 화면을 제외할 수 있습니다. Notes가 실제 저장 예제입니다. 서버의 `GET /api/integration/sample`은 SC_SAMPLE_HTTP_URL로 명시한 loopback HTTP client를 사용하며 쿠키/CSRF를 외부로 자동 전달하지 않습니다. 기본 주소 127.0.0.1:18190에 서버가 없다면 안전한 502가 정상입니다.

`sc-starter.lock.json`은 사용한 템플릿·배포 버전과 초기 소스/배포 SHA를 기록합니다. 이후 자신의 소스 변경을 막는 잠금 파일이 아니며 자동 덮어쓰기/업그레이드 도구도 아닙니다. `vendor`의 5개 npm tarball과 Maven 4좌표/7파일은 생성 시 검증한 배포 파일입니다. 업그레이드는 새 배포 세트의 변경 계약을 검토하고 source/manifest/lock을 명시적으로 갱신한 뒤 재검증합니다.

프런트는 strict 애플리케이션 타입 검사와 skipLibCheck=true를 사용합니다. VueKonva/Vuetify의 공급자 선언 충돌 때문에 모든 공급자 선언의 strict 검사 통과를 보장하지 않습니다. 애플리케이션의 공개 타입 오용은 일반 typecheck에서 검사됩니다. 직접 버전은 package.json과 설치 후 생성한 잠금 파일을 원본으로 삼습니다.

## 선택 운영 profile

이 앱은 templateVersion 2와 framework 0.3.0을 소비합니다. 앱 자체 package/POM version은 1.0.0입니다. 기본 prod/dev는 messaging/scheduler/browserErrors/observability OFF이므로 RabbitMQ나 운영 연결 secret 없이 Notes 빌드·실행이 가능합니다. operations profile을 자동으로 켜거나 외부 인프라를 자동 설치하지 않습니다.

```bash
# 새 private SC_HOME에 연결 secret을 준비합니다. 값을 출력하지 않습니다.
node scripts/prepare-operations.mjs --home /absolute/private/operations-home
# 이미 준비한 자신의 인프라 secret을 쓸 때만 두 파일을 명시 복사합니다.
node scripts/prepare-operations.mjs --home /absolute/private/another-home \
  --source /absolute/private/infra/secrets/operations
SC_HOME=/absolute/private/operations-home SC_PROFILE=dev,operations bash scripts/run.sh
# Vite 개발도 명시적으로 같은 선택을 합니다.
SC_HOME=/absolute/private/operations-home SC_PROFILE=dev,operations bash scripts/dev.sh
```

두 명령은 각각 새 destination을 대상으로 합니다. 기존 secrets/operations를 덮어쓰지 않으므로 이미 준비한 경로는 `--check`로 확인합니다. `spring.rabbitmq.password`와 `observer.secret`만 owned regular mode600 파일로 사용합니다. source/destination의 symlink를 거절합니다. 최초 생성한 Rabbit password는 자신이 운영하는 외부 broker에도 설정해야 합니다. 이미 실행 중인 broker와 연결할 때는 그 인프라의 private 파일을 source로 지정합니다. secret 값을 코드·환경값 목록·문서·stdout에 옮기지 않습니다. run.sh는 operations secret을 자동 생성하지 않고 준비 상태를 확인하며 기본 prod는 이 확인을 요구하지 않습니다.

외부 RabbitMQ는 기본 127.0.0.1:5679, username sc-framework를 사용합니다. SC_MQ_HOST/SC_MQ_PORT/SC_MESSAGING_APPLICATION_ID로 선택합니다. 기본 namespace는 앱 이름과 public SHA에서 생성한 `__APPLICATION_ID__`이며 같은 앱 재시작에서 유지됩니다. OTLP endpoint는 SC_OTLP_ENDPOINT, 관리 포트는 SC_MANAGEMENT_PORT(기본18482)로 지정합니다. 여러 앱/fixture는 각각 고유 broker namespace·관리 포트·SC_HOME을 사용해야 합니다. 관리 Prometheus는 별도의 stateless observer 인증 경계를 사용하고 일반 업무 세션·CSRF를 그대로 둡니다.

앱 소유 migration 순서는 Notes V1, 선택 감사 V2, operations messages V3, Quartz/browser V4입니다. operations profile은 세 locations를 합쳐 버전 중복 없이 적용합니다. 기본 예약은 OUTBOX_DISPATCH(ID1/매분), FILE_RECOVERY(ID2/5분), SAFE_RETENTION(ID3/03:00UTC)이며 첫 한 번 생성하고 이후 수정·pause를 재시작에서 덮어쓰지 않습니다. PULSE는 등록만 하고 자동 예약은 만들지 않습니다. seconds0 cron/실제 ZoneId/revision을 서버에서 검사하고 같은 DataSource/JpaTM을 사용합니다. 네트워크 작업의 효과를 Quartz가 정확히 한 번 보장한다고 주장하지 않습니다.

세 운영 화면은 /operations/messages, /operations/schedules, /operations/browser-errors입니다. 현재 인증 provider ADMIN을 서버에서 다시 검사하고 capabilities ON일 때 메뉴/collector를 설치합니다. 운영 UI는 공개 @sc/runtime ApiComponents의 중립 기술 DTO를 사용합니다. Notes는 앱의 실제 generated/api.d.ts를 계속 원본으로 사용하며 둘을 수동 복사하지 않습니다. collector는 appVersion1.0.0과 notes/patterns/운영 Router name만 전송하고 원문 message/stack/url/query/입력을 읽거나 저장하지 않습니다. 세션 전환·앱 unmount에서 해제하며 실패 보고를 재보고하지 않습니다.

storage-demo는 현재 프로세스의 whitelist metadata를 사용하고 정상 종료 때 정리를 요청합니다. operations의 durable cleanup/outbox는 그 정리 전달을 영속화하지만, 이 예제의 파일 metadata를 업무 DB metadata로 바꾸지 않습니다. 정상 종료 전 새 기동에서 이전 파일을 다운로드할 수 있다거나 강제 종료 복구를 확인했다고 표시하지 않습니다.

v2의 신규 JUnit/생성기 검사는 작성 단계입니다. 실제 clean consumer npm/Maven/JAR/운영 profile/browser 검증은 배포 세트가 준비된 뒤 실행하여 별도 결과를 남깁니다. Windows Wrapper/원격 CI/보조기기 수동 검증은 별도 확인 대상입니다.
