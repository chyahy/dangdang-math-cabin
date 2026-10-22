import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultConfig,
  load,
  persist,
  stats,
  type RecordItem,
} from "./storage";
afterEach(() => vi.unstubAllGlobals());
describe("local progress and honest statistics", () => {
  it("starts without invented records", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(load().records).toEqual([]);
    expect(stats([])).toEqual({ today: 0, correct: 0, streak: 0, stars: 0 });
  });
  it("recovers from invalid stored JSON", () => {
    vi.stubGlobal("localStorage", { getItem: () => "{oops" });
    expect(load().current).toBeNull();
  });
  it("reports quota failure instead of claiming a successful save", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("full");
      },
    });
    expect(
      persist({
        records: [],
        current: null,
        config: defaultConfig,
        motion: true,
        sound: true,
      }),
    ).toBe(false);
  });
  it("counts streaks and stars from actual records", () => {
    const now = Date.now();
    const records = [
      { correct: true, stars: 3, endedAt: now },
      { correct: false, stars: 2, endedAt: now },
      { correct: true, stars: 3, endedAt: now },
    ] as RecordItem[];
    expect(stats(records)).toEqual({
      today: 3,
      correct: 2,
      streak: 1,
      stars: 8,
    });
  });
});
