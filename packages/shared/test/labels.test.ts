import { describe, expect, it } from "vitest";
import { SESSION_TYPE_LABELS, sessionTitle } from "../src/labels";

describe("nombres de sesiones", () => {
  it("sin nombres de esfuerzo: carrera continua", () => {
    expect(SESSION_TYPE_LABELS.easy_run).toBe("Carrera continua");
    expect(Object.values(SESSION_TYPE_LABELS).join(" ")).not.toMatch(/rodaje|tempo|umbral|suave|recuperaci/i);
  });

  it("los títulos guardados en los planes DEMO anteriores se muestran con el nombre nuevo", () => {
    expect(sessionTitle("Rodaje fácil")).toBe("Carrera continua");
    expect(sessionTitle("Rodaje largo")).toBe("Carrera continua larga");
    expect(sessionTitle("Tempo")).toBe("Carrera continua exigente");
    expect(sessionTitle("Recuperación")).toBe("Carrera continua corta");
    expect(sessionTitle("Intervalos")).toBe("Intervalos");
  });
});
