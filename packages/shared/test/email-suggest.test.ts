import { describe, expect, it } from "vitest";
import { editDistance, suggestEmail } from "../src/email-suggest";

describe("sugerencia de correo", () => {
  it("corrige errores comunes de tipeo en el dominio", () => {
    expect(suggestEmail("juan@gmial.com")).toBe("juan@gmail.com");
    expect(suggestEmail("juan@gmail.con")).toBe("juan@gmail.com");
    expect(suggestEmail("juan@gmai.com")).toBe("juan@gmail.com");
    expect(suggestEmail("juan@hotmal.com")).toBe("juan@hotmail.com");
    expect(suggestEmail("juan@hotmail.com.ra")).toBe("juan@hotmail.com.ar");
    expect(suggestEmail("Juan@Yaho.com")).toBe("juan@yahoo.com");
    expect(suggestEmail("juan@outlok.com")).toBe("juan@outlook.com");
  });

  it("no sugiere nada si el dominio es correcto o no se parece a uno común", () => {
    expect(suggestEmail("juan@gmail.com")).toBeNull();
    expect(suggestEmail("juan@miempresa.com.ar")).toBeNull();
    expect(suggestEmail("juan@uba.ar")).toBeNull();
    expect(suggestEmail("juan")).toBeNull();
    expect(suggestEmail("juan@")).toBeNull();
  });

  it("distancia de edición con letras invertidas", () => {
    expect(editDistance("gmial", "gmail")).toBe(1);
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("", "abc")).toBe(3);
  });
});
