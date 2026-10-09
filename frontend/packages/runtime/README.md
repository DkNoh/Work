# @sc/runtime

Vue 소비 앱의 Router·Pinia·Vue Query와 단일 Axios client를 조립하는 ESM 패키지다. 공개 실행 진입점은 `@sc/runtime`, 타입은 `dist/types`, 버전 stamp는 `dist/build-manifest.json`이다.

현재 버전은 `0.2.0`이며 공통 서버 cohort는 `0.2.0-SNAPSHOT`이다. API·DDL은 유지한다. 이전 `0.1.0` 배포 후보는 수정하지 않으며 새 버전 upgrade/rollback·최종 브라우저 완료는 별도로 판정한다.

```ts
import { createFrameworkRuntime } from "@sc/runtime";

const runtime = createFrameworkRuntime({
  routes: [],
  unauthorizedPath: "/login",
});
// 소비 Vue 앱이 runtime.install을 설치하고 실제 업무 routes를 제공한다.
```

Vue·Router·Pinia·Query peer의 exact 버전은 package.json이 원본이다. peer 모듈을 runtime bundle 안에 복제하지 않는다. 서버 목록을 Pinia에 복사하지 않고 Query를 원본으로 사용한다. 기본 `Identity`는 username/roles이고 추가 identity 필드를 요구하는 앱은 `createFrameworkRuntime<AppIdentity>`에 검증하는 `decodeIdentity`를 반드시 제공한다. 서버 원래 JSON에 내부 roles를 덧붙여 보내지 않는다.

모든 업무 HTTP는 `runtime.client`를 사용한다. 쿠키·CSRF `headerName/token`, timeout, `ApiError.fields`, JSON/Blob/ArrayBuffer와 세션 generation 폐기 계약을 유지한다. 앱에 별도 Axios/fetch 우회를 만들지 않는다. dispose로 runtime의 요청·세션·이벤트 수명을 끝낸다. `ApiComponents`는 중립 예제 호환 타입만 포함하며 새 업무 DTO는 소비 앱의 실제 OpenAPI에서 생성한다.

ESM은 Node native import도 사용할 수 있는 형식이지만 기본 Router의 browser history 생성은 브라우저에 한정한다. Node에서 runtime을 생성하려면 `vue-router`의 memory history를 명시하고 실제 필요한 adapter를 제공한다. import 성공만으로 SSR·외부 HTTP·인증 시스템 전체를 지원했다고 판정하지 않는다.

```ts
import { createMemoryHistory } from "vue-router";
import { createFrameworkRuntime } from "@sc/runtime";
const runtime = createFrameworkRuntime({ routes: [], history: createMemoryHistory() });
// HTTP가 필요한 검사는 소비 앱의 실제 서버 또는 명시한 adapter로 수행한다.
runtime.dispose();
```

실제 레포 밖 native smoke에서 위 memory-history 조합의 초기 session null·빈 Query cache·dispose를 확인했다. 공개 `Identity`를 확장하면 unknown 서버 응답을 검증해 확장 Identity를 반환하는 앱 소유 decoder를 제공한다. 확장 generic의 decoder 누락·잘못된 Identity는 외부 타입 검사에서 실제 거절됐다. `@sc/runtime/src/http`는 실제 `ERR_PACKAGE_PATH_NOT_EXPORTED`이며 `createHttpClient`/`ApiError` 등 public export로 사용한다.

생산과 외부 non-UI 소비는 `strict:true/skipLibCheck:false`로 실제 exit0이다. `docs/검증/011-consumer-types-second.json`의 보존된 `0.1.0` 소비 결과는 native4·타입12·private3·XLSX/Sass를 포함한다. 이 결과를 현재 `0.2.0`의 새 JAR/세션/CSRF·브라우저·되돌리기 전체 성공으로 확대하지 않는다. UI의 별도 vendor strict696·자체0 한계와 구분한다.

워크스페이스에서 JS/선언을 만든 완성 tarball을 설치한다. consumer 설치 중 source 빌드/lifecycle 실행을 요구하지 않는다. 내부 build script는 저장소 개발 도구이며 설치된 tarball의 재빌드 API가 아니다. 자체 코드는 `private:true`·`UNLICENSED`; 직접 runtime dependency/peer의 설치된 원본 라이선스는 `THIRD_PARTY_NOTICES`에 있다. transitive vendor의 원래 고지도 적용된다.
