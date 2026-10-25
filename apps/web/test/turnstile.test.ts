import { describe, expect, it, vi } from "vitest";
import { TURNSTILE_VERIFY_URL, verifyTurnstile } from "../src/lib/turnstile";

const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response);

describe("captcha del registro", () => {
  it("sin clave secreta se omite (entorno local o claves sin cargar)", async () => {
    expect(await verifyTurnstile(undefined, null, { secret: "" })).toEqual({ ok: true, skipped: true });
  });

  it("con clave: sin token se rechaza sin consultar", async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile("", "1.2.3.4", { secret: "s", fetchImpl: f })).toEqual({ ok: false, reason: "missing" });
    expect(f).not.toHaveBeenCalled();
  });

  it("token válido: consulta a Cloudflare con la clave, el token y la IP", async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile("tok", "1.2.3.4", { secret: "s", fetchImpl: f })).toEqual({ ok: true, skipped: false });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    const sent = init.body as URLSearchParams;
    expect([sent.get("secret"), sent.get("response"), sent.get("remoteip")]).toEqual(["s", "tok", "1.2.3.4"]);
  });

  it("token rechazado o servicio caído: no se crea la cuenta", async () => {
    expect(await verifyTurnstile("tok", null, { secret: "s", fetchImpl: reply({ success: false }) })).toEqual({ ok: false, reason: "rejected" });
    expect(await verifyTurnstile("tok", null, { secret: "s", fetchImpl: reply({}, false) })).toEqual({ ok: false, reason: "unavailable" });
    const boom = vi.fn(async () => {
      throw new Error("red");
    });
    expect(await verifyTurnstile("tok", null, { secret: "s", fetchImpl: boom })).toEqual({ ok: false, reason: "unavailable" });
  });
});
