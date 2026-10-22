import type { Expr } from "./engine";
import { symbol, bracketSymbols, format } from "./engine";
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
  highlighted?: string[];
  activeSource?: string;
  hoverTarget?: string;
  interactiveOperators?: boolean;
  inserted?: string;
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
    activeSource,
    hoverTarget,
  } = p;
  if (n.kind === "num") {
    const step = steps.find((s) => s.id === n.ref);
    if (merge && n.ref)
      return (
        <button
          data-target={n.id}
          data-source={n.ref}
          className={`number-target ${selected === n.id ? "selected" : ""} ${activeSource === n.ref ? "drop-legal" : ""} ${hoverTarget === n.id ? (activeSource === n.ref ? "drop-hover" : "drop-invalid") : ""}`}
          onClick={() => onSelect?.(n.id)}
          aria-pressed={selected === n.id}
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
  const [open, close] = bracketSymbols(
    n,
    automatic,
    parent?.kind === "bin" ? parent : undefined,
    right,
  );
  return (
    <span
      data-block={n.id}
      className={`expr-group ${selected === n.id ? "chosen-group" : ""} ${p.highlighted?.includes(n.id) ? "hint-legal" : ""} ${p.inserted === n.id ? "inserted-brick" : ""}`}
    >
      {open && <span className="bracket">{open}</span>}
      <Expression {...p} node={n.left} parent={n} right={false} />
      {p.interactiveOperators === false ? (
        <span className="operator-static">{symbol(n.op)}</span>
      ) : (
        <button
          type="button"
          className={`operator ${selected === n.id ? "selected" : ""}`}
          aria-label={`${merge ? "选择积木" : "计算"}${format(n)}`}
          data-op={n.id}
          onClick={() => onSelect?.(n.id)}
        >
          {symbol(n.op)}
        </button>
      )}
      <Expression {...p} node={n.right} parent={n} right />
      {close && <span className="bracket">{close}</span>}
    </span>
  );
}
