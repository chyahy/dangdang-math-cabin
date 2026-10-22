import { useEffect, useRef, useState } from "react";
import {
  checkMerge,
  bracketDecision,
  errorNames,
  explanation,
  find,
  format,
  getLegalNextSteps,
  isLegalStep,
  makeSteps,
  normalize,
  orderError,
  parse,
  reduce,
  replace,
  sources,
  substitute,
  value,
  type ErrorType,
  type Expr,
} from "./engine";
import { lessonNames } from "./generator";
import type { MergeAction, Session, Snapshot } from "./storage";
import { Expression } from "./Expression";
import { SourceBricks } from "./SourceBricks";
type Props = {
  session: Session;
  update: (s: Session) => void;
  finish: (s: Session) => void;
  next: () => void;
  nextLevel: () => void;
  motion: boolean;
};
export function Training({
  session: s,
  update,
  finish,
  next,
  nextLevel,
  motion,
}: Props) {
  const merge = s.question.module === "merge";
  const pending = s.pendingBracket;
  const [feedback, setFeedback] = useState({
    text: pending
      ? "上次展开的积木已保留，请继续判断高亮部分是否需要括号。"
      : merge
        ? "把上面的算式积木拖到下方对应的数字上。也可以先点积木，再点数字。"
        : "点击你想先算的运算符，再填写结果。",
    good: true,
  });
  const [activeSource, setActiveSource] = useState(""),
    [hoverTarget, setHoverTarget] = useState("");
  const [flying, setFlying] = useState(false),
    [showAnswer, setShowAnswer] = useState(false),
    [highlighted, setHighlighted] = useState<string[]>([]),
    [inserted, setInserted] = useState("");
  const busy = useRef(false),
    mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!pending) return;
    const frame = requestAnimationFrame(() => {
      const choice = document.querySelector<HTMLElement>(".bracket-choice");
      choice?.scrollIntoView({ block: "nearest", behavior: "instant" });
      choice
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pending?.insertedId]);
  const steps = makeSteps(s.question.original),
    selected = find(s.tree, s.selected),
    legal = getLegalNextSteps(s.tree),
    expected = legal[0];
  const tree = s.tree;
  function patch(p: Partial<Session>) {
    update({ ...s, ...p });
  }
  const snapshot = (): Snapshot => ({
    tree: s.tree,
    history: s.history,
    pendingBracket: pending,
  });
  const action = (type: MergeAction["type"], stepId: string): MergeAction => ({
    type,
    stepId,
    at: Date.now(),
  });
  function clearSelection() {
    setActiveSource("");
    setHoverTarget("");
    setHighlighted([]);
    setInserted("");
  }
  function completeIfReady(candidate: Session) {
    const done = merge
      ? !candidate.pendingBracket &&
        !sources(candidate.tree).length &&
        checkMerge(candidate.tree, candidate.question.original).ok
      : candidate.tree.kind === "num";
    if (done) {
      const result = merge
        ? checkMerge(candidate.tree, candidate.question.original)
        : { ok: true, message: "✓ 每一步都完成了！" };
      if (result.ok) {
        setFeedback({ text: result.message, good: true });
        finish(candidate);
        return;
      }
    }
    update(candidate);
  }
  function error(type: ErrorType, text?: string, event?: MergeAction) {
    const count = s.errors.filter((e) => e.type === type).length + 1;
    let message = text || explanation(type, count, expected);
    if (type === "structure" && count >= 3)
      message = `正确合成为：${format(s.question.original)}＝${s.question.answer}。请重新判断替换积木的括号。`;
    patch({
      errors: [
        ...s.errors,
        { type, step: format(tree, !merge), at: Date.now() },
      ],
      ...(event ? { actions: [...(s.actions || []), event] } : {}),
    });
    setFeedback({ text: message, good: false });
  }
  function select(id: string) {
    if (flying || s.done || pending) return;
    if (merge) {
      const target = find(s.tree, id);
      if (target?.kind === "num" && target.ref && activeSource) {
        requestInsert(activeSource, id);
        return;
      }
      patch({ selected: id });
      setFeedback({
        text:
          target?.kind === "num"
            ? "目标已选好，点击它对应的来源积木也能放入。"
            : "先把来源积木放到对应数字，再判断括号。",
        good: true,
      });
      return;
    }
    if (s.config.mode === "guided" && !isLegalStep(s.tree, id)) {
      error(orderError(s.tree, id));
      return;
    }
    patch({ selected: id, input: "", nextLine: "" });
    setFeedback({
      text:
        s.config.mode === "independent"
          ? "已选中，填写结果后提交。"
          : legal.length > 1
            ? "✓ 这些互不依赖的括号都可以先算。你选的这一步也正确！"
            : "✓ 先算这里选对了！输入结果。",
      good: true,
    });
  }
  function animateNumbers(before: Map<string, DOMRect>) {
    if (!motion || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    requestAnimationFrame(() =>
      document
        .querySelectorAll<HTMLElement>(".expression-line [data-number]")
        .forEach((el) => {
          const a = before.get(el.dataset.number!);
          if (!a) return;
          const b = el.getBoundingClientRect();
          el.animate(
            [
              {
                transform: `translate(${a.left - b.left}px,${a.top - b.top}px) scaleX(${Math.min(3, a.width / Math.max(1, b.width))})`,
              },
              { transform: "none" },
            ],
            { duration: 300, easing: "cubic-bezier(.2,.7,.2,1)" },
          );
        }),
    );
  }
  function compute(e: React.FormEvent) {
    e.preventDefault();
    if (s.done || selected?.kind !== "bin") return;
    if (!isLegalStep(s.tree, selected.id)) {
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
    const reduced = reduce(s.tree, selected.id);
    if (s.config.preserve && reduced.kind !== "num") {
      try {
        if (normalize(parse(s.nextLine)) !== normalize(reduced)) {
          error("retention");
          return;
        }
      } catch {
        error("retention");
        return;
      }
    }
    const before = new Map<string, DOMRect>();
    document
      .querySelectorAll<HTMLElement>(".expression-line [data-number]")
      .forEach((el) =>
        before.set(el.dataset.number!, el.getBoundingClientRect()),
      );
    const block = document.querySelector(`[data-block="${selected.id}"]`);
    if (block) before.set(selected.id, block.getBoundingClientRect());
    clearSelection();
    setFeedback({
      text: "✓ 这一部分已变成结果，其余部分保留。继续选下一步。",
      good: true,
    });
    completeIfReady({
      ...s,
      tree: reduced,
      undo: [...s.undo, snapshot()],
      redo: [],
      history: [...s.history, `${format(selected)}＝${value(selected)}`],
      selected: "",
      input: "",
      nextLine: "",
    });
    animateNumbers(before);
  }
  function hint() {
    const hints = s.hints + 1;
    patch({ hints });
    if (!merge && expected) {
      setHighlighted(legal.map((n) => n.id));
      setFeedback({
        text:
          legal.length > 1
            ? `高亮的${legal.length}个括号互不依赖，任选一个先算都对：${legal.map((n) => format(n)).join("、")}。`
            : hints === 1
              ? "先算括号里；没有括号时先乘除、后加减；同级从左往右。高亮的是当前可先算的部分。"
              : hints === 2
                ? `可以先算${format(expected)}。`
                : `${format(expected)}＝${value(expected)}。请你动手完成这一步。`,
        good: true,
      });
    } else if (merge) {
      if (pending) {
        setFeedback({
          text: bracketDecision(tree, pending.insertedId).reason,
          good: true,
        });
        return;
      }
      const target = sources(s.tree)[0],
        source = target && steps.find((t) => t.id === target.ref);
      if (source) {
        setActiveSource(source.id);
        setFeedback({
          text:
            hints === 1
              ? "找一张卡片，让它右边的结果和蓝色数字的来源编号对应。"
              : `把积木${source.index}“${format(source.expression)}＝${source.result}”拖到来源${source.index}的${source.result}上，再判断这一整块是否需要括号。`,
          good: true,
        });
      } else
        setFeedback({
          text: "来源已展开。检查这些积木的括号是否保护了原来的运算顺序。",
          good: true,
        });
    }
  }
  function chooseSource(id: string) {
    if (s.done || flying || pending) return;
    if (selected?.kind === "num" && selected.ref === id) {
      requestInsert(id, selected.id);
      return;
    }
    setActiveSource(id);
    patch({ selected: "" });
    setFeedback({
      text: "积木已选好，点击蓝色高亮的目标数字就能放入。",
      good: true,
    });
  }
  function requestInsert(source: string, target: string) {
    if (s.done || busy.current || pending) return;
    const number = find(s.tree, target);
    if (number?.kind !== "num" || number.ref !== source) {
      error(
        "source",
        "这不是这张积木的来源位置。结果即使相同，也要看来源编号。",
        action("source-wrong", source),
      );
      return;
    }
    void insert(source, target);
  }
  async function insert(source: string, target: string) {
    if (busy.current || s.done) return;
    const step = steps.find((t) => t.id === source);
    if (!step) return;
    const nextTree = substitute(s.tree, target, step, false);
    busy.current = true;
    setFlying(true);
    const card = document.querySelector(`[data-card="${source}"]`),
      number = document.querySelector(`[data-target="${target}"]`);
    if (
      motion &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      card &&
      number
    ) {
      const a = card.getBoundingClientRect(),
        b = number.getBoundingClientRect(),
        ghost = document.createElement("div");
      ghost.className = "flying-brick";
      ghost.textContent = format(find(nextTree, step.id)!);
      Object.assign(ghost.style, { left: a.left + "px", top: a.top + "px" });
      document.body.append(ghost);
      try {
        await Promise.all([
          ghost.animate(
            [
              { transform: "translate(0,0) scale(1)", opacity: 1 },
              {
                transform: `translate(${b.left - a.left}px,${b.top - a.top}px) scale(.8)`,
                opacity: 0.4,
              },
            ],
            { duration: 360, easing: "cubic-bezier(.2,.7,.2,1)" },
          ).finished,
          number.animate(
            [
              { transform: "scale(1)", opacity: 1 },
              { transform: "scale(.6)", opacity: 0 },
            ],
            { duration: 340 },
          ).finished,
        ]);
      } catch {
        /* Cancellation leaves the committed expression unchanged. */
      } finally {
        ghost.remove();
      }
    }
    if (!mounted.current) return;
    busy.current = false;
    setFlying(false);
    clearSelection();
    setInserted(step.id);
    setFeedback({
      text: "✓ 来源找对了！高亮的整块已经展开。这里需要加括号吗？",
      good: true,
    });
    update({
      ...s,
      tree: nextTree,
      undo: [...s.undo, snapshot()],
      redo: [],
      selected: "",
      input: "",
      nextLine: "",
      pendingBracket: { insertedId: step.id },
      actions: [...(s.actions || []), action("source-correct", source)],
    });
  }
  function chooseBracket(add: boolean) {
    if (!pending || s.done || flying) return;
    const { required, reason } = bracketDecision(tree, pending.insertedId);
    if (required && !add) {
      error(
        "missing-bracket",
        `再想一想！不加括号会改变原来的运算顺序。${reason}请你重新选择。`,
        action("bracket-missing", pending.insertedId),
      );
      return;
    }
    const part = find(tree, pending.insertedId)!;
    if (part.kind !== "bin") return;
    const confirmed = replace(tree, part.id, { ...part, bracket: add });
    clearSelection();
    setInserted(part.id);
    const message = required
      ? `判断正确！${reason}`
      : add
        ? "这样也对，不过这里的括号可以省略，不写更简洁！这不是数学错误，不扣星。"
        : `判断正确！这里不需要括号。${reason}`;
    setFeedback({ text: message, good: true });
    completeIfReady({
      ...s,
      tree: confirmed,
      pendingBracket: undefined,
      history: [
        ...s.history,
        `${format(confirmed, false)}＝${s.question.answer}`,
      ],
      actions: [
        ...(s.actions || []),
        action(
          required
            ? "bracket-required"
            : add
              ? "bracket-extra"
              : "bracket-omitted",
          part.id,
        ),
      ],
    });
    // Completion must not erase the educational feedback (especially optional brackets).
    setFeedback({ text: message, good: true });
  }
  function travel(direction: "undo" | "redo") {
    if (flying) return;
    const stack = direction === "undo" ? s.undo : s.redo || [];
    if (!stack.length) return;
    const frame = stack[stack.length - 1];
    clearSelection();
    const candidate = {
      ...s,
      tree: frame.tree,
      history: frame.history,
      pendingBracket: frame.pendingBracket,
      selected: "",
      input: "",
      nextLine: "",
      done: false,
      saved: false,
      stars: 0,
      undo:
        direction === "undo" ? s.undo.slice(0, -1) : [...s.undo, snapshot()],
      redo:
        direction === "redo"
          ? (s.redo || []).slice(0, -1)
          : [...(s.redo || []), snapshot()],
    };
    setFeedback({
      text:
        direction === "undo"
          ? "已撤销这一步，算式和计算记录都已恢复。"
          : "已重做这一步。",
      good: true,
    });
    completeIfReady(candidate);
  }
  function reset() {
    clearSelection();
    setShowAnswer(false);
    patch({
      tree: merge
        ? structuredClone(steps[steps.length - 1].expression)
        : structuredClone(s.question.original),
      undo: [...s.undo, snapshot()],
      redo: [],
      history: [],
      pendingBracket: undefined,
      selected: "",
      input: "",
      nextLine: "",
      done: false,
      saved: false,
      stars: 0,
    });
    setFeedback({
      text: "已回到本题起点。之前的尝试仍会保留，再来一次吧。",
      good: true,
    });
  }
  // A pre-upgrade session may already have every source inserted, but used a final check button.
  useEffect(() => {
    if (
      merge &&
      !pending &&
      !s.done &&
      !sources(s.tree).length &&
      checkMerge(tree, s.question.original).ok
    )
      completeIfReady({ ...s, tree });
  }, []);
  return (
    <section className={`training ${merge ? "merge-training" : ""}`}>
      <div className="training-heading">
        <div>
          <span className="eyebrow">
            第{s.question.level}关 ·{" "}
            {merge
              ? "自己判断括号"
              : s.config.mode === "guided"
                ? "引导训练"
                : "独立训练"}
          </span>
          <h1>{lessonNames[s.question.module]}</h1>
        </div>
        <button className="quiet" onClick={next} disabled={flying}>
          换一道题 ↻
        </button>
      </div>
      <div className="problem-strip">
        <span>{merge ? "任务" : "原题"}</span>
        <strong>
          {merge
            ? "把上面的算式积木拖下来，拼成一个综合算式！"
            : format(s.question.original)}
        </strong>
      </div>
      {merge && (
        <SourceBricks
          steps={steps}
          disabled={s.done || flying || !!pending}
          active={activeSource}
          onSelect={chooseSource}
          onHover={(source, target) => {
            setActiveSource(source);
            setHoverTarget(target);
          }}
          onDrop={requestInsert}
          onMiss={() =>
            setFeedback({
              text: "还没有放到数字上。靠近蓝色数字会吸附，也可以先点积木、再点数字。",
              good: false,
            })
          }
        />
      )}
      <div className="workspace">
        <div className="workspace-label">
          <span>{merge ? "综合算式拼装区" : "我的计算台"}</span>
          <span>
            {merge
              ? pending
                ? "请先确认这一块的括号"
                : `还有${sources(s.tree).length}块等待展开`
              : `${s.history.length}步已完成`}
          </span>
        </div>
        <div
          className={`expression-line ${s.done ? "finished" : ""}`}
          aria-label="当前算式"
        >
          <Expression
            node={tree}
            selected={s.selected}
            onSelect={select}
            merge={merge}
            automatic={!merge}
            steps={steps}
            highlighted={pending ? [pending.insertedId] : highlighted}
            activeSource={activeSource}
            hoverTarget={hoverTarget}
            interactiveOperators={!merge}
            inserted={inserted}
          />
          {merge && !pending && (
            <span className="answer-suffix">＝{s.question.answer}</span>
          )}
          {pending && <span className="pending-badge">待确认</span>}
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
                  {isLegalStep(s.tree, selected.id) &&
                  reduce(s.tree, selected.id).kind === "num"
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
        {!s.done && merge && pending && (
          <div className="merge-tools">
            <div className="bracket-choice">
              <strong>这里需要加括号吗？</strong>
              <button
                className="primary"
                onClick={() => chooseBracket(true)}
                disabled={flying}
              >
                需要加括号
              </button>
              <button onClick={() => chooseBracket(false)} disabled={flying}>
                不需要括号
              </button>
            </div>
          </div>
        )}
      </div>
      <div
        role="status"
        className={`coach ${feedback.good ? "" : "try-again"}`}
      >
        <span className="coach-face">{feedback.good ? "✦" : "?"}</span>
        <div>
          <small>当当老师小提示</small>
          <p>{feedback.text}</p>
        </div>
      </div>
      {s.done && (
        <div className="celebrate" role="status">
          <div className="reward-stars">
            {"★".repeat(s.stars)}
            {"☆".repeat(3 - s.stars)}
          </div>
          <h2>又解开一道数学机关！</h2>
          <p>
            {s.stars === 3
              ? "这次没有错误、没有使用提示，获得3颗星。"
              : "每一次认真尝试都有收获。"}{" "}
            星星只记录本次练习表现。
          </p>
          <button className="primary" onClick={next}>
            继续下一题 →
          </button>
          {s.question.level < 5 && (
            <button className="next-level" onClick={nextLevel}>
              前往下一关 →
            </button>
          )}
        </div>
      )}
      <div className="toolbar">
        <button onClick={hint} disabled={s.done || flying}>
          ✦ 查看提示
        </button>
        <button
          disabled={!s.undo.length || flying}
          onClick={() => travel("undo")}
        >
          ↶ 撤销上一步
        </button>
        <button
          disabled={!s.redo?.length || flying}
          onClick={() => travel("redo")}
        >
          ↷ 重做上一步
        </button>
        <button onClick={reset} disabled={flying}>
          重新开始
        </button>
        <button
          className="quiet"
          onClick={() => {
            if (!s.done) patch({ hints: Math.max(3, s.hints) });
            setShowAnswer(!showAnswer);
          }}
        >
          查看完整解析
        </button>
      </div>
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
          <p>上面是一种解法。互不依赖的括号可以交换先算顺序，同样正确。</p>
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
