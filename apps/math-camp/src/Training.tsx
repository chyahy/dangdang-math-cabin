import { useRef, useState } from "react";
import {
  checkMerge,
  errorNames,
  explanation,
  find,
  format,
  makeSteps,
  nextStep,
  normalize,
  orderError,
  parse,
  reduce,
  replace,
  sources,
  substitute,
  value,
  type Bin,
  type ErrorType,
} from "./engine";
import { lessonNames } from "./generator";
import type { Session } from "./storage";
import { Expression } from "./Expression";
type Props = {
  session: Session;
  update: (s: Session) => void;
  finish: (s: Session) => void;
  next: () => void;
  motion: boolean;
};
export function Training({ session: s, update, finish, next, motion }: Props) {
  const [feedback, setFeedback] = useState({
    text: "点击算式里的运算符，选出这一轮要计算的部分。",
    good: true,
  });
  const [pending, setPending] = useState("");
  const [flying, setFlying] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    id: string;
    moved: boolean;
    active: boolean;
    pointer: number;
  } | null>(null);
  const steps = makeSteps(s.question.original),
    merge = s.question.module === "merge",
    selected = find(s.tree, s.selected),
    expected = nextStep(s.tree);
  function patch(p: Partial<Session>) {
    update({ ...s, ...p });
  }
  function error(type: ErrorType, text?: string) {
    const count = s.errors.filter((e) => e.type === type).length + 1;
    let message = text || explanation(type, count, expected || undefined);
    if (merge && type === "structure" && count >= 3) {
      message = `对照原来的分步关系，正确合成为：${format(s.question.original)}＝${s.question.answer}。替换进去的整块加减算式，参加乘除或放在减号后时，要用括号保护它的运算顺序。请你选中对应积木补改括号，再检查。`;
    }
    if (merge && type === "source" && count >= 3) {
      const target = find(s.tree, s.selected);
      const source = target?.kind === "num" && steps.find(t => t.id === target.ref);
      if (source) message = `${source.result}旁的来源编号是${source.index}：应当用第${source.index}张卡片“${format(source.expression)}＝${source.result}”来替换。即使另一张卡片的结果相同，也要按原来的来源编号来拼。`;
    }
    patch({
      errors: [
        ...s.errors,
        { type, step: format(s.tree, !merge), at: Date.now() },
      ],
    });
    setFeedback({ text: message, good: false });
  }
  function select(id: string) {
    if (s.done || flying) return;
    const node = find(s.tree, id);
    if (merge) {
      patch({ selected: id });
      setPending("");
      setFeedback({
        text:
          node?.kind === "num"
            ? `找到${node.value}的来源卡片，点击它或拖到这个数字上。`
            : "已选中这块算式，可以添加或去掉括号。",
        good: true,
      });
      return;
    }
    if (s.config.mode === "guided" && id !== expected?.id) {
      error(orderError(s.tree, id));
      return;
    }
    patch({ selected: id, input: "", nextLine: "" });
    setFeedback({
      text:
        s.config.mode === "guided"
          ? "✓ 先算这里选对了！输入这一部分的结果。"
          : "已选中。填写结果后提交检查。",
      good: true,
    });
  }
  function compute(e: React.FormEvent) {
    e.preventDefault();
    if (s.done || !selected || selected.kind !== "bin") return;
    if (selected.id !== expected?.id) {
      error(orderError(s.tree, selected.id));
      return;
    }
    if (
      !/^\d+(?:\.\d+)?$/.test(s.input) ||
      Number(s.input) !== value(selected)
    ) {
      error("calculation");
      return;
    }
    const tree = reduce(s.tree, selected.id);
    if (s.config.preserve && tree.kind !== "num") {
      try {
        if (normalize(parse(s.nextLine)) !== normalize(tree)) {
          error("retention");
          return;
        }
      } catch {
        error("retention");
        return;
      }
    }
    const line = `${format(selected)}＝${value(selected)}`;
    const oldRects = new Map<string, DOMRect>();
    if (motion && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document
        .querySelectorAll<HTMLElement>(".expression-line [data-number]")
        .forEach((el) =>
          oldRects.set(el.dataset.number!, el.getBoundingClientRect()),
        );
      const collapsing = document.querySelector(
        `[data-block="${selected.id}"]`,
      );
      if (collapsing)
        oldRects.set(selected.id, collapsing.getBoundingClientRect());
    }
    const updated = {
      ...s,
      tree,
      history: [...s.history, line],
      selected: "",
      input: "",
      nextLine: "",
    };
    setFeedback({
      text:
        tree.kind === "num"
          ? "✓ 每一步都完成了！"
          : "✓ 这一部分已变成结果，其余算式保留。继续选下一步。",
      good: true,
    });
    if (tree.kind === "num") finish(updated);
    else update(updated);
    requestAnimationFrame(() =>
      document
        .querySelectorAll<HTMLElement>(".expression-line [data-number]")
        .forEach((el) => {
          const before = oldRects.get(el.dataset.number!);
          if (!before) return;
          const after = el.getBoundingClientRect();
          el.animate(
            [
              {
                transform: `translate(${before.left - after.left}px,${before.top - after.top}px) scaleX(${Math.min(3, before.width / Math.max(1, after.width))})`,
              },
              { transform: "none" },
            ],
            { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)" },
          );
        }),
    );
  }
  function hint() {
    const hints = s.hints + 1;
    patch({ hints });
    if (merge) {
      const remaining = sources(s.tree)[0],
        source = remaining && steps.find((t) => t.id === remaining.ref);
      setFeedback({
        text:
          hints === 1
            ? "先找带“来源”编号的数字。它不是原始数字，还能继续展开。"
            : source
              ? `选中${remaining.value}（来源${source.index}），再用第${source.index}张卡片替换。把加减算式放进乘除法时，想一想括号。`
              : "所有来源都展开了。检查加减算式在乘除法或减号后面的括号。",
        good: true,
      });
    } else if (expected)
      setFeedback({
        text:
          hints === 1
            ? "先找括号；没有括号时先乘除，再加减；同级从左向右。"
            : hints === 2
              ? `下一步先算${format(expected)}。点击它的运算符，再算结果。`
              : `先算${format(expected)}＝${value(expected)}。请你来完成这一步。`,
        good: true,
      });
  }
  function chooseCard(id: string, target = s.selected) {
    if (s.done || flying) return;
    const node = find(s.tree, target);
    if (node?.kind !== "num" || !node.ref) {
      setFeedback({ text: "先点击下方一个带来源编号的数字。", good: false });
      return;
    }
    if (node.ref !== id) {
      error("source");
      return;
    }
    patch({ selected: target });
    setPending(id);
    setFeedback({
      text: "来源找对了！放进去之前，想一想：需要加括号吗？",
      good: true,
    });
  }
  async function insert(brackets: boolean) {
    const step = steps.find((t) => t.id === pending);
    if (!step || flying) return;
    const sourceEl = document.querySelector(`[data-card="${step.id}"]`),
      targetEl = document.querySelector(`[data-target="${s.selected}"]`);
    setFlying(true);
    if (
      sourceEl &&
      targetEl &&
      motion &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const a = sourceEl.getBoundingClientRect(),
        b = targetEl.getBoundingClientRect(),
        ghost = document.createElement("div");
      ghost.className = "flying-brick";
      ghost.textContent = `${brackets ? "(" : ""}${format(step.expression)}${brackets ? ")" : ""}`;
      Object.assign(ghost.style, { left: a.left + "px", top: a.top + "px" });
      document.body.append(ghost);
      try {
        await ghost.animate(
          [
            { transform: "translate(0,0) scale(1)", opacity: 1 },
            {
              transform: `translate(${b.left - a.left}px,${b.top - a.top}px) scale(.75)`,
              opacity: 0.3,
            },
          ],
          { duration: 450, easing: "cubic-bezier(.2,.7,.2,1)" },
        ).finished;
      } catch {
        /* Reduced motion / page exit. */
      } finally {
        ghost.remove();
      }
    }
    const tree = substitute(s.tree, s.selected, step, brackets);
    patch({ tree, undo: [...s.undo, s.tree], selected: step.id });
    setPending("");
    setFlying(false);
    setFeedback({
      text: "✓ 替换积木已放入。继续展开蓝色数字，最后点击检查。",
      good: true,
    });
  }
  function toggleBracket() {
    if (selected?.kind !== "bin") return;
    patch({
      tree: replace(s.tree, selected.id, {
        ...selected,
        bracket: !selected.bracket,
      }),
      undo: [...s.undo, s.tree],
    });
  }
  function check() {
    const result = checkMerge(s.tree, s.question.original);
    if (result.ok) {
      setFeedback({ text: result.message, good: true });
      finish(s);
    } else error("structure", result.message);
  }
  function reset() {
    // Restart keeps the same attempt's hint/error history, so stars cannot be inflated.
    patch({
      tree: merge
        ? structuredClone(steps[steps.length - 1].expression)
        : structuredClone(s.question.original),
      undo: [],
      history: [],
      selected: "",
      input: "",
      nextLine: "",
    });
    setPending("");
    setShowAnswer(false);
    setFeedback({ text: "已回到这道题的起点，再来一次。", good: true });
  }
  return (
    <section className="training">
      <div className="training-heading">
        <div>
          <span className="eyebrow">
            第{s.question.level}关 ·{" "}
            {s.config.mode === "guided" ? "引导训练" : "独立训练"}
          </span>
          <h1>{lessonNames[s.question.module]}</h1>
        </div>
        <button className="quiet" onClick={next}>
          换一道题 ↻
        </button>
      </div>
      <div className="problem-strip">
        <span>{merge ? "任务" : "原题"}</span>
        <strong>
          {merge ? "把分步算式拼成一个综合算式" : s.question.text}
        </strong>
      </div>
      {merge && (
        <div className="source-cards" aria-label="分步算式卡片">
          {steps.map((t) => (
            <button
              key={t.id}
              data-card={t.id}
              disabled={s.done || flying}
              className={`source-card tone-${t.index % 3} ${pending === t.id ? "source-active" : ""}`}
              onClick={() => {
                if (drag.current?.moved) {
                  drag.current = null;
                  return;
                }
                chooseCard(t.id);
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                drag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  id: t.id,
                  moved: false,
                  active: true,
                  pointer: e.pointerId,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (
                  drag.current?.active &&
                  drag.current.pointer === e.pointerId &&
                  Math.hypot(
                    e.clientX - drag.current.x,
                    e.clientY - drag.current.y,
                  ) > 8
                ) {
                  drag.current.moved = true;
                  e.currentTarget.classList.add("dragging");
                }
              }}
              onPointerUp={(e) => {
                e.currentTarget.classList.remove("dragging");
                const d = drag.current;
                if (!d || !d.active) return;
                d.active = false;
                if (d.moved) {
                  const target = document
                    .elementFromPoint(e.clientX, e.clientY)
                    ?.closest("[data-target]") as HTMLElement | null;
                  if (target?.dataset.target)
                    chooseCard(t.id, target.dataset.target);
                  else
                    setFeedback({
                      text: "把卡片放到下方蓝色的来源数字上，也可以先点数字，再点卡片。",
                      good: false,
                    });
                }
              }}
              onPointerCancel={(e) => {
                drag.current = null;
                e.currentTarget.classList.remove("dragging");
              }}
            >
              <span className="card-index">{t.index} / 分步算式</span>
              <strong>
                {format(t.expression)}＝<span>{t.result}</span>
              </strong>
              <small>
                {t.left.ref || t.right.ref
                  ? `含有前面步骤的结果`
                  : "从原始数字开始"}
              </small>
            </button>
          ))}
        </div>
      )}
      <div className="workspace">
        <div className="workspace-label">
          <span>{merge ? "我的综合算式" : "我的计算台"}</span>
          <span>
            {merge
              ? `还剩${sources(s.tree).length}个来源待展开`
              : `${s.history.length}步已完成`}
          </span>
        </div>
        <div
          className={`expression-line ${s.done ? "finished" : ""}`}
          aria-label="当前算式"
        >
          <Expression
            node={s.tree}
            selected={s.selected}
            onSelect={select}
            merge={merge}
            automatic={!merge}
            steps={steps}
          />
          {merge && (
            <span className="answer-suffix">＝{s.question.answer}</span>
          )}
        </div>
        {!s.done && !merge && selected?.kind === "bin" && (
          <form className="answer-form" onSubmit={compute}>
            <label>
              <span>{format(selected)}＝？</span>
              <input
                aria-label="这一步的结果"
                inputMode="decimal"
                value={s.input}
                onChange={(e) => patch({ input: e.target.value })}
                autoFocus
                placeholder="输入结果"
                autoComplete="off"
              />
            </label>
            {s.config.preserve && (
              <label>
                <span>
                  {expected && reduce(s.tree, expected.id).kind === "num"
                    ? "最后一步无需抄写"
                    : "替换之后，完整的下一行是？"}
                </span>
                <input
                  aria-label="下一行完整算式"
                  value={s.nextLine}
                  onChange={(e) => patch({ nextLine: e.target.value })}
                  placeholder="保留其他数字和符号"
                />
              </label>
            )}
            <button className="primary" type="submit">
              检查这一步 →
            </button>
          </form>
        )}
        {!s.done && merge && (
          <div className="merge-tools">
            {pending ? (
              <div className="bracket-choice">
                <strong>这一块需要括号吗？</strong>
                <button
                  className="primary"
                  onClick={() => void insert(true)}
                  disabled={flying}
                >
                  加上括号再放入
                </button>
                <button onClick={() => void insert(false)} disabled={flying}>
                  不用括号，直接放入
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={toggleBracket}
                  disabled={selected?.kind !== "bin"}
                >
                  给选中积木
                  {selected?.kind === "bin" && selected.bracket
                    ? "去掉"
                    : "加上"}
                  括号
                </button>
                <button className="primary" onClick={check}>
                  检查综合算式 ✓
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div
        role="status"
        className={`coach ${feedback.good ? "" : "try-again"}`}
      >
        <span className="coach-face">{feedback.good ? "✦" : "?"}</span>
        <div>
          <small>鲁老师 × 当当老师 · 小提示</small>
          <p>{feedback.text}</p>
        </div>
      </div>
      {s.done ? (
        <div className="celebrate" role="status">
          <div className="reward-stars">
            {"★".repeat(s.stars)}
            {"☆".repeat(3 - s.stars)}
          </div>
          <h2>又解开一道数学机关！</h2>
          <p>
            {s.stars === 3
              ? "这次没有使用提示，获得3颗星。"
              : "认真想、慢慢练，每一次尝试都有收获。"}{" "}
            星星只记录本次练习表现。
          </p>
          <button className="primary" onClick={next}>
            继续下一题 →
          </button>
        </div>
      ) : (
        <div className="toolbar">
          <button onClick={hint}>✦ 查看提示</button>
          {merge && (
            <button
              disabled={!s.undo.length}
              onClick={() => {
                patch({
                  tree: s.undo[s.undo.length - 1],
                  undo: s.undo.slice(0, -1),
                  selected: "",
                });
                setPending("");
              }}
            >
              ↶ 撤销上一步
            </button>
          )}
          <button onClick={reset}>重新开始</button>
          <button
            className="quiet"
            onClick={() => {
              patch({ hints: Math.max(3, s.hints) });
              setShowAnswer(!showAnswer);
            }}
          >
            查看完整解析
          </button>
        </div>
      )}
      {showAnswer && (
        <div className="solution">
          <h3>边看边想</h3>
          {steps.map((t) => (
            <p key={t.id}>
              {t.index}．{format(t.expression)}＝{t.result}
            </p>
          ))}
          <strong>
            {format(s.question.original)}＝{s.question.answer}
          </strong>
          <p>看过解析后，回到计算台亲手完成。正确计算的部分才能合成下一步。</p>
        </div>
      )}
      {s.history.length > 0 && (
        <section className="history">
          <h2>
            {s.question.module === "split"
              ? "我拆出的分步算式"
              : "我的计算脚印"}
          </h2>
          <ol>
            {s.history.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </section>
      )}
      {s.errors.length > 0 && (
        <p className="muted">
          本题已记录{s.errors.length}次尝试：
          {[...new Set(s.errors.map((e) => errorNames[e.type]))].join("、")}
          。继续练习就好。
        </p>
      )}
    </section>
  );
}
