import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getCategories, getGameQuestion, submitAnswer } from "./game";

describe("game api coverage", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_API_URL", "http://localhost:8000");
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("submitAnswer validates empty answer", async () => {
    await expect(submitAnswer(1, "", "es")).rejects.toMatchObject({
      kind: "validation",
    });
  });

  it("submitAnswer validates answer longer than 300 chars", async () => {
    const long = "a".repeat(301);
    await expect(submitAnswer(1, long, "es")).rejects.toMatchObject({
      kind: "validation",
    });
  });

  it("submitAnswer sends correct request for es", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ correct: true, correct_answer: "A" }),
      ) as Response,
    );
    await submitAnswer(123, "Mi respuesta", "es");
    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(call[0]).toContain("/game/answer?lang=es");
    expect(call[1].method).toBe("POST");
    expect(JSON.parse(call[1].body)).toEqual({
      question_id: 123,
      answer: "Mi respuesta",
    });
  });

  it("submitAnswer with lang en", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ correct: false, correct_answer: "B" }),
      ) as Response,
    );
    await submitAnswer(5, "X", "en");
    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(call[0]).toContain("lang=en");
  });

  it("getCategories valid", async () => {
    const categories = Array(6)
      .fill(0)
      .map((_, i) => ({ name: `n${i}`, label: `l${i}`, description: `d${i}` }));
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(categories)) as Response,
    );
    const res = await getCategories();
    expect(res).toHaveLength(6);
  });

  it("getGameQuestion en", async () => {
    const question = {
      id: 1,
      question: "Q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "en",
    };
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(question)) as Response,
    );
    const res = await getGameQuestion("c", "en");
    expect(res.lang).toBe("en");
  });
});
