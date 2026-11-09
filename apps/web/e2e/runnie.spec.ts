import { expect, test } from "@playwright/test";

/** Runnie: sin sesión no responde; sin clave configurada queda apagado (y no gasta). */
test("Runnie: protegido y apagado sin clave", async ({ request }) => {
  const status = await (await request.get("/api/runnie")).json();
  const post = await request.post("/api/runnie", { data: { messages: [{ role: "user", content: "hola" }] } });
  if (status.enabled === false) {
    expect(post.status()).toBe(503);
  } else {
    // Con clave: sin sesión no hay respuesta.
    expect(post.status()).toBe(401);
  }
  const health = await (await request.get("/api/health")).json();
  expect(Object.keys(health.variables)).toContain("ANTHROPIC_API_KEY");
});
