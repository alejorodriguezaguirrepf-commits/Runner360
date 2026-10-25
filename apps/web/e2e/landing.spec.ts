import { expect, test } from "@playwright/test";

test.describe("landing", () => {
  test("muestra la propuesta comercial en español y sin testimonios inventados", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Tu próximo objetivo empieza con un plan." })).toBeVisible();
    await expect(page.getByText("Entrená para tus primeros 5K, mejorá tus marcas o prepará tu próxima maratón con un plan adaptado a vos.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Comenzar gratis" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Conocer los planes" })).toBeVisible();
    await expect(page.getByText("Beta en desarrollo")).toBeVisible();
    for (const id of ["como-funciona", "distancias", "precios", "preguntas"]) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await expect(page.getByRole("link", { name: "Política de privacidad" })).toBeVisible();
    // La vista de ejemplo es el último bloque de la página y ya no hay 15 km.
    await expect(page.locator("#contenido > section").last()).toHaveAttribute("aria-labelledby", "vista-ejemplo");
    await expect(page.getByRole("heading", { name: "Vista de ejemplo" })).toBeVisible();
    await expect(page.locator("#distancias").getByText("15K")).toHaveCount(0);
    await expect(page.getByText("Criterio profesional")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
  });

  test("preguntas frecuentes: acordeón accesible y datos estructurados iguales al texto visible", async ({ page }) => {
    await page.goto("/#preguntas");
    const section = page.locator("#preguntas");
    const buttons = section.getByRole("button");
    const questions = [
      "¿Quién diseña los planes?",
      "¿Necesito experiencia previa?",
      "¿La app reemplaza a un entrenador?",
      "¿Puedo usarla gratis?",
      "¿Cómo se cobran las suscripciones?",
      "¿Puedo cancelar cuando quiera?",
    ];
    await expect(buttons).toHaveCount(questions.length);
    for (const [i, q] of questions.entries()) await expect(buttons.nth(i)).toHaveAccessibleName(q);
    const first = buttons.first();
    const answer = page.locator(`#${await first.getAttribute("aria-controls")}`);
    // «¿Quién diseña los planes?» viene abierta, con foto, nombre y respuesta.
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(answer).toBeVisible();
    const designer = page.getByRole("region", { name: "¿Quién diseña los planes?" });
    await expect(designer).toContainText("Alejo Rodríguez Aguirre");
    await expect(designer.getByRole("img", { name: /^Retrato de Alejo Rodríguez Aguirre/ })).toBeVisible();
    await expect(designer.getByRole("img")).toHaveCount(1);
    // Mouse: cierra y abre.
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await expect(answer).toBeHidden();
    await first.click();
    await expect(answer).toBeVisible();
    await first.click();
    await expect(answer).toBeHidden();
    // Teclado: Enter y Espacio abren y cierran; las flechas mueven el foco.
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Space");
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("ArrowDown");
    await expect(buttons.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(buttons.last()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(first).toBeFocused();

    // JSON-LD: mismas preguntas y respuestas que en pantalla.
    for (let i = 0; i < 6; i++) await buttons.nth(i).click();
    const visible = await section.locator("[data-faq-id]").evaluateAll((els) =>
      els.map((el) => [el.querySelector("button span:not([aria-hidden])")!.textContent!.trim(), el.querySelector("[data-faq-answer]")!.textContent!.trim()]),
    );
    const ld = JSON.parse((await section.locator('script[type="application/ld+json"]').textContent())!);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => [q.name, q.acceptedAnswer.text])).toEqual(visible);
  });

  test("las rutas privadas redirigen al ingreso", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/ingresar/);
  });

  test("los documentos legales se identifican como borradores", async ({ page }) => {
    await page.goto("/privacidad");
    await expect(page.getByText("Borrador sujeto a revisión legal")).toBeVisible();
  });
});
