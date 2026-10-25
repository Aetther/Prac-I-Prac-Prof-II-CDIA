import { describe, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

function walk(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, files);
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("fetch boundary", () => {
  it("only src/api calls fetch", () => {
    const srcDir = join(process.cwd(), "src");
    const allFiles = walk(srcDir);
    for (const file of allFiles) {
      const normalized = file.replace(/\\/g, "/");
      if (normalized.includes(".test.") || normalized.includes(".spec.")) {
        continue;
      }
      if (normalized.includes("/src/api/")) {
        continue;
      }
      const content = readFileSync(file, "utf-8");
      if (/\bfetch\s*\(/.test(content)) {
        throw new Error(`fetch found outside src/api in ${file}`);
      }
    }
  });
});
