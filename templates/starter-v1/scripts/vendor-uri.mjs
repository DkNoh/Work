import path from "node:path";
import { pathToFileURL } from "node:url";
const args = process.argv.slice(2);
if (args[0] === "--settings-mode") {
  const custom = args
    .slice(1)
    .some(
      (arg) =>
        arg === "-s" || arg === "--settings" || arg.startsWith("--settings=") || /^-s.+/.test(arg),
    );
  console.log(custom ? "custom" : "default");
} else {
  const backendRoot = args[0];
  if (!backendRoot || /[\0\r\n]/.test(backendRoot))
    throw new Error("Use the generated backend directory.");
  // 모델 읽기 전에 settings에 제공한다. 소스에 저장소 절대 경로를 고정하지 않는다.
  console.log(pathToFileURL(path.resolve(backendRoot, "../vendor/maven")).href);
}
