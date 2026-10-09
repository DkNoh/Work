import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * 앱 2개와 생성 템플릿의 DB 선택 계약을 파일만 읽어서 검사한다.
 * Maven profile → JDBC/Flyway → Spring vendor 설정 → 실제 migration 파일의 연결 누락을
 * 빠르게 찾는 게이트다. DB 접속/DDL 실행/SQL 문법 전체 검증을 대신하지 않으며 비밀값은 읽지 않는다.
 * YAML은 이 저장소의 들여쓰기 기반 scalar 설정만 읽는다. 전체 YAML 해석기로 사용하지 않는다.
 */
const vendors = [
  { vendor: "h2", profile: "db-h2", driver: "org.h2.Driver", jdbc: "com.h2database:h2" },
  {
    vendor: "oracle",
    profile: "db-oracle",
    driver: "oracle.jdbc.OracleDriver",
    jdbc: "com.oracle.database.jdbc:ojdbc11",
    flyway: "flyway-database-oracle",
    delegate: "org.quartz.impl.jdbcjobstore.oracle.OracleDelegate",
  },
  {
    vendor: "db2",
    profile: "db-db2",
    driver: "com.ibm.db2.jcc.DB2Driver",
    jdbc: "com.ibm.db2:jcc",
    flyway: "flyway-database-db2",
    delegate: "org.quartz.impl.jdbcjobstore.DB2v8Delegate",
  },
  {
    vendor: "sqlserver",
    profile: "db-mssql",
    driver: "com.microsoft.sqlserver.jdbc.SQLServerDriver",
    jdbc: "com.microsoft.sqlserver:mssql-jdbc",
    flyway: "flyway-sqlserver",
    delegate: "org.quartz.impl.jdbcjobstore.MSSQLDelegate",
  },
  {
    vendor: "postgresql",
    profile: "db-postgresql",
    driver: "org.postgresql.Driver",
    jdbc: "org.postgresql:postgresql",
    flyway: "flyway-database-postgresql",
    delegate: "org.quartz.impl.jdbcjobstore.PostgreSQLDelegate",
  },
];

const applications = [
  "backend/reference-app",
  "backend/starter-app",
  "templates/starter-v2/backend",
];

// 템플릿의 ${...}는 펼치지 않는다. 설정되지 않은 비밀값의 대체값을 평가하지도 않는다.
function scalarSettings(source) {
  const settings = new Map();
  const parents = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^( *)([^#\s][^:]*):(?:\s+(.*))?$/);
    if (!match) continue;
    const [, spaces, key, raw = ""] = match;
    const indent = spaces.length;
    while (parents.length && parents.at(-1).indent >= indent) parents.pop();
    const path = [...parents.map((parent) => parent.key), key.trim()].join(".");
    const value = raw.trim();
    if (value) settings.set(path, value.replace(/^(["'])(.*)\1$/, "$2"));
    else parents.push({ indent, key: key.trim() });
  }
  return settings;
}

function xmlTag(source, name) {
  return source.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1].trim();
}

function dependencies(source) {
  return [...source.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)].map((match) => ({
    coordinate: `${xmlTag(match[1], "groupId")}:${xmlTag(match[1], "artifactId")}`,
    scope: xmlTag(match[1], "scope") ?? "compile",
  }));
}

function sqlCode(source) {
  // 주석과 문자열 상수를 제외하고 H2 전용 구문의 잔여와 논리 테이블 이름만 비교한다.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ")
    .replace(/'(?:''|[^'])*'/g, "''");
}

function tableNames(source) {
  return [
    ...sqlCode(source).matchAll(
      /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[["]?([A-Za-z_][A-Za-z_0-9]*)[\]"]?/gi,
    ),
  ]
    .map((match) => match[1].toLowerCase())
    .sort();
}

export async function verifyDatabaseConfig(root) {
  const checks = [];
  function check(id, passed, message) {
    checks.push({ id, passed: Boolean(passed), message });
  }
  async function read(relative) {
    try {
      return await readFile(resolve(root, relative), "utf8");
    } catch (error) {
      check(
        `file:${relative}`,
        false,
        `필수 파일을 읽을 수 없습니다 (${error.code ?? "READ_ERROR"}).`,
      );
      return "";
    }
  }
  async function sqlFiles(relative) {
    try {
      return (await readdir(resolve(root, relative)))
        .filter((file) => /^V.+\.sql$/.test(file))
        .sort();
    } catch (error) {
      check(
        `directory:${relative}`,
        false,
        `migration 경로를 읽을 수 없습니다 (${error.code ?? "READ_ERROR"}).`,
      );
      return [];
    }
  }

  const starterPom = (await read("backend/framework-spring-boot-starter/pom.xml")).replace(
    /<!--[\s\S]*?-->/g,
    "",
  );
  check(
    "shared-starter:no-driver",
    !dependencies(starterPom).some((dependency) =>
      vendors.some((vendor) => dependency.coordinate === vendor.jdbc),
    ),
    "공통 Starter가 특정 DB 드라이버를 강제로 가져오지 않아야 합니다.",
  );

  for (const app of applications) {
    const pom = (await read(`${app}/pom.xml`)).replace(/<!--[\s\S]*?-->/g, "");
    const profiles = [...pom.matchAll(/<profile>([\s\S]*?)<\/profile>/g)].map((match) => ({
      id: xmlTag(match[1], "id"),
      source: match[1],
    }));
    const baseDependencies = dependencies(pom.replace(/<profiles>[\s\S]*?<\/profiles>/g, ""));
    check(
      `${app}:test-isolation`,
      baseDependencies.some(
        (dependency) =>
          dependency.coordinate === "com.h2database:h2" && dependency.scope === "test",
      ) &&
        !baseDependencies.some(
          (dependency) =>
            vendors.some((vendor) => dependency.coordinate === vendor.jdbc) &&
            dependency.scope !== "test",
        ),
      "기본 의존성의 H2는 격리 테스트용이어야 하며 실행 드라이버는 profile이 선택해야 합니다.",
    );

    const resources = `${app}/src/main/resources`;
    const base = scalarSettings(await read(`${resources}/application.yml`));
    check(
      `${app}:vendor-import`,
      base.get("spring.config.import") === "classpath:database/${SC_DB_VENDOR:h2}.yml",
      "vendor 선택이 필수 classpath import에 연결돼야 하며 오타를 optional로 무시하면 안 됩니다.",
    );
    check(
      `${app}:schema-ownership`,
      ["none", "validate"].includes(base.get("spring.jpa.hibernate.ddl-auto")),
      "업무 DDL을 Hibernate create/update에 맡기지 않아야 합니다.",
    );

    const configs = (await readdir(resolve(root, resources))).filter((file) =>
      /^application(?:-[a-z-]+)?\.yml$/.test(file),
    );
    const migrationSuffixes = new Set();
    for (const name of configs) {
      const settings = scalarSettings(await read(`${resources}/${name}`));
      const locations = settings.get("spring.flyway.locations");
      if (!locations) continue;
      const tokens = locations.split(",").map((value) => value.trim());
      for (const token of tokens) {
        const match = token.match(
          /^\$\{sc\.app\.database\.(migration|audit-migration|operations-migration):classpath:db\/\1\}$/,
        );
        check(
          `${app}:${name}:location:${token}`,
          match,
          "활성 Flyway 위치가 DB 선택 속성과 기존 H2 fallback을 함께 사용해야 합니다.",
        );
        if (match) migrationSuffixes.add(match[1]);
      }
    }
    check(
      `${app}:migrations-present`,
      migrationSuffixes.has("operations-migration") && migrationSuffixes.size >= 2,
      "기본 또는 audit와 선택 operations의 migration 연결이 있어야 합니다.",
    );

    const h2Files = new Map();
    for (const suffix of migrationSuffixes) {
      h2Files.set(suffix, await sqlFiles(`${resources}/db/${suffix}`));
      check(
        `${app}:h2:${suffix}:nonempty`,
        h2Files.get(suffix).length > 0,
        "사용하는 H2 migration 경로가 비어 있으면 안 됩니다.",
      );
    }

    for (const vendor of vendors) {
      const prefix = `${app}:${vendor.vendor}`;
      const selected = profiles.filter((profile) => profile.id === vendor.profile);
      check(
        `${prefix}:maven-profile`,
        selected.length === 1,
        "각 DB profile이 중복 없이 하나 있어야 합니다.",
      );
      const profile = selected[0]?.source ?? "";
      const deps = dependencies(profile);
      check(
        `${prefix}:driver-dependency`,
        deps.some(
          (dependency) => dependency.coordinate === vendor.jdbc && dependency.scope === "runtime",
        ),
        "선택 DB의 JDBC 드라이버를 runtime으로 제공해야 합니다.",
      );
      check(
        `${prefix}:single-driver`,
        deps.filter((dependency) => vendors.some((item) => item.jdbc === dependency.coordinate))
          .length === 1,
        "하나의 DB profile은 하나의 실행 드라이버만 선택해야 합니다.",
      );
      check(
        `${prefix}:default-profile`,
        /<activeByDefault>\s*true\s*<\/activeByDefault>/.test(profile) === (vendor.vendor === "h2"),
        "H2만 기본 profile이어야 합니다.",
      );
      if (vendor.flyway)
        check(
          `${prefix}:flyway-module`,
          deps.some(
            (dependency) =>
              dependency.coordinate === `org.flywaydb:${vendor.flyway}` &&
              dependency.scope === "runtime",
          ),
          "선택 DB의 Flyway 확장 모듈을 runtime으로 제공해야 합니다.",
        );

      const settings = scalarSettings(await read(`${resources}/database/${vendor.vendor}.yml`));
      check(
        `${prefix}:driver-config`,
        settings.get("spring.datasource.driver-class-name") === vendor.driver,
        "Spring driver-class-name과 Maven 드라이버가 일치해야 합니다.",
      );
      if (vendor.vendor === "h2") continue;
      for (const [key, variable] of [
        ["url", "SC_DB_URL"],
        ["username", "SC_DB_USERNAME"],
        ["password", "SC_DB_PASSWORD"],
      ]) {
        check(
          `${prefix}:required-${key}`,
          settings.get(`spring.datasource.${key}`) === `\${${variable}}`,
          "외부 DB 접속값은 환경에서 필수로 받아야 하며 H2/빈 값으로 대체하면 안 됩니다.",
        );
      }
      check(
        `${prefix}:quartz-delegate`,
        settings.get("spring.quartz.properties.org.quartz.jobStore.driverDelegateClass") ===
          vendor.delegate,
        "Quartz가 선택 DB 전용 JDBC delegate를 사용해야 합니다.",
      );

      const versions = new Set();
      for (const suffix of migrationSuffixes) {
        const directory = `${resources}/db/${vendor.vendor}/${suffix}`;
        check(
          `${prefix}:${suffix}:path`,
          settings.get(`sc.app.database.${suffix}`) === `classpath:db/${vendor.vendor}/${suffix}`,
          "선택한 DB의 앱 소유 migration 경로를 사용해야 합니다.",
        );
        const files = await sqlFiles(directory);
        check(
          `${prefix}:${suffix}:files`,
          JSON.stringify(files) === JSON.stringify(h2Files.get(suffix)),
          "DB별 migration 파일 목록은 기존 기능의 migration 목록과 대응해야 합니다.",
        );
        for (const file of files) {
          const version = file.match(/^V(.+?)__/)[1];
          check(
            `${prefix}:${suffix}:${file}:version`,
            !versions.has(version),
            "동시에 활성화되는 Flyway 위치 사이에서 버전이 중복되면 안 됩니다.",
          );
          versions.add(version);
          const sql = await read(`${directory}/${file}`);
          const h2Sql = await read(`${resources}/db/${suffix}/${file}`);
          check(
            `${prefix}:${suffix}:${file}:tables`,
            JSON.stringify(tableNames(sql)) === JSON.stringify(tableNames(h2Sql)),
            "DB별 migration에서 공통/업무 테이블을 누락하거나 다른 이름으로 만들면 안 됩니다.",
          );
          const code = sqlCode(sql);
          check(
            `${prefix}:${suffix}:${file}:h2-statements`,
            !/\b(?:SET\s+(?:DB_CLOSE_DELAY|MODE|REFERENTIAL_INTEGRITY)|MERGE\s+INTO[\s\S]*?\bKEY\s*\()/i.test(
              code,
            ),
            "외부 DB DDL에 H2 실행 전용 구문이 남으면 안 됩니다.",
          );
          const forbidden = {
            oracle: /\b(?:BOOLEAN|UUID|BIGINT)\b|\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i,
            sqlserver:
              /\b(?:BOOLEAN|UUID|CLOB|BLOB)\b|\bTIMESTAMP\s+WITH\s+TIME\s+ZONE\b|\bGENERATED\s+BY\s+DEFAULT\s+AS\s+IDENTITY\b/i,
            db2: /\bUUID\b|\bTIMESTAMP\s+WITH\s+TIME\s+ZONE\b/i,
            postgresql: /\b(?:CLOB|BLOB)\b/i,
          }[vendor.vendor];
          check(
            `${prefix}:${suffix}:${file}:types`,
            !forbidden.test(code),
            "DB별로 변환해야 하는 대표 H2 자료형/identity 구문이 남으면 안 됩니다. SQL 전체 검증은 실DB에서 수행합니다.",
          );
        }
      }
    }
  }

  return {
    kind: "database-config-static",
    databaseExecuted: false,
    applications: applications.length,
    vendors: vendors.map((vendor) => vendor.vendor),
    passed: checks.filter((check) => check.passed).length,
    failed: checks.filter((check) => !check.passed).length,
    checks,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let root = fileURLToPath(new URL("../", import.meta.url));
  let json = false;
  for (let index = 2; index < process.argv.length; index++) {
    const argument = process.argv[index];
    if (argument === "--json") json = true;
    else if (argument === "--root" && process.argv[index + 1])
      root = resolve(process.argv[++index]);
    else
      throw new Error(
        "사용법: node scripts/verify-database-config.mjs [--root <프로젝트>] [--json]",
      );
  }
  const result = await verifyDatabaseConfig(root);
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const check of result.checks.filter((check) => !check.passed))
      console.error(`${check.id}: ${check.message}`);
    console.log(
      `DB 설정 정적 검사: ${result.passed} 통과 / ${result.failed} 실패 (실제 DB 실행 없음)`,
    );
  }
  if (result.failed) process.exitCode = 1;
}
