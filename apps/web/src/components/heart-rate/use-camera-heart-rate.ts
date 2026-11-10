"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initialMeasureState, MeasurementSession, type MeasureResult, type MeasureState } from "@/lib/heart-rate/measurementSession";

const ROI = 40; // recorte central chico: alcanza y es barato
export type CameraState = "starting" | "on" | "off" | "error";

type TorchSet = MediaTrackConstraintSet & { torch?: boolean; exposureMode?: string };
type VideoWithFrames = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };

/**
 * Cámara trasera + flash para medir pulsaciones por el dedo (PPG). Arranca sola al montarse, se
 * apaga al desmontarse, al pasar a segundo plano y tras 90" sin dedo (estado "paused" de la sesión).
 * El video nunca sale del dispositivo: solo se promedia el color de un recorte central de 40×40 px.
 */
export function useCameraHeartRate(onResult: (r: MeasureResult) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<MeasurementSession | null>(null);
  const genRef = useRef(0); // invalida arranques viejos (StrictMode, visibilidad)
  const onResultRef = useRef(onResult);
  const exposureLockedRef = useRef(false);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const [state, setState] = useState<MeasureState>(initialMeasureState);
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [error, setError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState<boolean | null>(null);

  const releaseCamera = useCallback(() => {
    genRef.current++;
    const track = streamRef.current?.getVideoTracks()[0];
    track?.applyConstraints({ advanced: [{ torch: false } as TorchSet] }).catch(() => {});
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    sessionRef.current = null;
    exposureLockedRef.current = false;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopCamera = useCallback(() => {
    releaseCamera();
    setCameraState("off");
  }, [releaseCamera]);

  const startCamera = useCallback(async () => {
    releaseCamera();
    const gen = ++genRef.current;
    // Lo que sigue es asíncrono: los cambios de estado no ocurren dentro del efecto que lo llama.
    await Promise.resolve();
    if (gen !== genRef.current) return;
    setCameraState("starting");
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("sin cámara"), { name: window.isSecureContext ? "NotFoundError" : "SecurityError" });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } },
      });
      if (gen !== genRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0]!;

      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; exposureMode?: string[] };
      const hasTorch = Boolean(caps.torch);
      setTorchSupported(hasTorch);
      if (hasTorch) await track.applyConstraints({ advanced: [{ torch: true } as TorchSet] }).catch(() => setTorchSupported(false));
      const canLockExposure = Array.isArray(caps.exposureMode) && caps.exposureMode.includes("manual") && caps.exposureMode.includes("continuous");

      const video = videoRef.current as VideoWithFrames | null;
      if (!video) return;
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      await video.play();
      if (gen !== genRef.current) return;

      const canvas = document.createElement("canvas");
      canvas.width = ROI;
      canvas.height = ROI;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("sin canvas");

      sessionRef.current = new MeasurementSession({
        onState: (s) => {
          setState(s);
          // Exposición fija mientras hay dedo (menos ruido); automática el resto del tiempo.
          if (canLockExposure) {
            const lock = s.status === "stabilizing" || s.status === "counting";
            if (lock !== exposureLockedRef.current) {
              exposureLockedRef.current = lock;
              track.applyConstraints({ advanced: [{ exposureMode: lock ? "manual" : "continuous" } as TorchSet] }).catch(() => {});
            }
          }
          if (s.status === "paused") stopCamera(); // 90" sin dedo → apagar
        },
        onResult: (r) => onResultRef.current(r),
      });
      setCameraState("on");

      const schedule = (cb: () => void) => (video.requestVideoFrameCallback ? video.requestVideoFrameCallback(cb) : requestAnimationFrame(cb));
      const loop = () => {
        if (gen !== genRef.current) return;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw && vh) {
          const side = Math.min(vw, vh) * 0.5;
          ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, ROI, ROI);
          const d = ctx.getImageData(0, 0, ROI, ROI).data;
          let r = 0;
          let g = 0;
          let b = 0;
          for (let i = 0; i < d.length; i += 4) {
            r += d[i]!;
            g += d[i + 1]!;
            b += d[i + 2]!;
          }
          const n = d.length / 4;
          sessionRef.current?.pushFrame(performance.now(), { r: r / n, g: g / n, b: b / n });
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

  // Arranque automático al abrir la pestaña + pausa/reanudación con la visibilidad.
  useEffect(() => {
    // En la próxima vuelta: si React monta y desmonta enseguida (modo desarrollo), no se prende dos veces.
    const boot = setTimeout(() => void startCamera(), 0);
    const onVis = () => {
      if (document.hidden) stopCamera();
      else {
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
    setState(initialMeasureState);
    void startCamera();
  }, [startCamera]);

  return { videoRef, state, cameraState, error, torchSupported, resume };
}
