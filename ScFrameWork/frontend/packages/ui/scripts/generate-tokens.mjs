import { readFile, writeFile } from "node:fs/promises";
import { uiTokens } from "../src/tokens.ts";

const output = new URL("../src/tokens.scss", import.meta.url);
const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const variables = [];
function addGroup(group, entries, unit = "") {
  for (const [name, value] of Object.entries(entries)) {
    variables.push(`  --sc-${group}-${kebab(name)}: ${value}${unit};`);
  }
}
addGroup("color", uiTokens.color);
addGroup("space", uiTokens.space, "px");
addGroup("radius", uiTokens.radius, "px");
addGroup("shadow", uiTokens.shadow);
addGroup("font-size", uiTokens.fontSize, "px");
addGroup("font-weight", uiTokens.fontWeight);
addGroup("line-height", uiTokens.lineHeight);
addGroup("breakpoint", uiTokens.breakpoint, "px");
addGroup("control", uiTokens.control, "px");
for (const [name, value] of Object.entries(uiTokens.layout)) {
  variables.push(`  --sc-${kebab(name)}: ${value}px;`);
}
variables.push(
  `  --sc-radius: var(--sc-radius-lg);`,
  `  --sc-font-family: ${uiTokens.fontFamily};`,
  `  --sc-motion-duration: ${uiTokens.motion.duration}ms;`,
  `  --sc-motion-easing: ${uiTokens.motion.easing};`,
);
const breakpoints = Object.entries(uiTokens.breakpoint).map(
  ([name, value]) => `$sc-breakpoint-${name}: ${value}px;`,
);
const generated = [
  "// Generated from tokens.ts. Edit tokens.ts, then run npm run tokens:generate --workspace @sc/ui.",
  ...breakpoints,
  "$sc-emit-css: true !default;",
  "",
  "@if $sc-emit-css {",
  "  :root {",
  ...variables.map((line) => `  ${line}`),
  "  }",
  "}",
  "",
].join("\n");
if (process.argv.includes("--check")) {
  if ((await readFile(output, "utf8")) !== generated) {
    throw new Error("Design token CSS is stale. Run npm run tokens:generate --workspace @sc/ui.");
  }
  process.stdout.write("Design token CSS matches tokens.ts.\n");
} else {
  await writeFile(output, generated);
  process.stdout.write("Generated UI token CSS from tokens.ts.\n");
}
