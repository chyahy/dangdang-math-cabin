import type { Expr } from "./engine";
import { symbol, precedence } from "./engine";
import type { Step } from "./engine";
type Props = {
  node: Expr;
  selected?: string;
  onSelect?: (id: string) => void;
  merge?: boolean;
  steps?: Step[];
  automatic?: boolean;
  parent?: Expr;
  right?: boolean;
  onDropCard?: (target: string, step: string) => void;
};
export function Expression(p: Props) {
  const {
    node: n,
    selected,
    onSelect,
    merge,
    steps = [],
    automatic = true,
    parent,
    right,
  } = p;
  if (n.kind === "num") {
    const step = steps.find((s) => s.id === n.ref);
    if (merge && n.ref)
      return (
        <button
          data-target={n.id}
          className={`number-target ${selected === n.id ? "selected" : ""}`}
          onClick={() => onSelect?.(n.id)}
          aria-label={`替换${n.value}，来自第${step?.index}步`}
        >
          {n.value}
          <small>来源{step?.index}</small>
        </button>
      );
    return (
      <span
        data-number={n.id}
        className={`number ${n.id.startsWith("b") ? "reduced-number" : ""}`}
      >
        {n.value}
      </span>
    );
  }
  const needs =
    automatic &&
    parent?.kind === "bin" &&
    (precedence(n.op) < precedence(parent.op) ||
      (right &&
        precedence(n.op) === precedence(parent.op) &&
        (parent.op === "-" ||
          parent.op === "/" ||
          (parent.op === "*" && n.op === "/"))));
  const bracket = n.bracket || needs;
  return (
    <span
      data-block={n.id}
      className={`expr-group ${selected === n.id ? "chosen-group" : ""}`}
    >
      {bracket && <span className="bracket">(</span>}
      <Expression {...p} node={n.left} parent={n} right={false} />
      <button
        type="button"
        className={`operator ${selected === n.id ? "selected" : ""}`}
        aria-label={`${merge ? "选择积木" : "计算"}${n.id}`}
        data-op={n.id}
        onClick={() => onSelect?.(n.id)}
      >
        {symbol(n.op)}
      </button>
      <Expression {...p} node={n.right} parent={n} right />
      {bracket && <span className="bracket">)</span>}
    </span>
  );
}
