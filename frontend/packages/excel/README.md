# @sc/excel

명시한 열/행을 XLSX ArrayBuffer로 쓰고 읽는 ESM 패키지다. 파일 선택·다운로드·업무 저장·자동 재시도는 소비 앱이 소유한다. 공개 진입점은 `@sc/excel`, 자체 선언은 `dist/types/index.d.ts`다.

현재 버전은 `0.2.0`, 서버 cohort는 `0.2.0-SNAPSHOT`이며 API·DDL은 유지한다. 이전 `0.1.0` 배포 후보와 실패 증거는 수정하지 않고 최종 upgrade/rollback·브라우저 결과는 별도로 확인한다.

```ts
import { readWorkbook, writeWorkbook } from "@sc/excel";

const columns = [{ key: "title", label: "제목", type: "string" }] as const;
const bytes = await writeWorkbook({ columns, rows: [{ title: "명시적으로 반영할 자료" }] });
const preview = await readWorkbook(bytes, { columns });
// preview.rows[i]와 preview.sourceRowNumbers[i]를 표시한 뒤 사용자 승인으로 업무 저장한다.
```

string/number/boolean/Date/null 자체 cell 계약과 파일·행·열 제한을 사용한다. 잘못된 구조/셀은 원본 XLSX 행 번호의 오류로 반환하고 유효하지 않은 행을 정상 rows에 섞지 않는다. `sourceRowNumbers`는 유효 rows와 같은 인덱스의 실제 1-based 물리 행 번호다. ISO 달력 문자열과 Instant Date는 소비 업무의 열 정의에서 구분한다. 수식/임의 객체는 자동 실행하거나 업무 값으로 정규화하지 않는다.

ExcelJS는 외부 dependency다. Node에서는 vendor의 Node entry를, 브라우저 Vite에서는 vendor browser entry를 실제로 사용한다. 자체 공개 선언은 ExcelJS/Node Buffer를 노출하지 않는다. 라이브러리 source의 vendor 타입 검사에는 개발용 Node 타입이 필요하지만 그것이 브라우저에 Node builtin을 번들하는 설정은 아니다.

현재 저장소의 `exceljs -> uuid:11.1.1` 루트 override는 tarball consumer로 전파되지 않는다. 소비 프로젝트는 검증된 override 정책을 자기 root manifest에 명시하고 actual audit/XLSX 왕복을 다시 확인해야 한다. 라이브러리 안의 overrides나 저장소 audit 결과만으로 외부 설치를 판정하지 않는다.

실제 레포 밖 native import와 XLSX write/read에서 한글·Date·null·수식 모양 문자열을 보존하고 원본 물리 행 `[2,3]`을 확인했다. formula를 실행하거나 원본 날짜를 자동 재작성한 결과가 아니다. 생산·외부 non-UI `strict:true/skipLibCheck:false`는 실제 exit0이며 Node ambient는 producer의 ExcelJS vendor 선언 해석에만 필요하다. 공개 함수와 `ScWorkbookColumn` 등 자체 타입을 사용하고 source/dist wildcard를 import하지 않는다.

증거 `docs/검증/011-consumer-types-second.json`은 source alias0·보존된 `0.1.0`의 native4/type12/private3/XLSX/Sass를 기록한다. UI의 별도 vendor strict696·자체0 제한과 이 패키지의 strict 성공을 구분한다. 현재 `0.2.0`의 production 브라우저 파일 선택·download·staging·upgrade/rollback 최종 결과는 아직 진행 중이다.

완성 JS/선언을 설치하며 consumer lifecycle/source 빌드를 요구하지 않는다. 버전 stamp는 `dist/build-manifest.json`이다. 자체 코드는 `private:true`·`UNLICENSED`, ExcelJS 원본 라이선스는 `THIRD_PARTY_NOTICES`에 보존한다. 이 파일은 모든 transitive dependency의 완전한 라이선스 inventory가 아니며 설치 vendor의 원래 고지도 적용된다.
