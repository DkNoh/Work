import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const files = ["spring.rabbitmq.password", "observer.secret"];
async function ownedPath(value, directory = false) {
  if (!path.isAbsolute(value) || /[\0\r\n]/.test(value)) throw new Error("INVALID_PRIVATE_PATH");
  let current = path.parse(value).root;
  for (const part of value.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new Error("SYMLINK_PRIVATE_PATH");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (directory) {
    const entry = await fs.lstat(value);
    if (
      !entry.isDirectory() ||
      (entry.mode & 0o777) !== 0o700 ||
      (typeof process.getuid === "function" && entry.uid !== process.getuid())
    )
      throw new Error("PRIVATE_DIRECTORY_REQUIRED");
  }
}
async function readSecret(file) {
  await ownedPath(file);
  const entry = await fs.lstat(file);
  if (
    !entry.isFile() ||
    entry.size < 16 ||
    entry.size > 256 ||
    (entry.mode & 0o777) !== 0o600 ||
    (typeof process.getuid === "function" && entry.uid !== process.getuid())
  )
    throw new Error("PRIVATE_SECRET_REQUIRED");
  const bytes = await fs.readFile(file);
  if (bytes.includes(0) || bytes.includes(10) || bytes.includes(13))
    throw new Error("PRIVATE_SECRET_FORMAT");
  return bytes;
}
export async function prepareOperations({ home, source, check = false, directory }) {
  await ownedPath(home);
  const target = directory ?? path.join(home, "secrets/operations");
  if (check) {
    await ownedPath(target, true);
    for (const name of files) await readSecret(path.join(target, name));
    return;
  }
  if (directory || source === target) throw new Error("INVALID_PREPARATION_TARGET");
  const content = [];
  if (source) {
    await ownedPath(source, true);
    for (const name of files) content.push(await readSecret(path.join(source, name)));
  } else {
    for (const name of files) {
      void name;
      content.push(Buffer.from(crypto.randomBytes(32).toString("base64url")));
    }
  }
  await fs.mkdir(home, { recursive: true, mode: 0o700 });
  const owner = await fs.lstat(home);
  if (
    !owner.isDirectory() ||
    (typeof process.getuid === "function" && owner.uid !== process.getuid())
  )
    throw new Error("OWNED_HOME_REQUIRED");
  await fs.chmod(home, 0o700);
  await fs.mkdir(path.join(home, "secrets"), { mode: 0o700 }).catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });
  await ownedPath(path.join(home, "secrets"), true);
  // 새 private 디렉터리만 생성한다. 기존 값을 부분적으로 덮어쓰지 않는다.
  await fs.mkdir(target, { mode: 0o700 });
  const created = [];
  try {
    for (let index = 0; index < files.length; index++) {
      const file = path.join(target, files[index]);
      await fs.writeFile(file, content[index], { flag: "wx", mode: 0o600 });
      created.push(file);
    }
  } catch (error) {
    for (const file of created) await fs.unlink(file);
    await fs.rmdir(target);
    throw error;
  }
}
async function main(args) {
  const values = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--check" && !values.check) {
      values.check = true;
      continue;
    }
    if (!["--home", "--source", "--directory"].includes(key) || values[key] || !args[index + 1])
      throw new Error("INVALID_PREPARATION_OPTIONS");
    values[key] = args[++index];
  }
  if (!values["--home"]) throw new Error("HOME_REQUIRED");
  await prepareOperations({
    home: values["--home"],
    source: values["--source"],
    directory: values["--directory"],
    check: values.check === true,
  });
  console.log("Private operations configuration is ready (values omitted).");
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main(process.argv.slice(2)).catch(() => {
    console.error(
      "Operations configuration failed: use owned canonical private paths and new destination files.",
    );
    process.exitCode = 1;
  });
