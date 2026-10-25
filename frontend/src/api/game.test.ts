import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getCategories, getGameQuestion, submitAnswer } from "./game";

describe("game api functions", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_API_URL", "http://localhost:8000");
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("getCategories returns exactly six valid categories", async () => {
    const categories = [
      { name: "geografia", label: "Geografía", description: "desc1" },
      { name: "historia", label: "Historia", description: "desc2" },
      { name: "ciencia", label: "Ciencia", description: "desc3" },
      { name: "arte", label: "Arte", description: "desc4" },
      {
        name: "entretenimiento",
        label: "Entretenimiento",
        description: "desc5",
      },
      { name: "deportes", label: "Deportes", description: "desc6" },
    ];
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(categories)) as Response,
    );
    const result = await getCategories();
    expect(result).toHaveLength(6);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("label");
    expect(result[0]).toHaveProperty("description");
  });

  it("getCategories throws validation for wrong count", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify([{ name: "x", label: "y", description: "z" }]),
      ) as Response,
    );
    await expect(getCategories()).rejects.toMatchObject({
      kind: "validation",
    });
  });

  it("getGameQuestion validates and returns", async () => {
    const question = {
      id: 123,
      question: "¿Pregunta?",
      category: "geografia",
      options: ["A", "B", "C", "D"],
      lang: "es",
    };
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(question)) as Response,
    );
    const result = await getGameQuestion("geografia", "es");
    expect(result.id).toBe(123);
    expect(result.options).toHaveLength(4);
    expect(result.lang).toBe("es");
  });

  it("getGameQuestion throws validation for bad shape", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 0,
          question: "x",
          category: "y",
          options: ["a", "b", "c", "d"],
          lang: "es",
        }),
      ) as Response,
    );
    await expect(getGameQuestion("geografia", "es")).rejects.toMatchObject({
      kind: "validation",
    });
  });

  it("submitAnswer sends body and validates", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ correct: true, correct_answer: "B" }),
      ) as Response,
    );
    const result = await submitAnswer(123, "B", "es");
    expect(result.correct).toBe(true);
    expect(result.correct_answer).toBe("B");
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("submitAnswer throws validation for bad response", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ correct: "yes" })) as Response,
    );
    await expect(submitAnswer(123, "B", "es")).rejects.toMatchObject({
      kind: "validation",
    });
  });
});
