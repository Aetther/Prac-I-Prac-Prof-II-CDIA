import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { dirname, join, resolve } from "path";

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

export function resolvesToAudio(file: string, specifier: string): boolean {
  if (!specifier.startsWith(".")) return false;
  const audioDir = normalize(join(process.cwd(), "src", "audio"));
  const resolved = normalize(resolve(dirname(file), specifier));
  return resolved === audioDir || resolved.startsWith(`${audioDir}/`);
}

const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*"([^"]+)"/g;

function importSpecifiers(content: string): string[] {
  return [...content.matchAll(IMPORT_SPECIFIER)].map((match) => match[1]);
}

describe("fetch boundary", () => {
  it("only src/api calls fetch", () => {
    const srcDir = join(process.cwd(), "src");
    const allFiles = walk(srcDir).map(normalize);
    expect(allFiles.length).toBeGreaterThan(0);
    for (const name of [
      "ReportForm.tsx",
      "Admin.tsx",
      "AdminKeyGate.tsx",
      "AdminPanel.tsx",
      "AdminQuestionEditor.tsx",
      "AdminReportRow.tsx",
      "questionEditorForm.ts",
    ]) {
      expect(allFiles).toContain(
        normalize(join(process.cwd(), "src", "components", name)),
      );
    }

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
    for (const name of [
      "ReportForm.tsx",
      "AdminPanel.tsx",
      "AdminQuestionEditor.tsx",
      "AdminReportRow.tsx",
      "questionEditorForm.ts",
    ]) {
      expect(components).toContain(normalize(join(srcDir, "components", name)));
    }

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
      join(srcDir, "api", "admin.ts"),
      join(srcDir, "api", "adminFailures.ts"),
      join(srcDir, "game", "reporting.ts"),
      join(srcDir, "components", "ReportForm.tsx"),
      join(srcDir, "components", "AdminKeyGate.tsx"),
      join(srcDir, "components", "AdminPanel.tsx"),
      join(srcDir, "components", "AdminQuestionEditor.tsx"),
      join(srcDir, "components", "AdminReportRow.tsx"),
      join(srcDir, "components", "Admin.tsx"),
      join(srcDir, "components", "questionEditorForm.ts"),
      join(srcDir, "api", "questionEditing.ts"),
    ];
    expect(modules).toContain(join(srcDir, "components", "ReportForm.tsx"));
    expect(modules).toContain(
      join(srcDir, "components", "questionEditorForm.ts"),
    );
    expect(modules).toContain(join(srcDir, "api", "questionEditing.ts"));

    for (const file of modules) {
      const content = readFileSync(file, "utf-8");
      const specifiers = importSpecifiers(content);
      expect(specifiers.length).toBeGreaterThan(0);
      for (const specifier of specifiers) {
        if (resolvesToAudio(file, specifier)) {
          throw new Error(`audio import ${specifier} in ${file}`);
        }
        if (specifier === "react" || specifier.startsWith(".")) {
          continue;
        }
        throw new Error(`unexpected dependency ${specifier} in ${file}`);
      }
    }
  });

  it("the admin tree never persists the key, never logs X-API-Key and never touches audio", () => {
    const srcDir = join(process.cwd(), "src");
    const files = [
      join(srcDir, "components", "Admin.tsx"),
      join(srcDir, "components", "AdminKeyGate.tsx"),
      join(srcDir, "components", "AdminPanel.tsx"),
      join(srcDir, "components", "AdminQuestionEditor.tsx"),
      join(srcDir, "components", "AdminReportRow.tsx"),
      join(srcDir, "components", "questionEditorForm.ts"),
      join(srcDir, "components", "adminDateFormat.ts"),
      join(srcDir, "api", "adminFailures.ts"),
    ];
    const forbidden = [
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "dangerouslySetInnerHTML",
      "src/audio",
      "new AudioContext",
      "X-API-Key",
    ];

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      for (const token of forbidden) {
        if (content.includes(token)) {
          throw new Error(`${token} found in ${file}`);
        }
      }
      for (const specifier of importSpecifiers(content)) {
        if (resolvesToAudio(file, specifier)) {
          throw new Error(`audio import ${specifier} in ${file}`);
        }
      }
    }

    const adminClient = readFileSync(join(srcDir, "api", "admin.ts"), "utf-8");
    expect(adminClient).toContain("X-API-Key");

    const questionClient = readFileSync(
      join(srcDir, "api", "questionEditing.ts"),
      "utf-8",
    );
    expect(questionClient.length).toBeGreaterThan(0);
    expect(questionClient).toContain("X-API-Key");
  });

  it("Admin ignores the stored language: no admin file imports src/i18n", () => {
    const srcDir = join(process.cwd(), "src");
    const i18nDir = normalize(join(srcDir, "i18n"));
    const adminFiles = readdirSync(join(srcDir, "components"))
      .filter((name) => /^Admin.*\.tsx$/.test(name) && !name.includes(".test."))
      .map((name) => join(srcDir, "components", name));
    expect(adminFiles.length).toBeGreaterThanOrEqual(5);
    for (const file of adminFiles) {
      for (const specifier of importSpecifiers(readFileSync(file, "utf-8"))) {
        if (!specifier.startsWith(".")) continue;
        const resolved = normalize(resolve(dirname(file), specifier));
        expect(
          resolved === i18nDir || resolved.startsWith(`${i18nDir}/`),
          `${file} imports ${specifier}`,
        ).toBe(false);
      }
    }
  });

  it("F4 an ../audio import resolves to src/audio and is rejected", () => {
    const component = join(process.cwd(), "src", "components", "Admin.tsx");
    const apiModule = join(process.cwd(), "src", "api", "adminFailures.ts");

    expect(resolvesToAudio(component, "../audio")).toBe(true);
    expect(resolvesToAudio(component, "../audio/engine")).toBe(true);
    expect(resolvesToAudio(apiModule, "../audio")).toBe(true);
    expect(resolvesToAudio(component, "./audio")).toBe(false);
    expect(resolvesToAudio(component, "../api/admin")).toBe(false);
    expect(resolvesToAudio(component, "../game/reporting")).toBe(false);
    expect(resolvesToAudio(component, "react")).toBe(false);
  });
});
