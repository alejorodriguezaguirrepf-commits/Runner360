import type { PriceRow } from "@runner360/shared";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arsEquivalent, checkoutAvailable, type PricedProduct } from "@/lib/data/pricing";
import { arsMinorFromUsd, formatArs, formatListPrice, formatUsd } from "@/lib/money";

const price = (currency: string, amount_minor: number, provider: string | null = null) => ({ id: "p", product_id: "x", currency, amount_minor, provider, active: true }) as unknown as PriceRow;
const rate = { rate: 1499.95, quotedAt: "2026-10-16T15:00:00.000Z", fetchedAt: "2026-10-16T15:01:00.000Z", source: "dolarapi", rateType: "oficial" };

describe("precio en pesos", () => {
  it("convierte con la cotización y redondea al peso hacia arriba", () => {
    expect(arsMinorFromUsd(2000, 1499.95)).toBe(2999900);
    expect(arsMinorFromUsd(18000, 1499.95)).toBe(26999100);
    expect(arsMinorFromUsd(2000, 1500)).toBe(3000000);
    expect(arsMinorFromUsd(2000, 1499.951)).toBe(3000000); // 29.999,02 → 30.000
    expect(() => arsMinorFromUsd(2000, 0)).toThrow();
    expect(() => arsMinorFromUsd(20.5, 1000)).toThrow();
  });

  it("formatos: $ 29.999 y US$ 20", () => {
    expect(formatArs(2999900)).toBe("$ 29.999");
    expect(formatUsd(2000)).toBe("US$ 20");
    expect(formatUsd(18000)).toBe("US$ 180");
    expect(formatUsd(1999)).toBe("US$ 19,99");
    expect(formatListPrice(2999900, "ARS")).toBe("$ 29.999");
  });

  it("equivalente: con cotización muestra el importe y la fecha; sin cotización se oculta", () => {
    expect(arsEquivalent(price("USD", 2000), rate)).toMatchObject({ amountMinor: 2999900, label: "$ 29.999" });
    expect(arsEquivalent(price("USD", 2000), rate)!.rateNote).toMatch(/oficial/);
    expect(arsEquivalent(price("USD", 2000), null)).toBeNull();
    expect(arsEquivalent(null, rate)).toBeNull();
    expect(arsEquivalent(price("ARS", 2999900), null)).toMatchObject({ label: "$ 29.999" });
  });

  it("Mercado Pago se ofrece con precio de lista en USD o ARS; otros proveedores necesitan su precio", () => {
    const p = { listPrice: price("USD", 2000), prices: [price("USD", 2000)] } as unknown as PricedProduct;
    expect(checkoutAvailable(p, "mercadopago")).toBe(true);
    expect(checkoutAvailable(p, "stripe")).toBe(false);
    expect(checkoutAvailable({ ...p, listPrice: null } as PricedProduct, "mercadopago")).toBe(false);
  });
});

describe("no queda el precio anterior", () => {
  it("sin USD 8 / 7,99 en la app web, la app móvil, los seeds ni la documentación", () => {
    const root = join(__dirname, "..", "..", "..");
    const dirs = ["apps/web/src", "apps/mobile/lib", "supabase/seed", "docs", "README.md", ".env.example"].map((d) => join(root, d));
    const re = /(USD|US\$|u\$s)\s?8(?![\d,.])|\b8 d[oó]lares|\$\s?8(?![\d.,])|7[,.]99|\b799\b/i;
    const hits: string[] = [];
    const walk = (p: string) => {
      const st = statSync(p, { throwIfNoEntry: false });
      if (!st) return;
      if (st.isDirectory()) for (const f of readdirSync(p)) walk(join(p, f));
      else if (/\.(tsx?|dart|sql|md|example)$/.test(p) || p.endsWith(".env.example")) {
        readFileSync(p, "utf8").split("\n").forEach((line, i) => {
          if (re.test(line)) hits.push(`${p.replace(root, "")}:${i + 1}: ${line.trim()}`);
        });
      }
    };
    dirs.forEach(walk);
    expect(hits).toEqual([]);
  });
});
