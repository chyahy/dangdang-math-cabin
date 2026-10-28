import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { degrees, distance, nearestPoint, toWorld, zoomAt } from "./geometry";
import type { Document, Rotation, Size, Tool, Vec, View } from "./model";
type Options = {
  svg: RefObject<SVGSVGElement | null>;
  doc: RefObject<Document>;
  size: Size;
  view: View;
  setView: (v: View) => void;
  tool: Tool;
  draft: Rotation | null;
  cursor: (v: Vec) => void;
  selectPoint: (id: string) => void;
  click: (world: Vec, pointId?: string, shapeId?: string) => void;
  setAngle: (n: number) => void;
  fitPreview: () => void;
  begin: () => void;
  preview: (d: Document) => void;
  end: () => void;
  cancel: () => void;
};
type Gesture = {
  type: "click" | "point" | "pan" | "rotate" | "pinch";
  start: Vec;
  view: View;
  id?: string;
  point?: Vec;
  shapeId?: string;
  moved: boolean;
  previous?: number;
  angle?: number;
  distance?: number;
  anchor?: Vec;
};
export function useBoardInteraction(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const pointers = useRef(new Map<number, Vec>()),
    gesture = useRef<Gesture | null>(null),
    space = useRef(false);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = latest.current.svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const middle = (values: Vec[]) => ({
    x: (values[0].x + values[1].x) / 2,
    y: (values[0].y + values[1].y) / 2,
  });
  useEffect(() => {
    const svg = options.svg.current;
    if (!svg) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (gesture.current) return;
      const p = latest.current;
      p.setView(
        zoomAt(
          p.view,
          p.size,
          local(e),
          p.view.scale * Math.exp(-e.deltaY * 0.0015),
        ),
      );
    };
    const down = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !(e.target as HTMLElement).closest("input,textarea,select,button")
      ) {
        space.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") space.current = false;
    };
    const blur = () => {
      space.current = false;
      pointers.current.clear();
      gesture.current = null;
      latest.current.cancel();
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      svg.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button > 2) return;
    e.preventDefault();
    const p = latest.current,
      s = local(e);
    pointers.current.set(e.pointerId, s);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointers.current.size >= 2) {
      p.cancel();
      const values = [...pointers.current.values()],
        mid = middle(values);
      gesture.current = {
        type: "pinch",
        start: mid,
        view: p.view,
        moved: true,
        distance: Math.max(1, distance(values[0], values[1])),
        anchor: toWorld(mid, p.view, p.size),
      };
      return;
    }
    const world = toWorld(s, p.view, p.size),
      point = nearestPoint(p.doc.current.points, world, p.view.scale);
    const el = e.target as Element,
      shapeId =
        el.closest("[data-shape]")?.getAttribute("data-shape") || undefined;
    if (el.closest("[data-rotation-handle]") && p.draft) {
      gesture.current = {
        type: "rotate",
        start: s,
        view: p.view,
        moved: false,
        previous: Math.atan2(
          world.y - p.draft.center.y,
          world.x - p.draft.center.x,
        ),
        angle: p.draft.angle,
      };
      return;
    }
    if (
      e.button === 1 ||
      e.button === 2 ||
      space.current ||
      p.tool === "pan" ||
      (p.tool === "select" && !point && !shapeId)
    ) {
      gesture.current = { type: "pan", start: s, view: p.view, moved: false };
      return;
    }
    if (!p.draft && p.tool === "select" && point) {
      p.selectPoint(point.id);
      p.begin();
      gesture.current = {
        type: "point",
        id: point.id,
        point: { ...point },
        start: s,
        view: p.view,
        moved: false,
      };
      return;
    }
    gesture.current = {
      type: "click",
      start: s,
      view: p.view,
      id: point?.id,
      shapeId,
      moved: false,
    };
  }
  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const p = latest.current,
      s = local(e),
      world = toWorld(s, p.view, p.size);
    p.cursor(world);
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, s);
    const g = gesture.current;
    if (!g) return;
    if (distance(s, g.start) > 4) g.moved = true;
    if (g.type === "pinch" && pointers.current.size >= 2) {
      const vs = [...pointers.current.values()],
        mid = middle(vs),
        scale = Math.max(
          8,
          Math.min(500, (g.view.scale * distance(vs[0], vs[1])) / g.distance!),
        );
      p.setView({
        scale,
        x: g.anchor!.x - (mid.x - p.size.width / 2) / scale,
        y: g.anchor!.y + (mid.y - p.size.height / 2) / scale,
      });
      return;
    }
    if (g.type === "pan")
      p.setView({
        ...g.view,
        x: g.view.x - (s.x - g.start.x) / g.view.scale,
        y: g.view.y + (s.y - g.start.y) / g.view.scale,
      });
    if (g.type === "point" && g.point) {
      p.preview({
        ...p.doc.current,
        points: p.doc.current.points.map((q) =>
          q.id === g.id
            ? {
                ...q,
                x: g.point!.x + (s.x - g.start.x) / g.view.scale,
                y: g.point!.y - (s.y - g.start.y) / g.view.scale,
              }
            : q,
        ),
      });
    }
    if (g.type === "rotate" && p.draft) {
      const next = Math.atan2(
        world.y - p.draft.center.y,
        world.x - p.draft.center.x,
      );
      let delta = next - g.previous!;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      g.angle = Math.max(-360, Math.min(360, g.angle! + degrees(delta)));
      g.previous = next;
      p.setAngle(
        e.shiftKey
          ? Math.round(g.angle / 15) * 15
          : Math.round(g.angle * 10) / 10,
      );
    }
  }
  function finish(e: ReactPointerEvent<SVGSVGElement>, cancelled = false) {
    const p = latest.current,
      g = gesture.current;
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (g?.type === "point") {
      if (cancelled) p.cancel();
      else p.end();
    }
    if (g?.type === "rotate" && !cancelled) p.fitPreview();
    if (pointers.current.size) {
      const rest = [...pointers.current.values()][0];
      gesture.current = { type: "pan", start: rest, view: p.view, moved: true };
      return;
    }
    gesture.current = null;
    if (!cancelled && g?.type === "click" && !g.moved)
      p.click(toWorld(local(e), p.view, p.size), g.id, g.shapeId);
    if (!cancelled && g?.type === "pan" && !g.moved && p.tool === "select")
      p.click(toWorld(local(e), p.view, p.size));
  }
  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => finish(e),
    onPointerCancel: (e: ReactPointerEvent<SVGSVGElement>) => finish(e, true),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
