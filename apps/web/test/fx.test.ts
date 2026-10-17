import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "@/lib/cron-auth";
import { fxSourceUrl, parseBcra, parseDolarApi, parseFxResponse } from "@/lib/fx/sources";

describe("cotización: dolarapi", () => {
  const body = { moneda: "USD", casa: "oficial", nombre: "Oficial", compra: 1450, venta: 1499.95, fechaActualizacion: "2026-10-16T15:00:00.000Z" };

  it("usa el valor de venta y la fecha de la fuente", () => {
    expect(parseDolarApi(body, "oficial")).toEqual({ source: "dolarapi", rateType: "oficial", rate: 1499.95, quotedAt: "2026-10-16T15:00:00.000Z" });
    expect(fxSourceUrl("dolarapi", "oficial")).toBe("https://dolarapi.com/v1/dolares/oficial");
  });

  it("descarta respuestas inválidas o fuera de rango", () => {
    for (const bad of [null, "x", {}, { ...body, venta: "1499" }, { ...body, venta: 0 }, { ...body, venta: 5e6 }, { ...body, moneda: "EUR" }, { ...body, fechaActualizacion: "ayer" }])
      expect(parseDolarApi(bad, "oficial")).toBeNull();
  });
});

describe("cotización: BCRA", () => {
  it("toma el USD de la fecha más reciente (resultados como lista u objeto)", () => {
    const list = {
      status: 200,
      results: [
        { fecha: "2026-10-15", detalle: [{ codigoMoneda: "USD", tipoCotizacion: 1400.5 }] },
        { fecha: "2026-10-16", detalle: [{ codigoMoneda: "EUR", tipoCotizacion: 1600 }, { codigoMoneda: "USD", tipoCotizacion: 1410.25 }] },
      ],
    };
    expect(parseBcra(list)).toMatchObject({ source: "bcra", rateType: "mayorista", rate: 1410.25 });
    expect(parseBcra(list)!.quotedAt.slice(0, 10)).toBe("2026-10-16");
    expect(parseFxResponse("bcra", "oficial", { results: { fecha: "2026-10-16", detalle: [{ codigoMoneda: "USD", tipoCotizacion: 1410 }] } })?.rate).toBe(1410);
  });

  it("sin USD válido devuelve null", () => {
    expect(parseBcra({ results: [{ fecha: "2026-10-16", detalle: [{ codigoMoneda: "EUR", tipoCotizacion: 1 }] }] })).toBeNull();
    expect(parseBcra({ status: 500 })).toBeNull();
  });
});

describe("tarea diaria", () => {
  it("solo con Bearer y el secreto exacto", () => {
    expect(isCronAuthorized("Bearer abc123", "abc123")).toBe(true);
    expect(isCronAuthorized("Bearer abc124", "abc123")).toBe(false);
    expect(isCronAuthorized("abc123", "abc123")).toBe(false);
    expect(isCronAuthorized(null, "abc123")).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
  });
});
