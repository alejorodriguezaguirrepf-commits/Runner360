import { describe, expect, it } from "vitest";
import { formatClock, formatDistance, maskClock, paceAt, parseClock, parseDistance, parseKm, PERCENTS, timeAt } from "@/lib/calculator";

describe("entradas", () => {
  it("km del test con coma o punto", () => {
    expect(parseKm("2,4")).toBe(2.4);
    expect(parseKm("5")).toBe(5);
    expect(parseKm("3.2")).toBe(3.2);
    for (const bad of ["", "0", "abc", "2,4,1", "-3", "500"]) expect(parseKm(bad)).toBeNull();
  });

  it("tiempo mm:ss o hh:mm:ss", () => {
    expect(parseClock("12:00")).toBe(720);
    expect(parseClock("9:45")).toBe(585);
    expect(parseClock("1:05:30")).toBe(3930);
    expect(parseClock("75:00")).toBe(4500);
    for (const bad of ["", "12", "12:60", "1:60:00", "a:bc", "0:00", "1:2:3:4"]) expect(parseClock(bad)).toBeNull();
  });

  it("tiempo: los dos puntos se ponen solos mientras se escribe", () => {
    // Escritura dígito por dígito: 1 → 12 → 1:20 → 12:00
    expect(["1", "12", "120", "1200"].map(maskClock)).toEqual(["1", "12", "1:20", "12:00"]);
    expect(maskClock("945")).toBe("9:45");
    expect(maskClock("13030")).toBe("1:30:30");
    expect(maskClock("013030")).toBe("1:30:30");
    expect(maskClock("0945")).toBe("9:45");
    // Pegar un tiempo con ":" o caracteres sueltos también funciona; máximo 6 dígitos.
    expect(maskClock("12:00")).toBe("12:00");
    expect(maskClock("1h 05m 30s")).toBe("1:05:30");
    expect(maskClock("1234567")).toBe("12:34:56");
    expect(maskClock("")).toBe("");
    // Al borrar el último dígito, se reacomoda: 12:00 → 1:20
    expect(maskClock("12:0")).toBe("1:20");
    // El resultado se puede leer como tiempo.
    expect(parseClock(maskClock("1200"))).toBe(720);
    expect(parseClock(maskClock("13030"))).toBe(5430);
  });

  it("distancias en metros o km", () => {
    expect(parseDistance("200")).toBe(200);
    expect(parseDistance("400 m")).toBe(400);
    expect(parseDistance("1000m")).toBe(1000);
    expect(parseDistance("1,5 km")).toBe(1500);
    expect(parseDistance("5km")).toBe(5000);
    expect(parseDistance("5")).toBe(5000);
    expect(parseDistance("21,0975 km")).toBe(21098);
    for (const bad of ["", "km", "10 millas", "0", "200 km"]) expect(parseDistance(bad)).toBeNull();
  });
});

describe("porcentajes sobre la velocidad (casos verificados a mano)", () => {
  // Test: 2,4 km en 12:00 → 12 km/h → 5:00/km.
  const test = { meters: 2400, seconds: 720 };

  it("100 % es el ritmo del test", () => {
    expect(formatClock(paceAt(test, 100))).toBe("5:00");
    expect(formatClock(timeAt(test, 400, 100))).toBe("2:00");
    expect(formatClock(timeAt(test, 2400, 100))).toBe("12:00");
  });

  it("al 50 % se tarda el doble; al 80 % 1,25 veces", () => {
    expect(formatClock(timeAt(test, 400, 50))).toBe("4:00");
    expect(formatClock(paceAt(test, 50))).toBe("10:00");
    expect(formatClock(timeAt(test, 400, 80))).toBe("2:30");
    expect(formatClock(paceAt(test, 80))).toBe("6:15");
  });

  it("redondea al segundo: 1000 m al 90 % = 333,3 s → 5:33", () => {
    expect(formatClock(timeAt(test, 1000, 90))).toBe("5:33");
    expect(formatClock(timeAt(test, 200, 95))).toBe("1:03"); // 60 s / 0,95 = 63,2 s
  });

  it("tiempos de más de una hora en h:mm:ss", () => {
    expect(formatClock(timeAt(test, 10000, 50))).toBe("1:40:00");
  });

  it("tabla: 11 porcentajes del 100 al 50 de a 5", () => {
    expect(PERCENTS).toEqual([100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]);
  });

  it("formato de distancias", () => {
    expect(formatDistance(400)).toBe("400 m");
    expect(formatDistance(1000)).toBe("1 km");
    expect(formatDistance(1500)).toBe("1,5 km");
  });
});
