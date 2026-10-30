import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// The game remembers the language and the sound in localStorage; every test
// starts from a first visit so one test's choice never leaks into the next.
beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
});
