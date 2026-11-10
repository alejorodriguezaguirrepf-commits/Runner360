import { describe, it, expect } from 'vitest';
import { HeartRateProcessor, detectFinger } from '@/lib/heart-rate/heartRateProcessor';
import { MeasurementSession, type MeasureResult, type MeasureStatus } from '@/lib/heart-rate/measurementSession';

// PRNG con semilla para que los tests sean deterministas
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Señal PPG sintética: pulso con armónico + deriva lenta + ruido. */
function ppg(bpm: number, tMs: number, rand: () => number) {
  const f = bpm / 60, s = tMs / 1000;
  const pulse = Math.sin(2 * Math.PI * f * s) + 0.4 * Math.sin(4 * Math.PI * f * s);
  const drift = 3 * Math.sin(2 * Math.PI * 0.1 * s);
  return 200 - 2 * pulse + drift + (rand() - 0.5) * 0.6;
}

type Segment = { seconds: number; finger: boolean };

function run(bpm: number, segments: Segment[], seed = 1) {
  const rand = rng(seed);
  const results: MeasureResult[] = [];
  const statuses: MeasureStatus[] = [];
  const session = new MeasurementSession({
    onState: (s) => { if (statuses[statuses.length - 1] !== s.status) statuses.push(s.status); },
    onResult: (r) => results.push(r),
  });
  let t = 0;
  for (const seg of segments) {
    const frames = Math.round(seg.seconds * 30);
    for (let i = 0; i < frames; i++) {
      t += 1000 / 30 + (rand() - 0.5) * 6; // jitter de cuadros
      const color = seg.finger ? { r: ppg(bpm, t, rand), g: 40, b: 30 } : { r: 120, g: 110, b: 100 };
      session.pushFrame(t, color);
    }
  }
  return { results, statuses };
}

describe('Conteo 6" × 10', () => {
  it.each([60, 72, 90, 120, 150])('mide %i automáticamente (resultado = latidos × 10, ±10)', (bpm) => {
    const { results, statuses } = run(bpm, [{ seconds: 11, finger: true }]);
    expect(statuses).toEqual(['waitingFinger', 'stabilizing', 'counting', 'done']);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.bpm).toBe(r.beats * 10);
    expect(Math.abs(r.bpm - bpm)).toBeLessThanOrEqual(10);
  });

  it('sin dedo no mide nada', () => {
    const { results, statuses } = run(72, [{ seconds: 10, finger: false }]);
    expect(results).toHaveLength(0);
    expect(statuses).toEqual(['waitingFinger']);
  });

  it('si se saca el dedo durante el conteo, cancela y vuelve a esperar', () => {
    const { results, statuses } = run(72, [{ seconds: 5, finger: true }, { seconds: 2, finger: false }]);
    expect(results).toHaveLength(0);
    expect(statuses[statuses.length - 1]).toBe('waitingFinger');
  });

  it('levantar y volver a apoyar el dedo inicia otra medición sola', () => {
    const { results } = run(80, [
      { seconds: 11, finger: true },
      { seconds: 2, finger: false },
      { seconds: 11, finger: true },
    ]);
    expect(results).toHaveLength(2);
  });
});

describe('HeartRateProcessor.countBeats', () => {
  it('cuenta los latidos de una ventana de 6"', () => {
    const rand = rng(7);
    const p = new HeartRateProcessor();
    for (let t = 0; t < 10000; t += 1000 / 30) p.addSample(t, ppg(70, t, rand));
    const c = p.countBeats(3000); // ventana 3000–9000 ms
    expect(c.beats).toBeGreaterThanOrEqual(6);
    expect(c.beats).toBeLessThanOrEqual(8);
    expect(c.bpm).toBe(c.beats * 10);
    expect(c.confidence).toBeGreaterThan(0.5);
  });

  it('con ruido puro la confianza es baja', () => {
    const rand = rng(3);
    const p = new HeartRateProcessor();
    for (let t = 0; t < 10000; t += 1000 / 30) p.addSample(t, 200 + (rand() - 0.5) * 10);
    expect(p.countBeats(3000).confidence).toBeLessThan(0.5);
  });
});

describe('detectFinger', () => {
  it('detecta el dedo con rojo dominante', () => expect(detectFinger({ r: 200, g: 40, b: 30 }, [])).toBe('ok'));
  it('sin dedo con imagen normal', () => expect(detectFinger({ r: 120, g: 110, b: 100 }, [])).toBe('no_finger'));
});

describe('Flujo automático: casos límite', () => {
  it('90" sin dedo: pausa (la pantalla apaga cámara y flash)', () => {
    const { results, statuses } = run(72, [{ seconds: 92, finger: false }]);
    expect(results).toHaveLength(0);
    expect(statuses).toEqual(['waitingFinger', 'paused']);
  });

  it('señal inestable: recuenta sola 2 veces, no guarda y lo marca como de baja calidad', () => {
    const rand = rng(11);
    const results: MeasureResult[] = [];
    const retries: boolean[] = [];
    let last: { lowQuality: boolean; status: MeasureStatus } | null = null;
    const session = new MeasurementSession({
      onState: (s) => {
        if (s.status === 'counting' && s.retrying && retries[retries.length - 1] !== true) retries.push(true);
        if (s.status === 'counting' && !s.retrying) retries.push(false);
        last = { lowQuality: s.lowQuality, status: s.status };
      },
      onResult: (r) => results.push(r),
    });
    let t = 0;
    for (let i = 0; i < 30 * 26; i++) {
      t += 1000 / 30;
      session.pushFrame(t, { r: 200 + (rand() - 0.5) * 20, g: 40, b: 30 });
    }
    expect(results).toHaveLength(0);
    expect(last).toEqual({ lowQuality: true, status: 'done' });
  });
});
