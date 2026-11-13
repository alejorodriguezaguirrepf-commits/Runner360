import { expect, test } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

/** Runnie: responde dentro de la app (sin servicios externos); sin sesión no responde. */
test("Runnie: protegido sin sesión y sin claves externas", async ({ request }) => {
  expect((await request.get("/api/runnie")).status()).toBe(401);
  const post = await request.post("/api/runnie", { data: { messages: [{ role: "user", content: "hola" }] } });
  expect(post.status()).toBe(401);
  const health = await (await request.get("/api/health")).json();
  expect(Object.keys(health.variables)).not.toContain("ANTHROPIC_API_KEY");
});

/** Con sesión y sin suscripción: Runnie responde gratis, con la información de la app. */
test("Runnie: responde gratis a una persona sin suscripción", async ({ page }) => {
  test.skip(!backendConfigured, "Requiere backend Supabase");
  await signUp(page, uniqueEmail("runnie"));
  await completeOnboarding(page);
  await page.getByRole("button", { name: "Preguntale a Runnie, tu asistente" }).click();
  const chat = page.getByRole("dialog", { name: "Runnie" });
  await expect(chat.getByText("Runnie es parte de la suscripción")).toHaveCount(0);
  await chat.getByLabel("Tu pregunta para Runnie").fill("¿Qué es el RPE?");
  await chat.getByRole("button", { name: "Enviar" }).click();
  await expect(chat.getByText(/El RPE es cuánto te costó la sesión/)).toBeVisible();
  await chat.getByLabel("Tu pregunta para Runnie").fill("¿Qué me toca hoy?");
  await chat.getByRole("button", { name: "Enviar" }).click();
  await expect(chat.getByRole("link", { name: "/planes" }).last()).toBeVisible();
});
