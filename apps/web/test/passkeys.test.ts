import { describe, expect, it } from "vitest";
import { deviceName, relyingParty, userHandle } from "@/lib/passkeys/config";

describe("ingreso con huella", () => {
  it("las llaves pertenecen al dominio de producción", () => {
    expect(relyingParty("https://runner360.ar")).toEqual({ rpID: "runner360.ar", origin: "https://runner360.ar" });
    expect(relyingParty("http://localhost:3000")).toEqual({ rpID: "localhost", origin: "http://localhost:3000" });
  });
  it("nombra el dispositivo para la lista del perfil", () => {
    expect(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1")).toBe("iPhone (Safari)");
    expect(deviceName("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")).toBe("Android (Chrome)");
    expect(deviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0")).toBe("Windows (Edge)");
    expect(deviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15")).toBe("Mac (Safari)");
  });
  it("la llave guarda el id interno de la cuenta, no el correo", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    expect(new TextDecoder().decode(userHandle(id))).toBe(id);
    expect(userHandle(id).length).toBeLessThanOrEqual(64);
  });
});
