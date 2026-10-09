# ScFramework

JSP·Java 개발자를 위한 [Vue 3·TypeScript·서버 코드 읽기 안내](docs/developer-reading-guide.md)를 추가했다. 수작업 프런트·Java 기능 코드와 현재 v2 생성 템플릿에 한국어 역할·흐름 주석을 유지한다. 범위와 실제 검증은 [상세 주석 적용 기록](docs/질의/상세주석-개발자학습가이드.md)을 따른다.

## 현재 상태: Yzen 시안 재정렬 후보·로컬 검증 완료

2026-10-09 사용자 확인에 따라 Yzen Sales를 다시 기준으로 삼아 글꼴·강조색·카드·셸·대시보드 비율을 조정했다. 공통 토큰과 UI 패키지에 반영하여 두 앱이 같은 규격을 소비한다. 독립 tarball 설치 앱까지 실제 확인했다. [이번 변경과 새 검증](docs/질의/디자인시안-재정렬.md)은 아래 013 이전 실행 기록과 구분한다. 사용자 디자인 수락은 아직 확인되지 않았다.

### 이전 013 공통 디자인 로컬 검증 완료·사용자 수락 미확인

버튼·입력·카드·상태 배지·표의 공개 디자인 규격을 `Sc` 부품으로 제공하고 Reference·Starter·생성 템플릿에 적용했다. Storybook·별도 후보·독립 설치 소비 앱의 실제 브라우저까지 로컬 검증을 완료했다. 사용자 디자인 수락은 미확인이다. [013 규격·사용 가이드·실제 검증](docs/질의/013-공통디자인프레임워크.md)이 현재 결과의 원본이다.

[새 공통 UI 예제](http://100.120.61.117:18083/patterns) · [새 대시보드](http://100.120.61.117:18083/dashboard) · [Storybook](https://macstudio.tailf9bcc5.ts.net:6007)

현재18082 실행 서버·JAR·계정·기존 Tailscale 설정은 보존했고 새 UI만18083에서 기존 백엔드에 연결한다. 아래001~012·대시보드 교정은 이전 단계의 근거이며 현재013의 검증으로 합산하지 않는다. 검토 후보는 미게시 상태다.

### 이전 001~012 기능과 대시보드 디자인 교정의 검증 기록

001~012의 기능 구현·로컬 통합 검증은 완료했다. 기존 UI가 사용자 지정 Yzen Sales의 시각 목표를 충족하지 못해 별도 [디자인 교정](docs/질의/디자인교정.md)을 진행했다. 새 [live 브라우저 QA](docs/검증/design-correction-browser.json)는1440/390px·40검사·전체 DOM axe14회에서 위반/중복ID/가로 overflow/브라우저 오류0을 확인했다. [교정 통합 빌드](.runtime/design-correction/integrated-build.log)도unit155/38 files·선별 서버10개·새두JAR생성을 통과했다. 새JAR의 [관련30개 확인](docs/검증/design-correction-final-summary.json)과 정적파일46/8개 해시 일치·Tailnet HTTP/HTTPS 실제 로그인/4KPI/SVG/pageerror0을 확인했다. 첫28PASS/2FAIL 뒤layout6개를 재검증해30고유 케이스가 모두 확인됐으며 중복수를 합산하지 않는다. 새 시각 기준16PNG의 명시 갱신·정상 비교4개와 전체 Storybook105개/30files를 통과했다. 교정의 로컬 검증은 완료했으며 새패키지의 독립 설치소비와 사용자 디자인 수락은 미확인이고 `accepted=false`다. 아래unit149·서버196·E2E·Storybook·시각 회귀는 교정 전001~012의 역사적 근거로 유지한다. 현재source공개UI24개와 불변012아카이브22개의 성적을 합치지 않는다.

전체 [Storybook105개/30files](.runtime/design-correction/storybook-all-resize-final.log)와 새 [시각 비교4개](.runtime/design-correction/visual-baseline-compare.log)가 통과했다. 이전104PASS/1FAIL과 새 기준의 명시 갱신·교정 전17파일 보존은 디자인 교정 문서에 기록했다. 자동 로컬 검증 완료와 사용자 디자인 수락은 구분한다.

공통 프런트5패키지 `0.3.0`·서버 `0.3.0-SNAPSHOT`이 현재 기준이다. Reference/내부 Starter의 앱 버전은 `0.1.0`, 생성 Starter v2는 `1.0.0`이며 운영 기능은 기본 OFF·선택 ON이다. Redis·JWT·SSO는 제외한다. [012 완료 기록](docs/질의/012-운영모듈완료.md)에서 범위와 제한을 확인한다.

| 최신 실제 확인      | 결과·근거                                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 필수 통합 빌드      | [build.sh](docs/검증/012-integration-build-final.log) PASS: unit149/36 files. [일반 서버](docs/검증/012-integration-backend-final.json)는 총196/실행193/MQ3 skip, [별도 실제 Rabbit 검증](docs/검증/012-backend-verify-fifth-summary.json)은196/skip0                                             |
| JAR·시각·카탈로그   | 기본 E2E71+보고서5 PASS, 별도 시각4 PASS. [Storybook](docs/검증/012-storybook-tests-first.log)95/28 files·[Docs22/Controls10](docs/검증/012-storybook-browser.json) PASS·브라우저 오류0. live ON/OFF 명세4비교와 neutral 타입 경계 PASS                                                           |
| 최신 운영 화면      | [다섯 번째10개](docs/검증/012-operations-e2e-fifth.log) PASS. 모바일 UUID가 옆 셀과 겹친 앱 CSS를 수정한 최신 JAR·[JSON/PNG](docs/검증/012-operations-e2e-fifth-results/) 기준                                                                                                                    |
| 전체 DOM 접근성     | [최신 집계](docs/검증/012-browser-axe-final.json): 운영11회·보고서9회에서 위반0/중복ID0. incomplete는 운영29규칙/143노드·보고서18규칙/245노드이며 수동 검수 미완료                                                                                                                                |
| 운영·복구·관측      | [운영18그룹](docs/검증/012-operational-boundaries-first.json)·[복구7그룹](docs/검증/012-runtime-recovery-third.json)·[관측8그룹](docs/검증/012-observability-fifth.json) PASS. [Grafana](docs/검증/012-grafana-browser-second/summary.json)는 populated metric query5·data frame11·visible panel6 |
| 독립 Starter·Docker | [설치 소비 앱](docs/검증/012-generated-operations-visual-final/summary.json)8그룹/axe15회·위반0/중복ID0·PNG15·UUID 셀 geometry PASS. [최신 Docker](docs/검증/012-docker-operations-final-second.json)7그룹 PASS                                                                                   |

초기 실패와 당시 진행 중 표시는 아래 이력에 보존한다. 기본71 E2E 출력은 별도 시각 실행으로 정리되어 이전 단계의 axe111회를012 성적으로 재사용하지 않는다. axe 규칙 제외0이며 incomplete·VoiceOver 실제 음성·Windows·Linux 시각 기준·원격 CI/운영 배포·HA/power-loss 보장은 미확인이다. 이 문서 갱신은 새로운 서버·브라우저 실행 결과가 아니다.

Vue 3/Vuetify 공통 UI·프런트 runtime·Spring Boot Starter를 조립하여 사용하는 독립 프레임워크다. WorkboardVue는 읽기 전용 레퍼런스이며 신규 서버는 JDK 21·H2·JPA/MyBatis·OpenFeign을 사용한다. Yzen Sales는 이번 디자인 교정의 명시적인 시각 기준이다. Yzen 코드·에셋·브랜드·라이선스를 가져오지 않고 공개 OSS와 자체 컴포넌트로 구현한다. 자체 공통 UI는 `Sc` 파일 이름과 `<sc-*>` 템플릿 이름을 사용한다. Redis·JWT·SSO는 제외하고 나머지 [조건부 기술](docs/질의/조건부기술-전체구현.md)도 구현한다.

001~009의 구현과 로컬 통합 검증을 완료했다. 010의 업무 확장·파일 저장·이미지 작업실·칸반·공지·관리·서식 문서와 공통 보드/이미지 UI도 구현·로컬 통합 검증을 완료했다. 단계별 실제 명령·결과·초기 실패는 [개발 문서 목록](docs/질의/README.md)과 [001~012 개발 계획](docs/질의/개발단계.md)에 보존한다. 011의 공통 패키지0.2.0 배포·독립 Starter 생성/소비·실제 업그레이드/되돌리기와 로컬 회귀 검증도 완료했다. 012 메시징·스케줄러·관측·백업/복원과 운영 프런트도 구현·로컬 검증을 완료했다.

```bash
# Node 24.16 / npm 11.13 / JDK 21
npm ci
npm run verify
./scripts/build.sh
./scripts/dev.sh
```

개발 기본 포트는 Vue 5175·Spring 18082이며 새 `.runtime/dev`를 사용한다. 최초 관리자 비밀번호는 스크립트가 생성하는 모드600 파일에서 확인한다. 값을 로그·코드·문서에 출력하지 않는다. [실행·운영](docs/operations.md), [API](docs/api.md), [폴더 구조](docs/folder-structure.md), [유지보수 가이드](docs/maintenance-guide.md), [실제 설치 기술스택](docs/질의/기술스택-적용현황.md)을 함께 확인한다.

010의 최종 통합 빌드는 unit139/34 files·서버143개를 통과했다. 새 두 JAR의 정적 파일은 Reference dist46개·Starter dist6개와 해시까지 일치한다. 전체 E2E69개+보고서5개=74개, 별도 시각 비교4개, Story95개/28 files와 공개 UI Docs22개·Controls10개도 통과했다. 전체 DOM axe111회에서 자동 위반·중복ID는0이며 incomplete232개 규칙·2,121노드는 수동 검수 후보다. 실제 명령·초기 실패·검수 범위는 [010 완료 기록](docs/질의/010-업무확장과파일작업실.md)과 [최종 결과](docs/검증/010-final-summary.json)에 보존한다.

현재 공통 프런트는 npm workspaces와 단일 루트 잠금 파일을 사용한다. Reference의 업무 DTO/권한/DB migration과 공통 UI/runtime/서버 Starter의 책임을 분리한다. Starter의 중립 기능 메뉴/route는 `VITE_SC_PATTERNS_ENABLED=false` 빌드 설정으로 끌 수 있다. 비활성 앱은 optional chunk를 요청하지 않지만 일부 산출물은 남으므로 설치 의존성과 번들 전체가 제거된다고 주장하지 않는다. Storybook 출력은 업무 JAR와 분리한다.

VoiceOver 실제 음성 안내·Linux 시각 baseline·원격 CI·운영 배포는 미검증이다. 011의 로컬 npm pack/Maven artifact/생성기 검증과 공개 registry 게시는 별개다. 공개 npm publish·registry 인증·기존 사용자 파일 자동 덮어쓰기는 현재 범위에 넣지 않는다. 012의 로컬 Compose 인프라·운영 API·복구·관측 검증은 아래에서 구분한다. 원본 WorkboardVue의 007 기준170개 소스 SHA-256은 010에서도 변경0을 확인했으며 원본 실행 자료는 사용하지 않았다.

011의 [완료 기록](docs/질의/011-배포와Starter생성기.md)은 npm5개/Maven4좌표·generator48·외부 서버5/브라우저7/실행프로필9·실제0.1→0.2→0.1 전환/업무47files·같은H2/lock 보존을 확인한다. 최신 fresh unit139/server143·E2E74·Story95/Docs22/Controls10·시각4도 통과했다. 외부 UI는 strict/skipLibCheck true를 지원하며 vendor strict false의696진단을 기록했다. 원격 게시/CI·운영 기능은 완료로 합산하지 않는다.

<details>
<summary>012 초기 구현·중간 검증 이력 — 아래 대기 표시는 당시 상태</summary>

## 012 운영 구현·검증 진행

현재 공통 프런트 5패키지는 `0.3.0`, 서버 공통은 `0.3.0-SNAPSHOT`이다. Reference/내부 Starter의 오류 수집 `appVersion`은 각각 `0.1.0`이며 생성 Starter v2는 자체 `1.0.0`을 설정한다. 기본 프로필은 운영 기능 OFF다. 인증 후 `GET /api/framework/capabilities`를 Query로 확인하고 ADMIN의 메시지·작업 예약·브라우저 오류 화면을 필요한 기능 ON일 때만 노출한다. Redis·JWT·SSO는 계속 제외한다. [운영 실행](docs/operations.md#012-선택-운영-프로필과-로컬-인프라), [메시지·복구](docs/질의/012-메시지와복구계약.md), [예약·오류](docs/질의/012-예약과브라우저오류.md)를 함께 읽는다.

[서버 네 번째 실행](docs/검증/012-backend-tests-fourth.log)은 195개·실패/오류/skip 0이다. [두 앱 실제 운영 HTTP/H2 경계](docs/검증/012-operational-boundaries-first.json) 18그룹, [강제 중단·새 root 복원](docs/검증/012-runtime-recovery-third.json) 7그룹, [실제 지표·trace·log·Grafana 조회](docs/검증/012-observability-third.json) 7그룹이 통과했다. 프런트의 수집기·예약 폼 단위 10개와 scoped 타입/형식/lint도 통과했다. 새 프런트 포함 JAR·운영/OFF 브라우저·접근성·시각·패키지/생성기와 전체 012 마감은 **통합 검증 진행 중**이다. 이 성적을 001~011의 완료 수에 더하지 않는다. 원격 CI·Windows·VoiceOver 실제 음성·Linux 시각 기준·axe incomplete 수동 검수는 미확인이다.

[운영 첫 브라우저10개](docs/검증/012-operations-e2e-first.log)는4 PASS/6 FAIL이었다.2개는 예약 행 버튼의 visible 선택 문구가 aria-label에 빠진 실제 `label-content-name-mismatch`,4개는 이미 있는 PULSE를 다시 생성해 등록 작업당 예약 하나(`job_code UNIQUE`) 계약에409가 발생한 fixture 오류다. [초기 axe JSON·PNG](docs/검증/012-operations-e2e-first-results/)를 보존했다. 두 앱의 accessible name에 실제 ko/en visible 문구를 포함했고 테스트는 기존3개 system 예약과 PULSE1개를 사용하며 현재 revision으로 설정을 복원한다. DB·공통 UI·axe rule은 바꾸지 않았다. 수정 소스의 scoped 형식/lint·두앱/E2E 타입은0이며 실제 새 JAR 재실행은 진행 중이다.

### 012 후속 실제 실행과 남은 브라우저 재검증

[프런트 verify](docs/검증/012-frontend-verify-first.log)의149 unit과 [서버 다섯 번째](docs/검증/012-backend-verify-fifth-summary.json)의196개/실패·오류·skip0을 확인했다. 앞선 담당 unit10/서버195는 당시 실행으로 보존하고 중복 합산하지 않는다. [관측 다섯 번째](docs/검증/012-observability-fifth.json)는8그룹 PASS, [실제 Grafana 브라우저](docs/검증/012-grafana-browser-second/summary.json)는5개 metric query populated·11 data frame·6개 panel visible·pageerror0을 확인했다. raw canary0·trace6span/Loki1log와 manualReviewComplete=false 경계는 유지한다.

[Docker 세 번째 image build](docs/검증/012-docker-app-build-third.log)와 [네 번째 앱 컨테이너7그룹](docs/검증/012-docker-operations-fourth.json)도 실제 통과했다. prod,operations·UID10001/umask077·secret600·Flyway7·MESSAGE_DEMO 완료·예약 revision409·PDF/revision 보존·앱만 재기동/인프라6 ID불변·별도 management observer/Prometheus up을 확인했다. 당시 container/volume은 부모 검증을 위해 남겨 둔 상태이며 종료/회수까지 완료했다는 결과는 아니다. 기존 첫/두 번째 build 실패를 보존하고 로컬 컨테이너 성공을 원격 배포/HA/power-loss 보장으로 확대하지 않는다.

[운영 두 번째10개](docs/검증/012-operations-e2e-second.log)는7 PASS/3 FAIL이다. 앞선 제품 ARIA와 fixture UNIQUE 문제는 해결됐고 409/GET500·늦은A→B·실제 window/rejection·Starter 소비는 통과했다. 남은1개는 첫 dialog visible/focus 확인 전 Escape를 보낸 race,2개는 새 document goto에서 기본KO로 초기화된 뒤 EN 표를 찾은 fixture다. [두 번째 결과/PNG/axe](docs/검증/012-operations-e2e-second-results/)를 보존했다. dialog visible→취소 focus→Escape→닫힘과 재확인 후 URL을 기다리고, EN은 실제 SPA RouterLink로 이동하며 locale를 확인하도록 E2E만 수정했다. 임의 sleep·force click·locale 영속화·공통UI/DB/axe rule 변경 없이 scoped 형식/lint/E2E 타입0을 확인했다. 실제10 재실행·전체 회귀·시각·Story/Docs/Controls·0.3 pack/v2 소비와012 종합 마감은 아직 진행 중이다.

후속 정적 action 점검에서도 두 앱의 오류 그룹 행 버튼에 visible `발생 이력`/`Occurrence history`가 accessible name에서 빠진 같은 결함을 확인해 해당 앱 SFC 두 곳만 수정했다. 메시지 재시도·예약 선택·다른 운영 action도 visible 문구 포함 여부를 점검했다. scoped 형식/lint·두 앱 타입은0이며 이 후속 제품 수정은 새 JAR와 v2 소비 앱의 실제 axe 결과로 확인할 예정이다. 공통 UI/runtime·DB·규칙 제외·원문 오류 노출·locale 영속화는 추가하지 않았다.

</details>
