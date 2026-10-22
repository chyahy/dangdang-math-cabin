import { describe, expect, it, afterEach, vi } from "vitest";
import {
  parse,
  format,
  value,
  getLegalNextSteps,
  isLegalStep,
  reduce,
  find,
  makeSteps,
  sources,
  initialMerge,
  substitute,
  smartBrackets,
  checkMerge,
  bracketDepth,
  normalize,
  type Expr,
} from "./engine";
import { generate } from "./generator";
import { load, defaultConfig } from "./storage";
const initial = "[(8+1)*(15/3)]+5*2";
function solveAll(e: Expr, answer: number, seen = new Set<string>()): number {
  const key = JSON.stringify(e);
  if (seen.has(key)) return 0;
  seen.add(key);
  expect(value(e)).toBe(answer);
  expect(value(parse(format(e)))).toBe(answer);
  if (e.kind === "num") return 1;
  const legal = getLegalNextSteps(e);
  expect(legal.length).toBeGreaterThan(0);
  let count = 0;
  for (const n of legal) {
    expect(n.left.kind).toBe("num");
    expect(n.right.kind).toBe("num");
    count += solveAll(reduce(e, n.id), answer, seen);
  }
  return count;
}
describe("all legal next steps under teaching rules", () => {
  it.each([
    ["(8＋1)", "(15÷3)"],
    ["(15÷3)", "(8＋1)"],
  ])(
    "accepts the path %s then %s without any fixed answer index",
    (first, second) => {
      let e = parse(initial);
      expect(getLegalNextSteps(e).map((n) => format(n))).toEqual([
        "(8＋1)",
        "(15÷3)",
      ]);
      let step = getLegalNextSteps(e).find((n) => format(n) === first)!;
      expect(isLegalStep(e, step.id)).toBe(true);
      e = reduce(e, step.id);
      step = getLegalNextSteps(e).find((n) => format(n) === second)!;
      expect(step).toBeDefined();
      e = reduce(e, step.id);
      while (e.kind === "bin") e = reduce(e, getLegalNextSteps(e)[0].id);
      expect(value(e)).toBe(55);
    },
  );
  it("blocks outside multiplication until all active groups are complete", () => {
    const e = parse(initial);
    const outside = e.kind === "bin" ? e.right : undefined;
    expect(outside?.kind).toBe("bin");
    expect(isLegalStep(e, outside!.id)).toBe(false);
    expect(() => reduce(e, outside!.id)).toThrow("还不能先算");
  });
  it("allows independent groups at unequal nesting depths", () => {
    let e = parse("(2+3)+[4+(12/3)]");
    expect(getLegalNextSteps(e).map((n) => format(n))).toEqual([
      "(2＋3)",
      "(12÷3)",
    ]);
    const divide = getLegalNextSteps(e)[1];
    e = reduce(e, divide.id);
    expect(getLegalNextSteps(e).map((n) => format(n))).toEqual([
      "(2＋3)",
      "(4＋4)",
    ]);
    expect(solveAll(e, 13)).toBeGreaterThan(0);
  });
  it("checks precedence within each independent group, not across unrelated groups", () => {
    const e = parse("(8+1*2)+(15/3)");
    expect(getLegalNextSteps(e).map((n) => format(n))).toEqual([
      "1×2",
      "(15÷3)",
    ]);
    expect(isLegalStep(e, e.kind === "bin" ? e.left.id : "")).toBe(false);
  });
  it("keeps left-to-right within same-level chains", () => {
    const e = parse("24/6*2");
    expect(getLegalNextSteps(e).map((n) => format(n))).toEqual(["24÷6"]);
    expect(isLegalStep(e, e.id)).toBe(false);
    expect(isLegalStep(e, parse("6*2").id)).toBe(false);
    const f = parse("3*4+5*2");
    expect(getLegalNextSteps(f).map((n) => format(n))).toEqual(["3×4"]);
  });
  it("enumerates all reachable states of branching examples with no dead ends", () => {
    for (const text of [
      initial,
      "[(8+1)*(15/3)]+[(6+2)/2]",
      "(2+3)+[4+(12/3)]",
      "[(3+4)+(8-2)]/(4-2)",
    ])
      expect(solveAll(parse(text), value(parse(text)))).toBeGreaterThan(0);
  });
});
describe("shared elementary-school bracket layout", () => {
  it("converts nested brackets dynamically after each chosen step", () => {
    let e = parse("100-(24+(18/3))*2");
    expect(format(e)).toBe("100－[24＋(18÷3)]×2");
    e = reduce(e, getLegalNextSteps(e)[0].id);
    expect(format(e)).toBe("100－(24＋6)×2");
    e = reduce(e, getLegalNextSteps(e)[0].id);
    expect(format(e)).toBe("100－30×2");
    e = reduce(e, getLegalNextSteps(e)[0].id);
    expect(format(e)).toBe("100－60");
    e = reduce(e, getLegalNextSteps(e)[0].id);
    expect(format(e)).toBe("40");
  });
  it("formats and solves nested divisor brackets", () => {
    const e = parse("96/((8+4)/3)");
    expect(format(e)).toBe("96÷[(8＋4)÷3]");
    expect(solveAll(e, 24)).toBeGreaterThan(0);
  });
  it("keeps the outer square group after either first choice", () => {
    const e = parse(initial),
      [a, b] = getLegalNextSteps(e);
    expect(format(reduce(e, a.id))).toBe("[9×(15÷3)]＋5×2");
    expect(format(reduce(e, b.id))).toBe("[(8＋1)×5]＋5×2");
  });
  it("uses only round brackets for single-level grouping", () =>
    expect(format(parse("24-6*(2+1)"))).toBe("24－6×(2＋1)"));
});
describe("automatic source substitution and necessary parentheses", () => {
  it.each([
    ["(15+19)*11", "(15＋19)×11"],
    ["50-(6+4)", "50－(6＋4)"],
    ["24/(4+2)", "24÷(4＋2)"],
    ["20*3-15", "20×3－15"],
  ])("preserves %s", (input, expected) => {
    const original = parse(input);
    let e = initialMerge(original);
    const steps = makeSteps(original);
    while (sources(e).length) {
      const target = sources(e)[0];
      e = smartBrackets(
        substitute(
          e,
          target.id,
          steps.find((s) => s.id === target.ref)!,
          false,
        ),
      );
    }
    expect(format(e, false)).toBe(expected);
    expect(checkMerge(e, original).ok).toBe(true);
  });
  it("expands three steps automatically and avoids redundant product brackets", () => {
    const original = parse("(12+8)*3-15"),
      steps = makeSteps(original);
    let e = initialMerge(original);
    let target = sources(e)[0];
    e = smartBrackets(
      substitute(
        e,
        target.id,
        steps.find((t) => t.id === target.ref)!,
        false,
      ),
    );
    expect(format(e, false)).toBe("20×3－15");
    target = sources(e)[0];
    e = smartBrackets(
      substitute(
        e,
        target.id,
        steps.find((t) => t.id === target.ref)!,
        false,
      ),
    );
    expect(format(e, false)).toBe("(12＋8)×3－15");
    expect(checkMerge(e, original).ok).toBe(true);
  });
  it("can expand two independent branches in either order", () => {
    const original = parse("(2+3)*(8-3)"),
      steps = makeSteps(original);
    for (const reverse of [false, true]) {
      let e = initialMerge(original);
      while (sources(e).length) {
        const refs = sources(e),
          target = reverse ? refs.at(-1)! : refs[0];
        e = smartBrackets(
          substitute(
            e,
            target.id,
            steps.find((t) => t.id === target.ref)!,
            false,
          ),
        );
      }
      expect(checkMerge(e, original).ok).toBe(true);
    }
  });
});
describe("generated questions and legacy progress", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("keeps random questions at most two display levels and enumerates all legal paths", () => {
    let seed = 123;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (const module of ["mixed", "merge", "split"] as const)
      for (let level = 1; level <= 5; level++)
        for (let i = 0; i < 30; i++) {
          const q = generate(module, level, i % 2 ? 10 : 100, rng);
          expect(bracketDepth(q.original)).toBeLessThanOrEqual(2);
          expect(solveAll(q.original, q.answer)).toBeGreaterThan(0);
          const steps = makeSteps(q.original);
          let e = initialMerge(q.original);
          while (sources(e).length) {
            const ref = sources(e).at(-1)!;
            e = smartBrackets(
              substitute(
                e,
                ref.id,
                steps.find((t) => t.id === ref.ref)!,
                false,
              ),
            );
          }
          expect(checkMerge(e, q.original).ok).toBe(true);
        }
  });
  it("migrates old tree-only undo history without losing records or current input", () => {
    const original = parse("100-(24+(18/3))*2"),
      question = {
        id: "old",
        module: "mixed",
        level: 4,
        original,
        text: "100－(24＋(18÷3))×2",
        answer: 40,
      };
    const legacy = {
      config: { ...defaultConfig, smartBrackets: undefined },
      current: {
        question,
        config: {
          module: "mixed",
          level: 4,
          mode: "guided",
          max: 100,
          preserve: false,
        },
        tree: original,
        undo: [original],
        history: [],
        selected: "",
        input: "6",
        hints: 1,
        errors: [],
        startedAt: 1,
        done: false,
        saved: false,
        stars: 0,
      },
      records: [
        {
          id: "record",
          question,
          text: question.text,
          stars: 3,
          errors: [],
          correct: true,
          endedAt: 1,
        },
      ],
    };
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(legacy) });
    const saved = load();
    expect(saved.current?.input).toBe("6");
    expect(saved.current?.config.smartBrackets).toBe(false);
    expect(saved.records).toHaveLength(1);
    expect(normalize(saved.current!.tree)).toBe(normalize(original));
    expect(saved.current?.undo[0].tree).toEqual(original);
    expect(saved.current?.question.text).toBe("100－[24＋(18÷3)]×2");
  });
});
