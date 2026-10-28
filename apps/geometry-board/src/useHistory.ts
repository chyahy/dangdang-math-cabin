import { useRef, useState } from "react";
import type { Document } from "./model";
export function useHistory(initial: Document) {
  const [doc, setDoc] = useState(initial),
    [past, setPast] = useState<Document[]>([]),
    [future, setFuture] = useState<Document[]>([]);
  const current = useRef(doc),
    transaction = useRef<Document | null>(null);
  function preview(next: Document) {
    current.current = next;
    setDoc(next);
  }
  function commit(next: Document) {
    const before = transaction.current || current.current;
    transaction.current = null;
    if (JSON.stringify(before) !== JSON.stringify(next)) {
      setPast((p) => [...p.slice(-99), structuredClone(before)]);
      setFuture([]);
    }
    preview(next);
  }
  function begin() {
    transaction.current = structuredClone(current.current);
  }
  function end() {
    if (transaction.current) commit(current.current);
  }
  function cancel() {
    if (transaction.current) {
      preview(transaction.current);
      transaction.current = null;
    }
  }
  function undo() {
    cancel();
    if (!past.length) return;
    const previous = past.at(-1)!,
      before = structuredClone(current.current);
    setFuture((f) => [...f, before]);
    setPast((p) => p.slice(0, -1));
    preview(structuredClone(previous));
  }
  function redo() {
    cancel();
    if (!future.length) return;
    const next = future.at(-1)!,
      before = structuredClone(current.current);
    setPast((p) => [...p, before]);
    setFuture((f) => f.slice(0, -1));
    preview(structuredClone(next));
  }
  return {
    doc,
    current,
    commit,
    preview,
    begin,
    end,
    cancel,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
