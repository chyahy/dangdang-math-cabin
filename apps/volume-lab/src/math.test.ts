import { describe, expect, it } from 'vitest';
import { CAPACITY, SCALE, UNITS, cubePosition, formatHeight, formatQuantity, heightCm, interpolateQuantity, ml, parseQuantity } from './units';
import { CUP_HEIGHT, CUP_RADIUS, cylinderVolumeBelow, liquidPlane, pourAngle, spillAngle } from './beakerMath';
import { conversionWarning, initialState, quantity, reducer, type LabState } from './state';
import { cupWaterGeometry } from './cupGeometry';
function finish(s: LabState) { for (let i = 0; i < 1000 && s[s.mode].animation; i++) s = reducer(s, { type: 'tick', dt: 100 }); return s; }
describe('exact four-unit conversion', () => {
  it('makes all four equivalences exact, including decimal litres', () => {
    expect(parseQuantity('1', 'mL')).toBe(parseQuantity('1', 'cm3'));
    expect(parseQuantity('1', 'L')).toBe(parseQuantity('1', 'dm3'));
    expect(parseQuantity('1', 'L')).toBe(parseQuantity('1000', 'mL'));
    expect(parseQuantity('0.3', 'L')).toBe(ml(300));
    expect(parseQuantity('.3', 'L')).toBe(ml(300)); expect(parseQuantity('0.3000000000', 'L')).toBe(ml(300));
    expect(formatQuantity(ml(500), 'L')).toBe('0.5');
    expect(formatQuantity(parseQuantity('0.1', 'mL'), 'L')).toBe('0.0001');
    expect(formatQuantity(parseQuantity('1000000000000'), 'L')).toBe('1000000000');
  });
  it('roundtrips 500 deterministic fractional quantities through all four units', () => {
    for (let i = 0; i < 500; i++) for (const unit of UNITS) {
      const value = BigInt(i) * 12_345_678n;
      expect(parseQuantity(formatQuantity(value, unit.id), unit.id)).toBe(value);
    }
  });
  it('rejects negative, non-finite, exponent, excessive precision and invalid text', () => {
    for (const input of ['-1', 'Infinity', 'NaN', '', '1e3', '2,000', '<script>', '0.1234567', '1000000000001']) expect(() => parseQuantity(input)).toThrow();
  });
});
describe('tank and instanced cubes use real centimetres', () => {
  it('uses height = mL / 100 with no minimum visible height', () => {
    expect(heightCm(ml(1))).toBe(.01); expect(heightCm(ml(100))).toBe(1); expect(heightCm(ml(500))).toBe(5); expect(heightCm(CAPACITY)).toBe(10); expect(heightCm(0n)).toBe(0);
    expect(heightCm(parseQuantity('0.001'))).toBe(.00001);
    expect(formatHeight(ml(1))).toBe('0.01'); expect(formatHeight(parseQuantity('0.3'))).toBe('0.003');
  });
  it('positions 1000 unit cubes without gaps, duplicates or out-of-bounds coordinates', () => {
    const positions = Array.from({ length: 1000 }, (_, i) => cubePosition(i));
    expect(new Set(positions.map(p => p.join(','))).size).toBe(1000);
    for (let layer = 0; layer < 10; layer++) expect(positions.filter(p => p[1] === layer + .5)).toHaveLength(100);
    for (const [x, y, z] of positions) { expect(x - .5).toBeGreaterThanOrEqual(-5); expect(x + .5).toBeLessThanOrEqual(5); expect(y - .5).toBeGreaterThanOrEqual(0); expect(y + .5).toBeLessThanOrEqual(10); expect(z - .5).toBeGreaterThanOrEqual(-5); expect(z + .5).toBeLessThanOrEqual(5); }
    expect(() => cubePosition(1000)).toThrow();
  });
  it('keeps fractional endpoints and monotonic animated water', () => {
    const from = parseQuantity('0.2'), to = parseQuantity('0.3'); let last = from;
    for (let i = 0; i <= 100; i++) { const q = interpolateQuantity(from, to, i / 100); expect(q).toBeGreaterThanOrEqual(last); last = q; }
    expect(last).toBe(to);
  });
});
describe('physical beaker geometry and gravity plane', () => {
  it('has an actual cylindrical capacity of 1000 cm³', () => expect(Math.PI * CUP_RADIUS ** 2 * CUP_HEIGHT).toBeCloseTo(1000, 10));
  it('inverts the analytic clipped-cylinder volume over different angles', () => {
    for (const degrees of [0, 10, 35, 55, 75, 88]) for (const volume of [.01, 1, 100, 250, 500, 999, 1000]) {
      const angle = degrees * Math.PI / 180, level = liquidPlane(volume, angle);
      expect(cylinderVolumeBelow(level, angle)).toBeCloseTo(volume, 6);
    }
  });
  it('computes a spill angle with exactly the requested liquid below the rim', () => {
    for (const remaining of [1, 50, 100, 250, 500, 750, 999]) {
      const angle = spillAngle(remaining), rim = CUP_HEIGHT * Math.cos(angle) - CUP_RADIUS * Math.sin(angle);
      expect(cylinderVolumeBelow(rim, angle)).toBeCloseTo(remaining, 6);
    }
  });
  it('keeps all rendered cup-water vertices inside the cylinder and below gravity level', () => {
    for (const volume of [1, 250, 500, 1000]) for (const angle of [0, .45, spillAngle(volume)]) {
      const g = cupWaterGeometry(volume, angle), p = g.getAttribute('position'), plane = liquidPlane(volume, angle);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        expect(Number.isFinite(x + y + z)).toBe(true); expect(x * x + z * z).toBeLessThanOrEqual(CUP_RADIUS ** 2 + .00001);
        expect(y).toBeGreaterThanOrEqual(-.00001); expect(y).toBeLessThanOrEqual(CUP_HEIGHT + .00001);
        expect(y * Math.cos(angle) - x * Math.sin(angle)).toBeLessThanOrEqual(plane + .00001);
      }
      g.dispose();
    }
  });
  it('returns upright after the transfer has completed', () => { expect(pourAngle(0, 750, 750, 500)).toBe(0); expect(pourAngle(1, 750, 500, 500)).toBe(0); });
});
describe('isolated modes, pause, skip, overflow and volume conservation', () => {
  it('does not overfill the tank when a conversion input exceeds capacity', () => {
    let s = reducer(initialState(), { type: 'quantity', value: ml(1200) });
    expect(quantity(s)).toBe(ml(1200)); expect(s.water.volume).toBe(ml(500)); expect(conversionWarning(s)).toContain('超出');
    s = reducer(s, { type: 'quantity', value: ml(300) }); expect(quantity(s)).toBe(ml(300)); expect(s.water.volume).toBe(ml(300));
  });
  it('does not create fractional cubes or change their count on conversion-only input', () => {
    let s = reducer(initialState(), { type: 'mode', mode: 'cubes' }); s = reducer(s, { type: 'quantity', value: parseQuantity('2.5') });
    expect(s.cubes.count).toBe(1); expect(quantity(s)).toBe(parseQuantity('2.5')); expect(conversionWarning(s)).toContain('整数');
  });
  it('fills and drains to exact endpoints, and supports pause and skip', () => {
    let s = reducer(initialState(), { type: 'water-to', value: CAPACITY, animate: true });
    s = reducer(s, { type: 'tick', dt: 100 }); const current = s.water.volume;
    s = reducer(s, { type: 'pause', paused: true }); s = reducer(s, { type: 'tick', dt: 100 }); expect(s.water.volume).toBe(current);
    s = reducer(s, { type: 'skip' }); expect(s.water.volume).toBe(CAPACITY);
    s = finish(reducer(s, { type: 'water-to', value: 0n, animate: true })); expect(s.water.volume).toBe(0n);
  });
  it('fills exactly 1000 cubes, slicing never removes packed cubes', () => {
    let s = reducer(initialState(), { type: 'mode', mode: 'cubes' }); s = finish(reducer(s, { type: 'start-cubes' })); expect(s.cubes.count).toBe(1000);
    s = reducer(s, { type: 'slice', layer: 3, enabled: true }); expect(s.cubes.count).toBe(1000); expect(s.cubes.slice).toBe(3);
    s = finish(reducer(s, { type: 'start-cubes', to: 500 })); expect(s.cubes.count).toBe(500);
  });
  it('conserves all 1000 mL on every animation frame and in repeated pours', () => {
    for (const amount of [100, 250, 500, 1000]) {
      let s = reducer(initialState(), { type: 'mode', mode: 'pour' });
      while (s.pour.cup > 0n) {
        s = reducer(s, { type: 'pour-amount', value: ml(amount) }); const oldTank = s.pour.tank;
        s = reducer(s, { type: 'start-pour' }); let previous = oldTank;
        for (let i = 0; i < 1000 && s.pour.animation; i++) {
          s = reducer(s, { type: 'tick', dt: 33 }); expect(s.pour.cup + s.pour.tank).toBe(CAPACITY); expect(s.pour.tank).toBeGreaterThanOrEqual(previous); previous = s.pour.tank;
          expect(s.pour.cup).toBeGreaterThanOrEqual(0n); expect(s.pour.tank).toBeLessThanOrEqual(CAPACITY);
        }
        expect(s.pour.tank).toBe(oldTank + (CAPACITY - oldTank < ml(amount) ? CAPACITY - oldTank : ml(amount)));
      }
      expect(s.pour.tank).toBe(CAPACITY);
    }
  });
  it('switches modes without changing other quantities, and pauses the old animation', () => {
    let s = reducer(initialState(), { type: 'water-to', value: ml(750), animate: true }); s = reducer(s, { type: 'tick', dt: 100 }); const water = s.water.volume;
    s = reducer(s, { type: 'mode', mode: 'pour' }); expect(s.water.animation?.paused).toBe(true);
    s = reducer(s, { type: 'quantity', value: ml(250) }); expect(s.pour.cup).toBe(ml(750));
    s = reducer(s, { type: 'mode', mode: 'cubes' }); s = reducer(s, { type: 'cubes', count: 123 });
    s = reducer(s, { type: 'reset' }); expect(s.water.volume).toBe(water); expect(s.pour.tank).toBe(ml(250)); expect(s.cubes.count).toBe(1);
  });
  it('knowledge cards pause inactive data and focus accurate objects', () => {
    let s = reducer(initialState(), { type: 'mode', mode: 'pour' }); s = reducer(s, { type: 'start-pour' }); s = reducer(s, { type: 'knowledge', id: 0 });
    expect(s.pour.animation?.paused).toBe(true); expect(s.water.volume).toBe(SCALE); expect(s.focus).toBe('one');
    s = reducer(s, { type: 'knowledge', id: 2 }); expect(s.cubes.count).toBe(1000); expect(s.mode).toBe('cubes');
  });
});
