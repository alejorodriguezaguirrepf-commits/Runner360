/**
 * Procesador PPG.
 * Entrada: color medio (R, G, B) del centro de la imagen por cuadro + timestamp (ms). Se usa el canal
 * con el pulso más claro: con flash el rojo suele saturarse y el pulso se ve mejor en el verde; con
 * luz ambiente o de pantalla, en el rojo.
 * Pipeline: remuestreo uniforme a 30 Hz → resta de media → band-pass 0.7–3.5 Hz (filtfilt)
 *           → inversión (más sangre = menos luz) → periodo dominante por autocorrelación
 *           → detección de picos (latidos) con distancia mínima adaptativa.
 */

export interface FrameColor {
  r: number;
  g: number;
  b: number;
  /** Variación entre píxeles del recorte (opcional). Con el lente tapado por el dedo es baja. */
  spread?: number;
}
/** De dónde viene la luz que atraviesa el dedo. Sin flash la imagen es más oscura. */
export type LightSource = 'flash' | 'ambient' | 'screen';
export type FingerStatus = 'ok' | 'no_finger' | 'too_much_pressure';

export const COUNT_WINDOW_MS = 6000; // conteo de 6 segundos
export const MULTIPLIER = 10;        // 6" × 10 = 1 minuto

const MIN_BPM = 40;
const MAX_BPM = 210;
const FS = 30; // Hz de remuestreo

/**
 * ¿Hay un dedo tapando la cámara? Imagen roja y pareja (poco verde/azul, sin detalles). Con flash
 * tiene que ser brillante; con lámpara o pantalla alcanza con menos luz.
 */
export function detectFinger(c: FrameColor, recentRed: number[], light: LightSource = 'flash'): FingerStatus {
  const minRed = light === 'flash' ? 90 : light === 'ambient' ? 45 : 30;
  const ratio = light === 'flash' ? 1.6 : 1.35;
  const redDominant = c.r > minRed && c.r > c.g * ratio && c.r > c.b * ratio;
  if (!redDominant) return 'no_finger';
  // Una escena con detalles (no un lente tapado) tiene mucha variación entre píxeles.
  if (c.spread !== undefined && c.spread > 28) return 'no_finger';
  // Apretar demasiado corta la circulación: el dedo se pone pálido (mucho verde) y el rojo queda plano.
  // Con flash es normal que el rojo se sature en 255 con poco verde: ahí el pulso se lee en el verde.
  if (c.r > 250 && c.g > 120 && recentRed.length > 20 && std(recentRed.slice(-30)) < 0.05) return 'too_much_pressure';
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
  /** Qué tan periódica es la señal (0..1): cuanto más alto, más claro se ve el pulso. */
  quality: number;
  channel: 'r' | 'g' | 'b';
}

export class HeartRateProcessor {
  private t: number[] = [];
  private ch: Record<'r' | 'g' | 'b', number[]> = { r: [], g: [], b: [] };

  constructor(private bufferMs = 15000) {}

  reset() {
    this.t = [];
    this.ch = { r: [], g: [], b: [] };
  }

  /** Un cuadro: el color medio, o solo el rojo (número). */
  addSample(timestampMs: number, sample: number | FrameColor) {
    const last = this.t[this.t.length - 1];
    if (last !== undefined && timestampMs <= last) return;
    const c = typeof sample === 'number' ? { r: sample, g: NaN, b: NaN } : sample;
    this.t.push(timestampMs);
    this.ch.r.push(c.r);
    this.ch.g.push(c.g);
    this.ch.b.push(c.b);
    const cutoff = timestampMs - this.bufferMs;
    while (this.t.length && this.t[0]! < cutoff) {
      this.t.shift();
      this.ch.r.shift();
      this.ch.g.shift();
      this.ch.b.shift();
    }
  }

  get rawRed(): number[] {
    return this.ch.r;
  }

  /** Señal filtrada + latidos detectados, del canal con el pulso más claro. */
  snapshot(): Snapshot {
    if (this.t.length < FS * 2) return { waveform: [], beatTimes: [], quality: 0, channel: 'r' };
    let best: { y: number[]; t: number[]; acf: number; period: number | null; channel: 'r' | 'g' | 'b' } | null = null;
    for (const channel of ['r', 'g'] as const) {
      const raw = this.ch[channel];
      if (raw.some((x) => Number.isNaN(x))) continue;
      // Canal saturado o plano: no tiene pulso.
      if (mean(raw) > 250 || std(raw) < 0.02) continue;
      const f = filtered(this.t, raw);
      const { period, score } = dominantPeriod(f.y, FS);
      // El rojo tiene una pequeña ventaja: con luz que atraviesa el dedo es el canal natural.
      const adjusted = channel === 'r' ? score + 0.05 : score;
      if (!best || adjusted > best.acf) best = { ...f, acf: adjusted, period, channel };
    }
    if (!best) {
      const f = filtered(this.t, this.ch.r);
      const { period, score } = dominantPeriod(f.y, FS);
      best = { ...f, acf: score, period, channel: 'r' };
    }
    const { y, t, period } = best;
    // Distancia mínima entre latidos: 60 % del periodo dominante (evita contar la muesca dicrótica)
    const minDist = period ? Math.round(period * 0.6) : Math.round((FS * 60) / MAX_BPM);
    const peaks = findPeaks(y, minDist, 0.3, Math.round(FS * 0.4));
    return { waveform: y, beatTimes: peaks.map((i) => t[i]!), quality: clamp(best.acf, 0, 1), channel: best.channel };
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

/**
 * Remuestreo a 30 Hz, recorte de saltos bruscos (movimiento del dedo o cambios de luz), band-pass
 * 0.7–3.5 Hz sin desfase e inversión (más sangre = menos luz).
 */
function filtered(times: number[], raw: number[]): { t: number[]; y: number[] } {
  const { t, v: resampled } = resample(times, raw, FS);
  const v = clipJumps(resampled);
  const m = mean(v);
  let x = v.map((s) => s - m);
  const f1 = MIN_BPM / 60;
  const f2 = MAX_BPM / 60;
  const f0 = Math.sqrt(f1 * f2);
  const c = bandpassCoeffs(FS, f0, f0 / (f2 - f1));
  x = filtfilt(filtfilt(x, c), c); // 2 etapas, sin desfase
  const sd = std(x) || 1;
  return { t, y: x.map((s) => -s / sd) };
}

interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

/**
 * Un latido cambia el brillo de a poco; un movimiento o un cambio de luz, de golpe. Se limita cada
 * paso entre cuadros a 4 veces su variación típica (mediana de los pasos), sin tocar la forma del pulso.
 */
function clipJumps(v: number[]): number[] {
  if (v.length < 3) return v;
  const steps: number[] = [];
  for (let i = 1; i < v.length; i++) steps.push(v[i]! - v[i - 1]!);
  const mad = median(steps.map(Math.abs));
  if (mad === 0) return v;
  const limit = mad * 4;
  const out = [v[0]!];
  for (let i = 0; i < steps.length; i++) out.push(out[i]! + Math.max(-limit, Math.min(limit, steps[i]!)));
  return out;
}

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

/**
 * Periodo dominante (en muestras) por autocorrelación, o null si no hay periodicidad clara; y el
 * puntaje de periodicidad (0..1) para elegir el mejor canal y saber si la señal ya se asentó.
 */
function dominantPeriod(y: number[], fs: number): { period: number | null; score: number } {
  const minLag = Math.floor((fs * 60) / MAX_BPM);
  const maxLag = Math.min(Math.ceil((fs * 60) / MIN_BPM), Math.floor(y.length / 2));
  if (maxLag <= minLag + 2) return { period: null, score: 0 };
  const acf0 = y.reduce((s, v) => s + v * v, 0) / y.length || 1;
  const acf: number[] = [];
  for (let lag = 0; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < y.length; i++) s += y[i]! * y[i + lag]!;
    acf[lag] = s / (y.length - lag) / acf0;
  }
  let best = -Infinity;
  for (let l = minLag; l <= maxLag; l++) best = Math.max(best, acf[l]!);
  const score = Math.max(0, best);
  if (best < 0.3) return { period: null, score };
  // Primer máximo local que llegue al 80 % del mejor (evita tomar 2× el periodo)
  for (let l = minLag + 1; l <= maxLag; l++) {
    if (acf[l]! > acf[l - 1]! && acf[l]! >= acf[l + 1]! && acf[l]! >= 0.8 * best) return { period: l, score };
  }
  return { period: null, score };
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
