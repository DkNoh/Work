// npm을 실행한 터미널과 무관하게 운영체제에 맞는 개발 실행기를 고른다.
// Windows에서는 Bash/Python 없이 PowerShell이 Java와 Vite의 수명을 관리한다.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const windows = process.platform === "win32";
const flags = process.argv.slice(2);
if (flags.some((flag) => !windows || !["--stop", "--rebuild"].includes(flag))) {
  console.error("Windows options: npm run dev -- --stop / --rebuild");
  process.exit(1);
}
const script = fileURLToPath(new URL(windows ? "./dev.ps1" : "./dev.sh", import.meta.url));
const env = { ...process.env };
// PowerShell 7의 모듈 경로를 Windows PowerShell 5.1에 넘기면 Set-Acl 로딩이 실패한다.
if (windows) {
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === "PSMODULEPATH") delete env[key];
  }
}
const child = spawn(
  windows ? "powershell.exe" : "bash",
  windows
    ? [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        ...flags.map((flag) => flag.slice(1)),
      ]
    : [script],
  { stdio: "inherit", windowsHide: true, env },
);
// Windows 자식에게 Unix 신호를 보내면 finally 없이 종료될 수 있다.
// Ctrl+C도 같은 실행 자료의 stop 요청으로 전달하고 소유 프로세스 정리를 기다린다.
let stopping = false;
function stop(signal) {
  if (!windows) return child.kill(signal);
  if (stopping) return;
  stopping = true;
  const request = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Stop"],
    { stdio: "inherit", windowsHide: true, env },
  );
  request.on("error", (error) => console.error(error.message));
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
