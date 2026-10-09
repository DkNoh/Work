# 011 Starter 생성기

상태: **011 생성기·패키지 소비 구현 및 로컬 통합 검증 완료**다. 실제 0.1.0/0.2.0 배포 세트의 생성·경계 검증과 repository 밖 소비 앱의 install/cold build/API bootstrap/JAR/browser를 확인했다. 같은 앱의 0.1.0→0.2.0→0.1.0 변경에서도 손작성 source·H2·old lock을 보존했다. 실제 검증 경로와 한계는 아래 근거로 구분한다. 자체 라이선스는 UNLICENSED/internal이며 공개 npm publish를 실행하지 않는다. 012 운영·crash 복구·backup은 후속 단계다.

구현은 [create-starter.mjs](../../scripts/create-starter.mjs), [명시적 템플릿 allowlist](../../templates/starter-v1/template.json), [Node 생성기 검사](../../scripts/verify-starter-generator.mjs)가 소유한다. [준비 검토](011-배포와생성기-준비검토.md)의 모노레포 alias·SFC 소스 배포·독립 잠금 파일 문제를 실제 compiled 패키지 소비 계약으로 바꾼다. 생성 앱은 Reference와 원본 업무를 import하지 않는다.

| 항목         | 생성 계약                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| CLI          | `--target --name --java-package --frontend-port --server-port --artifacts`, 선택 `--dry-run`                |
| name         | 소문자로 시작하는 1~50자 kebab-case                                                                         |
| Java package | 소문자 2개 이상 구간, 길이 150 이하, 지정한 예약어 거절                                                     |
| 포트         | 정수 1024~65535, 프런트·서버 서로 다른 값                                                                   |
| 대상         | 새 경로 또는 기존 빈 디렉터리. 기존 파일이 있으면 거절                                                      |
| 경로 보호    | 대상 및 모든 ancestor symlink 거절. 프레임워크/WorkboardVue/workboard 내부 거절. 실제 디렉터리 inode도 확인 |
| template     | format 1/templateVersion 1, 승인된 프레임워크 버전 0.1.0·0.2.0, 61개 명시 파일의 SHA-256·mode 검증          |
| artifacts    | 공통 checker의 format·정확한 패키지/좌표·실제 내용·SHA·경로·symlink 검증 뒤 복사                            |
| 실행 정책    | 생성 시 npm 설치, Maven, 서버·브라우저 실행, secret 생성 없음                                               |
| 출력         | 모노레포 밖 독립 앱, `sc-starter.lock.json` 초기 provenance                                                 |
| 기존 앱 변경 | 재생성·자동 덮어쓰기·자동 codemod 범위 밖                                                                   |

```bash
node scripts/create-starter.mjs \
  --target /private/tmp/sc-framework-new-app/sc-notes \
  --name sc-notes --java-package dev.scconsumer.notesapp \
  --frontend-port 5186 --server-port 18096 \
  --artifacts /Users/dk/Work/ScFramework/.runtime/releases/011/v0.2.0 \
  --dry-run
```

`--dry-run`은 검증과 메모리 내 렌더링 결과만 출력한다. 패키지 checker는 private 임시 추출 폴더를 만들 수 있으며 finally에서 제거한다. 생성기 자체는 대상·부모·secret·설치 폴더를 쓰지 않는다. 정상 생성은 같은 대상의 wx lock을 잡고 새 staging에 모든 파일을 쓴 뒤 rename한다. 실패하면 자신이 만든 staging·빈 부모 경로·lock만 정리한다. 기존 사용자 자료는 삭제하지 않는다. 이는 정상 CLI 동시 실행을 직렬화하는 계약이며 다른 프로세스가 동시에 filesystem을 악의적으로 교체하는 보안 격리를 제공한다는 뜻은 아니다. SHA manifest는 배포 무결성과 우발적 변경 검사이며 배포 서명·신뢰된 공급자 인증을 대신하지 않는다.

위 새 target은 사용 예시다. 실제 외부 검증은 아래 candidate3/candidate4의 별도 경로를 사용했으며 기존 first/second 앱을 덮어쓰지 않았다. 현재 root/npm framework 0.2.0·Maven 0.2.0-SNAPSHOT, 기존 공통 API v0.1, 생성 앱의 독립 1.0.0은 서로 다른 버전 책임이다.

실제 파일 복사와 패키지 검사는 [verify-package-artifacts.mjs](../../scripts/verify-package-artifacts.mjs)의 `verifyArtifactDirectory()`를 재사용한다. generator에는 tar 해제 코드를 중복 작성하지 않는다. UI의 공개 component stamp와 실제 compiled JS/d.ts named export도 공통 checker의 대상이다.

| 배포 입력                                         | 독립 앱 출력                                              |
| ------------------------------------------------- | --------------------------------------------------------- |
| `@sc/ui/runtime/date/excel/i18n` 정확한 5 tarball | `vendor/npm/*.tgz`, root package.json의 `file:` 의존성    |
| parent/core/autoconfigure/Starter 4좌표           | `vendor/maven/dev/scframework/...`의 4POM·3plain JAR      |
| `artifacts.json` 버전·hash                        | `sc-starter.lock.json`에 배포 버전 및 생성 파일 hash 기록 |
| framework 부모 버전                               | generated backend 부모로 사용, `relativePath` 비움        |
| generated app 버전                                | 독립 `1.0.0`, framework common 라이브러리 버전과 분리     |

템플릿에는 원본/Reference 파일이나 실행 자료를 포함하지 않는다. 우리 최소 Starter의 중립 SFC 예제, Maven Wrapper/JDK 선택 스크립트, 최소 storage 소비 예제, 감사 schema만 명시 allowlist로 반영했다. Notes 기능은 새 구현이다. 복사한 기존 root package-lock.json은 없으며 프레임워크 src alias도 없다.

실제 외부 첫 Maven 빌드는 부모를 찾는 단계에서 `file://${project.basedir}/../vendor/maven`이 해석되지 않아 실패했다. [첫 외부 빌드 로그](../검증/011-consumer-build-first.log)를 보존한다. 두 번째 시도는 Wrapper가 계산한 URI를 `-Dsc.generated.vendor`로 전달하고 POM에서 참조했지만, 같은 early repository 단계에서는 이 URL도 raw 문자열로 남아 실패했다. [두 번째 외부 빌드 로그](../검증/011-consumer-build-second.log)를 보존한다. 일반 POM의 CLI property 참조 근거를 이 초기 repository 해석까지 확대 적용한 판단은 실제 검증으로 철회했다.

현재 템플릿은 POM의 repository 표현을 제거했다. [sc-vendor-settings.xml](../../templates/starter-v1/backend/.mvn/sc-vendor-settings.xml)의 활성 profile에 repository를 정의하고 URL은 `${env.SC_GENERATED_VENDOR_URI}`로 받는다. [vendor-uri.mjs](../../templates/starter-v1/scripts/vendor-uri.mjs)로 URI를 계산한 Wrapper는 Maven 시작 전에 환경 변수를 export한 뒤 앱의 settings를 기본 `--settings`로 전달한다. 환경 변수 settings interpolation은 [Maven 공식 Settings Reference](https://maven.apache.org/settings.html)에 명시된 계약이며, settings profile에 정의한 일반 properties를 보간하는 방식은 사용하지 않는다. [candidate3 cold build](../검증/011-consumer-build-third.log)는 빈 캐시의 부모 해석·metadata package·실제 API bootstrap·npm verify·마지막 clean Maven verify의 **서버5 PASS/BUILD SUCCESS**까지 통과했다. 첫 두 repository 실패를 그대로 보존하며 settings 방식 성공을 추측/대기로 남기지 않는다.

기존 first/second 소비 앱을 덮어쓰지 않고 새 `/private/tmp/sc-framework-consumer-011-20261007/sc-notes-candidate3`, 이후 `sc-notes-candidate4`에 같은 app name/package/ports를 적용했다. latest **61template+12vendor+lock=74파일**, dry-run·생성 exit0은 [candidate4 실제 생성 JSON](../검증/011-generated-candidate4-create.json)으로 확인했다. 이전 first는 59template/72파일, second는 60template/73파일 기록을 유지한다. Wrapper는 다른 cwd에서도 자신의 위치를 사용하며 Node `pathToFileURL`로 공백·한글 등을 인코딩한다. `scripts/build.sh`는 앱 root, 내부 Maven은 backend cwd를 사용한다.

명시적 `-s`, `--settings`, `--settings=...`, `-s...`는 기본 settings를 추가하지 않고 사용자 선택을 그대로 전달한다. 이때 같은 vendor repository/active profile을 custom settings에 포함해야 하며 환경 URI는 계속 제공된다. bare `mvn`은 환경 URI와 settings를 모두 직접 지정해야 한다. settings에 localRepository를 지정하지 않으므로 CI의 독립 `MAVEN_OPTS=-Dmaven.repo.local=...` 캐시 선택을 덮지 않는다. Windows Wrapper도 구현했지만 실제 Windows 실행은 미확인이다.

생성 앱의 root npm 잠금 파일은 최초 `npm install`로 별도로 작성·검토·커밋한다. 이후 `npm ci`로 재현한다. Node 24.16.0/npm 11.13.0/JDK 21/Boot 3.5.16 기준이고 직접 라이브러리는 exact pin이다. ExcelJS 하위 uuid 11.1.1 및 esbuild 0.28.1 override를 포함한다. Vue I18n은 011에서 안정 Vue 3.5.43에 맞는 **11.1.12**로 설정했다. 기존 010의 11.4.13 실행 기록을 이 버전으로 소급 변경하지 않는다.

프런트는 strict 애플리케이션 소스와 `skipLibCheck:true`를 사용한다. VueKonva/Vuetify의 공급자 선언 충돌 등 알려진 vendor strict 한계를 감춘 zero-error 지원으로 기록하지 않는다. runtime/date/excel/i18n 독립 strict 및 UI vendor 한계·공개 타입 오용 검사는 배포 검증 결과에서 별도로 기록한다.

## 생성 앱 실행 및 API bootstrap

```bash
cd /private/tmp/sc-framework-new-app/sc-notes
npm install
bash scripts/build.sh
bash scripts/run.sh
# 개발 프런트 + dev JAR
bash scripts/dev.sh
# 같은 SC_HOME의 현재 run.sh만 정상 종료
bash scripts/stop.sh
```

[생성 README](../../templates/starter-v1/README.md)와 [build.sh](../../templates/starter-v1/scripts/build.sh)가 아래 순서를 고정한다.

1. 앱 자신의 잠금 파일을 `npm ci`로 설치한다. 잠금 파일이 없으면 최초 install 안내 후 종료한다.
2. 프런트 타입 없이도 backend metadata-only JAR를 먼저 package한다. 이 실행의 테스트 skip을 테스트 성공으로 표시하지 않는다.
3. [bootstrap-api.mjs](../../templates/starter-v1/scripts/bootstrap-api.mjs)가 새 임시 H2·600 secret·free loopback port의 dev JAR를 기동한다. 자신의 Notes schema를 실제 `/v3/api-docs`에서 수집하고 서버를 종료하며 임시 자료를 제거한다.
4. [openapi-types.mjs](../../templates/starter-v1/scripts/openapi-types.mjs)가 `docs/openapi.json`과 앱 소유 `frontend/src/generated/api.d.ts`를 생성한다. 수동 DTO seed는 제공하지 않는다.
5. format/lint/api:check/typecheck/Vite build 후 마지막 clean Maven verify에서 실제 서버 테스트 및 새 프런트 JAR를 만든다.

Notes API/Query/폼의 타입 원본은 실제 생성된 `components["schemas"]`이며, Zod의 앱 소유 decoder는 unknown 응답의 runtime 검증을 병행한다. `api:check`는 수집된 명세와 실제 생성 파일을 다시 비교한다. 첫 독립 `npm run build`는 API 파일이 아직 없으면 실패할 수 있어 통합 bootstrap을 먼저 실행하도록 설명한다.

run 기본 prod는 Swagger 차단, dev는 Swagger 활성이다. audit/file-storage는 명시 선택이며 허용된 조합만 받는다. 실행 폴더는 새 `.runtime/local` 또는 개발 `.runtime/dev`, 새 secret은 mode600·owned regular file이다. 값은 콘솔·로그·문서에 쓰지 않는다. PID 파일과 종료는 해당 앱의 절대 run.sh 프로세스만 검사하고 임의 프로세스를 강제 종료하지 않는다.

## 중립 예제와 업무 경계

| 기능                 | 실제 계약                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Notes                | `GET/POST /api/notes`, `GET/PUT /api/notes/{id}`, `GET /api/notes/stats`                                                               |
| DTO                  | `StarterNoteCreateInput`, `StarterNoteUpdateInput`, `StarterNoteResponse`, `StarterNotePage`, `StarterNoteStats`, `StarterNoteCommand` |
| 자료·권한            | 앱 소유 H2 V1 `starter_note`, 현재 세션 username의 자료만 읽기·쓰기. 타인 detail은 404                                                 |
| 수정                 | 첫 revision1, 제목 변경 시 증가, 동일 제목은 revision 유지, stale409. 폼 작성 입력 보존                                                |
| 목록                 | Querydsl typed 동적 literal q/page/count·고정 updatedAt/id DESC, 단순 detail은 JPA                                                     |
| 쓰기·집계            | JPA flush 후 같은 DataSource/JpaTM의 MyBatis COUNT/MAX, 반환 `{item,stats}`                                                            |
| DTO 생성             | MapStruct spring mapper + Lombok 제한 Getter/protected constructor, Q/mapper는 target 생성물                                           |
| 감사                 | 실제 공통 publisher commit 경계. 기본 비활성, audit 프로필에서 앱 소유 V2 schema                                                       |
| Feign                | 명시한 loopback sample URL/timeout, 전달 cookie·CSRF 없음, upstream failure 안전한502                                                  |
| optional `/patterns` | 공개 board/image/table/chart/editor/date/Excel UI를 소비하는 로컬 예제. 영속화 완료 주장 없음                                          |
| file-storage         | 현재 기동의 metadata와 정상 종료 cleanup 예제. crash 이후 durable queue는 012 후속                                                     |

[서버 integration test](../../templates/starter-v1/backend/src/test/java/__JAVA_PATH__/GeneratedAppIntegrationTest.java)는 신규 파일 로그인204/CSRF, JPA flush→MyBatis aggregate, revision409, owner/literal 검색, mixed rollback, 실제 loopback Feign 실패를 구현했다. MockMvcPrint.NONE을 적용하고 비밀번호 request body를 자동 출력하지 않는다. 현재 구현과 실제 Maven 실행 결과는 구분한다.

## 외부 소비 앱의 최종 실제 결과

| 확인                     | 실제 결과                                                                                       | 근거                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| settings 방식 cold build | candidate3/candidate4 모두 서버5·metadata/API/npm·최종 clean verify PASS                        | [third](../검증/011-consumer-build-third.log), [fourth](../검증/011-consumer-build-fourth.log)                                |
| 새 H2와 설치 공통 JAR    | session/CSRF·Notes/JPA/Querydsl/MyBatis·revision·정상 재기동 HTTP2그룹, Reference classes0      | [candidate4 summary](../검증/011-generated-fourth/summary.json)                                                               |
| 실제 packed UI           | browser7그룹: 로그인/폼·409입력 보존·표/10k가상·chart/editor/XLSX·board/image·logout PASS       | [browser summary](../검증/011-generated-fourth/browser/summary.json)                                                          |
| 전체 DOM 접근성          | 4회 violations0/duplicateIds0, incomplete8은 수동 미확인                                        | [같은 browser JSON](../검증/011-generated-fourth/browser/summary.json)                                                        |
| 선택 profile·launcher    | 9그룹, audit/file-storage/dev 조합6·secret600·PID·dev proxy/정상 종료 PASS                      | [최종 JSON](../검증/011-generated-features-second.json), [로그](../검증/011-generated-features-second.log)                    |
| optional UI OFF          | HTTP2/browser4, optional route·추가 chunk request0                                              | [HTTP/JAR](../검증/011-generated-optionaloff/summary.json), [browser](../검증/011-generated-optionaloff/browser/summary.json) |
| 0.2.0 공개 소비 경계     | public type12·native중립4·private import3거절·Sass PASS; UI vendor696/own0, non-UI strictfalse0 | [type JSON](../검증/011-consumer-types-v02.json)                                                                              |
| 0.1→0.2→0.1              | same H2 revision1→2→3·손작성47파일 unchanged·old lock exact·공통 JAR exact bytes                | [summary](../검증/011-upgrade-rollback-second/summary.json), [로그](../검증/011-upgrade-rollback-second.log)                  |

candidate4의 초기 cold 앱은 0.1.0 공통 라이브러리였다. 같은 실제 앱을 0.2.0으로 변경·빌드·설치 UI 검증한 뒤 0.1.0으로 rollback했다. 0.2.0 생성기 validator의 실제 생성48검사와 별개의 경로이며, 별도 0.2.0 cold consumer가 실행됐다고 기록하지 않는다. API 비교는 동적 `servers`만 제외한 normalized 결과가 동일했고, 다른 field/schema/operation을 제외하지 않았다. 같은 API/DDL에서 확인한 rollback이므로 파괴적 schema migration·자료 이관·기존 앱 자동 codemod의 보장으로 확대하지 않는다.

generated profile 검사는 중립 storage metadata가 정상 종료 뒤 정리되고 새 run whitelist에서 이전 파일이 보이지 않는 것을 확인했다. stopped private H2의 audit count만 검사했으며 생성 앱에 새 ADMIN audit HTTP controller가 있다고 주장하지 않는다. 정상 종료/restart의 성공은 012 crash durable cleanup/backup과 구분한다.

## 확인 결과와 미확인

- [x] 배포 없는 Node 경계 검사 40개: 이름/package/포트/옵션/protected target/occupied/symlink/template SHA/traversal/source 보존/임시 cleanup. `node scripts/verify-starter-generator.mjs` exit0, actualArtifacts/actualGeneration/install/Maven/browser는 모두 false였다.
- [x] 생성기 두 파일 scoped ESLint exit0, 템플릿 frontend/src·scripts 별도 scoped ESLint exit0, shell syntax exit0.
- [x] 실제 candidate2 배포를 통과한 dry-run/새 target/기존 빈 target/동시 생성/손상 artifact 거절 6개 추가 검사. 기존 **46개** Node 검사 exit0이며 설치/Maven/browser는 실행하지 않았다.
- [x] 위 Root 지정 `/private/tmp/.../sc-notes` 경로에서 CLI dry-run exit0 → 실제 생성 exit0. 59개 템플릿+5tgz+7Maven+provenance **72파일**. provenance의 71개 내용 hash 일치, 644모드65개/755모드6개, 공통 5개 `file:` 경로 실제 해석 확인. 생성기가 secret/runtime/설치를 만들지 않았다.
- [x] 동적 vendor URI를 다른 cwd·공백·한글 경로에서 실제 확인했다. 두 번째 템플릿의 candidate2 전체 **47개** Node 검사 exit0, 임시 폴더 제거·source 불변·설치/Maven/browser 미실행. Raw report는 `/private/tmp/sc-framework-consumer-011-20261007/generator-candidate2-report.json`이다.
- [x] settings 기반 세 번째 템플릿은 명시적 user settings 선택을 포함한 **48개** Node 검사 exit0. Raw report는 `/private/tmp/sc-framework-consumer-011-20261007/generator-candidate3-report.json`이며 설치/Maven/browser를 실행하지 않았다.
- [x] settings 기반 candidate3/candidate4의 empty-cache 부모 해석·실제 API bootstrap·마지막 clean verify 서버5 PASS

[세 번째 cold 로그](../검증/011-consumer-build-third.log)와 [네 번째 cold 로그](../검증/011-consumer-build-fourth.log)의 최종 clean verify 서버5/BUILD SUCCESS가 실제 완료 근거다. metadata-only SUCCESS를 테스트 성공으로 대체하지 않는다. file repository 7파일에는 Maven sidecar checksum이 없어서 경고가 발생한다. 생성 전 manifest SHA-256 검증을 수행하며 이 경고 때문에 검증을 끄거나 7파일 배포 계약을 바꾸지 않는다.

- [x] 실제0.2.0 artifact 생성기48개·latest61template/74files·dry-run/생성·손상 입력 거절·cleanup ([v02 JSON](../검증/011-generator-v02.json))
- [x] 외부 앱 npm install→독립 lock→npm ci·Maven parent/file repo·실제 API bootstrap·frontend strict own-source 빌드
- [x] 새 H2 JAR session/CSRF/Notes/revision409/재기동·packed optional UI·profile9/선택6·browser7·axe4
- [x] optional UI OFF HTTP2/browser4·route 차단/chunk0·public type12/native4/private3/Sass·vendor 한계 기록
- [x] 같은 외부 앱0.1→0.2→0.1·손작성47파일·normalizedAPI(servers만 제외)·sameH2 revision1→2→3·exactoldlock/commonJarbytes

Root 저장소 회귀도 unit139/서버143·전체E2E74·Story95/28files·compiled static build·publicDocs22/Controls10을 통과했다. [최종 Storybook browser JSON](../검증/011-storybook-browser.json)의 pending/error/API leak0을 확인했다. CI의 generated optional profile9 step은 [최신 정적 확인](../검증/012-preparation-ci-check.json)의 YAML/Bash36/Python3/CLI flags 연결0이다. 이 정적 확인은 원격 job 실행이 아니며 remoteExecution=false를 유지한다.

초기 실패는 지우지 않는다. 첫 템플릿 script lint는 사용하지 않은 import로 실패했고 제거 후 별도 scope는 통과했다. 같은 ESLint 명령에서 framework와 template config를 함께 읽을 때 TypeScript parser root 추론이 중복되어 실패했고 템플릿 config에 명시 `tsconfigRootDir`를 넣어 구분했다. 초기 format 검사는 template manifest의 JSON 배열 형식으로 실패했고 hash 갱신 뒤 Prettier를 마지막으로 적용했다.

실제 첫 배포 후보는 checker의 `SC_DECL_UNDECLARED_BARE`(UI d.ts의 table-core/virtual-core 직접 선언 누락)로 거절됐고, candidate2는 `SC_UI_COMPONENT_EXPORT`로 먼저 거절됐다. 이는 checker가 상대 `export *`의 실제 named value를 추적하지 못한 오탐으로 확인되어 AST graph 추적을 수정했다. 실제 공개 export를 줄이거나 오류를 무시한 수정이 아니다. 선언 검사와 배포 producer를 조정한 뒤 새 세트를 정상 검사했고 거절을 우회하지 않았다. 템플릿 렌더 단계에서는 Maven Wrapper의 자체 `__MVNW_*__` 환경문자가 템플릿 변수로 오인되어 `TEMPLATE_TOKEN`으로 실패했다. 고정된 Wrapper 문자 3개만 보존하도록 수정했고, I18N처럼 숫자가 포함된 변수와 Markdown의 강조 정규화도 실제 렌더 결과에 맞게 보강했다. 이후46→47→48검사와 지정 경로 생성이 통과했다.

생성 앱 browser 초기 실패·수정 전 결과는 [first](../검증/011-generated-first/summary.json)·[second](../검증/011-generated-second/summary.json)·[third](../검증/011-generated-third/summary.json)에 보존하고, packed 예제7그룹이 모두 통과한 fourth를 최종 근거로 삼았다. profile 첫 실행의 JAR child ownership assertion은 [first JSON](../검증/011-generated-features-first.json)에, 업그레이드 첫 guard의 동적 API servers 오인은 [실패 JSON](../검증/011-upgrade-first-failure.json)에 남겼다. 수정 후 second 결과를 별도 기록하고 최초 실패를 덮어쓰지 않았다.

원격 CI·publish·Linux consumer/시각 baseline·실제 Windows Wrapper·VoiceOver 음성/axe incomplete 수동검토·기존 프로젝트 자동 업그레이드·실제 사용자 자료 이관·012 운영/crash/backup은 미확인이다. 로컬 패키지 소비와 같은 API/DDL rollback의 완료를 이 범위로 확대하지 않는다.
