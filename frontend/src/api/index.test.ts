import { describe, expect, it } from "vitest";
import * as api from "./index";

describe("api index", () => {
  it("exports modules", () => {
    expect(api.ApiError).toBeDefined();
    expect(api.getCategories).toBeDefined();
    expect(api.getGameQuestion).toBeDefined();
    expect(api.submitAnswer).toBeDefined();
    expect(api.getApiBaseUrl).toBeDefined();
    expect(api.buildUrl).toBeDefined();
  });
});
