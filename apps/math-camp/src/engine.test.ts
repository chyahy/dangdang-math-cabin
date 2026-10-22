import { describe, it, expect } from "vitest";
import {
  bin,
  num,
  parse,
  value,
  format,
  nextStep,
  reduce,
  normalize,
  makeSteps,
  initialMerge,
  sources,
  substitute,
  checkMerge,
  orderError,
  visit,
} from "./engine";
import { generate } from "./generator";
import type { Expr, Bin } from "./engine";
function solve(input: string): string[] {
  let e = parse(input);
  const list: string[] = [];
  while (e.kind !== "num") {
    const step = nextStep(e)!;
    list.push(format(step));
    e = reduce(e, step.id);
  }
  return list;
}
describe("safe expression parser and operation order", () => {
  it.each([
    ["18+6*3", 36],
    ["24/4+5", 11],
    ["36-12/3", 32],
    ["(24+12)/6", 6],
    ["48/6*2+7", 23],
    ["60-24/4*3", 42],
    ["100-[24+(18/3)]*2", 40],
    ["96/[(8+4)/3]", 24],
    ["50-(6+4)", 40],
    ["24/(4+2)", 4],
  ])("%s = %s", (s, n) => expect(value(parse(s as string))).toBe(n));
  it("reduces parentheses, multiplication, subtraction in order", () =>
    expect(solve("24-6*(2+1)")).toEqual(["(2＋1)", "6×3", "24－18"]));
  it("keeps same-level order", () =>
    expect(solve("48/6*2+7")).toEqual(["48÷6", "8×2", "16＋7"]));
  it("classifies parentheses mistakes separately", () => {
    const e = parse("24-6*(2+1)") as Bin;
    expect(orderError(e, e.id)).toBe("parentheses");
  });
  it("classifies operation priority and left-to-right", () => {
    const e = parse("24-6*3") as Bin;
    expect(orderError(e, e.id)).toBe("order");
    const f = parse("48/6*2") as Bin;
    expect(orderError(f, f.id)).toBe("left-to-right");
  });
  it.each([
    "1/0",
    "(2+3",
    "2++3",
    "2 3",
    "alert(1)",
    "1;2",
    "2**3",
    "Infinity",
    "2(3+4)",
    "2+",
    "[4/0]",
  ])("rejects unsafe/invalid %s", (s) => {
    // Whitespace between separate digits may not silently turn into a different number.
    if (s === "2 3") return expect(() => parse(s)).toThrow();
    expect(() => parse(s)).toThrow();
  });
  it("keeps unreduced parts exactly in structure", () => {
    const e = parse("48-(6+4)*3");
    const step = nextStep(e)!;
    const reduced = reduce(e, step.id);
    expect(format(reduced)).toBe("48－10×3");
    expect(normalize(reduced)).not.toBe(normalize(parse("48-10+3")));
  });
  it("accepts redundant parentheses", () =>
    expect(normalize(parse("50-(6*4)"))).toBe(normalize(parse("50-6*4"))));
  it("requires matching bracket kinds", () => {
    expect(() => parse("(2+3]")).toThrow();
    expect(value(parse("24÷【（2＋1）×2】"))).toBe(4);
  });
});
describe("source tracking and merge judging", () => {
  it("shows each dependency once and expands sources", () => {
    const e = parse("(12+8)*3-15"),
      steps = makeSteps(e);
    expect(steps.map((t) => t.result)).toEqual([20, 60, 45]);
    let work = initialMerge(e);
    while (sources(work).length) {
      const target = sources(work)[0];
      work = substitute(
        work,
        target.id,
        steps.find((t) => t.id === target.ref)!,
        true,
      );
    }
    expect(checkMerge(work, e).ok).toBe(true);
  });
  it("does not accept equal values with unrelated calculations", () =>
    expect(checkMerge(parse("6*5"), parse("(6+4)*3")).ok).toBe(false));
  it("detects missing brackets after subtraction", () => {
    const e = parse("50-(6+4)"),
      step = makeSteps(e)[0],
      initial = initialMerge(e),
      target = sources(initial)[0];
    expect(checkMerge(substitute(initial, target.id, step, false), e).ok).toBe(
      false,
    );
    expect(checkMerge(substitute(initial, target.id, step, true), e).ok).toBe(
      true,
    );
  });
  it("detects missing brackets in divisor", () => {
    const e = parse("24/(4+2)"),
      initial = initialMerge(e),
      step = makeSteps(e)[0],
      target = sources(initial)[0];
    expect(checkMerge(substitute(initial, target.id, step, false), e).ok).toBe(
      false,
    );
    expect(checkMerge(substitute(initial, target.id, step, true), e).ok).toBe(
      true,
    );
  });
  it("disambiguates repeated intermediate values using source IDs", () => {
    const e = bin("*", bin("+", num(2), num(3)), bin("-", num(8), num(3))),
      steps = makeSteps(e),
      initial = initialMerge(e),
      refs = sources(initial);
    expect(refs.map((n) => n.value)).toEqual([5, 5]);
    expect(refs[0].ref).not.toBe(refs[1].ref);
    expect(() => substitute(initial, refs[0].id, steps[1], true)).toThrow(
      "来源编号",
    );
  });
  it("preserves independent branches", () => {
    const e = parse("(12+8)*(9-4)-3"),
      steps = makeSteps(e);
    let work = initialMerge(e);
    for (let i = 0; i < 10 && sources(work).length; i++) {
      const t = sources(work).at(-1)!;
      work = substitute(
        work,
        t.id,
        steps.find((s) => s.id === t.ref)!,
        true,
      );
    }
    expect(checkMerge(work, e).ok).toBe(true);
  });
});
describe("procedural generation property checks", () => {
  it("creates 1,500 legal questions across all modules and levels", () => {
    let seed = 38;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const seen = new Set<string>();
    for (const module of ["mixed", "merge", "split"] as const)
      for (let level = 1; level <= 5; level++)
        for (let n = 0; n < 100; n++) {
          const q = generate(module, level, n % 2 ? 100 : 10, rng);
          seen.add(q.text);
          let count = 0;
          visit(q.original, (e) => {
            expect(Number.isSafeInteger(value(e))).toBe(true);
            expect(value(e)).toBeGreaterThanOrEqual(0);
            if (e.kind === "num")
              expect(e.value).toBeLessThanOrEqual(n % 2 ? 100 : 10);
          });
          let work: Expr = q.original;
          while (work.kind === "bin") {
            const step = nextStep(work);
            expect(step).not.toBeNull();
            work = reduce(work, step!.id);
            if (++count > 8) throw new Error("step loop");
          }
          expect(value(work)).toBe(q.answer);
          expect(value(parse(q.text))).toBe(q.answer);
          let merge = initialMerge(q.original);
          const steps = makeSteps(q.original);
          while (sources(merge).length) {
            const source = sources(merge)[0];
            merge = substitute(
              merge,
              source.id,
              steps.find((t) => t.id === source.ref)!,
              true,
            );
          }
          expect(checkMerge(merge, q.original).ok).toBe(true);
        }
    expect(seen.size).toBeGreaterThan(1000);
  });
});
