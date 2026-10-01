import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";
import { rateLimit } from "./rate-limit";

describe("safeNext", () => {
  it("permite rutas internas", () => expect(safeNext("/app/plan")).toBe("/app/plan"));
  it("bloquea redirecciones externas", () => {
    expect(safeNext("https://evil.com")).toBe("/app");
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("/\\evil.com")).toBe("/app");
    expect(safeNext(null)).toBe("/app");
  });
});

describe("rateLimit", () => {
  it("bloquea al superar el límite dentro de la ventana", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, now + i)).toBe(true);
    expect(rateLimit("k", 3, 1000, now + 10)).toBe(false);
    expect(rateLimit("k", 3, 1000, now + 2000)).toBe(true);
  });
});
