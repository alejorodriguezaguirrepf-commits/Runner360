// Genera claves JWT (anon / service_role) firmadas con el secreto local. SOLO para el entorno local de pruebas.
import { createHmac } from "node:crypto";
const [secret, role] = process.argv.slice(2);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const header = b64({ alg: "HS256", typ: "JWT" });
const payload = b64({ iss: "runner360-local", role, iat: 1700000000, exp: 2100000000 });
const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
process.stdout.write(`${header}.${payload}.${sig}`);
