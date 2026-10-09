import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generateApiTypes } from "./openapi-types.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
// 외부 DB 빌드는 이미 수집한 명세 또는 별도 개발 서버를 사용한다. 타입 생성은 DB 변경 권한을 갖지 않는다.
if (process.env.SC_API_SCHEMA || process.env.SC_API_URL) {
  await generateApiTypes({ schemaPath: process.env.SC_API_SCHEMA, url: process.env.SC_API_URL });
} else {
  if (process.env.SC_DB_VENDOR && process.env.SC_DB_VENDOR !== "h2")
    throw new Error(
      "External database builds require SC_API_SCHEMA or SC_API_URL for API generation.",
    );
  const jar = path.join(root, "backend/target/__APP_NAME__.jar");
  await fs.access(jar);
  const temp = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), "sc-generated-api-"));
  let child;
  let exited;
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    child?.kill("SIGTERM");
  };
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const secret = path.join(temp, "bootstrap.secret");
    await fs.writeFile(secret, crypto.randomBytes(32).toString("base64url"), {
      flag: "wx",
      mode: 0o600,
    });
    const port = await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const value = server.address().port;
        server.close((error) => (error ? reject(error) : resolve(value)));
      });
    });
    child = spawn(process.env.JAVA_BIN || "java", ["-jar", jar, "--spring.profiles.active=dev"], {
      cwd: root,
      stdio: ["ignore", "ignore", "ignore"],
      env: {
        ...process.env,
        SC_PORT: String(port),
        SC_ADDRESS: "127.0.0.1",
        SC_BOOTSTRAP_SECRET_FILE: secret,
        SC_BOOTSTRAP_USERNAME: "admin",
        SC_DB_URL: `jdbc:h2:file:${path.join(temp, "app")};DB_CLOSE_ON_EXIT=FALSE`,
        SC_DB_USERNAME: "sa",
        SC_DB_VENDOR: "h2",
        SC_DB_PASSWORD: "",
        SC_LOG_FILE: path.join(temp, "app.log"),
      },
    });
    exited = new Promise((resolve) => {
      child.once("exit", resolve);
      child.once("error", resolve);
    });
    const deadline = Date.now() + 90000;
    let ready = false;
    while (Date.now() < deadline && !cancelled && child.exitCode === null) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok && (await response.json()).status === "UP") {
          ready = true;
          break;
        }
      } catch {
        /* 신규 서버가 준비될 때까지만 확인한다. */
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready || cancelled)
      throw new Error(
        "The isolated metadata server could not become ready. No runtime secret/log content was printed.",
      );
    await generateApiTypes({ url: `http://127.0.0.1:${port}/v3/api-docs` });
  } finally {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 10000))]);
      if (child.exitCode === null) {
        child.kill("SIGKILL");
        await exited;
      }
    }
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
    await fs.rm(temp, { recursive: true, force: true });
  }
}
