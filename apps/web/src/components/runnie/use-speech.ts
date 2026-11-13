"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Voz para Runnie (gratis, con lo que trae el navegador o el teléfono).
 *
 * Dictado: el reconocimiento de voz del navegador con el reconocimiento de voz del navegador (gratis, sin claves). Escucha
 * una frase en español, muestra el texto mientras se habla y, al terminar, entrega la frase final.
 * Donde el navegador no lo ofrece, `supported` es false y no se muestra el micrófono.
 */

type Alternative = { transcript: string };
type Result = { isFinal: boolean; 0: Alternative; length: number };
type RecognitionEvent = { resultIndex: number; results: { length: number; [i: number]: Result } };
type RecognitionError = { error: string };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};

/** Mensaje para la persona según el error del navegador (null: no hace falta avisar). */
export function speechErrorMessage(code: string): string | null {
  switch (code) {
    case "aborted":
      return null;
    case "no-speech":
      return "No te escuché. Tocá el micrófono y probá de nuevo.";
    case "not-allowed":
    case "service-not-allowed":
      return "Para hablarle a Runnie, permití el uso del micrófono en la configuración del navegador.";
    case "audio-capture":
      return "No encontramos un micrófono. Revisá que esté conectado o escribí tu pregunta.";
    case "network":
      return "El dictado por voz necesita conexión a internet. Probá de nuevo o escribí tu pregunta.";
    default:
      return "No pudimos usar el dictado por voz. Escribí tu pregunta.";
  }
}

/** `active` false (chat cerrado) deja de escuchar sin enviar nada. */
export function useSpeechInput(opts: { active: boolean; onText: (text: string) => void; onFinal: (text: string) => void; onError: (message: string) => void }) {
  const supported = useSyncExternalStore(noop, () => recognitionCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const handlers = useRef(opts);
  useEffect(() => {
    handlers.current = opts;
  });
  // Al cerrar el chat (o salir de la página) se deja de escuchar, sin enviar lo dictado.
  useEffect(() => {
    if (opts.active) return;
    const r = rec.current;
    // Se suelta antes de cortar: así al terminar no se envía lo dictado.
    rec.current = null;
    r?.abort();
  }, [opts.active]);
  useEffect(() => () => rec.current?.abort(), []);

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor || listening) return;
    const r = new Ctor();
    r.lang = "es-AR";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let finalText = "";
    r.onresult = (e) => {
      if (rec.current !== r) return;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      handlers.current.onText(`${finalText}${interim}`.trim());
    };
    r.onerror = (e) => {
      const message = speechErrorMessage(e.error);
      if (message) handlers.current.onError(message);
    };
    r.onend = () => {
      setListening(false);
      const mine = rec.current === r;
      if (mine) rec.current = null;
      const text = finalText.trim();
      if (mine && text) handlers.current.onFinal(text);
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
      handlers.current.onError(speechErrorMessage("")!);
    }
  }

  function stop() {
    rec.current?.stop();
  }

  return { supported, listening, start, stop };
}

/**
 * Lectura en voz alta de las respuestas (`active` false, con el chat cerrado, corta la lectura) con la síntesis de voz del navegador, en español (de
 * Argentina si el teléfono la tiene). Donde no hay síntesis de voz, `supported` es false.
 */
export function useSpeechOutput(active: boolean) {
  const supported = useSyncExternalStore(noop, () => typeof window !== "undefined" && "speechSynthesis" in window, () => false);
  // Al cerrar el chat (o salir de la página) se deja de hablar.
  useEffect(() => {
    if (!active && supported) window.speechSynthesis.cancel();
  }, [active, supported]);
  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function voice(): SpeechSynthesisVoice | null {
    // Primero las voces del propio dispositivo (no mandan el texto a ningún servicio).
    const voices = [...window.speechSynthesis.getVoices()].sort((a, b) => Number(b.localService) - Number(a.localService));
    const pick = (re: RegExp) => voices.find((v) => re.test(v.lang.replace("_", "-")));
    return pick(/^es-AR/i) ?? pick(/^es-(419|US|MX)/i) ?? pick(/^es/i) ?? null;
  }

  function speak(text: string) {
    if (!supported || !text.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-AR";
    const v = voice();
    if (v) u.voice = v;
    synth.speak(u);
  }

  function cancel() {
    if (supported) window.speechSynthesis.cancel();
  }

  return { supported, speak, cancel };
}
