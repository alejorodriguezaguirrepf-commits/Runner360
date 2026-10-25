import { describe, expect, it } from "vitest";
import { paymentsConfigProblems, readPaymentsConfig } from "@/lib/payments/config";

const ok = { MP_ENV: "prod", MP_ACCESS_TOKEN: "APP_USR-1234567890-abcdef", MP_WEBHOOK_SECRET: "s3cr3t", APP_BASE_URL: "https://runner360.vercel.app" };

describe("configuración de cobros", () => {
  it("producción completa y coherente: sin problemas", () => {
    expect(paymentsConfigProblems(ok)).toEqual({ errors: [], warnings: [] });
  });

  it("acepta los nombres anteriores y quita la barra final de la URL", () => {
    const c = readPaymentsConfig({ MERCADOPAGO_ACCESS_TOKEN: "TEST-1", MERCADOPAGO_WEBHOOK_SECRET: "x", NEXT_PUBLIC_SITE_URL: "https://a.app/" });
    expect(c).toMatchObject({ mpAccessToken: "TEST-1", mpWebhookSecret: "x", appBaseUrl: "https://a.app", mpEnv: null, fxSource: "dolarapi", fxRateType: "oficial" });
  });

  it("MP_ENV=prod con credenciales de prueba no arranca", () => {
    expect(paymentsConfigProblems({ ...ok, MP_ACCESS_TOKEN: "TEST-123-abc" }).errors.join()).toMatch(/credenciales de prueba/);
  });

  it("con MP_ENV, cada faltante es un error con nombre de variable (y sin valores)", () => {
    const { errors } = paymentsConfigProblems({ MP_ENV: "test" });
    expect(errors.join("\n")).toMatch(/MP_ACCESS_TOKEN/);
    expect(errors.join("\n")).toMatch(/MP_WEBHOOK_SECRET/);
    expect(errors.join("\n")).toMatch(/NEXT_PUBLIC_SITE_URL/);
    const withSecret = paymentsConfigProblems({ ...ok, MP_ACCESS_TOKEN: "APP_USR-secreto-que-no-debe-aparecer", APP_BASE_URL: "http://x" });
    expect(withSecret.errors.join()).not.toContain("secreto-que-no-debe-aparecer");
    expect(withSecret.errors.join()).toMatch(/https/);
  });

  it("valores inválidos de MP_ENV y FX_SOURCE", () => {
    expect(paymentsConfigProblems({ MP_ENV: "produccion" }).errors.join()).toMatch(/MP_ENV inválido/);
    expect(paymentsConfigProblems({ FX_SOURCE: "otra" }).errors.join()).toMatch(/FX_SOURCE inválido/);
    expect(paymentsConfigProblems({ MP_ENV: "test", MP_ACCESS_TOKEN: "abc", MP_WEBHOOK_SECRET: "x", APP_BASE_URL: "http://localhost:3000" }).errors.join()).toMatch(/no parece/);
  });

  it("sin MP_ENV: modo anterior, solo aviso (no corta una instalación existente)", () => {
    expect(paymentsConfigProblems({ MERCADOPAGO_ACCESS_TOKEN: "APP_USR-1" })).toEqual({ errors: [], warnings: [expect.stringMatching(/MP_ENV/)] });
    expect(paymentsConfigProblems({})).toEqual({ errors: [], warnings: [] });
  });
});
