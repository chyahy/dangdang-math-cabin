import type { BoardFile, Document, View } from "./model";
export const STORAGE_KEY = "dangdang-geometry-board-v1";
export const fileData = (document: Document, view: View): BoardFile => ({
  format: "dangdang-geometry",
  version: 1,
  document,
  view,
});
export function parseBoard(text: string): BoardFile {
  if (text.length > 4_000_000)
    throw new Error("文件过大，请导入4MB以内的画板JSON。");
  const file = JSON.parse(text);
  if (file?.format !== "dangdang-geometry" || file.version !== 1)
    throw new Error("这不是受支持的几何画板JSON文件。");
  const d = file.document;
  if (
    !d ||
    !Array.isArray(d.points) ||
    !Array.isArray(d.shapes) ||
    d.points.length > 3000 ||
    d.shapes.length > 3000
  )
    throw new Error("图形数据不完整或数量超限。");
  const ids = new Set<string>();
  for (const p of d.points) {
    if (
      typeof p.id !== "string" ||
      !p.id ||
      ids.has(p.id) ||
      typeof p.label !== "string" ||
      p.label.length > 32 ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      Math.abs(p.x) > 1e6 ||
      Math.abs(p.y) > 1e6
    )
      throw new Error("点的编号、名称或坐标不合法。");
    ids.add(p.id);
  }
  const shapeIds = new Set<string>();
  for (const s of d.shapes) {
    if (
      typeof s.id !== "string" ||
      !s.id ||
      shapeIds.has(s.id) ||
      !["segment", "polygon"].includes(s.kind) ||
      !Array.isArray(s.vertices) ||
      new Set(s.vertices).size !== s.vertices.length ||
      s.vertices.some((id: string) => !ids.has(id)) ||
      (s.kind === "segment" ? s.vertices.length !== 2 : s.vertices.length < 3)
    )
      throw new Error("图形顶点或来源引用不合法。");
    if (s.color && !/^#[0-9a-f]{6}$/i.test(s.color))
      throw new Error("图形颜色不合法。");
    shapeIds.add(s.id);
  }
  const v = file.view;
  if (
    !v ||
    !Number.isFinite(v.x) ||
    !Number.isFinite(v.y) ||
    !Number.isFinite(v.scale) ||
    v.scale < 8 ||
    v.scale > 500 ||
    Math.abs(v.x) > 1e6 ||
    Math.abs(v.y) > 1e6
  )
    throw new Error("画布视图参数不合法。");
  // Whitelist persisted data. Ignore unrelated fields from imported files.
  return fileData(
    {
      points: d.points.map((p: any) => ({
        id: p.id,
        label: p.label,
        x: p.x,
        y: p.y,
      })),
      shapes: d.shapes.map((s: any) => ({
        id: s.id,
        kind: s.kind,
        vertices: s.vertices,
        color: s.color,
      })),
      ...(d.preset === "example5" ? { preset: "example5" as const } : {}),
    },
    { x: v.x, y: v.y, scale: v.scale },
  );
}
export function loadLocal(): BoardFile | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? parseBoard(text) : null;
  } catch {
    return null;
  }
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportPNG(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement,
    box = svg.getBoundingClientRect();
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(box.width));
  clone.setAttribute("height", String(box.height));
  clone.querySelectorAll("[data-no-export]").forEach((n) => n.remove());
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml;charset=utf-8",
    }),
    url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(2, 4096 / Math.max(box.width, box.height));
    canvas.width = Math.round(box.width * scale);
    canvas.height = Math.round(box.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器不支持PNG导出");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("图片导出失败"))),
        "image/png",
      ),
    );
    download(png, "当当老师-几何画板.png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
