import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { apiRequest } from "./client";

describe("api client coverage", () => {
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

  it("handles http 500", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ detail: "err" }), {
        status: 500,
      }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 500,
    });
  });

  it("handles 429 without Retry-After header", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ detail: "rate" }), {
        status: 429,
      }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 429,
    });
  });

  it("handles detail as list with non-object items", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ detail: ["err1", 123] }), {
        status: 400,
      }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 400,
    });
  });

  it("handles detail as list with object without msg", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: [{ loc: ["body", "x"] }, { code: "bad" }],
        }),
        { status: 422 },
      ) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 422,
    });
  });

  it("handles detail as list with msg non-string", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: [{ msg: 123 }, { msg: null }],
        }),
        { status: 422 },
      ) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 422,
    });
  });

  it("handles detail not text/object in some form", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ detail: 12345 }), {
        status: 400,
      }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 400,
    });
  });

  it("handles plain text error body", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("plain error text", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 400,
      detail: "plain error text",
    });
  });

  it("handles invalid JSON in 200 response", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("not json", { status: 200 }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "validation",
    });
  });

  it("handles invalid Retry-After", async () => {
    const headers = new Headers();
    headers.set("Retry-After", "abc");
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ detail: "rate" }), {
        status: 429,
        headers,
      }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 429,
      retryAfterSeconds: undefined,
    });
  });

  it("handles empty error body", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("", { status: 503 }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 503,
    });
  });

  it("handles body string directly", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify("oops"), { status: 400 }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 400,
    });
  });

  it("handles error body with detail undefined", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ detail: undefined }), {
        status: 400,
      }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 400,
    });
  });

  it("handles error body with detail null", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ detail: null }), {
        status: 400,
      }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 400,
    });
  });

  it("handles http 404 default message", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 404 }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 404,
    });
  });

  it("handles http 422 default message", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 422 }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 422,
    });
  });

  it("handles generic http error", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 400 }) as Response,
    );
    await expect(apiRequest("/x")).rejects.toMatchObject({
      kind: "http",
      status: 400,
    });
  });
});
