import { CAPACITY, SCALE, clampTank, interpolateQuantity, ml, smooth } from './units';
import { pourFraction } from './beakerMath';
export type Mode = 'water' | 'cubes' | 'pour';
export type Focus = 'default' | 'front' | 'one' | 'grid';
export interface Animation { from: bigint; to: bigint; elapsed: number; duration: number; paused: boolean }
interface Common { conversion: bigint | null; animation: Animation | null }
export interface WaterState extends Common { volume: bigint; step: bigint }
export interface CubeState extends Common { count: number; speed: number; slice: number; slicing: boolean }
export interface PourState extends Common { cup: bigint; tank: bigint; amount: bigint }
export interface LabState { mode: Mode; water: WaterState; cubes: CubeState; pour: PourState; focus: Focus; focusVersion: number; knowledge: number | null }
export const initialWater = (): WaterState => ({ volume: ml(500), step: ml(100), conversion: null, animation: null });
export const initialCubes = (): CubeState => ({ count: 1, speed: 1, slice: 10, slicing: false, conversion: null, animation: null });
export const initialPour = (): PourState => ({ cup: CAPACITY, tank: 0n, amount: ml(250), conversion: null, animation: null });
export const initialState = (): LabState => ({ mode: 'water', water: initialWater(), cubes: initialCubes(), pour: initialPour(), focus: 'default', focusVersion: 0, knowledge: null });
export function quantity(s: LabState) { const m = s[s.mode]; return m.conversion ?? (s.mode === 'water' ? s.water.volume : s.mode === 'cubes' ? BigInt(s.cubes.count) * SCALE : s.pour.tank); }
export function conversionWarning(s: LabState): string | null {
  const q = s[s.mode].conversion;
  if (q === null) return null;
  if (q > CAPACITY) return '超出本实验水箱容量。换算结果保留，3D 模型保持原来的实际装入量。';
  if (s.mode === 'cubes' && q % SCALE !== 0n) return '换算结果可以是小数；整块装箱只接受整数个，3D 方块数量保持不变。';
  return null;
}
export type Action =
  | { type: 'mode'; mode: Mode }
  | { type: 'reset' }
  | { type: 'focus'; focus: Focus }
  | { type: 'quantity'; value: bigint }
  | { type: 'water-to'; value: bigint; animate: boolean; reduced?: boolean }
  | { type: 'water-step'; value: bigint }
  | { type: 'cubes'; count: number }
  | { type: 'start-cubes'; reduced?: boolean; to?: number }
  | { type: 'speed' }
  | { type: 'slice'; layer: number; enabled?: boolean }
  | { type: 'pour-amount'; value: bigint }
  | { type: 'start-pour'; reduced?: boolean }
  | { type: 'pause'; paused?: boolean }
  | { type: 'skip' }
  | { type: 'tick'; dt: number }
  | { type: 'knowledge'; id: number };
export function reducer(s: LabState, a: Action): LabState {
  switch (a.type) {
    case 'mode': {
      if (a.mode === s.mode) return s;
      const m = s[s.mode];
      return { ...s, [s.mode]: { ...m, animation: m.animation ? { ...m.animation, paused: true } : null }, mode: a.mode, focus: 'default', focusVersion: s.focusVersion + 1, knowledge: null };
    }
    case 'reset': return { ...s, [s.mode]: s.mode === 'water' ? initialWater() : s.mode === 'cubes' ? initialCubes() : initialPour(), focus: 'default', focusVersion: s.focusVersion + 1, knowledge: null };
    case 'focus': return { ...s, focus: a.focus, focusVersion: s.focusVersion + 1 };
    case 'quantity': {
      if (a.value < 0n) return s;
      if (a.value > CAPACITY || (s.mode === 'cubes' && a.value % SCALE !== 0n)) return { ...s, [s.mode]: { ...s[s.mode], conversion: a.value, animation: null } };
      if (s.mode === 'water') return { ...s, water: { ...s.water, volume: a.value, conversion: null, animation: null } };
      if (s.mode === 'cubes') return { ...s, cubes: { ...s.cubes, count: Number(a.value / SCALE), conversion: null, animation: null } };
      return { ...s, pour: { ...s.pour, tank: a.value, cup: CAPACITY - a.value, conversion: null, animation: null } };
    }
    case 'water-to': {
      const to = clampTank(a.value);
      return { ...s, water: { ...s.water, conversion: null, volume: !a.animate || a.reduced ? to : s.water.volume, animation: a.animate && !a.reduced && to !== s.water.volume ? { from: s.water.volume, to, elapsed: 0, duration: 1600 + Number(to > s.water.volume ? to - s.water.volume : s.water.volume - to) / Number(SCALE) * 1.3, paused: false } : null } };
    }
    case 'water-step': return { ...s, water: { ...s.water, step: clampTank(a.value) } };
    case 'cubes': return { ...s, cubes: { ...s.cubes, count: Math.max(0, Math.min(1000, Math.round(a.count))), animation: null, conversion: null } };
    case 'start-cubes': {
      const to = Math.max(1, Math.min(1000, Math.round(a.to ?? 1000)));
      const from = s.cubes.count >= to ? 0 : s.cubes.count;
      return { ...s, cubes: { ...s.cubes, count: a.reduced ? to : from, conversion: null, animation: a.reduced ? null : { from: BigInt(from), to: BigInt(to), elapsed: 0, duration: (to - from) * 10, paused: false } }, focus: 'grid', focusVersion: s.focusVersion + 1 };
    }
    case 'speed': return { ...s, cubes: { ...s.cubes, speed: s.cubes.speed === 4 ? 1 : s.cubes.speed * 2 } };
    case 'slice': return { ...s, cubes: { ...s.cubes, slice: Math.max(1, Math.min(10, Math.round(a.layer))), slicing: a.enabled ?? s.cubes.slicing } };
    case 'pour-amount': return { ...s, pour: { ...s.pour, amount: clampTank(a.value) } };
    case 'start-pour': {
      const amount = s.pour.amount < s.pour.cup ? s.pour.amount : s.pour.cup;
      if (amount <= 0n) return s;
      const to = s.pour.tank + amount;
      return { ...s, pour: { ...s.pour, conversion: null, tank: a.reduced ? to : s.pour.tank, cup: a.reduced ? CAPACITY - to : s.pour.cup, animation: a.reduced ? null : { from: s.pour.tank, to, elapsed: 0, duration: 3000 + Number(amount) / Number(SCALE) * 3, paused: false } } };
    }
    case 'pause': {
      const anim = s[s.mode].animation;
      return anim ? { ...s, [s.mode]: { ...s[s.mode], animation: { ...anim, paused: a.paused ?? !anim.paused } } } : s;
    }
    case 'skip': {
      const anim = s[s.mode].animation; if (!anim) return s;
      if (s.mode === 'water') return { ...s, water: { ...s.water, volume: anim.to, animation: null } };
      if (s.mode === 'cubes') return { ...s, cubes: { ...s.cubes, count: Number(anim.to), animation: null } };
      return { ...s, pour: { ...s.pour, tank: anim.to, cup: CAPACITY - anim.to, animation: null } };
    }
    case 'tick': {
      const anim = s[s.mode].animation;
      if (!anim || anim.paused || a.dt <= 0) return s;
      const elapsed = Math.min(anim.duration, anim.elapsed + Math.min(a.dt, 100) * (s.mode === 'cubes' ? s.cubes.speed : 1));
      const progress = elapsed / anim.duration, next = progress >= 1 ? null : { ...anim, elapsed };
      if (s.mode === 'water') return { ...s, water: { ...s.water, volume: interpolateQuantity(anim.from, anim.to, smooth(progress)), animation: next } };
      if (s.mode === 'cubes') return { ...s, cubes: { ...s.cubes, count: Math.round(Number(anim.from) + Number(anim.to - anim.from) * progress), animation: next } };
      const tank = interpolateQuantity(anim.from, anim.to, pourFraction(progress));
      return { ...s, pour: { ...s.pour, tank, cup: CAPACITY - tank, animation: next } };
    }
    case 'knowledge': {
      const base = reducer(s, { type: 'mode', mode: a.id === 2 ? 'cubes' : 'water' });
      if (a.id === 2) return { ...base, cubes: { ...base.cubes, count: 1000, slicing: false, conversion: null, animation: null }, focus: 'grid', focusVersion: base.focusVersion + 1, knowledge: 2 };
      return { ...base, water: { ...base.water, volume: a.id === 0 ? ml(1) : CAPACITY, conversion: null, animation: null }, focus: a.id === 0 ? 'one' : 'default', focusVersion: base.focusVersion + 1, knowledge: a.id };
    }
  }
}
