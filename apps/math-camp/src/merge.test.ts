import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bracketDecision,
  bracketDepth,
  checkMerge,
  find,
  format,
  initialMerge,
  makeSteps,
  normalize,
  parse,
  replace,
  sources,
  substitute,
  value,
  type Expr,
} from "./engine";
import { generate } from "./generator";
import { validateMerge, validateMergeSteps } from "./mergeValidation";
import { defaultConfig, load, mergeStats } from "./storage";

describe("merge question validation", () => {
  it("rejects repeated zero results and identities", () => {
    expect(validateMerge(parse("(8+16)*(7-7)+3"))).toContain("分步结果重复");
    expect(validateMerge(parse("(8+16)*(7-7)+3"))).toContain("存在无效运算");
  });
  it("checks even unused cards for duplicate 20 and orphan dependencies", () => {
    const [a] = makeSteps(parse("12+8")),
      [b] = makeSteps(parse("25-5"));
    const [, final] = makeSteps(parse("(12+8)*3"));
    final.expression.left = { ...a.left, ref: a.id, value: 20 };
    final.left = final.expression.left;
    expect(validateMergeSteps([a, b, final])).toContain("分步结果重复");
    expect(validateMergeSteps([a, b, final])).toContain(
      "存在未参与最终结果的多余积木",
    );
  });
  it("accepts the four useful steps 24,5,120,123", () => {
    const root = parse("(8+16)*(9-4)+3");
    expect(makeSteps(root).map((s) => s.result)).toEqual([24, 5, 120, 123]);
    expect(validateMerge(root)).toEqual([]);
  });
  it.each([
    "(8+2)*0",
    "0*(8+2)",
    "(8+2)*1",
    "1*(8+2)",
    "(8+2)/1",
    "(8+2)+0",
    "(8+2)-0",
    "(8+2)-(8+2)",
  ])("rejects %s only in merge validator", (text) => {
    const e = parse(text);
    expect(validateMerge(e).length).toBeGreaterThan(0);
    expect(Number.isFinite(value(e))).toBe(true); // Mixed arithmetic still supports 0 and 1.
  });
  it("rejects broken, future and duplicated IDs and mismatched source values", () => {
    const steps = makeSteps(parse("(8+16)*(9-4)+3"));
    const wrong = structuredClone(steps);
    wrong[2].expression.left = { ...wrong[2].left, ref: "missing" };
    wrong[2].left = wrong[2].expression.left;
    expect(validateMergeSteps(wrong)).toContain(
      "来源缺失、数值不符或依赖顺序错误",
    );
    expect(
      validateMergeSteps([steps[2], steps[0], steps[1], steps[3]]).length,
    ).toBeGreaterThan(0);
    expect(validateMergeSteps([steps[0], ...steps])).toContain("积木ID重复");
  });
});

describe("AST-based bracket decisions", () => {
  it.each([
    ["(15+19)*11", true],
    ["12*3+5", false],
    ["50-(6+4)", true],
    ["24/(4+2)", true],
    ["6*3+5", false],
    ["(9-4)-2", false],
    ["40/(8/2)", true],
    ["2*(8/4)", true],
    ["2+(3+4)", true],
    ["(2+3)+4", false],
    ["(12/3)*2", false],
    // Same numeric answer without brackets, but the given dependency would change.
    ["2*(2/2)", true],
    ["4-(2-2)", true],
  ] as const)(
    "classifies %s without using its final value",
    (text, required) => {
      const original = parse(text),
        steps = makeSteps(original),
        start = initialMerge(original),
        target = sources(start)[0];
      const expanded = substitute(
        start,
        target.id,
        steps.find((t) => t.id === target.ref)!,
        false,
      );
      expect(bracketDecision(expanded, target.ref!).required).toBe(required);
      const part = find(expanded, target.ref!)!;
      expect(part.kind).toBe("bin");
      if (part.kind !== "bin") throw new Error("missing block");
      const confirmed = replace(expanded, part.id, {
        ...part,
        bracket: required,
      });
      expect(checkMerge(confirmed, original).ok).toBe(true);
    },
  );
  it("accepts optional extra brackets and switches nested round/square layout dynamically", () => {
    const original = parse("((8+16)*(9-4))+3"),
      steps = makeSteps(original);
    let e = initialMerge(original);
    const decisions: boolean[] = [];
    while (sources(e).length) {
      const t = sources(e)[0],
        s = steps.find((s) => s.id === t.ref)!;
      e = substitute(e, t.id, s, false);
      decisions.push(bracketDecision(e, s.id).required);
      const part = find(e, s.id)!;
      if (part.kind === "bin")
        e = replace(e, part.id, { ...part, bracket: true });
    }
    expect(decisions).toEqual([false, true, true]);
    expect(format(e, false)).toBe("[(8＋16)×(9－4)]＋3");
    expect(checkMerge(e, original).ok).toBe(true);
    expect(bracketDepth(e, false)).toBe(2);
  });
});

it("checks 1,500 merge questions across levels, EVERY target order and both optional choices", () => {
  let seed = 0x455623;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let level = 1; level <= 5; level++) {
    let requiredCount = 0,
      optionalCount = 0;
    const structures = new Set<string>();
    for (let n = 0; n < 300; n++) {
      const savedSeed = seed;
      let questionText = "未生成";
      try {
        const max = [10, 100, 500][n % 3],
          q = generate("merge", level, max, rng);
        questionText = q.text;
        expect(validateMerge(q.original, max * 12)).toEqual([]);
        const steps = makeSteps(q.original),
          seen = new Set<string>();
        const shape = (e: Expr): string =>
          e.kind === "num" ? "n" : `(${shape(e.left)}${e.op}${shape(e.right)})`;
        structures.add(shape(q.original));
        function explore(e: Expr) {
          const key = JSON.stringify(e);
          if (seen.has(key)) return;
          seen.add(key);
          expect(value(e)).toBe(q.answer);
          expect(normalize(parse(format(e, false)))).toBe(normalize(e));
          expect(bracketDepth(e, false)).toBeLessThanOrEqual(2);
          const targets = sources(e);
          if (!targets.length) {
            expect(checkMerge(e, q.original).ok).toBe(true);
            return;
          }
          for (const target of targets) {
            const step = steps.find((s) => s.id === target.ref)!;
            expect(step).toBeDefined();
            expect(target.value).toBe(step.result);
            const preview = substitute(e, target.id, step, false);
            const required = bracketDecision(preview, step.id).required;
            if (required) requiredCount++;
            else optionalCount++;
            for (const add of required ? [true] : [true, false]) {
              const part = find(preview, step.id)!;
              if (part.kind !== "bin")
                throw new Error("missing inserted block");
              explore(replace(preview, step.id, { ...part, bracket: add }));
            }
          }
        }
        explore(initialMerge(q.original));
      } catch (error) {
        throw new Error(
          `seed=${savedSeed}, level=${level}, n=${n}, question=${questionText}`,
          { cause: error },
        );
      }
    }
    expect(requiredCount).toBeGreaterThan(0);
    expect(optionalCount).toBeGreaterThan(0);
    expect(structures.size).toBeGreaterThan(1);
  }
}, 60000);

describe("real action reporting and pending progress", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("does not infer actions from old records or count optional additions as errors", () => {
    const summary = mergeStats([
      {
        module: "merge",
        actions: [
          { type: "source-correct", stepId: "1", at: 1 },
          { type: "source-wrong", stepId: "1", at: 2 },
          { type: "bracket-extra", stepId: "1", at: 3 },
          { type: "bracket-missing", stepId: "2", at: 4 },
        ],
      },
      { module: "merge" },
    ] as Parameters<typeof mergeStats>[0]);
    expect(summary).toEqual({
      sourceCorrect: 1,
      sourceWrong: 1,
      bracketCorrect: 1,
      bracketMissing: 1,
      optionalExtra: 1,
    });
  });
  it("keeps an unwrapped pending preview, undo and previous awards on reload", () => {
    const original = parse("(15+19)*11"),
      start = initialMerge(original),
      step = makeSteps(original)[0];
    const preview = substitute(start, sources(start)[0].id, step, false);
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          records: [],
          config: defaultConfig,
          current: {
            question: { original, module: "merge" },
            config: defaultConfig,
            tree: preview,
            mergeFlow: 2,
            pendingBracket: { insertedId: step.id },
            undo: [{ tree: start, history: [] }],
            history: [],
            errors: [],
          },
        }),
    });
    const loaded = load();
    expect(format(loaded.current!.tree, false)).toBe("15＋19×11");
    expect(loaded.current?.pendingBracket?.insertedId).toBe(step.id);
    expect(loaded.current?.undo[0].tree).toEqual(start);
  });
});
