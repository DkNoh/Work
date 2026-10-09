# DB 선택과 이관 기준

2026-10-09. H2를 기본 개발 DB로 유지하고 Oracle, Db2 LUW, Microsoft SQL Server, PostgreSQL을 선택하는 경로를 추가했다. 실제 외부 DB 4종의 접속 계정과 실행 서버는 제공되지 않았으므로, 설정·SQL·DDL 구현과 해당 제품에서의 실행 검증을 구분한다. 고객용 지원 확정 전에는 아래 수락 시험이 필요하다. 리뷰에 대한 판단은 [리뷰정리](리뷰정리.md)에 있다.

## 선택 방법

**Maven profile은 JAR에 넣을 드라이버를 선택하고, `SC_DB_VENDOR`는 실행할 앱 설정과 migration 경로를 선택한다. 두 값을 같은 DB로 맞춘다.** 여러 DB profile을 함께 켜는 것은 하나의 앱이 여러 DB를 동시에 쓰는 구성이 아니다. 공통 서버 Starter는 JDBC 드라이버를 강제하지 않으며 소비 앱이 소유한다.

| DB         | Maven profile   | `SC_DB_VENDOR` | JDBC 드라이버                        | Flyway 확장                  |
| ---------- | --------------- | -------------- | ------------------------------------ | ---------------------------- |
| H2         | `db-h2` (기본)  | `h2` (기본)    | `com.h2database:h2`                  | core                         |
| Oracle     | `db-oracle`     | `oracle`       | `com.oracle.database.jdbc:ojdbc11`   | `flyway-database-oracle`     |
| Db2 LUW    | `db-db2`        | `db2`          | `com.ibm.db2:jcc`                    | `flyway-database-db2`        |
| SQL Server | `db-mssql`      | `sqlserver`    | `com.microsoft.sqlserver:mssql-jdbc` | `flyway-sqlserver`           |
| PostgreSQL | `db-postgresql` | `postgresql`   | `org.postgresql:postgresql`          | `flyway-database-postgresql` |

버전은 Spring Boot **3.5.16** BOM으로 고정한다. 현재 BOM의 Oracle JDBC는 23.7.0.25.01, Db2 JCC는 12.1.4.0, MSSQL JDBC는 12.10.2.jre11, PostgreSQL JDBC는 42.7.11이며 Flyway는 11.7.2다. 직접 버전을 임의로 최신화하지 않는다. [Boot 의존성 관리](https://docs.spring.io/spring-boot/3.5/appendix/dependency-versions/properties.html), [Flyway Oracle](https://documentation.red-gate.com/flyway/reference/database-driver-reference/oracle-database), [Db2](https://documentation.red-gate.com/flyway/reference/database-driver-reference/db2), [SQL Server](https://documentation.red-gate.com/flyway/reference/database-driver-reference/sql-server-database)의 별도 모듈 계약을 따른다.

PowerShell 빌드 예시:

```powershell
# PostgreSQL 드라이버로 두 앱을 빌드한다. 기본 회귀 테스트는 합성 H2 자료를 사용한다.
& backend/mvnw.cmd -B -ntp -f backend/pom.xml -Pdb-postgresql verify
```

실행 환경에서 `SC_DB_VENDOR`, `SC_DB_URL`, `SC_DB_USERNAME`, `SC_DB_PASSWORD`를 공급한다. 비밀번호는 비밀정보 저장소/배포 환경에서 주입하고 명령 이력·소스·문서·로그에 값을 쓰지 않는다. URL에는 사용자 이름과 비밀번호를 넣지 않는다. TLS·인증서와 schema 설정은 고객 환경 계약에 맞춘다.

| DB         | URL 형식 예시 (접속 정보가 아닌 형식)                                                           |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Oracle     | `jdbc:oracle:thin:@//db-host:1521/service-name`                                                 |
| Db2 LUW    | `jdbc:db2://db-host:50000/DATABASE`                                                             |
| SQL Server | `jdbc:sqlserver://db-host:1433;databaseName=DATABASE;encrypt=true;trustServerCertificate=false` |
| PostgreSQL | `jdbc:postgresql://db-host:5432/database?sslmode=verify-full`                                   |

Windows의 `npm run dev -- --rebuild`는 선택 vendor에 맞는 Maven profile로 개발 JAR를 만든다. macOS/Linux에서는 먼저 `scripts/build.sh -Pdb-postgresql`처럼 해당 profile로 빌드하고 실행한다. 기존 JAR가 있으면 실행기가 DB 변경을 추측해 재빌드하지 않으므로 DB를 바꿀 때는 반드시 다시 빌드한다. 외부 DB를 명시하지 않은 개발 실행은 기존 격리 H2 자료를 사용한다. 기본 포트는 Vue 5175/Spring 18082다.

## 파일과 소유권

- `backend/framework-core/.../database/DatabaseDialect.java`: 공통 JDBC 페이지·시간·Quartz 선택 확장점. 소비 앱의 bean으로 교체할 수 있다.
- `backend/framework-autoconfigure/.../database/`: JDBC metadata에 따른 표준 구현과 중복 INSERT의 savepoint 복구. 원래 트랜잭션을 commit하거나 별도 트랜잭션으로 분리하지 않는다.
- 각 앱의 `src/main/resources/database/<vendor>.yml`: 드라이버·연결·migration 경로. 잘못된 vendor를 H2로 대체하지 않는다.
- 각 앱의 `src/main/resources/db/<vendor>/`: 외부 DB별 앱 소유 migration. Reference/Starter/생성 v2의 업무·감사·운영 선택을 각각 유지한다.
- 기존 `db/migration`, `db/audit-migration`, `db/operations-migration`: H2의 기존 파일과 checksum을 유지한다. 실행 중인 H2 파일을 변환하거나 이동하지 않는다.

`operations` profile의 Quartz DDL은 Quartz 2.5.2 공식 DB별 스크립트를 기반으로 앱 migration에서 제공한다. 공통 JAR가 고객 업무 schema에 DDL을 자동 추가하지 않는다. 기능 OFF는 해당 선택 테이블을 요구하지 않는다. 감사는 Reference 기본 및 Starter/생성 앱의 선택 profile 계약을 따른다.

기존 고객 schema에는 신규 예제 migration을 그대로 적용하지 않는다. DBA와 baseline, schema 소유자, 변경 권한, 적용 순서와 복구 계획을 결정한다. SQL Server의 `timestamp`는 날짜형이 아니므로 시각은 `datetimeoffset`, Db2 LUW는 UTC `TIMESTAMP(6)` 계약을 사용한다. Oracle의 빈 문자열, 문자열 길이·예약어, PostgreSQL 대형 문자열·UUID, DB별 자동 증가 키도 앱 DDL/매핑의 일부다. 신규 스키마 생성과 기존 H2 데이터를 다른 DB에 옮기는 작업은 별도다.

## 생성 앱과 API 명세

현재 v2 템플릿에도 같은 profile과 설정/DDL을 제공한다. 과거 배포판용 v1 템플릿은 수정하지 않는다. 외부 DB 빌드 시 API 타입 생성 때문에 고객 DB에 migration을 실행하지 않도록 명세 파일 또는 명시적인 loopback 개발 서버를 선택할 수 있다.

```bash
# 별도로 검증한 해당 앱의 실제 OpenAPI JSON을 입력한다.
SC_DB_VENDOR=postgresql SC_API_SCHEMA=/private/app-openapi.json \
  bash scripts/build.sh -Pdb-postgresql

# 이미 실행한 별도 개발 서버에서 수집할 때
SC_DB_VENDOR=postgresql SC_API_URL=http://127.0.0.1:18199/v3/api-docs \
  bash scripts/build.sh -Pdb-postgresql

# 타입만 생성하는 경우 DB나 JAR를 실행하지 않는다.
node scripts/openapi-types.mjs --schema /private/app-openapi.json
```

둘 중 하나만 지정한다. 기본 H2 빌드는 기존 임시 H2 명세 서버를 사용한다. 명세 파일의 타입 일치 검사는 실제 서버 API와의 일치 검사를 대신하지 않으므로 고객 CI에서 최신 개발 서버 명세와 대조한다. 생성 앱 테스트의 합성 비밀번호는 POSIX 600 또는 Windows 소유자 ACL로 작성한다.

## 지원을 확정하기 위한 검증

설계 대상은 Oracle 19c 이상, Db2 **LUW** 11.5 이상, SQL Server 2019 이상, PostgreSQL 14 이상이다. 이 버전 표는 실기동 인증 목록이 아니다. Db2 z/OS·IBM i, 구형 Oracle/WAS, 복수 DB/XA는 별도 어댑터와 검증 대상이다. 실제 채택 버전은 JDBC·Hibernate·Flyway·Quartz의 지원 범위와 함께 고객 계약에서 좁힌다.

DB별 폐기 가능한 신규 schema에서 다음을 실행하고 제품/버전·명령·결과를 남긴다.

1. migration 최초 실행·재실행·중단 복구, 기존 checksum 유지.
2. JPA 저장→flush→MyBatis 조회 및 같은 트랜잭션의 DML rollback.
3. 한글/긴 문자열/빈 문자열·NULL/생성 키/UUID/UTC 시각/페이지 정렬/revision 충돌.
4. 감사·outbox/inbox·중복 충돌 후 동일 트랜잭션 계속 사용·예약 경쟁·브라우저 오류 합산.
5. Quartz DB별 delegate·재시작·실행 중 실패와 복구, 운영 기능 OFF/ON.
6. 독립 생성 앱의 설치·JAR·로그인·CSRF·CRUD·DB 백업/복원과 패치.

H2 compatibility mode와 SQL 문자열 단위 검사는 외부 DB 엔진 실행으로 세지 않는다. 기존 H2 파일 백업/복원 스크립트는 외부 DB 백업 도구가 아니다. 외부 DB 백업/복원은 DBA/제품 도구와 업로드 자료의 일관성 절차를 별도로 구성한다. 현재 실행 결과와 미확인 사항은 [리뷰정리의 이번 작업 기록](리뷰정리.md)에 남긴다.

### Windows 종료와 H2 쓰기 지연

이번 격리 JAR 시험에서 Windows `subprocess.terminate()`가 JVM 종료 hook을 거치지 않고 종료하고,
기본 H2 지연 쓰기의 최근 변경이 재시작 후 보이지 않는 경우를 재현했다. 정상 종료 검증으로 간주하지 않는다.
제품의 기존 H2 접속 기본값은 유지했다. 즉시 쓰기 조건의 합성 DB 재시작 시험은
`python scripts/smoke-test.py --h2-write-through`로 실행한다. 별도 JAR는 `--jar`와 `--starter-jar`로 지정한다.
이 옵션은 테스트 DB URL에만 `WRITE_DELAY=0`을 추가하며 해당 조건에서 HTTP 17개 검사를 통과했다.
이 결과를 기본 설정의 강제 종료 무손실·운영 전원 장애·외부 DB 복구 보장으로 확대하지 않는다.

## DB별 선행조건과 앱 매핑

외부 DDL은 빈 신규 schema를 위한 시작점이며 네 DB에서 실제 실행한 결과가 아니다. 드라이버 설치만으로 레거시의 기존 테이블·프로시저·트랜잭션까지 호환된다는 의미는 아니다.

### Oracle

Reference의 짧은 문자는 `VARCHAR2(n CHAR)`, 긴 업무 본문과 JSON은 `CLOB`, 숫자 ID는 identity, 실수 좌표는 `BINARY_DOUBLE`로 정의한다. 한글과 보충 문자를 보존하려면 `AL32UTF8` DB를 준비한다. URL·태그 JSON처럼 최대 2,000자인 열은 문자 수와 별도로 최대 byte 제약을 받으므로 전체 API 길이 계약을 보장하는 배포는 `MAX_STRING_SIZE=EXTENDED`를 선행조건으로 삼는다. DBA가 기존 DB 설정 변경의 영향을 검토해야 하며 앱 시작 시 설정을 자동 변경하지 않는다. [Oracle 문자형·최대 byte 규칙](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Data-Types.html)을 따른다.

Oracle의 빈 문자열 처리를 고려해 선택 본문 열만 nullable로 정의하고 Reference 엔티티의 읽기 getter에서 빈 문자열로 복원한다. `database/oracle-orm.xml`은 해당 선택 열의 ORM nullable 설정도 함께 맞춰, NULL을 읽은 후 다른 필드를 갱신할 때 잘못 거절하지 않도록 한다. 장문 열의 저장 용량은 CLOB으로 고정하여 `MAX_STRING_SIZE=EXTENDED` 환경에서 Hibernate가 10,000~20,000자 필드를 VARCHAR2로 기대하는 불일치를 방지한다. API의 입력 길이 제한은 유지한다. 읽을 때 필드 자체를 변경하지 않아 단순 조회로 dirty/revision 변경이 생기지 않도록 한다. 필수 본문은 여전히 서버 입력 검증과 NOT NULL 대상이다. `OracleReferenceNamingStrategy`는 예약어인 `SIZE`·`NUMBER` 열만 인용하고 기존 Java/API 이름을 유지한다. 이 규칙은 Reference의 Oracle 설정에서만 선택한다. 고객 앱의 이름/NULL 의미는 별도로 매핑한다.

### Db2 LUW

Unicode DB를 사용한다. 업무 문자열에는 `VARCHAR(n CODEUNITS32)`를 사용하고 긴 본문은 `CLOB(2M)`으로 분리한다. 이 구분은 한글을 byte 길이로 잘라 저장하지 않기 위한 것이다. Reference의 `database/db2-orm.xml`은 해당 긴 본문의 ORM 열 용량만 덮어쓰며 ID·revision과 나머지 annotation은 유지한다. 코드의 `@Size`는 API 최대 길이를 계속 제한한다. [IBM 문자열 단위 설명](https://www.ibm.com/docs/en/db2/11.1.0?topic=elements-constants)을 참고한다.

앱 시각은 `TIMESTAMP(6)`에 UTC로 저장하고 JDBC·JPA·MyBatis의 UTC 변환을 함께 사용한다. 지역 시각을 같은 열에 혼합해서 넣는 기존 SQL/프로시저는 별도 이관 검증이 필요하다. Quartz는 공식 `tables_db2_v95.sql`을 기반으로 하고 `DB2v8Delegate`를 선택한다. 이 스크립트의 제한된 작업 이름·직렬화 BLOB 용량도 고객의 확장 작업과 함께 확인한다. z/OS와 IBM i는 이 설정의 적용 대상이 아니다.

### SQL Server·PostgreSQL

SQL Server는 한글 보존을 위해 `NVARCHAR`/`NVARCHAR(MAX)`와 Hibernate nationalized 설정을 함께 사용한다. 날짜는 `DATETIMEOFFSET(6)`, 자동 키는 `IDENTITY`, 감사 allowlist는 binary collation CHECK로 정의한다. 이력·문서 JSON은 `@Column(length=Integer.MAX_VALUE)`로 저장 용량을 지정하고 JDBC 문자열 타입은 dialect/nationalized 설정이 고르게 한다. 따라서 SQL Server는 `NVARCHAR(MAX)`, H2/Oracle/Db2는 CLOB, PostgreSQL은 TEXT를 기대하며 `@Lob`의 PostgreSQL OID 대형 객체 생성을 피한다. API의 JSON 크기 제한과 앱 DDL 용량은 별도로 유지한다. PostgreSQL 감사 정규식은 14에서도 사용할 수 있는 `~` 연산자를 사용한다.

[DatabaseOrmMappingTest](../backend/reference-app/src/test/java/dev/scframework/reference/database/DatabaseOrmMappingTest.java)는 실제 엔티티와 XML로 Hibernate 기대 열 타입을 계산한다. Oracle STANDARD/EXTENDED의 CLOB·NULL 계약과 다섯 DB의 장문 JSON 타입을 연결 없이 확인한다. 이것은 외부 DB의 실제 DDL/JDBC 실행을 대신하지 않는다.

MyBatis 보고서는 공통 `OFFSET … FETCH NEXT`와 CASE 기반 NULL 정렬을 사용한다. SQL 문법이 같아도 DB의 collation·격리 수준·잠금 결과까지 같아지는 것은 아니므로 한글 정렬, 같은 시각의 ID 순서, 통계와 페이지 일관성은 실제 고객 DB에서 확인한다.

## DB 설정 정적 검사

```powershell
node scripts/verify-database-config.mjs
```

[정적 검사기](../scripts/verify-database-config.mjs)는 두 앱과 v2 생성 템플릿의 Maven profile·JDBC/Flyway 모듈·Spring vendor 설정·Quartz delegate·앱 소유 migration 경로를 연결해 검사한다. 기존 기능과 DB별 migration 파일/테이블 목록의 대응, 중복 migration 버전, 외부 접속값의 H2/빈 값 fallback, 대표적인 미변환 자료형도 확인한다. `--json`은 기계가 읽을 결과, `--root <경로>`는 별도 체크아웃 검사에 사용한다. 설정 파일만 읽으며 secret이나 DB에 접근하지 않는다.

현재 [검증 기록](검증/2026-10-09-database-config-gate.json)은 정적 항목 447개 통과와 임시 복사본의 결함 5종 탐지를 담는다. 누락 profile, 비밀번호 fallback, 잘못된 migration 경로, 테이블 누락, DB 자료형 불일치를 각각 탐지했다. 이 수치는 SQL 파서나 외부 DB 엔진의 시험 수가 아니다.

## 실제 외부 DB의 명시적 계약 시험

[ExternalDatabaseContractTest](../backend/starter-app/src/test/java/dev/scframework/starter/ExternalDatabaseContractTest.java)는 외부 DB가 준비된 환경에서 실행하는 JUnit 진입점이다. 일반 빌드에서는 실행 조건이 없으면 **skip**한다. 이번 작업 환경에는 외부 DB 서버·계정이 제공되지 않았으므로 이 시험의 실제 Oracle/Db2/SQL Server/PostgreSQL 통과 결과는 없다.

시험 전 DBA가 폐기 가능한 별도 DB의 **비어 있는 `sc_contract_*` schema**와 제한된 전용 사용자를 준비한다. Oracle에서는 전용 사용자/schema를 준비하고, 다른 DB도 해당 사용자의 기본 schema 또는 JDBC의 current schema를 이 schema로 맞춘다. `Connection.getSchema()`가 지정한 schema와 일치해야 한다. 운영·고객 실데이터 schema를 대상으로 삼지 않는다. 이름만 임시로 바꾸고 실제 운영 계정이나 자료를 사용하는 방식은 허용하지 않는다.

| 환경 변수                                    | 입력 계약                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `SC_DB_CONTRACT_TEST`                        | 정확히 `true`일 때만 테스트를 실행한다. 없으면 skip한다.                  |
| `SC_TEST_DB_DISPOSABLE`                      | 정확히 `true`. 전용 폐기 가능한 시험 자원임을 명시한다.                   |
| `SC_TEST_DB_VENDOR`                          | `oracle`, `db2`, `sqlserver`, `postgresql` 중 하나. H2는 허용하지 않는다. |
| `SC_TEST_DB_URL`                             | 전용 시험 DB JDBC URL. 계정·비밀번호를 URL 안에 넣지 않는다.              |
| `SC_TEST_DB_USERNAME`, `SC_TEST_DB_PASSWORD` | 시험 전용 접속값. 비밀정보 저장소/보호된 실행 환경에서 주입한다.          |
| `SC_TEST_DB_SCHEMA`                          | 사전에 준비한 빈 기본 schema. `sc_contract_` 접두사를 사용한다.           |

PowerShell에서 접속값을 비밀정보 공급 수단으로 주입한 뒤 다음처럼 실행한다. 예시는 공개 가능한 선택값만 설정하며 접속값은 명령 이력에 적지 않는다.

```powershell
$env:SC_DB_CONTRACT_TEST = "true"
$env:SC_TEST_DB_DISPOSABLE = "true"
$env:SC_TEST_DB_VENDOR = "postgresql"
$env:SC_TEST_DB_SCHEMA = "sc_contract_trial"
& .\backend\mvnw.cmd -B -ntp -f backend/pom.xml -Pdb-postgresql `
  -pl starter-app -am "-Dtest=ExternalDatabaseContractTest" `
  "-Dsurefire.failIfNoSpecifiedTests=false" test
```

다른 DB는 표의 Maven profile과 `SC_TEST_DB_VENDOR`를 함께 바꾼다. 이 시험은 앱 실행용 `SC_DB_URL`이나 `.runtime/dev`를 읽지 않는다. JDBC metadata의 실제 제품을 확인해 H2 호환 모드 실행을 외부 DB로 세지 않으며, 전용 schema에 기존 테이블이 있으면 migration 전에 실패한다. 실행을 선택한 뒤 필수값이 누락되거나 계약이 맞지 않으면 성공/skip으로 넘기지 않고 실패한다.

시험은 Starter의 audit 1개·operations 2개 migration 최초 실행과 재실행 0개, 감사 생성 키, 한글 메시지·UUID·마이크로초 시각·NULL, 제한 조회와 페이지 경계, 중복 INSERT savepoint 복구, 중복 이전/이후 DML의 rollback과 commit, outbox/inbox 저장·완료, Quartz delegate 로딩과 핵심 테이블 접근을 검사한다. 실제 JPA/MyBatis 업무, Quartz 예약 실행·클러스터 잠금·복구, RabbitMQ 전달·crash, 브라우저 오류 동시 합산과 프런트 E2E는 별도 수락 시험이다.

`Flyway clean`·baseline·schema 자동 생성·종료 시 자동 삭제를 사용하지 않는다. 실행 뒤 합성 자료와 migration 이력을 남기므로 담당자가 결과를 확인한 후 전용 자원을 회수한다. 재실행에는 새 빈 schema를 준비한다. 제품/서버 버전·명령·성공/실패/skip을 기록하되 접속 URL·사용자·비밀번호가 들어간 JDBC/Flyway 원문 로그를 공개 검증 자료에 복사하지 않는다.
