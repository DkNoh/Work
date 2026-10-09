# 011 공통 패키지 배포와 Starter 생성

011의 **구현·로컬 검증을 완료**했다. 배포·외부 소비·업그레이드/롤백·전체 통합의 실제 성공은 아래에 기록한다. 010의 과거 결과와 초기 실패는 보존한다. 공개 registry 게시·기존 사용자 프로젝트 자동 덮어쓰기는 수행하지 않았다.

## 실제 구현과 검증

| 영역               | 실제 결과                                                                                                                                | 증거                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 프런트 배포        | 공개5개 `@sc/ui/runtime/date/excel/i18n`의 ESM·portable 선언·CSS/Sass·원문 NOTICE. 현재0.2.0                                             | [pack](../검증/011-package-v02.log), [산출물](../검증/011-package-artifacts-v02.json)                                                               |
| 서버 배포          | parent/core/autoconfigure/Starter4좌표·4POM/3plain JAR,0.2.0-SNAPSHOT. 첫0.1은 빈 격리 저장소에서30tests                                 | [첫 생산](../검증/011-backend-artifacts-first.json), [0.2 생산](../검증/011-backend-artifacts-v02.log)                                              |
| 공개 계약          | UI export8개·컴포넌트22개. private source/dist import 차단, 오래된 stamp로 pack 거절                                                     | [외부 타입](../검증/011-consumer-types-v02.json), [stale 거절](../검증/011-stale-build-rejection.json)                                              |
| 패키지 부정 검사   | 실제 CLI25개 기대 거절·보호128개 hash 불변·임시 fixture 제거                                                                             | [0.2 gate](../검증/011-package-gates-v02.json)                                                                                                      |
| 생성기             | 실제48/48, 검토된 template61·배포12·provenance1=74files. 설치·secret·DB 생성0                                                            | [0.2 생성기](../검증/011-generator-v02.json), [생성 기록](../검증/011-generated-candidate4-create.json)                                             |
| 외부 full build    | 앱1.0.0·독립 npm lock·실제 Notes OpenAPI→타입 생성·마지막 서버5tests·새 JAR                                                              | [빈 저장소의 성공](../검증/011-consumer-build-third.log), [수정 template build](../검증/011-consumer-build-fourth.log)                              |
| 외부 타입·모듈     | native4·공개타입12·private3기대거절·XLSX roundtrip·Sass `pkg:` 모두 성공, 소스 alias0                                                    | [0.1 검사](../검증/011-consumer-types-second.json), [0.2 검사](../검증/011-consumer-types-v02.json)                                                 |
| 외부 HTTP·브라우저 | 실제 H2/JPA/Querydsl/MyBatis/CSRF/409·재시작2그룹+브라우저7, whole DOM axe4 위반/중복ID0                                                 | [외부 JAR](../검증/011-generated-fourth/summary.json), [브라우저](../검증/011-generated-fourth/browser/summary.json)                                |
| 생성 앱 실행       | 기본prodOFF1+선택profile6+secret/PID보호1+dev/proxy/종료1=9그룹 성공                                                                     | [실제9그룹](../검증/011-generated-features-second.json)                                                                                             |
| 선택 기능 OFF      | 외부 새 JAR HTTP2·브라우저4 성공, 메뉴/route/optional chunk 요청0. 설치 의존성 전체 제거를 뜻하지 않음                                   | [외부OFF](../검증/011-generated-optionaloff/summary.json), [내부격리OFF](../검증/011-starter-features.json)                                         |
| 버전 전환          | 0.1.0→0.2.0→0.1.0 실제 build·설치5개/version·공통JAR bytes 일치, 같은 H2 revision1→2→3                                                   | [전환](../검증/011-upgrade-rollback-second/summary.json)                                                                                            |
| 업무 보호          | 외부 업무/스크립트/provenance47files 불변·서버주소만 정규화한 API 불변·이전 lock 바이트 복원                                             | [전환 로그](../검증/011-upgrade-rollback-second.log), [원본170개 보존](../검증/011-reference-source-preservation-first.json)                        |
| 통합·기능          | fresh unit139/34files·서버143, 두 JAR dist와 정확히 일치(Reference35/Starter5). E2E69+보고서5=74                                         | [통합](../검증/011-integration-build-first.log), [JAR](../검증/011-server-and-artifacts-first.json), [E2E](../검증/011-e2e-first.log)               |
| 접근성·시각        | whole DOM axe111 위반/중복ID0, incomplete232rules/2117nodes는 수동후보. 시각4PASS/기존baseline17변경0                                    | [axe](../검증/011-e2e-axe-summary.json), [시각](../검증/011-visual-final.json)                                                                      |
| API·의존성         | 실제 두 명세·생성타입3 일치. 9manifest 직접선언133/외부62제품·설치/lock불일치0·npm audit0                                                | [실제API](../검증/011-live-openapi-check-first.log), [타입](../검증/011-api-types-check-first.log), [의존성](../검증/011-dependency-inventory.json) |
| Storybook          | 기능95/28files 성공. compiled 공개 import의 문서 metadata 누락은 계약 adapter로 보완. 최종 Docs22/Controls10·브라우저 오류/API누출0 성공 | [Docs 첫 보완](../검증/011-storybook-browser-docs-first.json), [최종 실행](../검증/011-storybook-browser-controls-final.log)                        |

현재 프레임워크 package0.2.0·backend0.2.0-SNAPSHOT와 소비 앱1.0.0·내부 예제 앱0.1.0은 서로 다른 버전이다. 이번 전환은 API/DDL을 바꾸지 않는 호환 release다. 파괴적 schema downgrade나 임의 사용자 소스 merge를 검증했다고 확대하지 않는다. 이전 정상0.1 세트와 첫 실패 세트는 그대로 보관한다.

실제 외부 대상은 `/private/tmp/sc-framework-consumer-011-20261007/` 아래 새 검증 앱이다. 첫 실패·후보2·cold 성공 후보3·접근성 수정 후보4를 구분했다. 후보4의 현재 파일은 실제 rollback/OFF 검증 결과이며 프레임워크의 현재 배포 버전은0.2다. 실제 사용자 DB/비밀번호/업로드는 가져오지 않았다.

## 생산·소비 계약

생산자는 단일 루트 lock으로 설치하고 각 library의 JS·타입·자산을 빌드한다. `build-manifest.json`의 현재 소스/config digest가 다르면 pack은 출력 폴더를 만들기 전에 거절한다. 소비 install의 prepare/prepack로 누락 dist를 보완하지 않는다. 패키지는 내부용 `private:true/UNLICENSED`이며 공개 npm 게시가 완료된 것이 아니다.

UI는 `@sc/ui`·`/table`·`/charts`·`/editor`·`/board`·`/image`의 컴파일된 공개 경로를 사용한다. Vue/Vuetify CSS 뒤에 `@sc/ui/styles`를 넣는다. Sass 토큰은 NodePackageImporter의 `pkg:@sc/ui/tokens`로 읽는다. [패키지별 README](../../frontend/packages/ui/README.md)와 [생산 설계](011-공통패키지-배포설계.md), [산출물 계약](011-패키지계약검증.md), [생성기](011-Starter생성기.md)에 정확한 사용법이 있다.

생성 앱은 자기 root lock·package/version·Java package·포트·Flyway Notes migration을 소유한다. Maven parent의 relativePath는 비워 두며 reactor/프레임워크 소스/기존 사용자 Maven cache에 의존하지 않는다. Wrapper가 자기 위치의 vendor file URI를 만들고, project model보다 먼저 적용되는 `.mvn/sc-vendor-settings.xml` active profile로 공통 parent를 해석한다. 사용자 custom settings를 명시하면 자동 settings를 중복 강제하지 않으며 사용자가 동일 vendor repository를 포함해야 한다.

`build.sh`는 먼저 metadata용 package에서 테스트를 건너뛰고, 자기 임시 H2/600 secret으로 실제 OpenAPI를 수집한다. 이어 독립 프런트 검증·build를 수행하고 마지막 `clean verify`에서 서버5tests와 새 정적파일을 포함한 JAR를 검증한다. 최초 단계의 test skip를 성공 테스트 수에 합산하지 않는다.

## 지원 타입과 라이선스 경계

UI는 `strict:true, skipLibCheck:true`를 지원한다. 공개 타입의 양성·부정12개 검사에서 Props/emits/제네릭 slot/model/Identity decoder의 오용을 실제 거절했다. 별도 `skipLibCheck:false`는 vendor696진단(Vuetify695·lib.dom1, TS2344/2687/2308)이고 자체입력0이다. UI의 전체 vendor strict zero를 주장하지 않는다. 나머지 runtime/date/excel/i18n4개 joint strict/skipLibCheck false는 성공했다. [0.2 vendor 원문](../검증/011-consumer-types-v02-vendor-strict.log)을 보존한다.

Vue I18n11.4.13의 stable Vue3.5 선언 호환 문제를 확인해11.1.12로 고정했다. 이 버전의 선언이 참조하는 `@intlify/devtools-types11.1.12`를 직접 명시했다. UI의 table-core9.2.6·virtual-core3.17.11도 정확한 직접 의존성과 원문 MIT 고지를 넣었다. 프레임워크 runtime/peer vendor의 원문 license 부재는0이다. 개발도구6개는 설치 tarball의 원문 license/NOTICE 부재를 별도 기록했으며 license metadata MIT가 있다는 이유로 원문 파일까지 존재한다고 표시하지 않았다. [현재 inventory](../검증/011-dependency-inventory.json), [audit](../검증/011-dependency-audit.json)을 확인한다.

## 초기 실패와 실제 해결

- 첫 pack은 미선언 타입 의존성2개로 거절됐다. 다음 거절은 상대 export-star를 추적하지 않은 검사기 오탐이며 AST graph/value/type/cycle 처리를 보완했다. 산출물을 고쳐 검사기를 속이지 않았다.
- 첫/두 번째 외부 build는 각각 `${project.basedir}`·CLI property가 parent early model에서 해석되지 않아 실패했다. dynamic URI를 Maven settings의 환경변수 repository에 넣은 후보3에서 cold build와 실제5tests가 성공했다.
- 외부 브라우저의 정렬 기대·한국어 Excel 이름·이미지 output locator 오류는 검증기만 수정했다. 세 번째 run의 JSON 스크롤 영역은 실제 제품 접근성 결함이어서 template와 내부 두 앱에 tabindex/named region을 추가했다. 후보4에서 실제 키보드 스크롤과 전체 axe4를 통과했다. [세 번째 실패](../검증/011-consumer-jar-browser-third.log), [수정 hash](../검증/011-json-scroll-template-hash.json).
- 생성 profile 첫 run은 tester의 macOS `ps -P` 가정으로 실패했다. 자기 PID/PPID만 확인하도록 고친 두 번째 run9그룹이 성공했다.
- 버전 전환 첫 run은 성공 build가 새 임시 서버 포트를 생성한 것을 소스 변경으로 오판했다. `docs/openapi.json`의 servers만 정규화한 의미 계약을 따로 검사하고, 손으로 작성한47files/provenance/생성TS는 바이트 비교하여 두 번째 전환을 통과했다. [첫 실패](../검증/011-upgrade-first-failure.json).
- compiled UI에는 SFC docgen 정보가 없어 Storybook Docs가 color 등 공개 계약을 누락했다. Catalog는 public compiled import를 유지하면서 format2 계약 snapshot을 연결한다. Docs22 성공 뒤 Controls enhancer의 control 객체 정규화도 보완했고 최종 Docs22/Controls10·Story95/28files·static build를 실제 다시 통과했다.

초기 로그·false report를 지우지 않았다. 저장된 screenshot4개(Notes1366KO 정상/409, Patterns1366/390EN)는 실제 검토했지만 axe incomplete·VoiceOver 음성 안내까지 완료한 뜻은 아니다.

## 개발 순서와 완료 조건

1. framework 소스·계약·형식·lint·타입·unit·통합 build를 통과한다.
2. 격리 Maven repository에 공통 artifact를 생산하고 새 output에 `package-framework.mjs`로 pack한다.
3. 정상 artifact 검사와25개 거절 gate를 실행한다. 이전 세트를 보존한다.
4. 새 외부 경로에 생성하고 독립 npm lock·실제 API bootstrap·full build·JAR/프로필/브라우저를 검사한다.
5. 새 artifact만 교체하고 업무 소스·기존 자료를 보존한다. 이전 artifact/manifest/lock으로 실제 rollback을 검사한다.
6. Storybook Docs/Controls·전체 E2E/접근성/시각·문서 링크를 확인한 후012 운영으로 진행한다.

- [x] frontend5·backend4좌표/7files 생산과 실제 artifact/gate25
- [x] generator48·template61/총74files·경계/기존파일 보호
- [x] 실제 외부 설치·타입12/native4/private3/Sass/XLSX
- [x] 실제 API bootstrap/서버5/JAR/HTTP/H2·브라우저7·profile9·OFF
- [x] 실제0.1→0.2→0.1 build·동일H2·업무47/API/이전lock 보존
- [x] fresh139/143·E2E74/axe111·정상시각4/기준17불변·API2/types3
- [x] Storybook 최종 Docs22/Controls10
- [x] 최종 문서 연결/형식 확인

CI YAML/Bash/Python은 로컬 파싱했고 외부 소비 job·브라우저·선택profile9 연결도 구성했다. 원격 CI·Windows Wrapper·Linux 시각 기준·VoiceOver·axe incomplete 수동 검토는 미확인이다. 다음 단계는 [012 운영 계약](012-운영계약.md)과 [준비 검토](012-운영모듈-준비검토.md)다.

## AI에 다음 단계를 요청하는 문장

```text
ScFramework/AGENTS.md와 docs/질의/012-운영계약.md를 읽고012 운영 모듈을 구현·실제 검증해줘.
001~011의 계약과 초기 실패를 보존해줘. Redis/JWT/SSO는 계속 제외해줘.
RabbitMQ H2 outbox/inbox/confirm/commit후ACK/유한retry/DLQ와 감사·파일 journal/crash recovery를 구현해줘.
Quartz는 동일 DS/JpaTM JDBC JobStore·앱 Flyway·문자열 JobDataMap·등록jobCode·예약/시간대/misfire/재시작을 실제 확인해줘.
브라우저 오류는 원문URL/query/폼/쿠키/토큰/stack 대신 등록코드만 받고 서버 재검증·rate/size/retention·ADMIN Query UI를 구성해줘.
Prometheus/Collector/Tempo/Loki/Grafana와 Feign span·safe log correlation을 실제 scrape/query/UI로 확인해줘.
H2+uploads 같은정지세트/hash/schema manifest·새 root 복원과 강제종료 복구를 검증해줘. 원본 실행자료는 쓰지마.
실제 pinned Docker Compose를 기동/종료/재기동/복원해줘. 켜지지 않는기능을 완료로 표시하지마.
공통 패키지/runtime/서버 Starter를 두 앱에서 소비하고 새release/generator·전체회귀·Storybook 문서·기능검사·기술스택표를 갱신해줘.
```

최종 문서 검사에서 Markdown40개·상대링크1370개·연결JSON445회·표185개의 오류0을 확인했다. 전체 Prettier와 최종 lint도 종료0이다. `docs/검증/011-docs-final.json`과 `011-final-summary.json`에 로컬 완료·수동/원격 미확인 경계를 보존한다.
