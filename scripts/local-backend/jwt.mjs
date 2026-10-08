// Genera claves anon y service_role (JWT HS256) para el backend local.
import { createHmac } from "node:crypto";
const secret = process.argv[2];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (payload) => {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
};
// Expiración fija (2100-01-01) para que las claves locales sean estables entre reinicios.
const exp = 4102444800;
console.log(`ANON_KEY=${sign({ iss: "supabase-local", role: "anon", exp })}`);
console.log(`SERVICE_ROLE_KEY=${sign({ iss: "supabase-local", role: "service_role", exp })}`);
