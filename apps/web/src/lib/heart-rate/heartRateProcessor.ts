/**
 * Procesador PPG.
 * Entrada: brillo medio del canal rojo por cuadro + timestamp (ms).
 * Pipeline: remuestreo uniforme a 30 Hz → resta de media → band-pass 0.7–3.5 Hz (filtfilt)
 *           → inversión (más sangre = menos luz) → periodo dominante por autocorrelación
 *           → detección de picos (latidos) con distancia mínima adaptativa.
 */

export interface FrameColor { r: number; g: number; b: number }
export type FingerStatus = 'ok' | 'no_finger' | 'too_much_pressure';

export const COUNT_WINDOW_MS = 6000; // conteo de 6 segundos
export const MULTIPLIER = 10;        // 6" × 10 = 1 minuto

const MIN_BPM = 40;
const MAX_BPM = 210;
const FS = 30; // Hz de remuestreo

/** ¿Hay un dedo tapando la cámara + flash? (imagen roja, brillante, poco verde/azul) */
export function detectFinger(c: FrameColor, recentRed: number[]): FingerStatus {
  const redDominant = c.r > 90 && c.r > c.g * 1.6 && c.r > c.b * 1.6;
  if (!redDominant) return 'no_finger';
  // Saturado y plano = se aprieta demasiado (se corta la circulación)
  if (c.r > 250 && recentRed.length > 20 && std(recentRed.slice(-30)) < 0.05) return 'too_much_pressure';
  return 'ok';
}

export interface BeatCount {
  beats: number;          // latidos dentro de la ventana de 6"
  bpm: number;            // beats × 10
  beatTimes: number[];    // timestamps (ms) de cada latido contado
  ibiBpm: number | null;  // BPM según intervalos entre latidos (control de calidad)
  confidence: number;     // 0..1
}

export interface Snapshot {
  waveform: number[];   // señal filtrada normalizada (picos = latidos)
  beatTimes: number[];  // timestamps de todos los latidos detectados en el buffer
}

export class HeartRateProcessor {
  private t: number[] = [];
  private v: number[] = [];

  constructor(private bufferMs = 15000) {}

  reset() {
    this.t = [];
    this.v = [];
  }

  addSample(timestampMs: number, red: number) {
    const last = this.t[this.t.length - 1];
    if (last !== undefined && timestampMs <= last) return;
    this.t.push(timestampMs);
    this.v.push(red);
    const cutoff = timestampMs - this.bufferMs;
    while (this.t.length && this.t[0]! < cutoff) {
      this.t.shift();
      this.v.shift();
    }
  }

  get rawRed(): number[] {
    return this.v;
  }

  /** Señal filtrada + latidos detectados. */
  snapshot(): Snapshot {
    if (this.t.length < FS * 2) return { waveform: [], beatTimes: [] };
    const { t, v } = resample(this.t, this.v, FS);
    const m = mean(v);
    let x = v.map((s) => s - m);
    const f1 = MIN_BPM / 60;
    const f2 = MAX_BPM / 60;
    const f0 = Math.sqrt(f1 * f2);
    const c = bandpassCoeffs(FS, f0, f0 / (f2 - f1));
    x = filtfilt(filtfilt(x, c), c); // 2 etapas, sin desfase
    const sd = std(x) || 1;
    const y = x.map((s) => -s / sd);

    // Distancia mínima entre latidos: 60 % del periodo dominante (evita contar la muesca dicrótica)
    const period = dominantPeriod(y, FS);
    const minDist = period ? Math.round(period * 0.6) : Math.round((FS * 60) / MAX_BPM);
    const peaks = findPeaks(y, minDist, 0.3, Math.round(FS * 0.4));
    return { waveform: y, beatTimes: peaks.map((i) => t[i]!) };
  }

  /** Cuenta los latidos en [fromMs, fromMs + 6000) y calcula beats × 10. */
  countBeats(fromMs: number, toMs = fromMs + COUNT_WINDOW_MS): BeatCount {
    const all = this.snapshot().beatTimes;
    const inWindow = all.filter((x) => x >= fromMs && x < toMs);
    const beats = inWindow.length;
    const bpm = beats * MULTIPLIER;

    // Control de calidad: regularidad de los intervalos alrededor de la ventana
    const around = all.filter((x) => x >= fromMs - 2000 && x < toMs + 300);
    const ibis: number[] = [];
    for (let i = 1; i < around.length; i++) ibis.push(around[i]! - around[i - 1]!);
    if (ibis.length < 3) return { beats, bpm, beatTimes: inWindow, ibiBpm: null, confidence: 0 };

    const med = median(ibis);
    const kept = ibis.filter((d) => Math.abs(d - med) / med < 0.25);
    if (kept.length < 3) return { beats, bpm, beatTimes: inWindow, ibiBpm: null, confidence: 0 };

    const ibiBpm = 60000 / median(kept);
    const cv = std(kept) / mean(kept);
    let confidence = clamp((kept.length / ibis.length) * (1 - cv * 3), 0, 1);
    // El conteo × 10 tiene que coincidir (±12) con lo que dicen los intervalos
    if (Math.abs(bpm - ibiBpm) > 12) confidence *= 0.4;
    if (bpm < MIN_BPM || bpm > MAX_BPM) confidence = 0;

    return { beats, bpm, beatTimes: inWindow, ibiBpm: Math.round(ibiBpm), confidence };
  }
}

// ---------------- DSP ----------------

interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

function bandpassCoeffs(fs: number, f0: number, q: number): Biquad {
  // RBJ Audio EQ Cookbook — band-pass, 0 dB en el pico
  const w0 = (2 * Math.PI * f0) / fs;
  const alpha = Math.sin(w0) / (2 * q);
  const cosw = Math.cos(w0);
  const a0 = 1 + alpha;
  return { b0: alpha / a0, b1: 0, b2: -alpha / a0, a1: (-2 * cosw) / a0, a2: (1 - alpha) / a0 };
}

function biquad(x: number[], c: Biquad): number[] {
  const y = new Array<number>(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const out = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = out;
    y[i] = out;
  }
  return y;
}

function filtfilt(x: number[], c: Biquad): number[] {
  return biquad(biquad(x, c).reverse(), c).reverse();
}

function resample(t: number[], v: number[], fs: number): { t: number[]; v: number[] } {
  const ts: number[] = [];
  const out: number[] = [];
  const step = 1000 / fs;
  let j = 0;
  for (let ti = t[0]!; ti <= t[t.length - 1]!; ti += step) {
    while (j < t.length - 2 && t[j + 1]! < ti) j++;
    const t0 = t[j]!, t1 = t[j + 1]!;
    const a = t1 === t0 ? 0 : (ti - t0) / (t1 - t0);
    ts.push(ti);
    out.push(v[j]! + a * (v[j + 1]! - v[j]!));
  }
  return { t: ts, v: out };
}

/** Periodo dominante (en muestras) por autocorrelación, o null si no hay periodicidad clara. */
function dominantPeriod(y: number[], fs: number): number | null {
  const minLag = Math.floor((fs * 60) / MAX_BPM);
  const maxLag = Math.min(Math.ceil((fs * 60) / MIN_BPM), Math.floor(y.length / 2));
  if (maxLag <= minLag + 2) return null;
  const acf0 = y.reduce((s, v) => s + v * v, 0) / y.length || 1;
  const acf: number[] = [];
  for (let lag = 0; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < y.length; i++) s += y[i]! * y[i + lag]!;
    acf[lag] = s / (y.length - lag) / acf0;
  }
  let best = -Infinity;
  for (let l = minLag; l <= maxLag; l++) best = Math.max(best, acf[l]!);
  if (best < 0.3) return null;
  // Primer máximo local que llegue al 80 % del mejor (evita tomar 2× el periodo)
  for (let l = minLag + 1; l <= maxLag; l++) {
    if (acf[l]! > acf[l - 1]! && acf[l]! >= acf[l + 1]! && acf[l]! >= 0.8 * best) return l;
  }
  return null;
}

function findPeaks(y: number[], minDist: number, minHeight: number, edge: number): number[] {
  const peaks: number[] = [];
  for (let i = Math.max(1, edge); i < y.length - Math.max(1, edge); i++) {
    if (y[i]! > y[i - 1]! && y[i]! >= y[i + 1]! && y[i]! > minHeight) {
      const last = peaks[peaks.length - 1];
      if (last !== undefined && i - last < minDist) {
        if (y[i]! > y[last]!) peaks[peaks.length - 1] = i;
      } else {
        peaks.push(i);
      }
    }
  }
  return peaks;
}

export const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
export const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
export const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((p, q) => p - q);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k]! : (s[k - 1]! + s[k]!) / 2;
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
