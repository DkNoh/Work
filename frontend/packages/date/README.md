# @sc/date

Vue·Router·업무 API에 의존하지 않는 달력 날짜·UTC timestamp 표시 ESM 패키지다. 공개 경로는 `@sc/date`, 선언은 `dist/types/index.d.ts`다.

현재 공통 배포 버전은 `0.2.0`이다. cohort의 서버 `0.2.0-SNAPSHOT` 전환은 API·DDL을 유지하며 date에 서버 의존성을 추가하지 않는다. 이전 `0.1.0` 후보와 실패 기록은 보존하고 업그레이드·되돌리기의 최종 결과는 별도 확인한다.

```ts
import { createDateFormatter, isCalendarDate, parseUtcTimestamp } from "@sc/date";

const display = createDateFormatter({ locale: "ko", timeZone: "Asia/Seoul" });
isCalendarDate("0000-02-29");
display.formatCalendarDate("0099-01-02");
const raw = "2026-10-07T00:00:00.123456789Z";
parseUtcTimestamp(raw); // valid/empty/invalid. raw 원문을 보존한다.
display.formatTimestamp(raw);
```

달력은 `YYYY-MM-DD`와 그레고리력 0000~9999년을 검증하며 시간대 이동을 하지 않는다. UTC timestamp는 `Z`·소수초 1~9자리·유효한 날짜/시간만 받아 millisecond 표시값과 원문을 구분한다. 저장용 문자열을 Date/toISOString으로 재작성하지 않는다. 모호한 벽시각→Instant API는 제공하지 않는다.

factory는 실제 IANA zone을 검사하고 locale/표시 값을 독립적으로 유지한다. 빈 값/잘못된 값은 지정된 표시 문구를 사용하며 `Invalid Date`로 렌더하지 않는다. Day.js UTC/timezone plugin·ko/en locale 등록은 module side effect이며 tree shaking으로 제거하지 않도록 manifest에 표시한다. Intl/IANA 지원 범위는 소비 Node/브라우저 환경도 확인한다.

실제 외부 Node native import와 생산·외부 non-UI `strict:true/skipLibCheck:false` 검사를 통과했다. 공개 진입점만 사용하고 dist/source 경로를 직접 import하지 않는다. 근거인 `docs/검증/011-consumer-types-second.json`은 source alias0·보존된 `0.1.0` 소비의 native4/type12/private3/XLSX/Sass 결과다. 현재 `0.2.0`의 최종 전체 브라우저와 upgrade/rollback은 진행 중이다. UI의 vendor strict696·자체0 제한을 이 순수 패키지의 strict 실패로 합산하지 않는다.

완성 JS/선언 tarball을 설치하며 source 빌드를 consumer에 맡기지 않는다. `dist/build-manifest.json`이 버전 stamp다. 자체 코드는 `private:true`·`UNLICENSED`, Day.js 원본 MIT 문구는 `THIRD_PARTY_NOTICES`에 보존한다. 설치 vendor의 transitive 고지도 적용된다.
