// Gateway mínimo estilo Supabase: /auth/v1 → GoTrue, /rest/v1 → PostgREST. SOLO para pruebas locales.
import http from "node:http";
const routes = [
  ["/auth/v1", Number(process.env.AUTH_PORT ?? 9999)],
  ["/rest/v1", Number(process.env.REST_PORT ?? 3001)],
];
const port = Number(process.env.GATEWAY_PORT ?? 54321);
http
  .createServer((req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "authorization, apikey, content-type, prefer, x-client-info, accept-profile, content-profile, range, x-supabase-api-version");
    res.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    const route = routes.find(([p]) => req.url.startsWith(p));
    if (!route) return res.writeHead(404).end("not found");
    const [prefix, target] = route;
    const upstream = http.request(
      { host: "127.0.0.1", port: target, path: req.url.slice(prefix.length) || "/", method: req.method, headers: { ...req.headers, host: `127.0.0.1:${target}` } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => res.writeHead(502).end("upstream error"));
    req.pipe(upstream);
  })
  .listen(port, "127.0.0.1", () => console.log(`gateway en http://127.0.0.1:${port}`));
