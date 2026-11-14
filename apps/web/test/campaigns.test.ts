import { afterEach, describe, expect, it, vi } from "vitest";
import { birthdayEmail, campaignEmail, dueCampaign, variantIndex } from "@/lib/notifications/campaign-texts";
import { runEmailCampaigns } from "@/lib/notifications/campaigns";

const site = "https://runner360.ar";
const unsub = `${site}/correos/baja?t=abc`;

describe("correos de motivación: cuándo", () => {
  it("sin suscripción: invitación cada 7 días", () => {
    expect(dueCampaign({ premium: false, last_invite: null, last_encourage: null }, "2026-11-13")).toBe("invite");
    expect(dueCampaign({ premium: false, last_invite: "2026-11-10", last_encourage: null }, "2026-11-13")).toBeNull();
    expect(dueCampaign({ premium: false, last_invite: "2026-11-06", last_encourage: null }, "2026-11-13")).toBe("invite");
  });
  it("con suscripción: aliento cada 15 días (nunca la invitación)", () => {
    expect(dueCampaign({ premium: true, last_invite: "2026-11-12", last_encourage: null }, "2026-11-13")).toBe("encourage");
    expect(dueCampaign({ premium: true, last_invite: null, last_encourage: "2026-11-01" }, "2026-11-13")).toBeNull();
    expect(dueCampaign({ premium: true, last_invite: null, last_encourage: "2026-10-30" }, "2026-11-13")).toBe("encourage");
  });
  it("cada envío cambia de versión", () => {
    expect(variantIndex("invite", "2026-11-13")).not.toBe(variantIndex("invite", "2026-11-20"));
    expect(variantIndex("encourage", "2026-11-13")).not.toBe(variantIndex("encourage", "2026-11-27"));
  });
});

describe("correos de motivación: contenido", () => {
  it("invitación con saludo, botón a la suscripción y link de baja", () => {
    const m = campaignEmail({ kind: "invite", name: "Ana Pérez", today: "2026-11-09", siteUrl: site, unsubscribeUrl: unsub });
    expect(m.text).toContain("¡Hola, Ana!");
    expect(m.text).toContain(unsub);
    expect(m.html).toContain(unsub);
    expect(m.html).toContain(`${site}/suscripcion`);
    expect(m.subject.length).toBeGreaterThan(5);
  });
  it("aliento para suscriptos sin nombre y con el texto escapado", () => {
    const m = campaignEmail({ kind: "encourage", name: "<b>X</b>", today: "2026-11-09", siteUrl: site, unsubscribeUrl: unsub });
    expect(m.html).not.toContain("<b>X</b>");
    expect(m.html).toContain("&lt;b&gt;X&lt;/b&gt;");
    expect(m.text).toContain("suscripción en RUNNER 360");
    const empty = campaignEmail({ kind: "encourage", name: null, today: "2026-11-09", siteUrl: site, unsubscribeUrl: unsub });
    expect(empty.text.startsWith("¡Hola!")).toBe(true);
  });
});

describe("tarea diaria de correos", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function fakeAdmin(rows: unknown[], birthdays: unknown[] = []) {
    const logged: unknown[] = [];
    const admin = {
      rpc: vi.fn(async (name: string) => ({ data: name === "email_birthday_candidates" ? birthdays : rows, error: null })),
      from: vi.fn(() => ({ upsert: vi.fn(async (r: unknown[]) => (logged.push(...r), { error: null })) })),
    };
    return { admin, logged };
  }

  it("sin remitente verificado no manda nada", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_1234567890abcdef");
    vi.stubEnv("RESEND_FROM", "Runner 360 <onboarding@resend.dev>");
    const { admin } = fakeAdmin([]);
    const r = await runEmailCampaigns(admin as never, "2026-11-13");
    expect(r.enabled).toBe(false);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("manda lo que toca en un lote, con baja en un toque, y registra los envíos", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_1234567890abcdef");
    vi.stubEnv("RESEND_FROM", "RUNNER 360 <hola@runner360.ar>");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { admin, logged } = fakeAdmin([
      { user_id: "u1", email: "a@x.com", display_name: "Ana", premium: false, last_invite: null, last_encourage: null, unsubscribe_token: "t1" },
      { user_id: "u2", email: "b@x.com", display_name: "Beto", premium: true, last_invite: null, last_encourage: "2026-11-10", unsubscribe_token: "t2" },
      { user_id: "u3", email: "c@x.com", display_name: null, premium: true, last_invite: null, last_encourage: null, unsubscribe_token: "t3" },
    ]);
    const r = await runEmailCampaigns(admin as never, "2026-11-13");
    expect(r.sent).toEqual({ invite: 1, encourage: 1, birthday: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails/batch");
    const body = JSON.parse(String(init.body)) as { to: string[]; headers: Record<string, string> }[];
    expect(body.map((b) => b.to[0])).toEqual(["a@x.com", "c@x.com"]);
    expect(body[0]!.headers["List-Unsubscribe"]).toContain("/api/correos/baja?t=t1");
    expect(logged).toEqual([
      { user_id: "u1", kind: "invite", sent_on: "2026-11-13" },
      { user_id: "u3", kind: "encourage", sent_on: "2026-11-13" },
    ]);
  });

  it("el día del cumpleaños manda la felicitación y no otro correo a esa persona", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_1234567890abcdef");
    vi.stubEnv("RESEND_FROM", "RUNNER 360 <hola@runner360.ar>");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { admin, logged } = fakeAdmin(
      [
        { user_id: "u1", email: "a@x.com", display_name: "Ana", premium: false, last_invite: null, last_encourage: null, unsubscribe_token: "t1" },
        { user_id: "u2", email: "b@x.com", display_name: "Beto", premium: false, last_invite: null, last_encourage: null, unsubscribe_token: "t2" },
      ],
      [{ user_id: "u1", email: "a@x.com", display_name: "Ana", unsubscribe_token: "t1" }],
    );
    const r = await runEmailCampaigns(admin as never, "2026-11-14");
    expect(admin.rpc).toHaveBeenCalledWith("email_birthday_candidates", { p_today: "2026-11-14" });
    expect(r.sent).toEqual({ invite: 1, encourage: 0, birthday: 1 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { to: string[]; subject: string }[];
    expect(body.map((b) => [b.to[0], b.subject])).toEqual([
      ["a@x.com", "¡Feliz cumpleaños, Ana! 🎉"],
      ["b@x.com", expect.any(String)],
    ]);
    expect(logged).toEqual([
      { user_id: "u1", kind: "birthday", sent_on: "2026-11-14" },
      { user_id: "u2", kind: "invite", sent_on: "2026-11-14" },
    ]);
  });
});

describe("Correo de cumpleaños", () => {
  const input = { name: "Ana Pérez", today: "2026-11-14", siteUrl: "https://runner360.ar", unsubscribeUrl: "https://runner360.ar/correos/baja?t=abc" };
  it("saluda por el nombre, sin la edad, con el link de baja", () => {
    const m = birthdayEmail(input);
    expect(m.subject).toBe("¡Feliz cumpleaños, Ana! 🎉");
    expect(m.text).toContain("¡Hola, Ana!");
    expect(m.text).toContain(input.unsubscribeUrl);
    expect(m.html).toContain("https://runner360.ar/inicio");
    expect(m.text).not.toMatch(/\b\d{1,3} años\b/);
  });
  it("sin nombre, saludo general; la versión cambia cada año", () => {
    expect(birthdayEmail({ ...input, name: null }).subject).toBe("¡Feliz cumpleaños! 🎉");
    expect(birthdayEmail(input).text).not.toBe(birthdayEmail({ ...input, today: "2027-11-14" }).text);
  });
  it("escapa el nombre en el HTML", () => {
    expect(birthdayEmail({ ...input, name: "<b>Ana</b>" }).html).not.toContain("<b>Ana</b>");
  });
});
