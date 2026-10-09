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

프런트 포트는 `__FRONTEND_PORT__`, 서버 포트는 __SERVER_PORT__입니다. dev는 Vite 프록시를 사용합니다. JAR는 프런트 정적 파일을 포함합니다. 기본 prod는 Swagger를 끄며 dev에서 `/swagger-ui/index.html` 및 `/v3/api-docs`를 제공합니다. `audit`와 `file-storage`는 앱이 명시적으로 선택하는 프로필입니다. 기본 Notes V1과 선택 감사 V2는 앱이 소유합니다. 감사는 선택 프로필의 새 H2에 저장합니다. file-storage의 storage-demo는 현재 기동의 메타데이터만 유지하고 정상 종료 때 파일을 정리하는 소비 예제이며, 재기동 보존·crash 이후 durable 정리 큐는 구현하지 않습니다. 개발 기본 자료는 `.runtime/dev`, JAR 기본 자료는 `.runtime/local`입니다.

비밀번호는 새 `.runtime/<환경>/secrets/bootstrap.secret`에 모드 600으로만 생성됩니다. 값을 로그나 문서에 쓰지 않습니다. 운영에서는 별도로 준비한 secret과 SC_HOME을 지정하세요. 초기 username은 admin이며 SC_BOOTSTRAP_USERNAME으로 변경할 수 있습니다. 이 Starter는 파일 기반 계정을 사용하므로 기존 로그인 세션이나 비밀번호/DB 파일을 복사하지 않습니다. 파일 기반 secret 변경의 재인증·운영 정책은 소비 앱이 정합니다. 비밀번호 확인이 필요하면 자신의 새 파일만 로컬에서 확인하세요.

Notes는 세션 계정별 자료만 읽고 작성합니다. 제목은 앞뒤 공백 제거 후 1~200자, 최초 revision 1, 변경 후 증가, 동일 제목 저장은 revision 유지입니다. stale revision은 409이며 폼 입력을 보존합니다. 조회는 JPA/Querydsl, 읽기 DTO는 MapStruct, 저장 뒤 집계는 같은 DataSource/JpaTM의 MyBatis를 사용합니다. 성공 응답은 `{item,stats}`입니다. 서버 테스트는 CSRF·실제 신규 파일 로그인·owner 범위·literal 검색·stale revision·혼합 rollback·loopback Feign 실패를 확인합니다. 프런트는 VeeValidate 상태와 Zod 규칙을 직접 연결하며 Vue Query/URL을 원본으로 사용합니다.

선택 `/patterns`는 board/image/table/chart/editor/date/Excel의 공통 공개 API 예제입니다. 이 화면의 편집 자료는 로컬 예제이며 영속화 완료라고 표시하지 않습니다. `VITE_SC_PATTERNS_ENABLED=false npm run build`로 화면을 제외할 수 있습니다. Notes가 실제 저장 예제입니다. 서버의 `GET /api/integration/sample`은 SC_SAMPLE_HTTP_URL로 명시한 loopback HTTP client를 사용하며 쿠키/CSRF를 외부로 자동 전달하지 않습니다. 기본 주소 127.0.0.1:18190에 서버가 없다면 안전한 502가 정상입니다.

`sc-starter.lock.json`은 사용한 템플릿·배포 버전과 초기 소스/배포 SHA를 기록합니다. 이후 자신의 소스 변경을 막는 잠금 파일이 아니며 자동 덮어쓰기/업그레이드 도구도 아닙니다. `vendor`의 5개 npm tarball과 Maven 4좌표/7파일은 생성 시 검증한 배포 파일입니다. 업그레이드는 새 배포 세트의 변경 계약을 검토하고 source/manifest/lock을 명시적으로 갱신한 뒤 재검증합니다.

프런트는 strict 애플리케이션 타입 검사와 skipLibCheck=true를 사용합니다. VueKonva/Vuetify의 공급자 선언 충돌 때문에 모든 공급자 선언의 strict 검사 통과를 보장하지 않습니다. 애플리케이션의 공개 타입 오용은 일반 typecheck에서 검사됩니다. 직접 버전은 package.json과 설치 후 생성한 잠금 파일을 원본으로 삼습니다.
