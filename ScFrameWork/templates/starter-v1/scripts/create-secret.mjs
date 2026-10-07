import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination))
  throw new Error("Use an absolute secret file path.");
let current = path.parse(destination).root;
for (const part of destination.slice(current.length).split(path.sep).filter(Boolean)) {
  current = path.join(current, part);
  try {
    const entry = await fs.lstat(current);
    if (entry.isSymbolicLink()) throw new Error("Secret paths must not contain symlinks.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
try {
  await fs.writeFile(destination, crypto.randomBytes(32).toString("base64url"), {
    flag: "wx",
    mode: 0o600,
  });
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
const info = await fs.lstat(destination);
if (
  !info.isFile() ||
  info.isSymbolicLink() ||
  (info.mode & 0o777) !== 0o600 ||
  (typeof process.getuid === "function" && info.uid !== process.getuid())
)
  throw new Error("Use an owned regular secret file with mode 600.");
// 비밀번호는 파일로만 사용하며 stdout/stderr에 쓰지 않는다.
console.log("Bootstrap secret file is ready (value omitted).");
