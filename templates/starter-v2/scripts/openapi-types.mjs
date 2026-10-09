import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import openapiTS, { astToString } from "openapi-typescript";
const root = new URL("../", import.meta.url);
// DB에 접속하지 않는 명세 파일 입력과 명시적인 개발 서버 URL을 모두 지원한다.
// 고객 DB의 migration을 타입 생성 때문에 실행하지 않도록 schemaPath는 앱 외부 파일도 받는다.
export async function generateApiTypes({ url, schemaPath, check = false } = {}) {
  if (url && schemaPath) throw new Error("Choose either an OpenAPI file or a loopback URL.");
  const schemaFile = new URL("docs/openapi.json", root);
  const outputFile = new URL("frontend/src/generated/api.d.ts", root);
  let schema;
  if (url) {
    const endpoint = new URL(url);
    if (
      endpoint.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(endpoint.hostname) ||
      endpoint.username ||
      endpoint.password
    )
      throw new Error("Use an explicit loopback OpenAPI URL.");
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("The dev OpenAPI endpoint is unavailable.");
    schema = await response.json();
    if (!schema.openapi || !schema.paths?.["/api/notes"])
      throw new Error("This server does not expose the generated app API.");
  } else {
    try {
      schema = JSON.parse(
        await readFile(schemaPath ? path.resolve(schemaPath) : schemaFile, "utf8"),
      );
    } catch {
      throw new Error(
        "Provide --schema <OpenAPI JSON file>, --url <loopback URL>, or capture the local H2 API first.",
      );
    }
  }
  if (!schema.openapi || !schema.paths?.["/api/notes"])
    throw new Error("This schema does not expose the generated app API.");
  const types = astToString(await openapiTS(schema));
  if (check) {
    const existing = await readFile(outputFile, "utf8");
    if (existing !== types)
      throw new Error("API types differ from docs/openapi.json. Run npm run api:generate.");
    console.log("OpenAPI and generated application types match.");
  } else {
    await mkdir(new URL("docs/", root), { recursive: true });
    await mkdir(new URL("frontend/src/generated/", root), { recursive: true });
    if (url || schemaPath) await writeFile(schemaFile, `${JSON.stringify(schema, null, 2)}\n`);
    await writeFile(outputFile, types);
    console.log("Application API types generated from the actual schema.");
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--check") options.check = true;
    else if (
      ["--url", "--schema"].includes(arg) &&
      args[index + 1] &&
      !args[index + 1].startsWith("--")
    )
      options[arg === "--url" ? "url" : "schemaPath"] = args[++index];
    else
      throw new Error(
        "Use --check, --schema <OpenAPI JSON file>, or --url <loopback dev API URL>.",
      );
  }
  await generateApiTypes(options);
}
