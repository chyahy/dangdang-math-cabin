import { calc, makeSteps, value, type Expr, type Step } from "./engine";

// Validate even imported step lists, including unused cards (not only the final AST).
export function validateMergeSteps(steps: Step[], limit = Infinity): string[] {
  const errors: string[] = [],
    ids = new Set<string>(),
    results = new Set<number>();
  const previous = new Map<string, Step>();
  for (const step of steps) {
    if (ids.has(step.id)) errors.push("积木ID重复");
    ids.add(step.id);
    if (results.has(step.result)) errors.push("分步结果重复");
    results.add(step.result);
    const { left, right, op } = step.expression;
    if (left.kind !== "num" || right.kind !== "num") {
      errors.push("分步算式必须由两个来源数字组成");
      continue;
    }
    if (
      step.id !== step.expression.id ||
      step.left.id !== left.id ||
      step.right.id !== right.id ||
      step.left.ref !== left.ref ||
      step.right.ref !== right.ref ||
      step.left.value !== left.value ||
      step.right.value !== right.value
    )
      errors.push("积木与算式来源不一致");
    const a = left.value,
      b = right.value;
    if (
      a <= 0 ||
      b <= 0 ||
      (op === "*" && (a === 1 || b === 1)) ||
      (op === "/" && b === 1) ||
      (op === "-" && a === b)
    )
      errors.push("存在无效运算");
    try {
      const result = calc(op, a, b);
      if (
        result !== step.result ||
        !Number.isSafeInteger(result) ||
        result <= 0 ||
        result > limit
      )
        errors.push("计算结果错误或超出难度范围");
    } catch {
      errors.push("非法计算");
    }
    for (const n of [left, right]) {
      if (
        n.ref &&
        (!previous.has(n.ref) || previous.get(n.ref)!.result !== n.value)
      )
        errors.push("来源缺失、数值不符或依赖顺序错误");
    }
    previous.set(step.id, step);
  }
  const used = new Set<string>();
  function collect(id: string) {
    if (used.has(id)) return;
    used.add(id);
    const s = previous.get(id);
    if (s)
      for (const n of [s.expression.left, s.expression.right])
        if (n.kind === "num" && n.ref) collect(n.ref);
  }
  if (steps.length < 2) errors.push("至少需要两张积木");
  if (steps.length) collect(steps.at(-1)!.id);
  if (used.size !== steps.length) errors.push("存在未参与最终结果的多余积木");
  return [...new Set(errors)];
}
export function validateMerge(root: Expr, limit = Infinity): string[] {
  try {
    value(root);
    return validateMergeSteps(makeSteps(root), limit);
  } catch {
    return ["非法算式"];
  }
}
