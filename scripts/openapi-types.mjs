import { mkdir, readFile, writeFile } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";

const root = new URL("../", import.meta.url);
const artifacts = [
  {
    name: "neutral compatibility",
    schema: "docs/openapi-neutral.json",
    output: "frontend/packages/runtime/src/generated/api.d.ts",
  },
  {
    name: "reference",
    schema: "docs/openapi.json",
    output: "frontend/apps/reference-app/src/generated/api.d.ts",
  },
  {
    name: "starter",
    schema: "docs/openapi-starter.json",
    output: "frontend/apps/starter-app/src/generated/api.d.ts",
  },
];

// 업무 계약은 소비 앱 안에 생성한다. 기존 runtime의 중립 타입 export는 호환용으로 유지한다.
for (const artifact of artifacts) {
  const schemaUrl = new URL(artifact.schema, root);
  const outputUrl = new URL(artifact.output, root);
  const source = JSON.parse(await readFile(schemaUrl, "utf8"));
  const types = astToString(await openapiTS(source));
  if (process.argv.includes("--check")) {
    const existing = await readFile(outputUrl, "utf8");
    // Git의 Windows CRLF checkout은 API 변경이 아니다. 줄 끝만 맞추고 타입 본문은 그대로 비교한다.
    if (existing.replaceAll("\r\n", "\n") !== types.replaceAll("\r\n", "\n"))
      throw new Error(
        `${artifact.name}: OpenAPI 타입이 명세와 다릅니다. npm run api:generate로 다시 생성하세요.`,
      );
    console.log(`${artifact.name}: OpenAPI 명세와 생성 타입 일치`);
  } else {
    await mkdir(new URL(".", outputUrl), { recursive: true });
    await writeFile(outputUrl, types);
    console.log(`${artifact.name}: OpenAPI 타입 생성 완료`);
  }
}
