import { describe, expect, it, beforeEach, vi } from "vitest";
import { buildUrl, getApiBaseUrl } from "./config";

describe("api config", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes base URL without trailing slash", () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:8000/");
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("uses default when env missing", () => {
    vi.stubEnv("VITE_API_URL", "");
    // fallback to default
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("buildUrl works with or without trailing slash", () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:8000/");
    expect(buildUrl("/categories")).toBe("http://localhost:8000/categories");

    vi.stubEnv("VITE_API_URL", "http://localhost:8000");
    expect(buildUrl("/categories")).toBe("http://localhost:8000/categories");
  });

  it("buildUrl adds leading slash when path has no leading slash", () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:8000");
    expect(buildUrl("categories")).toBe("http://localhost:8000/categories");
    expect(buildUrl("game/question")).toBe(
      "http://localhost:8000/game/question",
    );
  });
});
