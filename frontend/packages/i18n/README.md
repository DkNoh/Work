# @sc/i18n

독립적인 Vue I18n Composition 인스턴스와 공통 ko/en 메시지를 제공하는 ESM 패키지다. 공개 진입점은 `@sc/i18n`, 선언은 `dist/types/index.d.ts`다.

현재 배포 버전은 `0.2.0`, 서버 cohort는 `0.2.0-SNAPSHOT`이며 API·DDL 변경은 없다. 기존 `0.1.0` 후보·실패 증거를 보존하고 최종 새 브라우저·upgrade/rollback 결과는 별도로 확인한다.

```ts
import { createScI18n } from "@sc/i18n";

const i18n = createScI18n({
  locale: "ko",
  messages: { ko: { app: { title: "소비 앱" } }, en: { app: { title: "Consumer app" } } },
  onMissing: (_locale, key) => console.warn(`Missing message: ${key}`),
});
// 소비 Vue 앱에 i18n을 설치하고 useI18n({useScope:'global'})으로 사용한다.
```

각 호출의 locale/messages는 독립적이다. 한국어 fallback과 앱 메시지를 깊이 병합하되 입력 원본을 바꾸지 않는다. 메시지는 문자열/중첩 객체만 허용하며 prototype 관련 키와 과도한 중첩을 거절한다. 언어 전환으로 업무 draft를 초기화하지 않는다. 공통 UI label은 앱에서 locale에 맞게 전달한다.

Vue peer·Vue I18n dependency의 exact 버전은 package.json과 actual consumer lock이 원본이다. 소비 앱의 직접 Vue I18n과 같은 module을 해석하도록 설치/dedupe하고 엄격한 선언 검사를 실행한다. 기존 workspace의 skipLibCheck 결과를 외부 strict 소비 통과로 재사용하지 않는다.

현재 Vue I18n과 직접 타입 의존성 `@intlify/devtools-types`는 모두 `11.1.12`, Vue peer는 `3.5.43`이다. 이전 `11.4.13`의 존재하지 않는 Vue 타입 참조와 devtools-types 누락은 초기 실패를 보존하고 실제 호환 설치로 수정했다. 임의 vendor patch·타입 assertion으로 감추지 않았다. registry의11.1.12 안내는 “This version is NOT deprecated. Previous deprecation was a mistake.”다.

레포 밖 native 소비에서 두 factory의 ko/en locale·번역 차이와 독립성을 확인했고 생산·외부 non-UI `strict:true/skipLibCheck:false`는 exit0이다. 공개 `createScI18n`/`commonMessages`로 사용하며 source/private 경로를 가져오지 않는다. `docs/검증/011-consumer-types-second.json`은 보존된 `0.1.0`의 native4/type12/private3/XLSX/Sass 결과다. 현재 `0.2.0`의 전체 production 브라우저·upgrade/rollback 성공을 대신하지 않으며 UI의 vendor strict696·자체0 제한과 구분한다.

워크스페이스에서 만든 완성 tarball을 소비한다. 설치 시 source 빌드/lifecycle를 실행하지 않는다. 버전 stamp는 `dist/build-manifest.json`이다. 자체 코드는 `private:true`·`UNLICENSED`, 직접 vendor/peer 원본 라이선스는 `THIRD_PARTY_NOTICES`에 보존한다. transitive vendor의 원래 고지도 적용된다.
