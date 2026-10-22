// Math and provenance are independent of UI. Never execute student text as code.
export type Op = "+" | "-" | "*" | "/";
export type Num = { kind: "num"; id: string; value: number; ref?: string };
export type Bin = {
  kind: "bin";
  id: string;
  op: Op;
  left: Expr;
  right: Expr;
  bracket?: boolean;
};
export type Expr = Num | Bin;
export type ErrorType =
  | "order"
  | "parentheses"
  | "left-to-right"
  | "calculation"
  | "retention"
  | "source"
  | "structure";
export const errorNames: Record<ErrorType, string> = {
  order: "先乘除后加减",
  parentheses: "括号优先",
  "left-to-right": "同级从左到右",
  calculation: "基本计算",
  retention: "保留其余算式",
  source: "中间结果来源",
  structure: "综合算式结构",
};
let serial = 0;
export const num = (value: number, ref?: string): Num => ({
  kind: "num",
  id: `n${++serial}`,
  value,
  ...(ref ? { ref } : {}),
});
export const bin = (op: Op, left: Expr, right: Expr, bracket = false): Bin => ({
  kind: "bin",
  id: `b${++serial}`,
  op,
  left,
  right,
  bracket,
});
export const symbol = (op: Op) =>
  ({ "+": "＋", "-": "－", "*": "×", "/": "÷" })[op];
export const precedence = (op: Op) => (op === "+" || op === "-" ? 1 : 2);
export function calc(op: Op, a: number, b: number): number {
  if (op === "/" && b === 0) throw new Error("除数不能是0");
  const v =
    op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b;
  if (!Number.isFinite(v) || Math.abs(v) > 1e10)
    throw new Error("数值超出范围");
  return v;
}
export function value(e: Expr): number {
  return e.kind === "num" ? e.value : calc(e.op, value(e.left), value(e.right));
}
export function parse(input: string): Expr {
  if (/\d\s+\d/.test(input)) throw new Error("数字之间缺少运算符");
  const brackets: string[] = [],
    pairs: Record<string, string> = {
      ")": "(",
      "）": "（",
      "]": "[",
      "】": "【",
    };
  for (const char of input) {
    if ("(（[【".includes(char)) brackets.push(char);
    else if (pairs[char] && brackets.pop() !== pairs[char])
      throw new Error("括号没有正确配对");
  }
  if (brackets.length) throw new Error("括号没有正确配对");
  const text = input
    .replace(/\s/g, "")
    .replace(/[＋]/g, "+")
    .replace(/[－−]/g, "-")
    .replace(/[×]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[（\[【]/g, "(")
    .replace(/[）\]】]/g, ")");
  if (!text || text.length > 500 || /[^\d.+*/()\-]/.test(text))
    throw new Error("请只填写数字、运算符和括号");
  let pos = 0,
    depth = 0;
  function atom(): Expr {
    if (++depth > 40) throw new Error("括号层数太多");
    let node: Expr;
    if (text[pos] === "(") {
      pos++;
      node = expression(0);
      if (text[pos++] !== ")") throw new Error("括号没有配对");
      if (node.kind === "bin") node.bracket = true;
    } else {
      const m = text.slice(pos).match(/^\d+(?:\.\d+)?/);
      if (!m) throw new Error("运算符旁边缺少数字");
      pos += m[0].length;
      node = num(Number(m[0]));
    }
    depth--;
    return node;
  }
  function expression(min: number): Expr {
    let left = atom();
    while (
      pos < text.length &&
      "+-*/".includes(text[pos]) &&
      precedence(text[pos] as Op) >= min
    ) {
      const op = text[pos++] as Op;
      left = bin(op, left, expression(precedence(op) + 1));
    }
    return left;
  }
  const out = expression(0);
  if (pos !== text.length) throw new Error("算式里有多余的数字或括号");
  value(out);
  return out;
}
// Literal mode reflects the child's chosen parentheses; automatic mode is for generated questions.
export function format(
  e: Expr,
  automatic = true,
  parent?: Bin,
  right = false,
): string {
  if (e.kind === "num") return String(e.value);
  let content =
    format(e.left, automatic, e) +
    symbol(e.op) +
    format(e.right, automatic, e, true);
  const needs =
    automatic &&
    parent &&
    (precedence(e.op) < precedence(parent.op) ||
      (right &&
        precedence(e.op) === precedence(parent.op) &&
        (parent.op === "-" ||
          parent.op === "/" ||
          (parent.op === "*" && e.op === "/"))));
  if (e.bracket || needs) content = "(" + content + ")";
  return content;
}
export function visit(e: Expr, fn: (e: Expr) => void) {
  fn(e);
  if (e.kind === "bin") {
    visit(e.left, fn);
    visit(e.right, fn);
  }
}
export function find(e: Expr, id: string): Expr | undefined {
  if (e.id === id) return e;
  if (e.kind === "bin") return find(e.left, id) || find(e.right, id);
}
export function replace(e: Expr, id: string, replacement: Expr): Expr {
  if (e.id === id) return replacement;
  return e.kind === "num"
    ? e
    : {
        ...e,
        left: replace(e.left, id, replacement),
        right: replace(e.right, id, replacement),
      };
}
export function normalize(e: Expr): string {
  if (e.kind === "num") return `n:${e.value}`;
  let a = normalize(e.left),
    b = normalize(e.right);
  if ((e.op === "+" || e.op === "*") && a > b) [a, b] = [b, a];
  return `(${e.op}:${a}:${b})`;
}
export function nextStep(e: Expr): Bin | null {
  if (e.kind === "num") return null;
  const ready: { node: Bin; depth: number; order: number }[] = [];
  let index = 0;
  function walk(n: Expr, depth: number) {
    if (n.kind === "num") return;
    const d = depth + (n.bracket ? 1 : 0);
    walk(n.left, d);
    const order = index++;
    walk(n.right, d);
    if (n.left.kind === "num" && n.right.kind === "num")
      ready.push({ node: n, depth: d, order });
  }
  walk(e, 0);
  ready.sort(
    (a, b) =>
      b.depth - a.depth ||
      precedence(b.node.op) - precedence(a.node.op) ||
      a.order - b.order,
  );
  return ready[0]?.node ?? null;
}
export function reduce(e: Expr, id: string): Expr {
  const n = find(e, id);
  if (!n || n.kind !== "bin") throw new Error("请选择运算部分");
  return replace(e, id, { kind: "num", id: n.id, value: value(n) });
}
export function orderError(e: Expr, selectedId: string): ErrorType {
  const expected = nextStep(e),
    chosen = find(e, selectedId);
  if (!expected || chosen?.kind !== "bin") return "order";
  let inBrackets = false;
  visit(e, (n) => {
    if (n.kind === "bin" && n.bracket && find(n, expected.id))
      inBrackets = true;
  });
  if (inBrackets) return "parentheses";
  if (precedence(chosen.op) === precedence(expected.op)) return "left-to-right";
  return "order";
}
export function explanation(
  type: ErrorType,
  attempt: number,
  expected?: Bin,
): string {
  const direction: Record<ErrorType, string[]> = {
    order: [
      "这里有不同级的运算，先想想哪一级要先算。",
      "乘法、除法要在加法、减法前面计算。",
    ],
    parentheses: [
      "再看看括号里面，里面的运算完成了吗？",
      "先算最里面的括号，再看括号外面的运算。",
    ],
    "left-to-right": [
      "这些运算是同一级，要从哪一边开始呢？",
      "乘除同级、加减同级，都从左往右计算。",
    ],
    calculation: [
      "先算哪里已经找对了，再核对一次计算结果。",
      "把这一步单独写出来，用口算或笔算再检查。",
    ],
    retention: [
      "这一行还没有算的部分也要保留下来。",
      "只替换选中的部分，其余数字、符号和顺序不变。",
    ],
    source: [
      "这个数字是哪一步的结果？看看数字旁边的小编号。",
      "卡片结果的编号，要和蓝色数字旁的来源编号一致。",
    ],
    structure: [
      "结果相同还不够，要保留原来每一步的计算关系。",
      "检查替换进去的加减算式，遇到乘除或减号时是否要加括号。",
    ],
  };
  if (attempt < 3 || !expected)
    return direction[type][Math.min(attempt - 1, 1)];
  return `看这一步：${format(expected)}＝${value(expected)}。${direction[type][1]}请你再操作一次。`;
}
export type Step = {
  id: string;
  index: number;
  expression: Bin;
  result: number;
  left: Num;
  right: Num;
};
export function makeSteps(root: Expr): Step[] {
  const list: Step[] = [];
  function walk(e: Expr): Num {
    if (e.kind === "num") return { ...e };
    const left = walk(e.left),
      right = walk(e.right);
    list.push({
      id: e.id,
      index: list.length + 1,
      expression: { ...e, bracket: false, left, right },
      result: value(e),
      left,
      right,
    });
    return { kind: "num", id: `ref-${e.id}`, ref: e.id, value: value(e) };
  }
  walk(root);
  return list;
}
export function initialMerge(root: Expr): Expr {
  const steps = makeSteps(root);
  return structuredClone(steps[steps.length - 1].expression);
}
export function sources(e: Expr): Num[] {
  const out: Num[] = [];
  visit(e, (n) => {
    if (n.kind === "num" && n.ref) out.push(n);
  });
  return out;
}
export function substitute(
  root: Expr,
  targetId: string,
  step: Step,
  brackets: boolean,
): Expr {
  const target = find(root, targetId);
  if (target?.kind !== "num" || target.ref !== step.id)
    throw new Error("来源编号不一致");
  return replace(root, targetId, {
    ...structuredClone(step.expression),
    bracket: brackets,
  });
}
export function checkMerge(
  root: Expr,
  original: Expr,
): { ok: boolean; message: string } {
  if (sources(root).length)
    return {
      ok: false,
      message: "还有带来源编号的中间结果没有替换，继续找出它们的来处。",
    };
  try {
    const written = parse(format(root, false));
    if (normalize(written) !== normalize(original))
      return {
        ok: false,
        message:
          "还没合好：括号改变了原来分步算式的关系。选中替换积木的运算符，试着补上或去掉括号。",
      };
    if (value(written) !== value(original))
      return { ok: false, message: "结果不同，再检查括号。" };
    return { ok: true, message: "合成成功！每一步的来源与运算关系都保留了。" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
