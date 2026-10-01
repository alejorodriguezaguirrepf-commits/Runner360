import { describe, expect, it } from "vitest";
import { localInputToIso } from "./datetime";

describe("localInputToIso", () => {
  it("aplica el desfase del navegador (Argentina = 180)", () => {
    expect(localInputToIso("2026-10-01T07:30", 180)).toBe("2026-10-01T07:30:00-03:00");
    expect(localInputToIso("2026-10-01T07:30", -120)).toBe("2026-10-01T07:30:00+02:00");
    expect(localInputToIso("2026-10-01T07:30", 0)).toBe("2026-10-01T07:30:00+00:00");
  });
  it("rechaza formatos inválidos y usa Argentina si el desfase es inválido", () => {
    expect(localInputToIso("01/10/2026", 180)).toBeNull();
    expect(localInputToIso("2026-10-01T07:30", 99999)).toBe("2026-10-01T07:30:00-03:00");
  });
});
