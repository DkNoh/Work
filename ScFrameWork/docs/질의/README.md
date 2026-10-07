# ScFramework 개발 문서

## 현재 상태: 013 공통 디자인 로컬 검증 완료·사용자 수락 미확인

[013 공통 디자인 프레임워크](013-공통디자인프레임워크.md)의 공개 규격과 Reference·Starter 소비·Storybook·별도 후보 로컬 검증을 완료했다. 독립 설치 소비 앱의 실제 브라우저도 확인했으며 사용자 디자인 수락은 미확인이다. 현재18082 서버는 그대로 유지하며 새 [공통 예제](http://100.120.61.117:18083/patterns)와 [Storybook](https://macstudio.tailf9bcc5.ts.net:6007)을 별도 제공한다. 아래 대시보드 교정은 이전 단계의 근거이며 013 성적으로 합산하지 않는다. 상세 결과·한계는013의 표가 원본이다.

### 이전 001~012 기능과 대시보드 디자인 교정의 검증 기록

001~012의 기능 구현·로컬 통합 검증은 완료했다. 기존 UI가 사용자 지정 Yzen Sales의 시각 목표를 충족하지 못해 별도 [디자인 교정](디자인교정.md)을 진행했다. 새 [live 브라우저 QA](../검증/design-correction-browser.json)는1440/390px·40검사·전체 DOM axe14회에서 위반/중복ID/가로 overflow/브라우저 오류0을 확인했다. [교정 통합 빌드](../../.runtime/design-correction/integrated-build.log)도unit155/38 files·선별 서버10개·새두JAR생성을 통과했다. 새JAR의 [관련30개 확인](../검증/design-correction-final-summary.json)과 정적파일46/8개 해시 일치·Tailnet HTTP/HTTPS 실제 로그인/4KPI/SVG/pageerror0을 확인했다. 첫28PASS/2FAIL 뒤layout6개를 재검증해30고유 케이스가 모두 확인됐으며 중복수를 합산하지 않는다. 새 시각 기준16PNG의 명시 갱신·정상 비교4개와 전체 Storybook105개/30files를 통과했다. 교정의 로컬 검증은 완료했으며 새패키지의 독립 설치소비와 사용자 디자인 수락은 미확인이고 `accepted=false`다. 아래unit149·서버196·E2E·Storybook·시각 회귀는 교정 전001~012의 역사적 근거로 유지한다. 현재source공개UI24개와 불변012아카이브22개의 성적을 합치지 않는다.

전체 [Storybook105개/30files](../../.runtime/design-correction/storybook-all-resize-final.log)와 새 [시각 비교4개](../../.runtime/design-correction/visual-baseline-compare.log)가 통과했다. 이전104PASS/1FAIL과 새 기준의 명시 갱신·교정 전17파일 보존은 디자인 교정 문서에 기록했다. 자동 로컬 검증 완료와 사용자 디자인 수락은 구분한다.

공통 프런트5패키지 `0.3.0`·서버 `0.3.0-SNAPSHOT`이 현재 기준이다. Reference/내부 Starter의 앱 버전은 `0.1.0`, 생성 Starter v2는 `1.0.0`이며 운영 기능은 기본 OFF·선택 ON이다. Redis·JWT·SSO는 제외한다. [012 완료 기록](012-운영모듈완료.md)에서 범위와 제한을 확인한다.

| 최신 실제 확인      | 결과·근거                                                                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 필수 통합 빌드      | [build.sh](../검증/012-integration-build-final.log) PASS: unit149/36 files. [일반 서버](../검증/012-integration-backend-final.json)는 총196/실행193/MQ3 skip, [별도 실제 Rabbit 검증](../검증/012-backend-verify-fifth-summary.json)은196/skip0                                           |
| JAR·시각·카탈로그   | 기본 E2E71+보고서5 PASS, 별도 시각4 PASS. [Storybook](../검증/012-storybook-tests-first.log)95/28 files·[Docs22/Controls10](../검증/012-storybook-browser.json) PASS·브라우저 오류0. live ON/OFF 명세4비교와 neutral 타입 경계 PASS                                                       |
| 최신 운영 화면      | [다섯 번째10개](../검증/012-operations-e2e-fifth.log) PASS. 모바일 UUID가 옆 셀과 겹친 앱 CSS를 수정한 최신 JAR·[JSON/PNG](../검증/012-operations-e2e-fifth-results/) 기준                                                                                                                |
| 전체 DOM 접근성     | [최신 집계](../검증/012-browser-axe-final.json): 운영11회·보고서9회에서 위반0/중복ID0. incomplete는 운영29규칙/143노드·보고서18규칙/245노드이며 수동 검수 미완료                                                                                                                          |
| 운영·복구·관측      | [운영18그룹](../검증/012-operational-boundaries-first.json)·[복구7그룹](../검증/012-runtime-recovery-third.json)·[관측8그룹](../검증/012-observability-fifth.json) PASS. [Grafana](../검증/012-grafana-browser-second/summary.json)는 populated metric query5·data frame11·visible panel6 |
| 독립 Starter·Docker | [설치 소비 앱](../검증/012-generated-operations-visual-final/summary.json)8그룹/axe15회·위반0/중복ID0·PNG15·UUID 셀 geometry PASS. [최신 Docker](../검증/012-docker-operations-final-second.json)7그룹 PASS                                                                               |

초기 실패와 당시 진행 중 표시는 아래 이력에 보존한다. 기본71 E2E 출력은 별도 시각 실행으로 정리되어 이전 단계의 axe111회를012 성적으로 재사용하지 않는다. axe 규칙 제외0이며 incomplete·VoiceOver 실제 음성·Windows·Linux 시각 기준·원격 CI/운영 배포·HA/power-loss 보장은 미확인이다. 이 문서 갱신은 새로운 서버·브라우저 실행 결과가 아니다.

신규 프로젝트의 실제 상태를 읽는 순서다. 기존 WorkboardVue 분석 자료는 각 문서의 참고 링크에 구분한다.

| 문서                                                                    | 용도                                                                                      |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [001 프로젝트 생성](001-프로젝트생성.md)                                | 구현·명령·검증·실패 기록·남은 범위                                                        |
| [조건부 기술 전체 구현](조건부기술-전체구현.md)                         | 확정한 전체 제품·단계·실행 완료 기준, 제외 유지                                           |
| [기술스택·적용 현황](기술스택-적용현황.md)                              | 버전·사용 위치·필수/권장/조건부·제외                                                      |
| [디자인](디자인.md)                                                     | 단일 토큰·공통 셸·실제 화면·후속 디자인                                                   |
| [디자인 교정](디자인교정.md)                                            | Yzen 시각 목표 미충족에 따른 별도 교정·240/68 셸·KPI/차트/위젯·새 QA와 사용자 승인 구분   |
| [013 공통 디자인 프레임워크](013-공통디자인프레임워크.md)               | 버튼·입력·카드·배지·표 공개 규격·Starter 조립·기술 역할·AI 질의·별도 검증                 |
| [프레임워크](프레임워크.md)                                             | 공통 UI/runtime/서버·소비 앱의 경계                                                       |
| [개발가이드](개발가이드.md)                                             | 단계별 개발·공통 부품 추가·검증·AI 입력                                                   |
| [001~012 단계](개발단계.md)                                             | 순서·완료 조건·진행 상태                                                                  |
| [002 디자인 토큰](002-디자인토큰.md)                                    | 구현·테스트·검수 캡처·복사용 AI 질의                                                      |
| [003 공통 UI 계약](003-공통UI계약.md)                                   | 공개 경계·실제 통합 검증·초기 실패 기록                                                   |
| [UI 공개 계약](UI-공개계약.md)                                          | props/defaults·events·slots·HTML/ARIA·SFC 사용·변경 정책                                  |
| [004 Storybook](004-Storybook.md)                                       | 자동 문서·Controls·fixture·MSW·play/axe·실제 검증                                         |
| [005 공통 입력·화면 패턴](005-공통입력과화면패턴.md)                    | 완료한 중립 입력·표·다국어·차트·Excel·서식 입력의 실제 통합 기록                          |
| [005 입력·폼 계약](005-입력폼계약.md)                                   | 입력/확인 dialog·native form·공개 타입·접근성·초기 실패                                   |
| [005 표·가상화 계약](005-표가상화계약.md)                               | 표/선택/페이지·합성 10,000행·focus/실측·일반 표 대안                                      |
| [005 확장 모듈 계약](005-확장모듈계약.md)                               | 차트·JSON editor·XLSX adapter·다국어의 자체 계약·라이선스                                 |
| [006 기능·접근성·시각 회귀](006-기능접근성시각회귀.md)                  | 로컬 완료한 26 E2E·40 axe·16 PNG/4 비교·실패 gate·CI 정책                                 |
| [007 요구사항 파일럿](007-요구사항파일럿.md)                            | 사용자/일반 요구사항·날짜·감사·실제 검증·실패·모바일/시각 실제 검수·남은 제한             |
| [008 조회·매핑·외부 연동](008-조회매핑과외부연동.md)                    | 서버77·Q/Mapper·혼합 TX/Feign·부모 processor fixture·fresh JAR/회귀 완료                  |
| [009 복잡 조회·서버 표](009-복잡조회와서버표.md)                        | 서버87·unit112·46 E2E·61 axe·10k/EXPLAIN·12 PNG·시각 회귀 완료                            |
| [010 업무 확장·파일 작업실](010-업무확장과파일작업실.md)                | 로컬 완료:139unit/143서버·74E2E/axe111·Story95/Docs22/Controls10·시각4·실패 보존          |
| [010 파일 저장 계약](010-파일저장계약.md)                               | 미디어/첨부/ADO·DB/blob 수명·Starter 선택 소비·012 영속 정리 인계                         |
| [010 보드·이미지 계약](010-보드와이미지계약.md)                         | Sc 공개 props/emits·좌표·이동·접근성·실제 검증 경계                                       |
| [011 배포·생성기 준비 검토](011-배포와생성기-준비검토.md)               | 로컬 완료: compiled0.2 pack·생성기48·외부 소비·Story95/Docs22/Controls10·upgrade/rollback |
| [012 메시지·복구 계약](012-메시지와복구계약.md)                         | outbox/inbox·Rabbit5회/DLQ·durable 감사/삭제·journal·single-set backup/restore            |
| [012 예약·오류 계약](012-예약과브라우저오류.md)                         | Quartz JDBC·등록 code·revision·코드 기반 오류·ADMIN·보존/제한                             |
| [012 완료 기록](012-운영모듈완료.md)                                    | 로컬 최종 검증·초기 실패·미확인 범위                                                      |
| [012 운영 계약](012-운영계약.md), [준비 검토](012-운영모듈-준비검토.md) | 전체 범위·원래 준비/실패 이력. 현재 실행 결과는 아래012 진행 기록                         |
| [007 요구사항 계약 조사](007-요구사항계약조사.md)                       | 입력 자료. 구현/실행 결과는 파일럿 기록에서 별도 확인                                     |
| [007 서버 설계](007-서버설계.md), [검증 matrix](007-서버검증계획.md)    | 원본 JSON/권한/revision과 실제 검증 범위를 대조                                           |

001~006은 구현·로컬 검증을 완료했다. 007 요구사항 업무 파일럿은 서버52·unit108·Story83·JAR E2E41·axe52회까지 통과했고 최종 모바일 목록 수정 후 fresh JAR·6장 이미지 검토도 통과하여 로컬 완료했다. 008 조회·매핑·외부 연동도 구현·로컬 통합 검증을 완료했고 [009 복잡 조회·서버 표](009-복잡조회와서버표.md)도 구현·로컬 통합 검증을 완료했고 010은 [업무 확장과 파일 작업실](010-업무확장과파일작업실.md)의 구현·로컬 통합 검증을 완료했으며 011 배포·생성기는 구현·로컬 검증을 완료했고 012 운영도 구현·로컬 검증을 완료했다. 최신 실행 범위는 문서 상단의012 결과를 따른다. VoiceOver 실제 음성·Windows·Linux 시각 baseline·원격 CI·실제 Compose·버전 전환 이외의 운영 검증은 미확인으로 남긴다. 외부0.1.0 생성 앱 JAR/브라우저 성공은 현재011 결과로 구분한다. Docker daemon·pack/생성기 경계·외부 타입은 아래011 실제 결과와 구분한다. 005 중립 모듈·006 회귀 기반과 007 일반 요구사항 파일럿의 결과를 구분한다. 이미지/주석·첨부·칸반/공지·관리·서식 문서는 010에서 구현·로컬 통합 검증을 완료했다.

008은 필수 fresh 통합·서버77/unit108·부모 상속 fixture2/미매핑 실패 gate·새 JAR E2E41/전체 DOM axe52·live2/타입3·HTTP17·원본170개 변경0을 통과해 로컬 완료했다. 초기76개와 실패·미확인 범위·AI 질의는 [조회·매핑·외부 연동](008-조회매핑과외부연동.md)에 기록한다.

009은 [compact 최종 통합](../검증/009-integration-build-compact-final.log)의 서버87·unit112/24 files와 새 JAR [46 E2E](../검증/009-e2e-compact-final.log)·[전체 DOM axe61회](../검증/009-e2e-compact-final-summary.json)를 통과했다. 보고서12 PNG를 실제 검토했고 별도 공통 시각4개 비교·의도한 실패 차단도 확인했다. incomplete117은 수동 후보이며 음성/원격/Linux/실제Compose·011 외부 소비 성공은 아래 현재 기록으로 구분한다.

010은 [최종 fresh 빌드](../검증/010-integration-build-focus-final.log)의 unit139/34 files·서버143개와 [최종 요약](../검증/010-final-summary.json)의74 E2E·axe111회 violations/중복ID0·Story95/28files·Docs22/Controls10·정상 시각4 PASS로 로컬 완료했다. [두 JAR 산출물](../검증/010-server-and-artifacts-focus-final.json)은 dist46+6 바이트 일치·obsolete extra0·Q18/Mapper2이며 Starter8/Reference5 clean restart도 확인했다. 초기 실패는 010 기록에 보존한다. 010 마감 당시012 crash 정리·복원·MQ/관측은 미검증이었다. 현재012 실행은 아래 절에서 구분하며 음성/incomplete 수동·Linux·원격 CI는 여전히 미확인이다.

011은 **구현·로컬 검증을 완료**했다. [진행 검토](011-배포와생성기-준비검토.md)·[생산 설계](011-공통패키지-배포설계.md)·[패키지 gate](011-패키지계약검증.md)·[Starter 생성기](011-Starter생성기.md)를 함께 읽는다. 011 마감 당시frontend5개0.2.0/backend0.2.0-SNAPSHOT은npm5/Maven7·negative25/보호128SHA불변을 확인했다. 생성기48/template61/새target74, 외부native4/type12/private3/XLSX/Sass·실제cold Notes 서버5개가 통과했다. 공통0.1.0 candidate4의browser7/HTTP2·axe4/루트검토PNG4와 생성 런처/프로필9·선택6도 실제 성공했다.

현재fresh139unit/143서버·JAR static35/5, main69+reports5=74/axe111·0violations/중복ID0·incomplete232/2117nodes, 정상시각4/17baseline불변·liveAPI2/생성타입3·원본170변경0을 확인했다.010의46/6·2121nodes는 당시 역사로 유지한다. compiled Story95 기능과 Docs22는 통과했으나 Controls0/10 첫 실패를 보존하고 정규화 수정 뒤10개 실제 재검증도 통과했다. [upgrade 첫 실패](../검증/011-upgrade-first-failure.json)는빌드 성공 뒤 동적API서버포트를 검증기가 소스 변경으로 오인한 경우이며 source변경0·정규화API동일이다. 두 번째 upgrade/rollback은 실제 통과했다.

i18n/devtools-types11.1.12와 UI table-core9.2.6/virtual-core3.17.11·루트단일lock을 적용했다. UIvendor strict696(Vuetify695/libDOM1)·자체0와 다른4 strictfalse0을 구분한다. 새 실제검사 위치는 `scripts/verify-generated-app.py`, `verify-generated-features.py`, `verify-package-upgrade.py`이며 CI package-consumer job에 생성 프로필9그룹을 연결했다. 원격CI·Windows·VoiceOver/incomplete수동·Linux시각은 미확인이다. daemon 사전 점검은012 실제Compose·DB/blob복원·MQ/Quartz/관측·영속 정리/감사 구현 완료가 아니다.

### 011 최종 로컬 확인과 당시012 준비 경계

[compiled Story95/28 files](../검증/011-stories-controls-final.log)와 [정적 Docs22/Controls10](../검증/011-storybook-browser.json)은 모두 실제 통과했고 브라우저 오류/API 누출은0이다. 첫 color 누락·Controls0/10 실패는 별도 로그/report에 보존한다. [0.2.0 외부 public 소비](../검증/011-consumer-types-v02.json)의 native4/type12/private3/XLSX/Sass와 [0.2.0 생성기48](../검증/011-generator-v02.json)도 통과했다. UI vendor strict696/자체0·다른4 strictfalse0의 지원 경계는 유지한다.

[실제 upgrade/rollback 두 번째](../검증/011-upgrade-rollback-second/summary.json)는0.1.0→0.2.0→0.1.0을 같은H2에서 통과했고 Notes revision1/2/3, 보호 업무 source47개 변경0·API 동일(`servers`만 정규화 제외)·공통JAR 정확한 바이트·기존lock 완전 복원을 확인했다. API·DDL이 같은 cohort의 전환 결과이며 파괴적 schema migration·사용자 코드 자동 병합을 지원한 결과가 아니다. 첫 build PASS/동적 server-port guard 실패 증거는 불변 보존한다.

[외부 optional OFF JAR](../검증/011-generated-optionaloff/summary.json)는 HTTP2/browser4·선택chunk 요청0을 확인했다. [격리 내부 OFF](../검증/011-starter-features.json)는 기본build 불변·요청0·선택chunk2개 emitted를 확인했으므로 완전한 번들 제거로 설명하지 않는다. [생성 프로필9/선택6](../검증/011-generated-features-second.json)와 기본prod OFF도 통과했다.011은 구현·로컬 검증 완료다.012는 [CI 준비 정적 검사](../검증/012-preparation-ci-check.json)의 YAML·Bash36·Python3 통과만 확인했고 remoteExecution/consumerExecuted/dependencyInstallExecuted는false다. 이 문단은 011 마감 당시의 준비 기록이다. 현재 012의 구현·실제 실행 범위는 아래 012 절에서 구분한다. 원격CI·Windows·Linux시각·VoiceOver/incomplete수동은 미확인으로 유지한다.

<details>
<summary>012 초기 구현·중간 검증 이력 — 아래 대기 표시는 당시 상태</summary>

## 012 현재 구현·확인 범위

012는 구현·통합 검증 중이다. 공통frontend5개0.3.0/backend0.3.0-SNAPSHOT, 두 앱의 선택 operations 프로필과 ADMIN 운영3페이지·capabilities Query·중립 오류 collector를 추가했다. 앱 own appVersion은0.1.0, templateVersion2의 생성 앱은1.0.0이다. v1의0.1/0.2 artifact/생성·실패 기록을 보존하고 v2는0.3 cohort를 선택한다. [선택 경계](../검증/012-template-cohort-selection.json)는 metadata 검증이며 v2의 실제 package/install/JAR/upgrade 성공을 대신하지 않는다.

현재 확인은 [서버195/실패·오류·skip0](../검증/012-backend-tests-fourth.log), [두 앱 운영 HTTP/H2 18그룹](../검증/012-operational-boundaries-first.json), [새 root 복구7그룹](../검증/012-runtime-recovery-third.json), [실제 관측7그룹](../검증/012-observability-third.json), [collector/예약 폼 단위10](../검증/012-operations-focused-unit-final.log)이다. 실제6개 인프라 pull/readiness·live ON/OFF snapshot·생성 타입3개와 담당 타입/형식/lint도 확인했다. 새 프런트 포함 JAR·운영10/OFF2 브라우저·whole DOM axe·시각·v2/pack·012 종합 마감은 진행 중이다. 앱 Docker build/기동은 아래 후속 실제 결과로 갱신한다. 관측 JSON의 manualReviewComplete는false이며 음성/수동 검수 성공으로 표시하지 않는다.

기본 프로필은 기능 OFF, 인증 후 capabilities를 확인하고 ON 기능만 호출한다. [실행 가이드](../operations.md#012-선택-운영-프로필과-로컬-인프라), [API13path·19schema 경계](../api.md#012-capabilities와-운영-api), [수정 위치](../maintenance-guide.md#012-운영-화면과-수집기를-수정할-때)를 원본으로 사용한다. Redis/JWT/SSO 제외와001~011의 역사적 성적은 유지한다. 원격 CI·Windows·Linux시각·VoiceOver·axe incomplete 수동은 별도 미확인이다.

[운영 첫 브라우저10개](../검증/012-operations-e2e-first.log)는4 PASS/6 FAIL이었다.2개는 예약 행 버튼의 visible 선택 문구가 aria-label에 빠진 실제 `label-content-name-mismatch`,4개는 이미 있는 PULSE를 다시 생성해 등록 작업당 예약 하나(`job_code UNIQUE`) 계약에409가 발생한 fixture 오류다. [초기 axe JSON·PNG](../검증/012-operations-e2e-first-results/)를 보존했다. 두 앱의 accessible name에 실제 ko/en visible 문구를 포함했고 테스트는 기존3개 system 예약과 PULSE1개를 사용하며 현재 revision으로 설정을 복원한다. DB·공통 UI·axe rule은 바꾸지 않았다. 수정 소스의 scoped 형식/lint·두앱/E2E 타입은0이며 실제 새 JAR 재실행은 진행 중이다.

### 012 후속 실제 실행과 남은 브라우저 재검증

[프런트 verify](../검증/012-frontend-verify-first.log)의149 unit과 [서버 다섯 번째](../검증/012-backend-verify-fifth-summary.json)의196개/실패·오류·skip0을 확인했다. 앞선 담당 unit10/서버195는 당시 실행으로 보존하고 중복 합산하지 않는다. [관측 다섯 번째](../검증/012-observability-fifth.json)는8그룹 PASS, [실제 Grafana 브라우저](../검증/012-grafana-browser-second/summary.json)는5개 metric query populated·11 data frame·6개 panel visible·pageerror0을 확인했다. raw canary0·trace6span/Loki1log와 manualReviewComplete=false 경계는 유지한다.

[Docker 세 번째 image build](../검증/012-docker-app-build-third.log)와 [네 번째 앱 컨테이너7그룹](../검증/012-docker-operations-fourth.json)도 실제 통과했다. prod,operations·UID10001/umask077·secret600·Flyway7·MESSAGE_DEMO 완료·예약 revision409·PDF/revision 보존·앱만 재기동/인프라6 ID불변·별도 management observer/Prometheus up을 확인했다. 당시 container/volume은 부모 검증을 위해 남겨 둔 상태이며 종료/회수까지 완료했다는 결과는 아니다. 기존 첫/두 번째 build 실패를 보존하고 로컬 컨테이너 성공을 원격 배포/HA/power-loss 보장으로 확대하지 않는다.

[운영 두 번째10개](../검증/012-operations-e2e-second.log)는7 PASS/3 FAIL이다. 앞선 제품 ARIA와 fixture UNIQUE 문제는 해결됐고 409/GET500·늦은A→B·실제 window/rejection·Starter 소비는 통과했다. 남은1개는 첫 dialog visible/focus 확인 전 Escape를 보낸 race,2개는 새 document goto에서 기본KO로 초기화된 뒤 EN 표를 찾은 fixture다. [두 번째 결과/PNG/axe](../검증/012-operations-e2e-second-results/)를 보존했다. dialog visible→취소 focus→Escape→닫힘과 재확인 후 URL을 기다리고, EN은 실제 SPA RouterLink로 이동하며 locale를 확인하도록 E2E만 수정했다. 임의 sleep·force click·locale 영속화·공통UI/DB/axe rule 변경 없이 scoped 형식/lint/E2E 타입0을 확인했다. 실제10 재실행·전체 회귀·시각·Story/Docs/Controls·0.3 pack/v2 소비와012 종합 마감은 아직 진행 중이다.

후속 정적 action 점검에서도 두 앱의 오류 그룹 행 버튼에 visible `발생 이력`/`Occurrence history`가 accessible name에서 빠진 같은 결함을 확인해 해당 앱 SFC 두 곳만 수정했다. 메시지 재시도·예약 선택·다른 운영 action도 visible 문구 포함 여부를 점검했다. scoped 형식/lint·두 앱 타입은0이며 이 후속 제품 수정은 새 JAR와 v2 소비 앱의 실제 axe 결과로 확인할 예정이다. 공통 UI/runtime·DB·규칙 제외·원문 오류 노출·locale 영속화는 추가하지 않았다.

</details>
