import type { ErrorType, Expr } from "./engine";
import type { Module, Question } from "./generator";
export type Config = {
  module: Module;
  level: number;
  mode: "guided" | "independent";
  max: number;
  preserve: boolean;
};
export type Mistake = { type: ErrorType; step: string; at: number };
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
};
export type Session = {
  question: Question;
  config: Config;
  tree: Expr;
  undo: Expr[];
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
    return { ...empty, ...s, config: { ...defaultConfig, ...s.config } };
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
