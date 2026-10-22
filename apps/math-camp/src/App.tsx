import { useEffect, useState } from "react";
import { errorNames, initialMerge, type ErrorType } from "./engine";
import {
  generate,
  lessonNames,
  levels,
  type Module,
  type Question,
} from "./generator";
import {
  beep,
  load,
  persist,
  stats,
  mergeStats,
  type Config,
  type RecordItem,
  type Saved,
  type Session,
} from "./storage";
import { Training } from "./Training";
type Page = "home" | "mode" | "levels" | "train" | "review" | "report";
const descriptions: Record<Module, string[]> = {
  mixed: [
    "两次运算，先乘除后加减",
    "带括号的两步运算",
    "乘除同级，从左往右",
    "从最里面的括号出发",
    "3—5步综合混合运算",
  ],
  merge: [
    "把两个算式拼起来",
    "追溯三个算式的来源",
    "减号后面为什么要括号",
    "除号后面的括号机关",
    "分析两条计算分支",
  ],
  split: [
    "拆出两个计算步骤",
    "把括号里的计算写出来",
    "保持同级运算的顺序",
    "拆解多层括号",
    "完成一条完整的计算链",
  ],
};
export function App() {
  const [saved, setSaved] = useState<Saved>(load),
    [page, setPage] = useState<Page>("home"),
    [storageOK, setStorageOK] = useState(true),
    [freeLevels, setFreeLevels] = useState(false);
  const [filter, setFilter] = useState<ErrorType | "all">("all");
  const config = saved.config,
    s = saved.current,
    summary = stats(saved.records);
  useEffect(() => {
    setStorageOK(persist(saved));
  }, [saved]);
  useEffect(() => {
    document.documentElement.dataset.motion = saved.motion ? "on" : "off";
  }, [saved.motion]);
  function changeConfig(p: Partial<Config>) {
    setSaved((v) => ({ ...v, config: { ...v.config, ...p } }));
  }
  function go(p: Page) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function choose(module: Module) {
    changeConfig({ module, level: 1 });
    go("mode");
  }
  function start(question?: Question, customConfig?: Config) {
    const c = customConfig || config,
      q = question || generate(c.module, c.level, c.max);
    const session: Session = {
      question: q,
      config: c,
      tree:
        q.module === "merge"
          ? initialMerge(q.original)
          : structuredClone(q.original),
      undo: [],
      redo: [],
      history: [],
      errors: [],
      hints: 0,
      selected: "",
      input: "",
      nextLine: "",
      startedAt: Date.now(),
      done: false,
      stars: 0,
      saved: false,
      mergeFlow: 2,
      actions: [],
    };
    setSaved((v) => ({ ...v, config: c, current: session }));
    go("train");
  }
  function finish(session: Session) {
    if (session.saved) return;
    const detailed =
      session.hints >= 3 ||
      Object.keys(errorNames).some(
        (type) => session.errors.filter((e) => e.type === type).length >= 3,
      );
    const stars = detailed
      ? 1
      : session.hints > 0 || session.errors.length > 0
        ? 2
        : 3;
    const r: RecordItem = {
      id: session.question.id,
      module: session.question.module,
      level: session.question.level,
      text: session.question.text,
      correct: session.errors.length === 0 && session.hints === 0,
      hints: session.hints,
      stars,
      errors: session.errors,
      duration: Math.max(
        1,
        Math.round((Date.now() - session.startedAt) / 1000),
      ),
      endedAt: Date.now(),
      question: session.question,
      actions: session.actions,
    };
    setSaved((v) => ({
      ...v,
      current: { ...session, done: true, stars, saved: true },
      records: v.records.some((item) => item.id === r.id)
        ? v.records.map((item) => (item.id === r.id ? r : item))
        : [...v.records, r],
    }));
    beep(saved.sound);
  }
  const grouped = Object.entries(errorNames)
    .map(([type, name]) => ({
      type: type as ErrorType,
      name,
      count: saved.records.reduce(
        (count, r) => count + r.errors.filter((e) => e.type === type).length,
        0,
      ),
    }))
    .sort((a, b) => b.count - a.count);
  const review = saved.records.filter(
    (r) =>
      r.errors.length &&
      (filter === "all" || r.errors.some((e) => e.type === filter)),
  );
  const mergeSummary = mergeStats(saved.records);
  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => go("home")}
          aria-label="返回训练大厅"
        >
          <span className="brand-symbol">
            ×<i>＋</i>
          </span>
          <span>
            <strong>数学思维训练营</strong>
            <small>当当老师小课堂</small>
          </span>
        </button>
        <nav aria-label="主导航">
          <button
            className={page === "home" ? "nav-on" : ""}
            onClick={() => go("home")}
          >
            训练大厅
          </button>
          <button
            className={page === "review" ? "nav-on" : ""}
            onClick={() => go("review")}
          >
            错题练习
          </button>
          <button
            className={page === "report" ? "nav-on" : ""}
            onClick={() => go("report")}
          >
            学习报告
          </button>
        </nav>
        <a className="cabin-link" href="../">
          ↗ 回到小屋
        </a>
      </header>
      <main>
        {!storageOK && (
          <p className="storage-warning" role="alert">
            当前浏览器无法保存记录。你仍能练习，但关闭页面后进度可能丢失。
          </p>
        )}
        {page !== "home" && page !== "train" && (
          <button
            className="back"
            onClick={() => go(page === "levels" ? "mode" : "home")}
          >
            ← 返回{page === "levels" ? "模式选择" : "训练大厅"}
          </button>
        )}
        {page === "home" && (
          <>
            <section className="hero">
              <div>
                <span className="eyebrow">把思考的每一步，看得见</span>
                <h1>
                  数学思维
                  <span>
                    训练营<span className="tiny-star">✦</span>
                  </span>
                </h1>
                <p>动动脑筋，数学其实很有趣！</p>
                <div className="hero-note">
                  <span>✓</span> 自己动手算 · 用积木拼算式 · 看见自己的进步
                </div>
              </div>
              <div
                className="hero-bricks"
                aria-label="算式积木示例：先12加8，再乘3"
              >
                <div className="brick-caption">小算式，也有大机关</div>
                <div className="brick-row">
                  <b className="brick blue">12</b>
                  <b className="brick yellow">＋</b>
                  <b className="brick blue">8</b>
                </div>
                <div className="brick-arrow">↓ 这一块是 20</div>
                <div className="brick-row">
                  <b className="brick outline">(12＋8)</b>
                  <b className="brick yellow">×</b>
                  <b className="brick blue">3</b>
                </div>
                <span className="hero-stamp">
                  想明白
                  <br />
                  再动手
                </span>
              </div>
            </section>
            {s && !s.done && (
              <div className="resume">
                <div>
                  <strong>还有一道题，等你接着想</strong>
                  <p>
                    {lessonNames[s.question.module]} · 第{s.question.level}关 ·{" "}
                    {s.question.text}
                  </p>
                </div>
                <button className="primary" onClick={() => go("train")}>
                  继续上次训练 →
                </button>
              </div>
            )}
            <section className="doors" aria-label="训练入口">
              <article className="door mixed-door">
                <div className="door-visual">
                  <span className="tile">18</span>
                  <span className="tile yellow">＋</span>
                  <span className="tile">6×3</span>
                  <small>先算哪一块？</small>
                </div>
                <span className="eyebrow">运算顺序 × 计算准确</span>
                <h2>混合运算大挑战</h2>
                <p>
                  先算什么？后算什么？
                  <br />
                  一步步成为运算高手！
                </p>
                <button className="primary" onClick={() => choose("mixed")}>
                  开始闯关 <span>→</span>
                </button>
              </article>
              <article className="door merge-door">
                <div className="door-visual">
                  <span className="tile amber">12＋8</span>
                  <span className="join-arrow">↘</span>
                  <span className="tile">20×3</span>
                  <small>找到数字的来处</small>
                </div>
                <span className="eyebrow">来源追溯 × 括号拼装</span>
                <h2>算式合成大师</h2>
                <p>
                  把几个算式变成一个，
                  <br />
                  挑战你的数学思维！
                </p>
                <button
                  className="primary amber-button"
                  onClick={() => choose("merge")}
                >
                  开始合成 <span>→</span>
                </button>
                <button className="split-link" onClick={() => choose("split")}>
                  反过来练：把综合算式拆开 ↗
                </button>
              </article>
            </section>
            <section className="progress-panel">
              <div className="section-title">
                <h2>我的成长脚印</h2>
                <button className="quiet" onClick={() => go("report")}>
                  查看报告 ↗
                </button>
              </div>
              <div className="stats">
                {[
                  [summary.today, "今日完成题数"],
                  [summary.correct, "累计独立答对"],
                  [summary.streak, "连续独立答对"],
                  [summary.stars, "已获得星星"],
                ].map(([n, label]) => (
                  <div key={label}>
                    <strong>
                      {n}
                      <small>{label === "已获得星星" ? " ★" : ""}</small>
                    </strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="recent">
                最近一次：
                {saved.records.length
                  ? `${new Date(saved.records.at(-1)!.endedAt).toLocaleDateString("zh-CN")} · ${lessonNames[saved.records.at(-1)!.module]} · ${saved.records.at(-1)!.stars}颗星`
                  : "还没有练习记录，从你感兴趣的一关开始吧。"}
              </p>
            </section>
          </>
        )}
        {page === "mode" && (
          <section className="setup">
            <span className="eyebrow">准备出发</span>
            <h1>{lessonNames[config.module]}</h1>
            <p className="lead">选一种节奏，把每一步想清楚。</p>
            <div className="mode-grid">
              {[
                ["guided", "引导模式", "选对先算的部分，就能看到确认提示。"],
                ["independent", "独立模式", "先自己选、自己算，提交后再检查。"],
              ].map(([mode, title, desc]) => (
                <button
                  className={`choice ${config.mode === mode ? "active" : ""}`}
                  key={mode}
                  onClick={() => changeConfig({ mode: mode as Config["mode"] })}
                >
                  <span className="choice-check">
                    {config.mode === mode ? "✓" : "○"}
                  </span>
                  <strong>{title}</strong>
                  <p>{desc}</p>
                </button>
              ))}
            </div>
            <div className="settings-row">
              {config.module === "merge" && (
                <p className="merge-mode-note">
                  拖动积木 → 展开数字 →
                  自己判断括号。可省略的括号多写了也不扣星。
                </p>
              )}
              <label>
                原始数字上限
                <input
                  aria-label="原始数字上限"
                  type="number"
                  min="10"
                  max="500"
                  value={config.max}
                  onChange={(e) =>
                    changeConfig({ max: e.target.valueAsNumber || 10 })
                  }
                  onBlur={() =>
                    changeConfig({
                      max: Math.min(500, Math.max(10, config.max)),
                    })
                  }
                />
                <small>10—500，中间结果可能更大</small>
              </label>
              {config.module !== "merge" && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={config.preserve}
                    onChange={(e) =>
                      changeConfig({ preserve: e.target.checked })
                    }
                  />
                  加练：自己填写下一行完整算式
                </label>
              )}
            </div>
            <button className="primary large" onClick={() => go("levels")}>
              选择关卡 →
            </button>
          </section>
        )}
        {page === "levels" && (
          <section className="setup">
            <span className="eyebrow">{lessonNames[config.module]}</span>
            <h1>今天，走到哪一站？</h1>
            <p className="lead">完成一关后，下一站就会点亮。</p>
            <label className="check-label teacher-switch">
              <input
                type="checkbox"
                checked={freeLevels}
                onChange={(e) => setFreeLevels(e.target.checked)}
              />
              课堂演示：自由选择所有关卡
            </label>
            <div className="level-map">
              {levels.map((name, i) => {
                const stars = saved.records
                  .filter(
                    (r) => r.module === config.module && r.level === i + 1,
                  )
                  .reduce((m, r) => Math.max(m, r.stars), 0);
                const unlocked =
                  freeLevels ||
                  i === 0 ||
                  saved.records.some(
                    (r) => r.module === config.module && r.level >= i,
                  );
                return (
                  <button
                    key={name}
                    disabled={!unlocked}
                    className={`level-card ${stars ? "level-passed" : ""}`}
                    onClick={() =>
                      start(undefined, { ...config, level: i + 1 })
                    }
                  >
                    <span className="level-number">
                      {unlocked ? i + 1 : "锁"}
                    </span>
                    <div>
                      <strong>{name}</strong>
                      <p>{descriptions[config.module][i]}</p>
                      <small>
                        {stars
                          ? "★".repeat(stars)
                          : unlocked
                            ? "准备好就出发"
                            : "先完成前一关"}
                      </small>
                    </div>
                    <span>→</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        {page === "train" && s && (
          <>
            <div className="session-nav">
              <button className="back" onClick={() => go("home")}>
                ← 保存进度，回大厅
              </button>
              <span>
                {s.done ? "本题已完成" : "本题进度自动保存在这台设备"}
              </span>
            </div>
            <Training
              key={s.question.id}
              session={s}
              update={(current) => setSaved((v) => ({ ...v, current }))}
              finish={finish}
              next={() => start(undefined, s.config)}
              nextLevel={() =>
                start(undefined, {
                  ...s.config,
                  level: Math.min(5, s.config.level + 1),
                })
              }
              motion={saved.motion}
            />
          </>
        )}
        {page === "review" && (
          <section className="report">
            <span className="eyebrow">再想一次，就近一步</span>
            <h1>错题练习</h1>
            <p className="lead">按真实的错误原因，找到该加强的地方。</p>
            <div className="filters">
              <button
                className={filter === "all" ? "filter-on" : ""}
                onClick={() => setFilter("all")}
              >
                全部
              </button>
              {grouped
                .filter((g) => g.count)
                .map((g) => (
                  <button
                    className={filter === g.type ? "filter-on" : ""}
                    key={g.type}
                    onClick={() => setFilter(g.type)}
                  >
                    {g.name} · {g.count}
                  </button>
                ))}
            </div>
            {review.length ? (
              review
                .slice()
                .reverse()
                .map((r) => (
                  <article className="review-row" key={r.id}>
                    <div>
                      <small>
                        {lessonNames[r.module]} · 第{r.level}关
                      </small>
                      <h3>{r.text}</h3>
                      <p>
                        {[
                          ...new Set(r.errors.map((e) => errorNames[e.type])),
                        ].join(" / ")}
                      </p>
                    </div>
                    <div className="review-actions">
                      <button
                        onClick={() =>
                          start(
                            {
                              ...r.question,
                              id: `retry-${Date.now()}-${Math.random()}`,
                            },
                            {
                              ...config,
                              module: r.module,
                              level: r.level,
                              mode: "guided",
                            },
                          )
                        }
                      >
                        重练原题
                      </button>
                      <button
                        className="primary"
                        onClick={() =>
                          start(undefined, {
                            ...config,
                            module: r.module,
                            level: r.level,
                            mode: "guided",
                            preserve: r.errors.some(
                              (e) => e.type === "retention",
                            ),
                          })
                        }
                      >
                        练同类新题 →
                      </button>
                    </div>
                  </article>
                ))
            ) : (
              <div className="empty">
                <strong>这里还没有错题</strong>
                <p>完成训练后，需要再练的题会自动出现在这里。</p>
                <button className="primary" onClick={() => choose("mixed")}>
                  去练一题 →
                </button>
              </div>
            )}
          </section>
        )}
        {page === "report" && (
          <section className="report">
            <span className="eyebrow">只和昨天的自己比</span>
            <h1>学习报告</h1>
            <div className="stats report-stats">
              {[
                [summary.today, "今日完成"],
                [saved.records.length, "累计完成"],
                [summary.correct, "独立答对"],
                [summary.stars, "获得星星"],
              ].map(([n, l]) => (
                <div key={l}>
                  <strong>{n}</strong>
                  <span>{l}</span>
                </div>
              ))}
            </div>
            <div className="report-columns">
              <article className="report-card merge-report">
                <h2>积木替换与括号判断</h2>
                <p>
                  积木来源：放对{mergeSummary.sourceCorrect}次，放错
                  {mergeSummary.sourceWrong}次。
                </p>
                <p>
                  括号判断：正确{mergeSummary.bracketCorrect}次，遗漏必要括号
                  {mergeSummary.bracketMissing}次。
                </p>
                <p>
                  其中，可省略括号多写了{mergeSummary.optionalExtra}
                  次：只提醒书写简洁，不计数学错误、不扣星。
                </p>
                <small>
                  只统计已完成题目的真实操作；撤销、重做不虚增次数。旧版没有记录的操作不作推算。遗漏必要括号单独记录，运算顺序类错误见下方。
                </small>
              </article>
              <article className="report-card">
                <h2>哪些地方还可以再练？</h2>
                {grouped.map((g) => (
                  <div className="skill-row" key={g.type}>
                    <span>{g.name}</span>
                    <div className="skill-track">
                      <span
                        style={{
                          width: `${Math.min(100, (g.count / Math.max(1, ...grouped.map((g) => g.count))) * 100)}%`,
                        }}
                      />
                    </div>
                    <strong>{g.count}次</strong>
                  </div>
                ))}
                <p className="coach-recommend">
                  {saved.records.length
                    ? grouped[0].count
                      ? `建议：下一次重点练习“${grouped[0].name}”。点击错题练习，可以直接找到对应题目。`
                      : "这几次完成得很稳，试试下一关吧。"
                    : "完成第一道题后，这里会根据真实记录给出建议。"}
                </p>
              </article>
              <article className="report-card">
                <h2>最近的练习</h2>
                {saved.records.length ? (
                  saved.records
                    .slice(-8)
                    .reverse()
                    .map((r) => (
                      <div className="record" key={r.id}>
                        <div>
                          <strong>{r.text}</strong>
                          <small>
                            {lessonNames[r.module]} · {r.duration}秒 · 提示
                            {r.hints}次 · 尝试错误{r.errors.length}次
                          </small>
                        </div>
                        <span>{"★".repeat(r.stars)}</span>
                      </div>
                    ))
                ) : (
                  <p className="empty-note">
                    暂无记录。每道题完成后，会记录用时、提示次数和计算过程。
                  </p>
                )}
              </article>
            </div>
            <p className="muted">
              “独立答对”指完成时没有错误、没有使用提示。记录仅保存在当前浏览器，不会上传，也不会跨设备同步。
            </p>
          </section>
        )}
      </main>
      <footer>
        <span>当当老师 · 让每一次思考都有迹可循</span>
        <div>
          <label>
            <input
              type="checkbox"
              checked={saved.sound}
              onChange={(e) =>
                setSaved((v) => ({ ...v, sound: e.target.checked }))
              }
            />
            音效
          </label>
          <label>
            <input
              type="checkbox"
              checked={saved.motion}
              onChange={(e) =>
                setSaved((v) => ({ ...v, motion: e.target.checked }))
              }
            />
            动画
          </label>
        </div>
      </footer>
    </div>
  );
}
