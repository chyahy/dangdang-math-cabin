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
  | "missing-bracket"
  | "structure";
export const errorNames: Record<ErrorType, string> = {
  order: "运算顺序理解：先乘除后加减",
  parentheses: "括号优先",
  "left-to-right": "同级从左到右",
  calculation: "基本计算",
  retention: "保留其余算式",
  source: "中间结果来源",
  "missing-bracket": "遗漏必要括号（运算顺序）",
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
// Keep right-hand same-precedence subtrees grouped to preserve the given step dependency.
export function needsBracket(e: Expr, parent?: Bin, right = false): boolean {
  return (
    e.kind === "bin" &&
    !!parent &&
    (precedence(e.op) < precedence(parent.op) ||
      (right && precedence(e.op) === precedence(parent.op)))
  );
}
function grouped(e: Bin, automatic: boolean, parent?: Bin, right = false) {
  return !!e.bracket || (automatic && needsBracket(e, parent, right));
}
export function bracketDepth(
  e: Expr,
  automatic = true,
  parent?: Bin,
  right = false,
): number {
  if (e.kind === "num") return 0;
  return (
    Math.max(
      bracketDepth(e.left, automatic, e),
      bracketDepth(e.right, automatic, e, true),
    ) + (grouped(e, automatic, parent, right) ? 1 : 0)
  );
}
// Text and interactive rendering share this AST-based layout; no string replacement.
export function bracketSymbols(
  e: Expr,
  automatic = true,
  parent?: Bin,
  right = false,
): [string, string] {
  if (e.kind === "num" || !grouped(e, automatic, parent, right))
    return ["", ""];
  return bracketDepth(e, automatic, parent, right) > 1
    ? ["[", "]"]
    : ["(", ")"];
}
export function smartBrackets(e: Expr, parent?: Bin, right = false): Expr {
  if (e.kind === "num") return e;
  return {
    ...e,
    bracket: needsBracket(e, parent, right),
    left: smartBrackets(e.left, e),
    right: smartBrackets(e.right, e, true),
  };
}
// Literal mode reflects a child's explicit groups; automatic mode preserves the tree.
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
  const [open, close] = bracketSymbols(e, automatic, parent, right);
  return open + content + close;
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
function activeScopes(e: Expr): Bin[] {
  if (e.kind === "num") return [];
  const children = [...activeScopes(e.left), ...activeScopes(e.right)];
  return children.length ? children : e.bracket ? [e] : [];
}
function firstInScope(e: Expr): Bin | null {
  const ready: Bin[] = [];
  function walk(n: Expr) {
    if (n.kind === "num") return;
    walk(n.left);
    if (n.left.kind === "num" && n.right.kind === "num") ready.push(n);
    walk(n.right);
  }
  walk(e);
  // An AST already encodes left associativity. In an ungrouped chain, choose
  // the first available high-precedence operation, then the first low one.
  return ready.find((n) => precedence(n.op) === 2) || ready[0] || null;
}
export function getLegalNextSteps(e: Expr): Bin[] {
  const scopes = activeScopes(e);
  return (scopes.length ? scopes : [e])
    .map(firstInScope)
    .filter((n): n is Bin => !!n);
}
export function isLegalStep(e: Expr, id: string): boolean {
  return getLegalNextSteps(e).some((n) => n.id === id);
}
// One example path for solution generation only; grading uses the full set.
export function nextStep(e: Expr): Bin | null {
  return getLegalNextSteps(e)[0] || null;
}
export function reduce(e: Expr, id: string): Expr {
  const n = find(e, id);
  if (!n || n.kind !== "bin") throw new Error("请选择运算部分");
  if (!isLegalStep(e, id)) throw new Error("这一部分还不能先算");
  return replace(e, id, { kind: "num", id: n.id, value: value(n) });
}
export function orderError(e: Expr, selectedId: string): ErrorType {
  const expected = nextStep(e),
    chosen = find(e, selectedId);
  if (!expected || chosen?.kind !== "bin") return "order";
  const scopes = activeScopes(e);
  const scope = scopes.find((n) => !!find(n, selectedId));
  if (scopes.length && !scope) return "parentheses";
  const localExpected = scope ? firstInScope(scope)! : expected;
  if (precedence(chosen.op) === precedence(localExpected.op))
    return "left-to-right";
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
    "missing-bracket": [
      "先想想这张积木里的运算，是否需要在外面的运算之前完成。",
      "不加括号会改变原来分步算式的运算顺序，请重新判断。",
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
// Judge the inserted AST's position, never a coincidentally equal numeric result.
// Same-precedence right subtrees stay grouped to retain the given step dependency.
export function bracketDecision(root: Expr, insertedId: string) {
  let required = false;
  let reason = "这里按先乘除、后加减，同级从左往右，已经能保持原来的计算关系。";
  let found = false;
  function walk(e: Expr, parent?: Bin, right = false) {
    if (e.id === insertedId && e.kind === "bin") {
      found = true;
      required = needsBracket(e, parent, right);
      if (required && parent) {
        reason =
          right && parent.op === "-"
            ? "减号后要先算这一整块，再减去它的结果，所以必须加括号。"
            : right && parent.op === "/"
              ? "除号后要先算这一整块，把它的结果作为除数，所以必须加括号。"
              : precedence(e.op) < precedence(parent.op)
                ? `要先算${format(e, false)}，再${parent.op === "*" ? "乘" : "除"}，所以必须加括号。`
                : "要先完成右边这张积木，再参与外面的同级运算，必须用括号保留原来的分步关系。";
      }
      return;
    }
    if (e.kind === "bin") {
      walk(e.left, e);
      walk(e.right, e, true);
    }
  }
  walk(root);
  if (!found) throw new Error("待判断的积木不存在");
  return { required, reason };
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
        message: "还没合好：括号没有保持原来分步算式的运算关系，请重新判断。",
      };
    if (value(written) !== value(original))
      return { ok: false, message: "结果不同，再检查括号。" };
    return { ok: true, message: "合成成功！每一步的来源与运算关系都保留了。" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
