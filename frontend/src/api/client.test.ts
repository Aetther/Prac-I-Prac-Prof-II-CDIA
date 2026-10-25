import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { apiRequest } from "./client";
import { getApiBaseUrl } from "./config";

describe("api client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_API_URL", "http://localhost:8000");
    globalThis.fetch = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("handles network error", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    await expect(apiRequest("/test")).rejects.toMatchObject({
      kind: "network",
      status: undefined,
      retryAfterSeconds: undefined,
    });
  });

  it("handles timeout after 10 seconds", async () => {
    (
      globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(
      (_url: string, options?: Record<string, unknown>) =>
        new Promise((_, reject) => {
          if (options && options.signal) {
            (options.signal as AbortSignal).addEventListener("abort", () => {
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
        }),
    );

    const promise = apiRequest("/test");
    vi.advanceTimersByTime(10000);
    await expect(promise).rejects.toMatchObject({
      kind: "timeout",
      status: undefined,
      retryAfterSeconds: undefined,
    });
  });

  it("handles http 404 with text detail", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ detail: "No encontrado" }), {
        status: 404,
      }) as Response,
    );
    await expect(apiRequest("/test")).rejects.toMatchObject({
      kind: "http",
      status: 404,
      detail: "No encontrado",
    });
  });

  it("handles http 422 with Pydantic list detail", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: [
            { loc: ["body", "field"], msg: "campo requerido" },
            { msg: "otro error" },
          ],
        }),
        { status: 422 },
      ) as Response,
    );
    await expect(apiRequest("/test")).rejects.toMatchObject({
      kind: "http",
      status: 422,
      detail: "campo requerido otro error",
    });
  });

  it("handles http 422 with text detail", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ detail: "Error de validación" }), {
        status: 422,
      }) as Response,
    );
    await expect(apiRequest("/test")).rejects.toMatchObject({
      kind: "http",
      status: 422,
      detail: "Error de validación",
    });
  });

  it("handles http 429 with Retry-After", async () => {
    const headers = new Headers();
    headers.set("Retry-After", "7");
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ detail: "rate limit" }), {
        status: 429,
        headers,
      }) as Response,
    );
    await expect(apiRequest("/test")).rejects.toMatchObject({
      kind: "http",
      status: 429,
      retryAfterSeconds: 7,
    });
  });

  it("normalizes base URL", () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:8000/");
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
    vi.stubEnv("VITE_API_URL", "http://localhost:8000");
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });
});
