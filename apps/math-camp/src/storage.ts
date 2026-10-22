import { format, smartBrackets, type ErrorType, type Expr } from "./engine";
import type { Module, Question } from "./generator";
export type Config = {
  module: Module;
  level: number;
  mode: "guided" | "independent";
  max: number;
  preserve: boolean;
  smartBrackets?: boolean;
};
export type Mistake = { type: ErrorType; step: string; at: number };
export type MergeAction = {
  type:
    | "source-correct"
    | "source-wrong"
    | "bracket-required"
    | "bracket-omitted"
    | "bracket-extra"
    | "bracket-missing";
  stepId: string;
  at: number;
};
export type RecordItem = {
  id: string;
  module: Module;
  level: number;
  text: string;
  correct: boolean;
  hints: number;
  stars: number;
  errors: Mistake[];
  duration: number;
  endedAt: number;
  question: Question;
  actions?: MergeAction[];
};
export type Session = {
  question: Question;
  config: Config;
  tree: Expr;
  undo: Snapshot[];
  redo?: Snapshot[];
  history: string[];
  errors: Mistake[];
  hints: number;
  selected: string;
  input: string;
  nextLine: string;
  startedAt: number;
  done: boolean;
  stars: number;
  saved: boolean;
  pendingBracket?: { insertedId: string };
  actions?: MergeAction[];
  mergeFlow?: number;
};
export type Snapshot = {
  tree: Expr;
  history: string[];
  pendingBracket?: { insertedId: string };
};
export type Saved = {
  records: RecordItem[];
  current: Session | null;
  sound: boolean;
  motion: boolean;
  config: Config;
};
export const defaultConfig: Config = {
  module: "mixed",
  level: 1,
  mode: "guided",
  max: 100,
  preserve: false,
  smartBrackets: false, // Legacy preference retained for compatibility; merge now always asks.
};
const KEY = "dangdang-math-camp-v1";
export function load(): Saved {
  const empty: Saved = {
    records: [],
    current: null,
    sound: true,
    motion: true,
    config: defaultConfig,
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const s = JSON.parse(raw);
    if (!Array.isArray(s.records)) return empty;
    // Keep the same storage key and migrate in place: never discard prior progress.
    const migrateQuestion = (q: Question) => ({
      ...q,
      text: format(q.original),
    });
    const legacyMerge =
      s.current?.question.module === "merge" &&
      !s.current.pendingBracket &&
      s.current.mergeFlow !== 2;
    const migrateFrame = (f: Expr | Snapshot): Snapshot => {
      const frame = "tree" in f ? f : { tree: f, history: [] };
      return legacyMerge
        ? { ...frame, tree: smartBrackets(frame.tree) }
        : frame;
    };
    const current = s.current
      ? {
          ...s.current,
          // Upgrade only legacy merge sessions. New pending previews must survive reload literally.
          tree: legacyMerge ? smartBrackets(s.current.tree) : s.current.tree,
          mergeFlow: 2,
          question: migrateQuestion(s.current.question),
          config: { ...defaultConfig, ...s.current.config },
          undo: (s.current.undo || []).map(migrateFrame),
          redo: (s.current.redo || []).map(migrateFrame),
        }
      : null;
    return {
      ...empty,
      ...s,
      current,
      records: s.records.map((r: RecordItem) => ({
        ...r,
        text: format(r.question.original),
        question: migrateQuestion(r.question),
      })),
      config: { ...defaultConfig, ...s.config },
    };
  } catch {
    return empty;
  }
}
export function persist(s: Saved): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
export function dayKey(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
export function stats(records: RecordItem[]) {
  const today = records.filter((r) => dayKey(r.endedAt) === dayKey(Date.now()));
  let streak = 0;
  for (const r of [...records].reverse()) {
    if (!r.correct) break;
    streak++;
  }
  return {
    today: today.length,
    correct: records.filter((r) => r.correct).length,
    streak,
    stars: records.reduce((s, r) => s + r.stars, 0),
  };
}
export function mergeStats(records: RecordItem[]) {
  const actions = records
    .filter((r) => r.module === "merge")
    .flatMap((r) => r.actions || []);
  const count = (type: MergeAction["type"]) =>
    actions.filter((a) => a.type === type).length;
  return {
    sourceCorrect: count("source-correct"),
    sourceWrong: count("source-wrong"),
    bracketCorrect:
      count("bracket-required") +
      count("bracket-omitted") +
      count("bracket-extra"),
    bracketMissing: count("bracket-missing"),
    optionalExtra: count("bracket-extra"),
  };
}
export function beep(enabled: boolean) {
  if (!enabled) return;
  try {
    const audio = new AudioContext(),
      gain = audio.createGain();
    gain.gain.value = 0.055;
    gain.connect(audio.destination);
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const o = audio.createOscillator();
      o.frequency.value = freq;
      o.connect(gain);
      o.start(audio.currentTime + i * 0.07);
      o.stop(audio.currentTime + i * 0.07 + 0.09);
    });
    setTimeout(() => void audio.close(), 500);
  } catch {
    /* Muted browsers still show visual feedback. */
  }
}
