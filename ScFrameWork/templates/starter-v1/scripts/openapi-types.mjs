import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import openapiTS, { astToString } from "openapi-typescript";
const root = new URL("../", import.meta.url);
export async function generateApiTypes({ url, check = false } = {}) {
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
      schema = JSON.parse(await readFile(schemaFile, "utf8"));
    } catch {
      throw new Error("Run bash scripts/build.sh to capture this app's actual API first.");
    }
  }
  const types = astToString(await openapiTS(schema));
  if (check) {
    const existing = await readFile(outputFile, "utf8");
    if (existing !== types)
      throw new Error("API types differ from docs/openapi.json. Run npm run api:generate.");
    console.log("OpenAPI and generated application types match.");
  } else {
    await mkdir(new URL("docs/", root), { recursive: true });
    await mkdir(new URL("frontend/src/generated/", root), { recursive: true });
    if (url) await writeFile(schemaFile, `${JSON.stringify(schema, null, 2)}\n`);
    await writeFile(outputFile, types);
    console.log("Application API types generated from the actual schema.");
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--check", "--url"].includes(arg) && !arg.startsWith("http://")))
    throw new Error("Use --check or --url <loopback dev API URL>.");
  const index = args.indexOf("--url");
  await generateApiTypes({
    check: args.includes("--check"),
    url: index >= 0 ? args[index + 1] : undefined,
  });
}
