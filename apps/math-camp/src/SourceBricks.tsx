import { useEffect, useRef } from "react";
import { format, type Step } from "./engine";
type Props = {
  steps: Step[];
  disabled: boolean;
  active: string;
  onSelect: (id: string) => void;
  onHover: (source: string, target: string) => void;
  onDrop: (source: string, target: string) => void;
  onMiss: () => void;
};
// A single Pointer Events path works for touch, pen and mouse. Click/keyboard is equivalent.
export function SourceBricks({
  steps,
  disabled,
  active,
  onSelect,
  onHover,
  onDrop,
  onMiss,
}: Props) {
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    pointer: number;
    moved: boolean;
    ghost: HTMLDivElement | null;
    target: string;
  } | null>(null);
  const scrollFrame = useRef(0);
  const suppressClick = useRef(false);
  function cleanup() {
    cancelAnimationFrame(scrollFrame.current);
    drag.current?.ghost?.remove();
    drag.current = null;
  }
  useEffect(() => {
    window.addEventListener("blur", cleanup);
    return () => {
      cleanup();
      window.removeEventListener("blur", cleanup);
    };
  }, []);
  function targetAt(x: number, y: number, source: string): HTMLElement | null {
    const direct = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-target]");
    if (direct) return direct;
    let nearest: HTMLElement | null = null,
      best = 44;
    document.querySelectorAll<HTMLElement>("[data-target]").forEach((el) => {
      if (el.dataset.source !== source) return;
      const b = el.getBoundingClientRect();
      const distance = Math.hypot(
        Math.max(b.left - x, 0, x - b.right),
        Math.max(b.top - y, 0, y - b.bottom),
      );
      if (distance < best) {
        best = distance;
        nearest = el;
      }
    });
    return nearest;
  }
  function autoScroll() {
    const d = drag.current;
    if (!d?.moved) return;
    const speed = d.lastY > innerHeight - 55 ? 12 : d.lastY < 65 ? -12 : 0;
    if (speed) {
      window.scrollBy(0, speed);
      const target = targetAt(d.lastX, d.lastY, d.id);
      d.target = target?.dataset.target || "";
      onHover(d.id, d.target);
    }
    scrollFrame.current = requestAnimationFrame(autoScroll);
  }
  return (
    <div className="source-cards" aria-label="分步算式积木">
      {steps.map((t) => (
        <button
          key={t.id}
          data-card={t.id}
          disabled={disabled}
          aria-pressed={active === t.id}
          className={`source-card tone-${t.index % 3} ${active === t.id ? "source-active" : ""}`}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            onSelect(t.id);
          }}
          onPointerDown={(e) => {
            if (e.button !== 0 || disabled) return;
            cleanup();
            suppressClick.current = false;
            drag.current = {
              id: t.id,
              x: e.clientX,
              y: e.clientY,
              lastX: e.clientX,
              lastY: e.clientY,
              pointer: e.pointerId,
              moved: false,
              ghost: null,
              target: "",
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.pointer !== e.pointerId || disabled) return;
            if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 7)
              return;
            d.lastX = e.clientX;
            d.lastY = e.clientY;
            if (!d.moved) {
              d.moved = true;
              suppressClick.current = true;
              d.ghost = document.createElement("div");
              d.ghost.className = "drag-preview";
              d.ghost.setAttribute("aria-hidden", "true");
              d.ghost.textContent = format(t.expression);
              document.body.append(d.ghost);
              e.currentTarget.classList.add("dragging");
              scrollFrame.current = requestAnimationFrame(autoScroll);
            }
            const target = targetAt(e.clientX, e.clientY, t.id);
            d.target = target?.dataset.target || "";
            onHover(t.id, d.target);
            if (d.ghost) {
              const b =
                target?.dataset.source === t.id
                  ? target.getBoundingClientRect()
                  : null;
              d.ghost.classList.toggle("snapping", !!b);
              d.ghost.style.left =
                (b ? b.left + b.width / 2 : e.clientX) + "px";
              d.ghost.style.top =
                (b ? b.top + b.height / 2 : e.clientY - 25) + "px";
            }
            e.preventDefault();
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            e.currentTarget.classList.remove("dragging");
            if (!d || d.pointer !== e.pointerId) return;
            const moved = d.moved,
              target = moved
                ? targetAt(e.clientX, e.clientY, t.id)?.dataset.target
                : "";
            cleanup();
            onHover("", "");
            if (moved) {
              if (target) onDrop(t.id, target);
              else onMiss();
            }
          }}
          onPointerCancel={(e) => {
            cleanup();
            e.currentTarget.classList.remove("dragging");
            onHover("", "");
          }}
          onLostPointerCapture={(e) => {
            if (drag.current?.pointer === e.pointerId) {
              cleanup();
              e.currentTarget.classList.remove("dragging");
              onHover("", "");
            }
          }}
        >
          <span className="card-index">积木 {t.index}</span>
          <strong>
            {format(t.expression)}＝<span>{t.result}</span>
          </strong>
          <small>拖到来源{t.index}的数字上 · 也可点击</small>
        </button>
      ))}
    </div>
  );
}
