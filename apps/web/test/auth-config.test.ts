import { afterEach, describe, expect, it, vi } from "vitest";
import { authErrorMessage } from "@/lib/auth-errors";
import { isSupabaseConfigured, missingSupabaseConfig, normalizeBaseUrl, publicEnv, readEnv } from "@/lib/env";
import { pickSiteUrl } from "@/lib/site-url";

const KEY = "sb_publishable_abcdefghijklmnopqrstuvwxyz";

afterEach(() => vi.unstubAllEnvs());

describe("variables de entorno", () => {
  it("se leen en tiempo de ejecución y se normalizan", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", '  "https://abc.supabase.co/rest/v1/"  ');
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ` ${KEY} `);
    expect(publicEnv.supabaseUrl).toBe("https://abc.supabase.co");
    expect(publicEnv.supabaseAnonKey).toBe(KEY);
    expect(isSupabaseConfigured()).toBe(true);
  });
  it("acepta los nombres alternativos (anon key e integración de Vercel)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", KEY);
    expect(isSupabaseConfigured()).toBe(true);
  });
  it("informa qué falta, sin valores", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "corta");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    expect(missingSupabaseConfig()).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
    expect(isSupabaseConfigured()).toBe(false);
  });
  it("utilidades", () => {
    vi.stubEnv("X_TEST", "'valor'");
    expect(readEnv("X_TEST")).toBe("valor");
    expect(readEnv("NO_EXISTE_X")).toBe("");
    expect(normalizeBaseUrl("no es url")).toBe("");
    expect(normalizeBaseUrl("HTTPS://Runner360.vercel.app/registro?x=1")).toBe("https://runner360.vercel.app");
  });
});

describe("dirección de retorno de los correos", () => {
  it("usa el dominio de la solicitud en producción", () => {
    expect(pickSiteUrl({ forwardedHost: "runner360.vercel.app", forwardedProto: "https", configured: "http://localhost:3000", production: true })).toBe(
      "https://runner360.vercel.app",
    );
  });
  it("nunca usa localhost en producción", () => {
    expect(pickSiteUrl({ host: "localhost:3000", configured: "http://localhost:3000", vercelProductionUrl: "runner360.vercel.app", production: true })).toBe(
      "https://runner360.vercel.app",
    );
  });
  it("en desarrollo local devuelve localhost", () => {
    expect(pickSiteUrl({ host: "localhost:3000", production: false })).toBe("http://localhost:3000");
  });
  it("ignora encabezados inválidos y usa la configurada", () => {
    expect(pickSiteUrl({ host: "evil.com/<script>", configured: "https://runner360.vercel.app", production: true })).toBe("https://runner360.vercel.app");
  });
});

describe("mensajes de error para el usuario", () => {
  const sinTecnicismos = (m: string) => expect(m).not.toMatch(/supabase|readme|variable|env/i);
  it("registro", () => {
    const m1 = authErrorMessage({ code: "user_already_exists", status: 422 }, "signup");
    expect(m1).toContain("Ya existe una cuenta");
    expect(authErrorMessage({ code: "weak_password" }, "signup")).toContain("10 caracteres");
    expect(authErrorMessage({ code: "over_email_send_rate_limit", status: 429 }, "signup")).toContain("demasiados correos");
    expect(authErrorMessage({ code: "signup_disabled" }, "signup")).toContain("no estamos aceptando");
    expect(authErrorMessage(new TypeError("fetch failed"), "signup")).toContain("No pudimos conectarnos");
    [m1, authErrorMessage({}, "signup")].forEach(sinTecnicismos);
  });
  it("ingreso", () => {
    expect(authErrorMessage({ code: "invalid_credentials", status: 400 }, "signin")).toBe("Correo o contraseña incorrectos.");
    expect(authErrorMessage({ code: "email_not_confirmed" }, "signin")).toContain("confirmaste tu correo");
    expect(authErrorMessage({ name: "AuthRetryableFetchError", status: 0 }, "signin")).toContain("No pudimos conectarnos");
  });
  it("cambio de contraseña", () => {
    expect(authErrorMessage({ code: "same_password" }, "update")).toContain("distinta");
  });
});
