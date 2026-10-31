/** Exact quantities: 1 mL = 1,000,000 integer micro-units. No binary float formatting. */
export const SCALE = 1_000_000n;
export const CAPACITY = 1000n * SCALE;
export type Unit = 'mL' | 'L' | 'cm3' | 'dm3';
export const UNITS: { id: Unit; name: string; symbol: string; factor: bigint; digits: number }[] = [
  { id: 'mL', name: '毫升', symbol: 'mL', factor: SCALE, digits: 6 },
  { id: 'L', name: '升', symbol: 'L', factor: 1000n * SCALE, digits: 9 },
  { id: 'cm3', name: '立方厘米', symbol: 'cm³', factor: SCALE, digits: 6 },
  { id: 'dm3', name: '立方分米', symbol: 'dm³', factor: 1000n * SCALE, digits: 9 },
];
export function parseQuantity(input: string, unit: Unit = 'mL'): bigint {
  let text = input.trim().replace(/。/g, '.');
  if (text.startsWith('.')) text = '0' + text;
  const info = UNITS.find(u => u.id === unit)!;
  if (!/^\d+(?:\.\d*)?$/.test(text)) throw new Error('请输入大于或等于 0 的数字。');
  const [whole, rawFraction = ''] = text.split('.');
  const integer = whole.replace(/^0+(?=\d)/, ''), fraction = rawFraction.replace(/0+$/, '');
  if (integer.length > 16 || fraction.length > info.digits) throw new Error(`最多支持 ${info.digits} 位小数。`);
  const value = BigInt(integer) * info.factor + BigInt((fraction + '0'.repeat(info.digits)).slice(0, info.digits));
  if (value > 1_000_000_000_000n * SCALE) throw new Error('本换算器最多支持 1 万亿毫升。');
  return value;
}
export function formatQuantity(value: bigint, unit: Unit = 'mL'): string {
  const { factor, digits } = UNITS.find(u => u.id === unit)!;
  const fraction = (value % factor).toString().padStart(digits, '0').replace(/0+$/, '');
  return `${value / factor}${fraction ? '.' + fraction : ''}`;
}
export const ml = (value: number) => BigInt(Math.round(value * 1_000_000));
export const inMl = (value: bigint) => Number(value) / Number(SCALE);
export const clampTank = (value: bigint) => value < 0n ? 0n : value > CAPACITY ? CAPACITY : value;
export const heightCm = (value: bigint) => inMl(clampTank(value)) / 100;
export function formatHeight(value: bigint): string {
  const factor = SCALE * 100n, fraction = (value % factor).toString().padStart(8, '0').replace(/0+$/, '');
  return `${value / factor}${fraction ? '.' + fraction : ''}`;
}
export const smooth = (p: number) => { p = Math.max(0, Math.min(1, p)); return p * p * (3 - 2 * p); };
/** Integer mL during motion keeps classroom readings stable; the endpoint retains exact decimals. */
export function interpolateQuantity(from: bigint, to: bigint, progress: number): bigint {
  if (progress >= 1) return to;
  if (progress <= 0) return from;
  const value = from + (to - from) * BigInt(Math.round(progress * 1_000_000)) / 1_000_000n;
  return from % SCALE === 0n && to % SCALE === 0n ? value / SCALE * SCALE : value;
}
export function cubePosition(index: number): [number, number, number] {
  if (!Number.isInteger(index) || index < 0 || index >= 1000) throw new Error('方块编号应为 0—999。');
  return [index % 10 - 4.5, Math.floor(index / 100) + .5, Math.floor(index / 10) % 10 - 4.5];
}
