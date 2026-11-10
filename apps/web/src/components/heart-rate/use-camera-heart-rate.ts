"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initialMeasureState, MeasurementSession, type MeasureResult, type MeasureState } from "@/lib/heart-rate/measurementSession";

export type CameraState = "starting" | "on" | "off" | "error";

/** Lado máximo del recorte que se promedia (en píxeles reales, sin achicar: más precisión). */
const MAX_ROI = 200;
/** Parte del cuadro que se promedia: con la cámara de adelante el dedo tapa casi toda la imagen. */
const ROI_FRACTION = 0.8;

type Constraint = MediaTrackConstraintSet & { exposureMode?: string; whiteBalanceMode?: string; focusMode?: string };
type Caps = MediaTrackCapabilities & { exposureMode?: string[]; whiteBalanceMode?: string[]; focusMode?: string[] };
type VideoWithFrames = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
type WakeLockLike = { release: () => Promise<void> };

const VIDEO = { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } };

function stopStream(s: MediaStream | null) {
  s?.getTracks().forEach((t) => t.stop());
}

/**
 * Cámara para medir pulsaciones por el dedo (PPG): la cámara de adelante, con la pantalla en blanco
 * iluminando el dedo. Arranca sola al montarse; se apaga al desmontarse, al pasar a segundo plano, al
 * cerrar y tras 90" sin dedo. La imagen nunca sale del dispositivo: solo se usa el color medio del cuadro.
 */
export function useCameraHeartRate(onResult: (r: MeasureResult) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<MeasurementSession | null>(null);
  const wakeRef = useRef<WakeLockLike | null>(null);
  const genRef = useRef(0); // invalida arranques viejos (StrictMode, visibilidad, cerrar)
  const onResultRef = useRef(onResult);
  const lockedRef = useRef(false);
  /** La persona cerró la medición: al volver a la app no se prende sola. */
  const closedRef = useRef(false);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const [state, setState] = useState<MeasureState>(initialMeasureState);
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [error, setError] = useState<string | null>(null);

  const releaseCamera = useCallback(() => {
    genRef.current++;
    stopStream(streamRef.current);
    streamRef.current = null;
    sessionRef.current = null;
    lockedRef.current = false;
    wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopCamera = useCallback(() => {
    releaseCamera();
    setCameraState("off");
  }, [releaseCamera]);

  const startCamera = useCallback(async () => {
    releaseCamera();
    const gen = ++genRef.current;
    await Promise.resolve();
    if (gen !== genRef.current) return;
    setCameraState("starting");
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("sin cámara"), { name: window.isSecureContext ? "NotFoundError" : "SecurityError" });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "user" }, ...VIDEO } });
      if (gen !== genRef.current) {
        stopStream(stream);
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0]!;
      const caps = (track.getCapabilities?.() ?? {}) as Caps;

      // Con el dedo apoyado se fijan exposición, balance de blancos y foco: los ajustes automáticos meten ruido.
      const lockable: Constraint = {};
      const unlock: Constraint = {};
      if (caps.exposureMode?.includes("manual") && caps.exposureMode.includes("continuous")) {
        lockable.exposureMode = "manual";
        unlock.exposureMode = "continuous";
      }
      if (caps.whiteBalanceMode?.includes("manual") && caps.whiteBalanceMode.includes("continuous")) {
        lockable.whiteBalanceMode = "manual";
        unlock.whiteBalanceMode = "continuous";
      }
      if (caps.focusMode?.includes("manual") && caps.focusMode.includes("continuous")) {
        lockable.focusMode = "manual";
        unlock.focusMode = "continuous";
      }
      const canLock = Object.keys(lockable).length > 0;

      const video = videoRef.current as VideoWithFrames | null;
      if (!video) return;
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      await video.play();
      if (gen !== genRef.current) return;

      // Pantalla siempre prendida mientras se mide (si el navegador lo permite).
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockLike> } };
      nav.wakeLock?.request("screen").then((w) => {
        if (gen === genRef.current) wakeRef.current = w;
        else w.release().catch(() => {});
      }).catch(() => {});

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("sin canvas");

      sessionRef.current = new MeasurementSession(
        {
          onState: (s) => {
            setState(s);
            if (canLock) {
              const lock = s.status === "stabilizing" || s.status === "counting";
              if (lock !== lockedRef.current) {
                lockedRef.current = lock;
                track.applyConstraints({ advanced: [lock ? lockable : unlock] }).catch(() => {});
              }
            }
            if (s.status === "paused") stopCamera(); // 90" sin dedo → apagar
          },
          onResult: (r) => onResultRef.current(r),
        },
        { light: "screen" },
      );
      setCameraState("on");

      const schedule = (cb: () => void) => (video.requestVideoFrameCallback ? video.requestVideoFrameCallback(cb) : requestAnimationFrame(cb));
      const loop = () => {
        if (gen !== genRef.current) return;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw && vh) {
          // Centro del cuadro (80 %) en su resolución real: se promedian miles de píxeles por cuadro,
          // lo que permite ver variaciones más chicas que un nivel de brillo.
          const side = Math.round(Math.min(vw, vh) * ROI_FRACTION);
          const out = Math.min(side, MAX_ROI);
          if (canvas.width !== out) {
            canvas.width = out;
            canvas.height = out;
          }
          ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, out, out);
          const d = ctx.getImageData(0, 0, out, out).data;
          let r = 0;
          let g = 0;
          let b = 0;
          let sq = 0;
          for (let i = 0; i < d.length; i += 4) {
            const ri = d[i]!;
            r += ri;
            g += d[i + 1]!;
            b += d[i + 2]!;
            sq += ri * ri;
          }
          const n = d.length / 4;
          const mr = r / n;
          const spread = Math.sqrt(Math.max(0, sq / n - mr * mr));
          sessionRef.current?.pushFrame(performance.now(), { r: mr, g: g / n, b: b / n, spread });
        }
        schedule(loop);
      };
      schedule(loop);
    } catch (e) {
      if (gen !== genRef.current) return;
      releaseCamera();
      const name = e instanceof Error ? e.name : "";
      setCameraState("error");
      setError(
        !window.isSecureContext || name === "SecurityError"
          ? "La cámara solo funciona con una conexión segura (https)."
          : name === "NotAllowedError"
            ? "Necesitamos permiso para usar la cámara. Habilitalo en la configuración del navegador y tocá Reintentar."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No encontramos una cámara en este dispositivo."
              : name === "NotReadableError"
                ? "Otra app está usando la cámara. Cerrala y tocá Reintentar."
                : "No pudimos iniciar la cámara.",
      );
    }
  }, [releaseCamera, stopCamera]);

  // Arranque automático al abrir + pausa/reanudación con la visibilidad.
  useEffect(() => {
    const boot = setTimeout(() => {
      setState(initialMeasureState);
      void startCamera();
    }, 0);
    const onVis = () => {
      if (document.hidden) stopCamera();
      else if (!closedRef.current) {
        setState(initialMeasureState);
        void startCamera();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(boot);
      document.removeEventListener("visibilitychange", onVis);
      releaseCamera();
    };
  }, [startCamera, stopCamera, releaseCamera]);

  const resume = useCallback(() => {
    closedRef.current = false;
    setState(initialMeasureState);
    void startCamera();
  }, [startCamera]);

  const close = useCallback(() => {
    closedRef.current = true;
    stopCamera();
  }, [stopCamera]);

  return { videoRef, state, cameraState, error, resume, close };
}
