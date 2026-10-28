import { useEffect, useRef, useState } from "react";
import { Board } from "./Board";
import {
  commitRotation,
  fitView,
  polygonArea,
  previewPoints,
  toScreen,
  zoomAt,
} from "./geometry";
import {
  deleteSelection,
  emptyDocument,
  nextLabel,
  objectName,
  selectedIds,
  uid,
  type Document,
  type Point,
  type Rotation,
  type Selection,
  type Size,
  type Tool,
  type Vec,
  type View,
} from "./model";
import {
  download,
  exportPNG,
  fileData,
  loadLocal,
  parseBoard,
  STORAGE_KEY,
} from "./persistence";
import { example5, exampleMeasurements } from "./preset";
import { useHistory } from "./useHistory";
const tools: { id: Tool; label: string; icon: string; key: string }[] = [
  { id: "select", label: "选择", icon: "↖", key: "V" },
  { id: "point", label: "点", icon: "•", key: "P" },
  { id: "segment", label: "线段", icon: "╱", key: "L" },
  { id: "triangle", label: "三角形", icon: "△", key: "T" },
  { id: "polygon", label: "多边形", icon: "⬠", key: "G" },
  { id: "vertices", label: "选顶点", icon: "⋮", key: "J" },
  { id: "rotate", label: "旋转", icon: "↻", key: "R" },
  { id: "pan", label: "平移", icon: "✥", key: "H" },
  { id: "delete", label: "删除", icon: "⌫", key: "Delete" },
];
const instructions: Record<Tool, string> = {
  select: "点击选中图形 · 拖动顶点调整 · 拖动空白处平移",
  point: "点击画布添加点；靠近已有点时会直接复用",
  segment: "依次点击两个点，可复用已有点，也可点击空白处建点",
  triangle: "依次点击三个不同的点，完成三角形",
  polygon: "依次点击顶点，最后点击起点闭合；也可按 Enter 完成",
  vertices: "依次点击已有顶点组成待旋转图形，再点“完成选择并旋转”",
  rotate: "点击一个已有点或画布空白处，指定旋转中心",
  pan: "拖动画布平移 · 滚轮缩放 · 双指平移与缩放",
  delete: "点击要删除的图形或顶点；删除顶点也会删除关联图形",
};
const number = (v: number) =>
  Number.isFinite(v) ? Number(v.toFixed(3)).toString() : "—";
export function App() {
  const [restored] = useState(loadLocal),
    h = useHistory(restored?.document || emptyDocument());
  const [view, setView] = useState<View>(
      restored?.view || { x: 0, y: 0, scale: 55 },
    ),
    [size, setSize] = useState<Size>({ width: 800, height: 600 });
  const [tool, setTool] = useState<Tool>("select"),
    [selection, setSelection] = useState<Selection>(null),
    [construction, setConstruction] = useState<string[]>([]);
  const [draft, setDraft] = useState<Rotation | null>(null),
    [copy, setCopy] = useState(true),
    [direction, setDirection] = useState<1 | -1>(1),
    [angleText, setAngleText] = useState("0");
  const [rotationRequested, setRotationRequested] = useState(false),
    [cursor, setCursor] = useState<Vec>({ x: 0, y: 0 });
  const [message, setMessage] = useState(
      restored
        ? "已恢复上次保存的本地画板。"
        : "先选择左侧工具开始绘图，或点击“加载例5”。",
    ),
    [failure, setFailure] = useState(false),
    [exporting, setExporting] = useState(false);
  const svg = useRef<SVGSVGElement>(null),
    surface = useRef<HTMLDivElement>(null),
    fileInput = useRef<HTMLInputElement>(null);
  const [savedSignature, setSavedSignature] = useState(
    restored ? JSON.stringify(restored.document) : "",
  );
  const doc = h.doc,
    ids = selectedIds(doc, selection),
    selectedPoints = ids
      .map((id) => doc.points.find((p) => p.id === id)!)
      .filter(Boolean);
  const measurements = doc.preset ? exampleMeasurements(doc) : null;
  const validAngle =
    angleText.trim() !== "" &&
    Number.isFinite(Number(angleText)) &&
    Math.abs(Number(angleText)) <= 360;
  function notify(text: string, bad = false) {
    setMessage(text);
    setFailure(bad);
  }
  useEffect(() => {
    const observer = new ResizeObserver(([e]) =>
      setSize({ width: e.contentRect.width, height: e.contentRect.height }),
    );
    if (surface.current) observer.observe(surface.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setConstruction((list) =>
      list.filter((id) => doc.points.some((p) => p.id === id)),
    );
    if (selection && ids.length === 0) setSelection(null);
  }, [doc]);
  function clearTransient() {
    h.cancel();
    setDraft(null);
    setConstruction([]);
    setSelection(null);
    setTool("select");
    setRotationRequested(false);
    setAngleText("0");
  }
  function newBoard() {
    clearTransient();
    h.commit(emptyDocument());
    setView({ x: 0, y: 0, scale: 55 });
    notify("已新建空白画板。可以撤销恢复原画板。");
  }
  function loadExample() {
    clearTransient();
    const next = example5();
    h.commit(next);
    setView(fitView(next.points, size));
    notify("已加载满足三个已知条件的例5图形。题目结论存在疑问，请看右侧说明。");
  }
  function startRotation(chosen = selection) {
    const vertices = selectedIds(h.current.current, chosen);
    if (vertices.length < 2) {
      setTool("vertices");
      setSelection({ kind: "vertices", ids: [] });
      setConstruction([]);
      setRotationRequested(true);
      notify("先依次点击已有顶点，组合一个待旋转图形。");
      return;
    }
    setSelection(chosen);
    setDraft(null);
    setTool("rotate");
    setConstruction([]);
    setRotationRequested(false);
    notify("现在点击旋转中心。可以选已有顶点，也可以选画布空白处。");
  }
  function setCenter(center: Vec, centerId?: string, chosen = selection) {
    const vertices = selectedIds(h.current.current, chosen),
      originals = vertices
        .map((id) => h.current.current.points.find((p) => p.id === id)!)
        .filter(Boolean)
        .map((p) => ({ ...p }));
    if (originals.length < 2) {
      notify("请先选择一个图形或至少两个顶点。", true);
      return;
    }
    setSelection(chosen);
    setDraft({
      originals,
      center: { ...center },
      centerId,
      angle: 0,
      kind: originals.length === 2 ? "segment" : "polygon",
    });
    setTool("select");
    setDirection(1);
    setAngleText("0");
    notify("拖动绿色手柄，或在右侧输入角度。橙色标记是旋转中心。");
  }
  function setAngle(n: number) {
    if (!Number.isFinite(n)) return;
    const angle = Math.max(-360, Math.min(360, n));
    if (angle !== 0) setDirection(angle > 0 ? 1 : -1);
    setAngleText(String(Math.abs(angle)));
    setDraft((d) => (d ? { ...d, angle } : d));
  }
  function fitPreview(rotation = draft) {
    if (!rotation) return;
    const points = previewPoints(rotation),
      outside = points.some((p) => {
        const q = toScreen(p, view, size);
        return (
          q.x < 35 ||
          q.y < 55 ||
          q.x > size.width - 35 ||
          q.y > size.height - 65
        );
      });
    if (outside)
      setView(fitView([...h.current.current.points, ...points], size));
  }
  function controlAngle(n: number) {
    setAngle(n);
    if (draft) fitPreview({ ...draft, angle: n });
  }
  function finishRotation() {
    if (!draft || !validAngle) {
      notify("请输入0到360之间的有效角度。", true);
      return;
    }
    const next = commitRotation(h.current.current, draft, copy);
    h.commit(next);
    setView(fitView(next.points, size));
    if (copy) setSelection({ kind: "shape", id: next.shapes.at(-1)!.id });
    setDraft(null);
    setTool("select");
    notify(
      copy
        ? "旋转副本已确认，原图保留。副本拥有独立顶点，可继续作辅助线。"
        : "原图旋转已确认，共享这些顶点的关联图形也已更新。",
    );
  }
  function cancelRotation() {
    setDraft(null);
    setTool("select");
    setRotationRequested(false);
    notify("本次旋转已取消，原图未改变，也没有留下临时对象。");
  }
  function chooseTool(next: Tool) {
    if (draft) {
      notify("请先确认或取消本次旋转，再切换绘图工具。", true);
      return;
    }
    setConstruction([]);
    setRotationRequested(false);
    if (next === "rotate") {
      startRotation();
      return;
    }
    setTool(next);
    if (next === "vertices") setSelection({ kind: "vertices", ids: [] });
    notify(instructions[next]);
  }
  function closePolygon(list = construction, nextDoc = h.current.current) {
    if (list.length < 3) {
      notify("多边形至少需要三个不同的顶点。", true);
      return;
    }
    const pts = list.map((id) => nextDoc.points.find((p) => p.id === id)!);
    if (polygonArea(pts) < 1e-8) {
      notify("这些点在同一条直线上，无法组成有面积的图形。", true);
      return;
    }
    const shape = {
      id: uid("s"),
      kind: "polygon" as const,
      vertices: [...list],
    };
    h.commit({ ...nextDoc, shapes: [...nextDoc.shapes, shape] });
    setConstruction([]);
    setSelection({ kind: "shape", id: shape.id });
    setTool("select");
    notify("图形已完成。点击“旋转”即可指定中心。");
  }
  function click(world: Vec, pointId?: string, shapeId?: string) {
    if (draft) return;
    const current = h.current.current;
    if (tool === "rotate") {
      const point = current.points.find((p) => p.id === pointId);
      setCenter(point || world, point?.id);
      return;
    }
    if (tool === "delete") {
      const chosen: Selection = pointId
        ? { kind: "point", id: pointId }
        : shapeId
          ? { kind: "shape", id: shapeId }
          : null;
      h.commit(deleteSelection(current, chosen));
      setSelection(null);
      notify(chosen ? "已删除，可撤销恢复。" : "请点击一个顶点或图形。");
      return;
    }
    if (tool === "vertices") {
      if (!pointId) {
        notify("请点击一个已有顶点，不需要重新画图。", true);
        return;
      }
      const old = selection?.kind === "vertices" ? selection.ids : [];
      setSelection({
        kind: "vertices",
        ids: old.includes(pointId)
          ? old.filter((id) => id !== pointId)
          : [...old, pointId],
      });
      return;
    }
    if (["point", "segment", "triangle", "polygon"].includes(tool)) {
      let next = current,
        id = pointId;
      if (!id) {
        const point: Point = {
          ...world,
          id: uid(),
          label: nextLabel(current.points),
        };
        id = point.id;
        next = { ...current, points: [...current.points, point] };
      }
      if (tool === "point") {
        h.commit(next);
        setSelection({ kind: "point", id });
        notify(
          pointId
            ? "已复用这个顶点，没有创建重复点。"
            : "点已添加。切换到线段或三角形工具连接它们。",
        );
        return;
      }
      if (
        tool === "polygon" &&
        construction[0] === id &&
        construction.length >= 3
      ) {
        closePolygon(construction, next);
        return;
      }
      if (construction.includes(id)) {
        notify("请选另一个顶点；多边形完成时可以点击起点闭合。", true);
        return;
      }
      const list = [...construction, id];
      if (tool === "segment" && list.length === 2) {
        const shape = {
          id: uid("s"),
          kind: "segment" as const,
          vertices: list,
        };
        h.commit({ ...next, shapes: [...next.shapes, shape] });
        setConstruction([]);
        setSelection({ kind: "shape", id: shape.id });
        notify("线段已添加。可继续绘制下一条线段。");
        return;
      }
      if (tool === "triangle" && list.length === 3) {
        closePolygon(list, next);
        return;
      }
      h.commit(next);
      setConstruction(list);
      notify(
        tool === "polygon" && list.length >= 3
          ? "继续添加顶点，或点击第一个点闭合。"
          : `已选择${list.length}个顶点，请点击下一个点。`,
      );
      return;
    }
    setSelection(
      pointId
        ? { kind: "point", id: pointId }
        : shapeId
          ? { kind: "shape", id: shapeId }
          : null,
    );
  }
  function remove() {
    if (draft) {
      notify("请先取消或确认旋转。", true);
      return;
    }
    if (!selection) {
      notify("请先选中要删除的图形或顶点。", true);
      return;
    }
    h.commit(deleteSelection(h.current.current, selection));
    setSelection(null);
    setConstruction([]);
    notify(
      selection.kind === "vertices"
        ? "已取消临时顶点组合，原有图形没有改变。"
        : "已删除所选内容，可撤销恢复。",
    );
  }
  function undo() {
    if (draft) {
      cancelRotation();
      return;
    }
    setConstruction([]);
    setSelection(null);
    setTool("select");
    h.undo();
    notify("已撤销。");
  }
  function redo() {
    if (draft) return;
    setConstruction([]);
    setSelection(null);
    h.redo();
    notify("已重做。");
  }
  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(fileData(h.current.current, view)),
      );
      setSavedSignature(JSON.stringify(h.current.current));
      notify(
        draft
          ? "原画板已保存；旋转预览尚未确认，不会写入文件。"
          : "已保存到此浏览器。换设备请使用JSON文件。",
      );
    } catch {
      notify("本地保存失败，可能是浏览器存储已满。请导出JSON备份。", true);
    }
  }
  async function png() {
    if (!svg.current) return;
    setExporting(true);
    try {
      await exportPNG(svg.current);
      notify("PNG已导出，包含当前可见图形。");
    } catch (e) {
      notify(`导出失败：${(e as Error).message}`, true);
    } finally {
      setExporting(false);
    }
  }
  async function importJSON(file: File) {
    try {
      if (file.size > 4_000_000) throw new Error("文件不能超过4MB。");
      const data = parseBoard(await file.text());
      clearTransient();
      h.commit(data.document);
      setView(data.view);
      notify("JSON画板已加载，可以继续编辑，也可以撤销导入。");
    } catch (e) {
      notify(`加载失败：${(e as Error).message}`, true);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (e.key === "Escape") {
        if (draft) cancelRotation();
        else {
          setConstruction([]);
          setRotationRequested(false);
          setTool("select");
          notify("已退出当前工具，已添加的点会保留。");
        }
        return;
      }
      if (e.key === "Enter" && tool === "polygon") {
        closePolygon();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
        return;
      }
      const t = tools.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
      if (t && !e.ctrlKey && !e.metaKey) chooseTool(t.id);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function shortcutTriangle() {
    if (!measurements) {
      notify("请先加载例5。", true);
      return;
    }
    setDraft(null);
    setSelection({ kind: "vertices", ids: ["ex-A", "ex-B", "ex-D"] });
    setConstruction([]);
    setTool("select");
    notify("已从四边形中选出△ABD，无需重新绘制三角形。");
  }
  function shortcutCenter() {
    if (!measurements) return;
    const chosen =
      ids.length >= 2
        ? selection
        : { kind: "vertices" as const, ids: ["ex-A", "ex-B", "ex-D"] };
    setCenter(measurements.d, measurements.d.id, chosen);
  }
  const centerLabel = draft
    ? draft.centerId
      ? doc.points.find((p) => p.id === draft.centerId)?.label
      : "O"
    : tool === "rotate"
      ? "请点击画布"
      : "尚未指定";
  return (
    <div className="studio flex flex-col h-dvh">
      <header className="topbar flex items-center justify-between gap-4">
        <div className="brand">
          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
            <path
              d="M5 25 13 5 27 25Z"
              fill="none"
              stroke="#2861ce"
              strokeWidth="2"
            />
            <circle cx="13" cy="5" r="3" fill="#008780" />
            <circle cx="5" cy="25" r="3" fill="#2861ce" />
            <circle cx="27" cy="25" r="3" fill="#dc8a2c" />
          </svg>
          <div>
            <h1>几何画板</h1>
            <small>当当老师 · 交互几何工作台</small>
          </div>
        </div>
        <nav
          className="top-actions flex items-center flex-wrap gap-2"
          aria-label="画板操作"
        >
          <a className="cabin-return" href="../">
            ← 回到小屋
          </a>
          <button onClick={newBoard}>＋ 新建画板</button>
          <button className="accent" onClick={loadExample}>
            加载例5
          </button>
          <span className="toolbar-rule" />
          <button onClick={save}>本地保存</button>
          <button onClick={undo} disabled={!draft && !h.canUndo} title="Ctrl+Z">
            ↶ 撤销
          </button>
          <button
            onClick={redo}
            disabled={!!draft || !h.canRedo}
            title="Ctrl+Shift+Z"
          >
            ↷ 重做
          </button>
          <button onClick={png} disabled={exporting}>
            {exporting ? "导出中…" : "导出PNG"}
          </button>
          <details className="file-menu">
            <summary>文件 ▾</summary>
            <div>
              <button
                onClick={() => {
                  download(
                    new Blob([JSON.stringify(fileData(doc, view), null, 2)], {
                      type: "application/json",
                    }),
                    "当当老师-几何画板.json",
                  );
                  notify("JSON已导出。旋转预览需确认后才写入文件。");
                }}
              >
                保存JSON
              </button>
              <button onClick={() => fileInput.current?.click()}>
                加载JSON
              </button>
              <button onClick={newBoard}>清空画布</button>
            </div>
          </details>
        </nav>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          aria-label="加载JSON文件"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void importJSON(f);
          }}
        />
      </header>
      <div className="workbench grid flex-1 min-h-0">
        <aside className="tool-rail" aria-label="绘图工具">
          {tools.map((t) => (
            <button
              key={t.id}
              className={`tool-button ${tool === t.id ? "active" : ""}`}
              aria-label={`${t.label}工具`}
              aria-pressed={tool === t.id}
              onClick={() => chooseTool(t.id)}
              title={`${t.label} · ${t.key}`}
            >
              <span aria-hidden="true">{t.icon}</span>
              <small>{t.label}</small>
            </button>
          ))}
          <span className="tool-rail-note">
            GEO
            <br />
            LAB
          </span>
        </aside>
        <section className="canvas-column flex flex-col min-h-0">
          <div className="canvas-toolbar flex items-center justify-between gap-2">
            <span>
              <i className={draft ? "live-dot" : "ready-dot"} />
              {draft
                ? "旋转预览"
                : tool === "rotate"
                  ? "选择旋转中心"
                  : tools.find((t) => t.id === tool)?.label}{" "}
              <span className="quiet">
                / {doc.points.length}个点 · {doc.shapes.length}个对象
              </span>
            </span>
            <span className="save-state">
              {savedSignature === JSON.stringify(doc)
                ? "本地已保存"
                : "未保存的画板"}
            </span>
          </div>
          <div ref={surface} className="canvas-surface flex-1 min-h-0">
            <Board
              svg={svg}
              doc={doc}
              docRef={h.current}
              size={size}
              view={view}
              selection={selection}
              tool={tool}
              construction={construction}
              cursor={cursor}
              draft={draft}
              copy={copy}
              setView={setView}
              setCursor={setCursor}
              selectPoint={(id) => setSelection({ kind: "point", id })}
              click={click}
              setAngle={setAngle}
              fitPreview={() => fitPreview()}
              begin={h.begin}
              preview={h.preview}
              end={h.end}
              cancel={h.cancel}
            />
            {!doc.points.length && (
              <div className="empty-canvas" aria-hidden="true">
                <span className="empty-glyph">△</span>
                <h2>从一个点开始</h2>
                <p>
                  选择「点」工具，点击画板。
                  <br />
                  也可以加载例5，直接探索旋转。
                </p>
              </div>
            )}
            <div className="canvas-help" data-no-export="true">
              {draft
                ? "蓝色：原图　绿色：旋转后　橙色：旋转中心"
                : instructions[tool]}
            </div>
            <div className="zoom-controls">
              <button
                aria-label="缩小画布"
                onClick={() =>
                  setView(
                    zoomAt(
                      view,
                      size,
                      { x: size.width / 2, y: size.height / 2 },
                      view.scale / 1.2,
                    ),
                  )
                }
              >
                −
              </button>
              <span>{Math.round((view.scale / 55) * 100)}%</span>
              <button
                aria-label="放大画布"
                onClick={() =>
                  setView(
                    zoomAt(
                      view,
                      size,
                      { x: size.width / 2, y: size.height / 2 },
                      view.scale * 1.2,
                    ),
                  )
                }
              >
                ＋
              </button>
              <button
                className="fit-button"
                onClick={() =>
                  setView(
                    fitView(
                      draft
                        ? [...doc.points, ...previewPoints(draft)]
                        : doc.points,
                      size,
                    ),
                  )
                }
              >
                完整显示
              </button>
            </div>
          </div>
          <div
            className={`status-line ${failure ? "error" : ""}`}
            role="status"
          >
            <span>{message}</span>
            <code>
              x {number(cursor.x)}　y {number(cursor.y)}
            </code>
          </div>
        </section>
        <aside className="inspector" aria-label="图形与旋转控制">
          <div className="panel-heading">
            <span>对象与变换</span>
            <small>数学坐标 · 逆时针为正</small>
          </div>
          <section className="panel-section">
            <label className="section-label">当前选中</label>
            <div className="selected-name" data-testid="selected-name">
              {ids.length ? objectName(doc, ids) : "尚未选择图形"}
            </div>
            {ids.length > 0 && (
              <div className="vertex-tags">
                {selectedPoints.map((pt) => (
                  <span key={pt.id}>
                    {pt.label}{" "}
                    <small>
                      ({number(pt.x)}, {number(pt.y)})
                    </small>
                  </span>
                ))}
              </div>
            )}
            {tool === "vertices" && (
              <>
                <p className="helper">
                  点选已有顶点，按点击顺序组成图形。再次点击可取消该顶点。
                </p>
                <button
                  className="primary w-full"
                  disabled={ids.length < 3}
                  onClick={() => startRotation(selection)}
                >
                  {rotationRequested ? "完成选择并指定中心" : "完成选择并旋转"}
                </button>
              </>
            )}
            {tool === "polygon" && construction.length >= 3 && (
              <button className="primary w-full" onClick={() => closePolygon()}>
                闭合多边形（Enter）
              </button>
            )}
            {!draft && tool !== "vertices" && (
              <button
                className="primary w-full"
                onClick={() => startRotation()}
              >
                ↻ {ids.length >= 2 ? "旋转所选图形" : "选择顶点并旋转"}
              </button>
            )}
            {ids.length > 0 && !draft && (
              <button className="text-danger" onClick={remove}>
                {selection?.kind === "vertices"
                  ? "取消顶点组合"
                  : `删除所选${selection?.kind === "point" ? "顶点及关联图形" : "对象"}`}
              </button>
            )}
          </section>
          <section
            className={`panel-section rotation-panel ${draft ? "is-live" : ""}`}
          >
            <div className="section-line">
              <h2>旋转</h2>
              <span className="small-badge">{draft ? "预览中" : "未开始"}</span>
            </div>
            <div className="center-row">
              <span>旋转中心</span>
              <strong>{centerLabel}</strong>
              {draft && (
                <button className="link-button" onClick={() => startRotation()}>
                  重选
                </button>
              )}
            </div>
            {draft && (
              <p className="coordinates">
                ({number(draft.center.x)}, {number(draft.center.y)})
              </p>
            )}
            <fieldset disabled={!draft}>
              <div className="direction-control">
                <button
                  className={direction === 1 ? "on" : ""}
                  aria-pressed={direction === 1}
                  onClick={() => {
                    setDirection(1);
                    if (draft) controlAngle(Math.abs(draft.angle));
                  }}
                >
                  ↺ 逆时针
                </button>
                <button
                  className={direction === -1 ? "on" : ""}
                  aria-pressed={direction === -1}
                  onClick={() => {
                    setDirection(-1);
                    if (draft) controlAngle(-Math.abs(draft.angle));
                  }}
                >
                  ↻ 顺时针
                </button>
              </div>
              <label className="angle-label" htmlFor="angle-input">
                旋转角度
              </label>
              <div className="angle-input-wrap">
                <input
                  id="angle-input"
                  type="number"
                  min="-360"
                  max="360"
                  step="0.1"
                  value={angleText}
                  onChange={(e) => {
                    const text = e.target.value;
                    setAngleText(text);
                    if (
                      text.trim() !== "" &&
                      Number.isFinite(Number(text)) &&
                      Math.abs(Number(text)) <= 360
                    ) {
                      const n = Number(text),
                        signed = n < 0 ? n : direction * n;
                      if (n < 0) setDirection(-1);
                      setDraft((d) => (d ? { ...d, angle: signed } : d));
                      if (draft) fitPreview({ ...draft, angle: signed });
                    }
                  }}
                  onBlur={() => {
                    if (!validAngle)
                      setAngleText(String(Math.abs(draft?.angle || 0)));
                  }}
                />
                <span>°</span>
              </div>
              <input
                className="angle-slider"
                aria-label="旋转角度滑块"
                type="range"
                min="0"
                max="360"
                step="1"
                value={Math.abs(draft?.angle || 0)}
                onChange={(e) =>
                  controlAngle(Number(e.target.value) * direction)
                }
              />
              <div className="range-labels">
                <span>0°</span>
                <span>180°</span>
                <span>360°</span>
              </div>
              <div className="angle-presets">
                {[30, 45, 60, 90, 180].map((angle) => (
                  <button
                    key={angle}
                    className={
                      Math.abs(draft?.angle || 0) === angle ? "on" : ""
                    }
                    onClick={() => controlAngle(angle * direction)}
                  >
                    {angle}°
                  </button>
                ))}
              </div>
              <label className="copy-switch">
                <span>
                  <strong>复制后旋转</strong>
                  <small>保留原图，创建独立顶点</small>
                </span>
                <input
                  aria-label="复制后旋转"
                  type="checkbox"
                  checked={copy}
                  onChange={(e) => setCopy(e.target.checked)}
                />
              </label>
              {!copy && (
                <p className="warning-note">
                  将移动原顶点，与这些点关联的其他图形也会更新。
                </p>
              )}
              <div className="confirm-row">
                <button
                  className="primary"
                  onClick={finishRotation}
                  disabled={!validAngle}
                >
                  确认旋转
                </button>
                <button onClick={cancelRotation}>取消</button>
              </div>
            </fieldset>
            {!draft && (
              <p className="helper">
                先选图形，再点击旋转工具与中心。也可以在四边形里点选三个顶点，无需重复绘图。
              </p>
            )}
            {draft && (
              <p className="helper">
                拖动画布上的绿色圆形手柄可旋转。按住 Shift
                吸附到15°。每次角度都相对本次初始位置。
              </p>
            )}
          </section>
          {doc.preset && (
            <section className="panel-section example-panel">
              <div className="section-line">
                <h2>例5 · 旋转探索</h2>
                <span className="small-badge">真实坐标</span>
              </div>
              <p className="problem-text">
                四边形 ABCD 中，∠ABC = 30°，∠ADC = 60°，AD = CD。
                <br />
                求证：BD² + AB² = BC²。
              </p>
              <div className="example-shortcuts">
                <button onClick={shortcutTriangle}>选择△ABD</button>
                <button onClick={shortcutCenter}>以D为旋转中心</button>
                <button
                  className="accent"
                  disabled={!draft}
                  onClick={() => {
                    controlAngle(-60);
                    requestAnimationFrame(() => {
                      if (innerWidth > 760)
                        document
                          .querySelector(".rotation-panel")
                          ?.scrollIntoView({
                            block: "nearest",
                            behavior: "instant",
                          });
                    });
                  }}
                >
                  旋转60°（顺时针）
                </button>
              </div>
              {measurements ? (
                <>
                  <div
                    className={`condition-state ${measurements.valid ? "valid" : "invalid"}`}
                  >
                    {measurements.valid
                      ? "✓ 当前三个已知条件均成立"
                      : "! 原图已改变，已知条件不再全部成立"}
                  </div>
                  <dl className="measurements">
                    <div>
                      <dt>∠ABC / ∠ADC</dt>
                      <dd>
                        {number(measurements.angleB)}° /{" "}
                        {number(measurements.angleD)}°
                      </dd>
                    </div>
                    <div>
                      <dt>AD / CD</dt>
                      <dd>
                        {number(measurements.ad)} / {number(measurements.cd)}
                      </dd>
                    </div>
                    <div>
                      <dt>BD² + AB²</dt>
                      <dd>{number(measurements.lhs)}</dd>
                    </div>
                    <div>
                      <dt>BC²</dt>
                      <dd>{number(measurements.rhs)}</dd>
                    </div>
                  </dl>
                  <p className="warning-note">
                    <strong>题干待核对</strong>
                    <br />
                    这三个条件不能保证所给结论。当前数值为{" "}
                    {number(measurements.lhs)} ≠ {number(measurements.rhs)}
                    。画板保留真实几何关系，不模拟证明成立。
                  </p>
                </>
              ) : (
                <p className="warning-note">
                  题目顶点已被删除，请重新加载例5。
                </p>
              )}
            </section>
          )}
          <section className="panel-section objects-panel">
            <div className="section-line">
              <h2>画板对象</h2>
              <small>{doc.shapes.length}</small>
            </div>
            {doc.shapes.length ? (
              doc.shapes.map((s) => (
                <button
                  key={s.id}
                  className={`object-row ${selection?.kind === "shape" && selection.id === s.id ? "on" : ""}`}
                  onClick={() => {
                    if (draft) {
                      notify("请先确认或取消旋转。", true);
                      return;
                    }
                    setSelection({ kind: "shape", id: s.id });
                    setTool("select");
                  }}
                >
                  <span style={{ color: s.color || "#2861ce" }}>
                    {s.kind === "segment" ? "╱" : "△"}
                  </span>
                  {objectName(doc, s.vertices)}
                  <small>{s.vertices.length}点</small>
                </button>
              ))
            ) : (
              <p className="helper">绘制的线段与多边形会出现在这里。</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
