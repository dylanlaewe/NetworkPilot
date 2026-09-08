import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const sourceRoot = resolve("src");
const extensions = new Set([".css", ".js", ".jsx", ".ts", ".tsx"]);
const forbidden = ["next/font/google", "fonts.googleapis.com", "fonts.gstatic.com"];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return extensions.has(extname(entry.name)) ? [path] : [];
  });
}

const violations = sourceFiles(sourceRoot).flatMap((path) => {
  const content = readFileSync(path, "utf8");
  return forbidden.filter((value) => content.includes(value)).map((value) => `${relative(process.cwd(), path)}: ${value}`);
});

if (violations.length) {
  console.error(`Remote font references are prohibited:\n${violations.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Remote font check passed: application source uses local system stacks only.");
}
