import {
  bin,
  num,
  value,
  format,
  parse,
  bracketDepth,
  type Expr,
  type Op,
} from "./engine";
import { validateMerge } from "./mergeValidation";
export type Module = "mixed" | "merge" | "split";
export type Question = {
  id: string;
  module: Module;
  level: number;
  original: Expr;
  text: string;
  answer: number;
};
const recent: string[] = [];
export const levels = [
  "运算新手村",
  "括号迷宫",
  "运算顺序塔",
  "算式拼装工厂",
  "数学思维城堡",
];
export const lessonNames: Record<Module, string> = {
  mixed: "混合运算大挑战",
  merge: "算式合成大师",
  split: "综合算式拆分",
};
export function generate(
  module: Module,
  level: number,
  max = 100,
  rng = Math.random,
): Question {
  max = Math.max(10, Math.min(500, Math.floor(max)));
  level = Math.max(1, Math.min(5, level));
  const int = (a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;
  const leaf = () => num(int(1, Math.min(max, 20)));
  const choose = <T>(items: T[]) => items[int(0, items.length - 1)];
  function combine(a: Expr, b: Expr, ops: Op[], bracket = false): Expr {
    const options = ops.filter((op) => {
      const av = value(a),
        bv = value(b);
      if (op === "/" && !bv) return false;
      const v =
        op === "+"
          ? av + bv
          : op === "-"
            ? av - bv
            : op === "*"
              ? av * bv
              : av / bv;
      return Number.isSafeInteger(v) && v >= 0 && v <= max * 12;
    });
    if (!options.length) throw new Error("retry");
    return bin(choose(options), a, b, bracket);
  }
  function division(denominator: Expr): Expr {
    const d = value(denominator);
    if (d < 1 || d > max) throw new Error("retry");
    return bin(
      "/",
      num(d * int(1, Math.min(9, Math.floor(max / d)))),
      denominator,
    );
  }
  for (let trial = 0; trial < 1500; trial++) {
    try {
      let e: Expr;
      if (module === "merge") {
        const sum = () => combine(leaf(), leaf(), ["+", "-"]);
        const product = () => combine(leaf(), leaf(), ["*"]);
        const variant = int(0, 2);
        if (level === 1)
          e =
            variant === 0
              ? combine(sum(), leaf(), ["*"])
              : variant === 1
                ? combine(product(), leaf(), ["+", "-"])
                : combine(leaf(), product(), ["+"]);
        else if (level === 2)
          e =
            variant === 0
              ? combine(combine(sum(), leaf(), ["*"]), leaf(), ["+", "-"])
              : variant === 1
                ? combine(combine(product(), leaf(), ["+"]), leaf(), ["*"])
                : combine(product(), sum(), ["+"]);
        else if (level === 3)
          e =
            variant === 0
              ? combine(num(max), sum(), ["-"])
              : variant === 1
                ? combine(product(), leaf(), ["-"])
                : combine(combine(num(max), sum(), ["-"]), leaf(), ["+"]);
        else if (level === 4)
          e =
            variant === 0
              ? division(sum())
              : variant === 1
                ? combine(division(leaf()), leaf(), ["+"])
                : combine(division(sum()), leaf(), ["+"]);
        else
          e =
            variant === 0
              ? combine(combine(sum(), sum(), ["*", "/"]), leaf(), ["+", "-"])
              : variant === 1
                ? combine(combine(product(), leaf(), ["+"]), sum(), ["*"])
                : combine(division(sum()), product(), ["+"]);
        if (validateMerge(e, max * 12).length) continue;
      } else {
        if (level === 1)
          e =
            rng() < 0.5
              ? combine(leaf(), combine(leaf(), leaf(), ["*", "/"]), ["+", "-"])
              : combine(combine(leaf(), leaf(), ["+", "-"]), leaf(), [
                  "+",
                  "-",
                ]);
        else if (level === 2) {
          const inner = combine(leaf(), leaf(), ["+", "-"], true);
          e = rng() < 0.5 ? division(inner) : combine(inner, leaf(), ["*"]);
        } else if (level === 3)
          e = combine(combine(division(leaf()), leaf(), ["*", "/"]), leaf(), [
            "+",
            "-",
          ]);
        else if (level === 4) {
          const inner = combine(leaf(), division(leaf()), ["+", "-"], true);
          const outer = combine(leaf(), inner, ["+"], true);
          e = combine(num(max), combine(outer, num(2), ["*"]), ["+", "-"]);
        } else {
          const a = combine(leaf(), leaf(), ["+", "-"], true),
            b = division(leaf());
          e = combine(
            combine(a, b, ["*", "/"], true),
            combine(leaf(), leaf(), ["*", "/"]),
            ["+", "-"],
          );
        }
      }
      // Parsing the displayed expression guarantees the same order is used in training and judging.
      const text = format(e);
      if (bracketDepth(e) > 2) continue;
      if (recent.includes(`${module}:${text}`) && trial < 1450) continue;
      const original = parse(text);
      if (module === "merge" && validateMerge(original, max * 12).length)
        continue;
      recent.push(`${module}:${text}`);
      if (recent.length > 60) recent.shift();
      return {
        id: `${Date.now()}-${int(0, 1e9)}`,
        module,
        level,
        original,
        text,
        answer: value(original),
      };
    } catch {
      /* Rebuild a legal tree; never expose invalid arithmetic to children. */
    }
  }
  throw new Error("未能生成题目，请调整数字范围后重试。");
}
