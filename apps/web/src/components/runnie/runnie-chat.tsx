"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { forSpeech, linkify, MESSAGE_MAX_CHARS, type ChatTurn } from "@/lib/runnie/shared";
import { IconMic, IconSpeaker, IconSpeakerOff } from "@/components/ui/icons";
import { RunnieAvatar } from "./runnie-avatar";
import { useSpeechInput, useSpeechOutput } from "./use-speech";

type Message = ChatTurn & { id: number; failed?: boolean };
const STORAGE_KEY = "r360-runnie";
// Si la persona quiere que Runnie lea las respuestas en voz alta (queda en este navegador).
const READ_KEY = "r360-runnie-leer";
const SUGGESTIONS = [
  "¿Qué me toca entrenar hoy?",
  "¿A qué ritmo hago las pasadas de hoy?",
  "¿Cómo anoto mis tiempos y guardo la sesión?",
  "Llevame a mi progreso",
];

function loadReadAloud(): boolean {
  try {
    return window.localStorage.getItem(READ_KEY) === "1";
  } catch {
    return false;
  }
}
function storeReadAloud(on: boolean) {
  try {
    if (on) window.localStorage.setItem(READ_KEY, "1");
    else window.localStorage.removeItem(READ_KEY);
  } catch {
    // Sin almacenamiento: vale mientras la pestaña esté abierta.
  }
}

// La conversación queda solo en este navegador mientras la pestaña esté abierta (no se guarda en el servidor).
function loadStored(): Message[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Message[]) : [];
    return Array.isArray(parsed) ? parsed.filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string") : [];
  } catch {
    return [];
  }
}
function store(messages: Message[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  } catch {
    // Sin almacenamiento (modo privado): la conversación se pierde al recargar.
  }
}

function Text({ content }: { content: string }) {
  return (
    <>
      {linkify(content).map((s, i) =>
        s.href ? (
          <Link key={i} href={s.href} className="font-semibold underline">
            {s.text}
          </Link>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/** Botón flotante y chat con Runnie, el asistente. Solo en la app (con sesión). */
export function RunnieChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  // Dictado por voz: el texto aparece en la caja mientras se habla y se envía solo al terminar.
  const speech = useSpeechInput({
    active: open,
    onText: (text) => setInput(text),
    onFinal: (text) => void send(text),
    onError: (message) => setNotice(message),
  });
  // Lectura en voz alta de las respuestas (se activa con el parlante del encabezado).
  const voice = useSpeechOutput(open);
  const [readAloud, setReadAloud] = useState(false);
  const readAloudRef = useRef(false);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  function openChat() {
    setOpen(true);
    const read = loadReadAloud();
    readAloudRef.current = read;
    setReadAloud(read);
    if (!messages.length) {
      const stored = loadStored();
      nextId.current = stored.reduce((m, x) => Math.max(m, x.id + 1), 1);
      setMessages(stored);
    }
  }

  function closeChat() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeChat();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, notice]);

  function toggleReadAloud() {
    const next = !readAloud;
    readAloudRef.current = next;
    setReadAloud(next);
    storeReadAloud(next);
    // Hablar dentro del toque habilita la voz en los teléfonos que lo exigen (iPhone).
    if (next) voice.speak("Listo, te leo las respuestas.");
    else voice.cancel();
  }

  function update(list: Message[]) {
    setMessages(list);
    store(list);
  }

  async function send(text: string) {
    const question = text.trim().slice(0, MESSAGE_MAX_CHARS);
    if (!question || busy) return;
    setNotice(null);
    setInput("");
    const history = messages.filter((m) => !m.failed);
    const userMsg: Message = { id: nextId.current++, role: "user", content: question };
    const replyId = nextId.current++;
    let list = [...history, userMsg];
    update(list);
    setBusy(true);
    let reply = "";
    let goTo: string | null = null;
    voice.cancel();
    try {
      const res = await fetch("/api/runnie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: list.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        update(list.map((m) => (m.id === userMsg.id ? { ...m, failed: true } : m)));
        setNotice(data.error ?? "Runnie no pudo responder esta vez. Probá de nuevo en un momento.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { t: string; text?: string; message?: string; keep?: boolean; href?: string };
          if (event.t === "delta" && event.text) {
            reply += event.text;
            list = [...list.filter((m) => m.id !== replyId), { id: replyId, role: "assistant", content: reply }];
            setMessages(list);
          } else if (event.t === "go" && event.href?.startsWith("/") && !event.href.startsWith("//")) {
            goTo = event.href;
          } else if (event.t === "done") {
            setAnnounce("Runnie respondió.");
            if (readAloudRef.current && reply) voice.speak(forSpeech(reply));
          } else if (event.t === "error") {
            if (!event.keep || !reply) {
              list = list.filter((m) => m.id !== replyId).map((m) => (m.id === userMsg.id ? { ...m, failed: true } : m));
            }
            setNotice(event.message ?? "Runnie no pudo responder esta vez.");
          }
        }
      }
      update(list);
      if (goTo) {
        router.push(goTo);
        // En el celular el chat ocupa toda la pantalla: se cierra para ver la sección.
        if (!window.matchMedia("(min-width: 1024px)").matches) setOpen(false);
      }
    } catch {
      update(list.filter((m) => m.id !== replyId || reply).map((m) => (m.id === userMsg.id && !reply ? { ...m, failed: true } : m)));
      setNotice("Se cortó la conexión. Probá de nuevo en un momento.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function clear() {
    update([]);
    setNotice(null);
    inputRef.current?.focus();
  }

  const writing = busy && messages.at(-1)?.role === "user";

  return (
    <>
      {!open ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={openChat}
          aria-label="Preguntale a Runnie, tu asistente"
          className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 inline-flex items-center gap-2 rounded-full bg-surface p-1 pr-4 font-semibold text-ink shadow-lg ring-1 ring-line transition hover:ring-primary lg:right-6 lg:bottom-6"
        >
          <RunnieAvatar size={48} />
          <span className="text-sm">Runnie</span>
        </button>
      ) : (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex flex-col bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:inset-auto lg:right-6 lg:bottom-6 lg:h-[min(36rem,calc(100dvh-3rem))] lg:w-96 lg:rounded-2xl lg:shadow-2xl lg:ring-1 lg:ring-line"
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <RunnieAvatar size={44} />
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-extrabold text-ink">Runnie</h2>
              <p className="text-xs text-muted">Tu asistente de running</p>
            </div>
            {voice.supported ? (
              <button
                type="button"
                onClick={toggleReadAloud}
                aria-pressed={readAloud}
                aria-label={readAloud ? "Dejar de leer las respuestas en voz alta" : "Leer las respuestas en voz alta"}
                title={readAloud ? "Dejar de leer en voz alta" : "Leer las respuestas en voz alta"}
                className={`inline-flex size-11 items-center justify-center rounded-xl ${readAloud ? "bg-primary text-on-primary" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
              >
                {readAloud ? <IconSpeaker width={22} height={22} /> : <IconSpeakerOff width={22} height={22} />}
              </button>
            ) : null}
            <button type="button" onClick={closeChat} aria-label="Cerrar el chat con Runnie" className="inline-flex size-11 items-center justify-center rounded-xl text-2xl text-muted hover:bg-surface-2 hover:text-ink">
              ×
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="rounded-2xl rounded-tl-sm bg-surface-2 px-4 py-3 text-sm text-ink">
                  ¡Hola! Soy Runnie. Preguntame lo que necesites sobre tu entrenamiento, tu plan o cómo usar la app.
                  {speech.supported ? " También podés tocar el micrófono y hablarme." : ""}
                  {voice.supported ? " Con el parlante de arriba te leo las respuestas en voz alta." : ""}
                </p>
                <ul className="flex flex-wrap gap-2" aria-label="Preguntas sugeridas">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button type="button" disabled={busy} onClick={() => void send(s)} className="min-h-11 rounded-full border border-line bg-surface px-3 text-left text-sm font-semibold text-ink hover:border-primary disabled:opacity-50">
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex flex-col items-end">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-on-primary">{m.content}</p>
                  {m.failed ? <span className="mt-1 text-xs text-muted">Sin respuesta</span> : null}
                </div>
              ) : (
                <div key={m.id} className="flex items-end gap-2">
                  <RunnieAvatar size={28} className="shrink-0" />
                  <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-2.5 text-sm whitespace-pre-wrap text-ink">
                    <Text content={m.content} />
                  </p>
                </div>
              ),
            )}
            {writing ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <RunnieAvatar size={28} className="shrink-0" />
                <span>Runnie está escribiendo…</span>
              </div>
            ) : null}
            {notice ? (
              <p role="alert" className="rounded-xl border border-warning/30 bg-warning-bg px-3 py-2 text-sm text-warning">
                {notice}
              </p>
            ) : null}
          </div>

          <form
            className="border-t border-line px-4 pt-3 pb-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <div className="flex items-end gap-2">
              <label htmlFor={`${titleId}-q`} className="sr-only">Tu pregunta para Runnie</label>
              <textarea
                id={`${titleId}-q`}
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={MESSAGE_MAX_CHARS}
                placeholder={speech.listening ? "Te escucho…" : "Escribí tu pregunta"}
                readOnly={speech.listening}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink sm:text-sm"
              />
              {speech.supported ? (
                <button
                  type="button"
                  onClick={() => {
                    if (speech.listening) speech.stop();
                    else {
                      setNotice(null);
                      voice.cancel();
                      speech.start();
                    }
                  }}
                  disabled={busy}
                  aria-pressed={speech.listening}
                  aria-label={speech.listening ? "Dejar de escuchar" : "Hablarle a Runnie"}
                  title={speech.listening ? "Dejar de escuchar" : "Hablarle a Runnie"}
                  className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl border disabled:opacity-50 ${
                    speech.listening ? "animate-pulse border-primary bg-primary text-on-primary motion-reduce:animate-none" : "border-line bg-surface text-ink hover:border-primary"
                  }`}
                >
                  <IconMic width={22} height={22} />
                </button>
              ) : null}
              <button type="submit" disabled={busy || speech.listening || !input.trim()} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50">
                Enviar
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
              <span>Runnie responde con la información de la app y de tu plan. No reemplaza a un profesional de la salud.</span>
              {messages.length ? (
                <button type="button" onClick={clear} className="min-h-11 shrink-0 font-semibold underline hover:text-ink">
                  Borrar
                </button>
              ) : null}
            </div>
          </form>
          <p aria-live="polite" className="sr-only">{speech.listening ? "Runnie te está escuchando." : announce}</p>
        </section>
      )}
    </>
  );
}
