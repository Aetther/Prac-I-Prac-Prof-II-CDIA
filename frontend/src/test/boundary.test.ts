import { describe, expect, it } from "vitest";
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

function normalize(file: string): string {
  return file.replace(/\\/g, "/");
}

describe("fetch boundary", () => {
  it("only src/api calls fetch", () => {
    const srcDir = join(process.cwd(), "src");
    const allFiles = walk(srcDir).map(normalize);
    expect(allFiles.length).toBeGreaterThan(0);
    expect(allFiles).toContain(
      normalize(join(process.cwd(), "src", "components", "ReportForm.tsx")),
    );

    for (const file of allFiles) {
      if (file.includes(".test.") || file.includes(".spec.")) {
        continue;
      }
      if (file.includes("/src/api/")) {
        continue;
      }
      const content = readFileSync(file, "utf-8");
      if (/\bfetch\s*\(/.test(content)) {
        throw new Error(`fetch found outside src/api in ${file}`);
      }
    }
  });

  it("no changed component injects HTML", () => {
    const srcDir = join(process.cwd(), "src");
    const components = walk(join(srcDir, "components")).map(normalize);
    expect(components.length).toBeGreaterThan(0);
    expect(components).toContain(
      normalize(join(srcDir, "components", "ReportForm.tsx")),
    );

    for (const file of components) {
      if (file.includes(".test.") || file.includes(".spec.")) {
        continue;
      }
      const content = readFileSync(file, "utf-8");
      if (content.includes("dangerouslySetInnerHTML")) {
        throw new Error(`dangerouslySetInnerHTML found in ${file}`);
      }
    }
  });

  it("the new modules import only react and project modules", () => {
    const srcDir = join(process.cwd(), "src");
    const modules = [
      join(srcDir, "api", "reportReasons.ts"),
      join(srcDir, "api", "reports.ts"),
      join(srcDir, "game", "reporting.ts"),
      join(srcDir, "components", "ReportForm.tsx"),
    ];
    expect(modules).toContain(join(srcDir, "components", "ReportForm.tsx"));

    for (const file of modules) {
      const content = readFileSync(file, "utf-8");
      const specifiers = [
        ...content.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g),
      ].map((match) => match[1]);
      expect(specifiers.length).toBeGreaterThan(0);
      for (const specifier of specifiers) {
        if (specifier === "react" || specifier.startsWith(".")) {
          continue;
        }
        throw new Error(`unexpected dependency ${specifier} in ${file}`);
      }
    }
  });
});
