// Gateway mínimo que imita las rutas de Supabase: /auth/v1 → GoTrue, /rest/v1 → PostgREST.
// SOLO para desarrollo/pruebas locales sin Docker.
import http from "node:http";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const ROUTES = [
  { prefix: "/auth/v1", target: { host: "127.0.0.1", port: Number(process.env.GOTRUE_PORT ?? 9999) } },
  { prefix: "/rest/v1", target: { host: "127.0.0.1", port: Number(process.env.POSTGREST_PORT ?? 54323) } },
];

http
  .createServer((req, res) => {
    const route = ROUTES.find((r) => req.url?.startsWith(r.prefix));
    if (!route) {
      res.writeHead(404).end("not found");
      return;
    }
    const headers = { ...req.headers, host: `${route.target.host}:${route.target.port}` };
    const upstream = http.request(
      { ...route.target, method: req.method, path: req.url.slice(route.prefix.length) || "/", headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", (e) => {
      res.writeHead(502).end(String(e));
    });
    req.pipe(upstream);
  })
  .listen(PORT, "127.0.0.1", () => console.log(`gateway en http://127.0.0.1:${PORT}`));
