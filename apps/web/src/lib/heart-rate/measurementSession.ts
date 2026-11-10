import { HeartRateProcessor, detectFinger, COUNT_WINDOW_MS, type FrameColor, type FingerStatus, type LightSource } from './heartRateProcessor';

/** Texto que acompaña al número del resultado (fácil de cambiar). */
export const RESULT_LABEL = 'pulsaciones por minuto';

export type MeasureStatus = 'waitingFinger' | 'stabilizing' | 'counting' | 'done' | 'paused';

export interface MeasureResult {
  beats: number;       // latidos en 6"
  bpm: number;         // beats × 10
  confidence: number;
  measuredAt: string;  // ISO
}

export interface MeasureState {
  status: MeasureStatus;
  finger: FingerStatus;
  stabilizeProgress: number; // 0..1
  secondsLeft: number;       // cuenta regresiva del conteo (6 → 0)
  liveBeats: number;         // latidos contados hasta ahora
  waveform: number[];
  result: MeasureResult | null; // último resultado (se mantiene visible al esperar el dedo)
  lowQuality: boolean;
  retrying: boolean;
  /** Qué tan claro se ve el pulso (0..1), para mostrar "señal débil / buena". */
  signal: number;
}

export const STABILIZE_MS = 3000;
/** Si a los 3" el pulso todavía no se ve claro, se espera un poco más (hasta 8") antes de contar. */
export const MAX_STABILIZE_MS = 8000;
/** Periodicidad mínima para empezar a contar (el ruido rara vez la sostiene; un pulso débil sí). */
const SIGNAL_READY = 0.75;
const TAIL_MS = 500;          // margen para detectar el último latido de la ventana
const FINGER_LOST_MS = 1000;
const IDLE_PAUSE_MS = 90000;
const MAX_AUTO_RETRIES = 2;
export const MIN_CONFIDENCE = 0.5;
const UI_EVERY_MS = 150;

export const initialMeasureState: MeasureState = {
  status: 'waitingFinger', finger: 'no_finger', stabilizeProgress: 0, secondsLeft: COUNT_WINDOW_MS / 1000,
  liveBeats: 0, waveform: [], result: null, lowQuality: false, retrying: false, signal: 0,
};

export interface SessionCallbacks {
  onState: (s: MeasureState) => void;
  onResult: (r: MeasureResult) => void; // solo resultados válidos → guardado automático
}

export interface SessionOptions {
  /** Fuente de luz: con flash, lámpara/ventana o pantalla (cambia cuánta luz se espera). */
  light?: LightSource;
}

/**
 * Máquina de estados 100 % automática:
 * waitingFinger → (dedo) → stabilizing 3" → counting 6" → done (guarda) → (levantar dedo) → waitingFinger
 */
export class MeasurementSession {
  private proc = new HeartRateProcessor(15000);
  private state: MeasureState = { ...initialMeasureState };
  private phaseStart = 0;
  private countStart = 0;
  private lastFingerAt = -Infinity;
  private waitingSince: number | null = null;
  private retries = 0;
  private lastEmit = -Infinity;
  private light: LightSource;
  private signalReady = false;
  private readyStreak = 0;

  constructor(private cb: SessionCallbacks, opts: SessionOptions = {}) {
    this.light = opts.light ?? 'flash';
    cb.onState(this.state);
  }

  pushFrame(t: number, color: FrameColor) {
    const status = this.state.status;
    if (status === 'paused') return;

    const finger = detectFinger(color, this.proc.rawRed, this.light);
    const ok = finger === 'ok';
    if (ok) this.lastFingerAt = t;
    const fingerLost = !ok && t - this.lastFingerAt > FINGER_LOST_MS;

    switch (status) {
      case 'waitingFinger': {
        this.waitingSince ??= t;
        if (ok) {
          this.proc.reset();
          this.proc.addSample(t, color);
          this.phaseStart = t;
          this.retries = 0;
          this.waitingSince = null;
          this.signalReady = false;
          this.readyStreak = 0;
          return this.set(t, { status: 'stabilizing', finger, stabilizeProgress: 0, liveBeats: 0, waveform: [], lowQuality: false, retrying: false, signal: 0 }, true);
        }
        if (t - this.waitingSince > IDLE_PAUSE_MS) return this.set(t, { status: 'paused', finger }, true);
        return this.set(t, { finger });
      }

      case 'stabilizing': {
        if (ok) this.proc.addSample(t, color);
        if (fingerLost) return this.toWaiting(t, finger);
        const elapsed = t - this.phaseStart;
        // Mínimo 3"; el conteo arranca cuando el pulso se ve claro (o a los 8", lo que pase primero).
        if (elapsed >= MAX_STABILIZE_MS || (elapsed >= STABILIZE_MS && this.signalReady)) {
          this.countStart = t;
          return this.set(t, { status: 'counting', finger, secondsLeft: COUNT_WINDOW_MS / 1000, liveBeats: 0 }, true);
        }
        return this.set(t, { finger, stabilizeProgress: Math.min(1, elapsed / STABILIZE_MS) });
      }

      case 'counting': {
        if (ok) this.proc.addSample(t, color);
        if (fingerLost) return this.toWaiting(t, finger);
        const end = this.countStart + COUNT_WINDOW_MS;
        if (t >= end + TAIL_MS) return this.finalize(t, finger);
        return this.set(t, { finger, secondsLeft: Math.max(0, Math.ceil((end - t) / 1000)) });
      }

      case 'done': {
        if (fingerLost) {
          // El usuario levantó el dedo: queda listo para la próxima medición automática
          this.waitingSince = t;
          return this.set(t, { status: 'waitingFinger', finger }, true);
        }
        if (t - this.phaseStart > IDLE_PAUSE_MS) return this.set(t, { status: 'paused', finger }, true);
        return;
      }
    }
  }

  private finalize(t: number, finger: FingerStatus) {
    const c = this.proc.countBeats(this.countStart);

    if (c.confidence < MIN_CONFIDENCE && this.retries < MAX_AUTO_RETRIES) {
      // Reintento automático: se vuelve a contar 6" sin que el usuario haga nada
      this.retries++;
      this.countStart = t;
      return this.set(t, { status: 'counting', finger, secondsLeft: COUNT_WINDOW_MS / 1000, liveBeats: 0, retrying: true }, true);
    }

    const result: MeasureResult = { beats: c.beats, bpm: c.bpm, confidence: c.confidence, measuredAt: new Date().toISOString() };
    const lowQuality = c.confidence < MIN_CONFIDENCE;
    this.phaseStart = t;
    this.set(t, { status: 'done', finger, result, lowQuality, retrying: false, secondsLeft: 0, liveBeats: c.beats }, true);
    if (!lowQuality) this.cb.onResult(result);
  }

  private toWaiting(t: number, finger: FingerStatus) {
    this.waitingSince = t;
    this.set(t, { status: 'waitingFinger', finger, liveBeats: 0, waveform: [], stabilizeProgress: 0, retrying: false }, true);
  }

  private set(t: number, patch: Partial<MeasureState>, force = false) {
    this.state = { ...this.state, ...patch };
    if (!force && t - this.lastEmit < UI_EVERY_MS) return;
    this.lastEmit = t;

    const st = this.state.status;
    if (st === 'stabilizing' || st === 'counting') {
      const snap = this.proc.snapshot();
      this.state.waveform = snap.waveform.slice(-150); // ~5"
      this.state.signal = snap.quality;
      // Pulso claro en dos lecturas seguidas (≈300 ms): así un pico de ruido no dispara el conteo.
      if (st === 'stabilizing') {
        this.readyStreak = snap.quality >= SIGNAL_READY ? this.readyStreak + 1 : 0;
        if (this.readyStreak >= 2) this.signalReady = true;
      }
      if (st === 'counting') {
        const end = this.countStart + COUNT_WINDOW_MS;
        this.state.liveBeats = snap.beatTimes.filter((x) => x >= this.countStart && x < end).length;
      }
    }
    this.cb.onState({ ...this.state });
  }
}
