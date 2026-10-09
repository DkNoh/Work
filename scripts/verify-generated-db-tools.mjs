/**
 * v2 생성 앱의 DB 비접속 API 생성 경로와 테스트용 secret 권한 작성기를 실제 실행한다.
 * 템플릿을 .runtime의 새 임시 디렉터리에 복사해 검사하고 원본/사용자 실행 자료는 읽지 않는다.
 * 이 검사는 생성 앱 전체의 npm 설치·Maven·JAR·브라우저 검증을 대신하지 않는다.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = path.resolve(root, ".runtime");
await fs.mkdir(runtime, { recursive: true });
const fixture = await fs.mkdtemp(path.join(runtime, "generated-db-tools-"));
const checks = [];

function execute(command, args, { env = process.env, expected = 0 } = {}) {
  const result = spawnSync(command, args, {
    cwd: fixture,
    env,
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (expected === 0) {
    assert.equal(result.status, 0, `${path.basename(command)} failed: ${result.stderr}`);
  } else {
    assert.notEqual(result.status, 0, "An invalid input unexpectedly succeeded.");
  }
  return result;
}

function javaTool(name) {
  const suffix = process.platform === "win32" ? ".exe" : "";
  if (process.env.JAVA21_HOME) return path.join(process.env.JAVA21_HOME, "bin", `${name}${suffix}`);
  if (process.env.JAVA_BIN)
    return name === "java"
      ? process.env.JAVA_BIN
      : path.join(path.dirname(process.env.JAVA_BIN), `${name}${suffix}`);
  if (process.env.JAVA_HOME) return path.join(process.env.JAVA_HOME, "bin", `${name}${suffix}`);
  return name;
}

try {
  const app = path.join(fixture, "consumer");
  const scripts = path.join(app, "scripts");
  await fs.mkdir(scripts, { recursive: true });
  for (const name of ["openapi-types.mjs", "bootstrap-api.mjs"])
    await fs.copyFile(
      path.join(root, "templates/starter-v2/scripts", name),
      path.join(scripts, name),
    );
  const schemaFile = path.join(fixture, "captured-openapi.json");
  const schema = {
    openapi: "3.0.3",
    info: { title: "Synthetic generated app contract", version: "1.0.0" },
    paths: {
      "/api/notes": {
        get: {
          responses: {
            200: {
              description: "Synthetic response",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/GeneratedNote" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        GeneratedNote: {
          type: "object",
          required: ["id", "title"],
          properties: { id: { type: "integer" }, title: { type: "string" } },
        },
      },
    },
  };
  await fs.writeFile(schemaFile, JSON.stringify(schema));
  const baseEnv = {
    ...process.env,
    SC_DB_VENDOR: "postgresql",
    SC_DB_URL: "jdbc:unused:must-not-connect",
    SC_DB_USERNAME: "unused",
    SC_DB_PASSWORD: "",
    SC_API_SCHEMA: schemaFile,
    SC_API_URL: "",
    JAVA_BIN: path.join(fixture, "java-must-not-be-launched"),
  };
  const bootstrap = path.join(scripts, "bootstrap-api.mjs");
  const openapi = path.join(scripts, "openapi-types.mjs");
  const typeFile = path.join(app, "frontend/src/generated/api.d.ts");
  execute(process.execPath, [bootstrap], { env: baseEnv });
  const generated = await fs.readFile(typeFile, "utf8");
  assert.match(generated, /GeneratedNote/);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(app, "docs/openapi.json"))), schema);
  await assert.rejects(fs.access(path.join(app, "backend")));
  await assert.rejects(fs.access(path.join(app, ".runtime")));
  checks.push("SC_API_SCHEMA generates types and snapshot with no backend, JAR, Java, or DB");

  execute(process.execPath, [openapi, "--schema", schemaFile, "--check"], { env: baseEnv });
  execute(process.execPath, [openapi, "--check"], { env: baseEnv });
  checks.push("explicit schema and saved snapshot both pass --check");

  await fs.writeFile(typeFile, `${generated}\n// synthetic drift\n`);
  const drift = execute(process.execPath, [openapi, "--check"], {
    env: baseEnv,
    expected: 1,
  });
  assert.match(drift.stderr, /API types differ/);
  execute(process.execPath, [openapi, "--schema", schemaFile], { env: baseEnv });
  assert.equal(await fs.readFile(typeFile, "utf8"), generated);
  checks.push("--check rejects drift and --schema regeneration restores types");

  const duplicateEnv = execute(process.execPath, [bootstrap], {
    env: { ...baseEnv, SC_API_URL: "http://127.0.0.1:9/v3/api-docs" },
    expected: 1,
  });
  assert.match(duplicateEnv.stderr, /Choose either an OpenAPI file or a loopback URL/);
  const duplicateArgs = execute(
    process.execPath,
    [openapi, "--schema", schemaFile, "--url", "http://127.0.0.1:9/v3/api-docs"],
    { env: baseEnv, expected: 1 },
  );
  assert.match(duplicateArgs.stderr, /Choose either an OpenAPI file or a loopback URL/);
  checks.push("environment and CLI both reject simultaneous schema and URL before network access");

  const missingSchema = execute(process.execPath, [bootstrap], {
    env: { ...baseEnv, SC_API_SCHEMA: "" },
    expected: 1,
  });
  assert.match(
    missingSchema.stderr,
    /External database builds require SC_API_SCHEMA or SC_API_URL/,
  );
  checks.push("external DB bootstrap without schema or URL fails before Java/JAR access");

  const invalidSchema = path.join(fixture, "invalid-openapi.json");
  await fs.writeFile(invalidSchema, JSON.stringify({ openapi: "3.0.3", paths: {} }));
  const invalid = execute(process.execPath, [openapi, "--schema", invalidSchema], {
    env: baseEnv,
    expected: 1,
  });
  assert.match(invalid.stderr, /This schema does not expose the generated app API/);
  assert.equal(await fs.readFile(typeFile, "utf8"), generated);
  const remote = execute(process.execPath, [openapi, "--url", "https://example.invalid"], {
    env: baseEnv,
    expected: 1,
  });
  assert.match(remote.stderr, /Use an explicit loopback OpenAPI URL/);
  checks.push("invalid API schemas and non-loopback URLs are rejected without changing types");

  const javaSource = path.join(fixture, "java-source/sc/fixture");
  const javaClasses = path.join(fixture, "java-classes");
  await fs.mkdir(javaSource, { recursive: true });
  await fs.mkdir(javaClasses, { recursive: true });
  const helper = await fs.readFile(
    path.join(
      root,
      "templates/starter-v2/backend/src/test/java/__JAVA_PATH__/SyntheticSecretFiles.java",
    ),
    "utf8",
  );
  await fs.writeFile(
    path.join(javaSource, "SyntheticSecretFiles.java"),
    helper.replaceAll("__JAVA_PACKAGE__", "sc.fixture"),
  );
  await fs.writeFile(
    path.join(javaSource, "GeneratedSecretContractProbe.java"),
    `package sc.fixture;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.util.*;
public final class GeneratedSecretContractProbe {
    public static void main(String[] args) throws Exception {
        if (Runtime.version().feature() != 21) throw new AssertionError("JDK_21_REQUIRED");
        Path parent = Files.createDirectory(Path.of(args[0]));
        Path file = parent.resolve("synthetic.secret");
        String synthetic = "fixture-" + UUID.randomUUID();
        SyntheticSecretFiles.write(file, synthetic);
        if (!Files.readString(file).equals(synthetic)) throw new AssertionError("SECRET_WRITE_MISMATCH");
        String permission;
        if (Files.getFileAttributeView(file, PosixFileAttributeView.class) != null) {
            if (!Files.getPosixFilePermissions(file).equals(PosixFilePermissions.fromString("rw-------")))
                throw new AssertionError("SECRET_POSIX_PERMISSIONS");
            permission = "POSIX_600";
        } else {
            for (Path target : List.of(parent, file)) {
                var view = Files.getFileAttributeView(target, AclFileAttributeView.class);
                if (view == null) throw new AssertionError("SECRET_ACL_UNAVAILABLE");
                var entries = view.getAcl();
                if (entries.size() != 1 || entries.getFirst().type() != AclEntryType.ALLOW
                    || !entries.getFirst().principal().equals(Files.getOwner(target))
                    || !entries.getFirst().permissions().containsAll(EnumSet.allOf(AclEntryPermission.class)))
                    throw new AssertionError("SECRET_OWNER_ACL_MISMATCH");
            }
            permission = "WINDOWS_OWNER_ACL";
        }
        try {
            SyntheticSecretFiles.write(file, "must-not-overwrite");
            throw new AssertionError("SECRET_OVERWRITE_ALLOWED");
        } catch (FileAlreadyExistsException expected) { }
        if (!Files.readString(file).equals(synthetic)) throw new AssertionError("SECRET_CHANGED");
        System.out.println(permission + ":CREATE_READ_OVERWRITE_GUARD_PASS");
    }
}
`,
  );
  execute(javaTool("javac"), [
    "--release",
    "21",
    "-encoding",
    "UTF-8",
    "-d",
    javaClasses,
    path.join(javaSource, "SyntheticSecretFiles.java"),
    path.join(javaSource, "GeneratedSecretContractProbe.java"),
  ]);
  const secretResult = execute(javaTool("java"), [
    "-cp",
    javaClasses,
    "sc.fixture.GeneratedSecretContractProbe",
    path.join(fixture, "private-secret-fixture"),
  ]);
  assert.match(
    secretResult.stdout,
    /^(WINDOWS_OWNER_ACL|POSIX_600):CREATE_READ_OVERWRITE_GUARD_PASS\s*$/,
  );
  checks.push(`JDK 21 synthetic secret: ${secretResult.stdout.trim()}`);
} finally {
  // 재귀 삭제 전 새 fixture가 지정 runtime 바로 아래에 있는지 확인한다. 사용자 경로는 삭제하지 않는다.
  const resolvedFixture = await fs.realpath(fixture);
  const resolvedRuntime = await fs.realpath(runtime);
  assert.equal(path.dirname(resolvedFixture), resolvedRuntime);
  assert.ok(path.basename(resolvedFixture).startsWith("generated-db-tools-"));
  await fs.rm(resolvedFixture, { recursive: true, force: true });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      platform: process.platform,
      checks,
      checkGroups: checks.length,
      actualExternalDatabaseExecuted: false,
      fullGeneratedApplicationExecuted: false,
      fixtureRemoved: true,
      secretValuesPrinted: false,
    },
    null,
    2,
  ),
);
