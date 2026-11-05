import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { detectDesktopOs, isDesktopOs, shortcutFile } from "@/lib/pwa";

/** Descarga del acceso directo para la computadora: /acceso-directo?so=windows|mac|linux (si falta, se detecta). */
export function GET(request: NextRequest) {
  const so = request.nextUrl.searchParams.get("so");
  const os = isDesktopOs(so) ? so : detectDesktopOs(request.headers.get("user-agent") ?? "");
  const file = shortcutFile(os, publicEnv.siteUrl);
  return new NextResponse(file.body, {
    headers: {
      "content-type": `${file.contentType}; charset=utf-8`,
      "content-disposition": `attachment; filename="${file.filename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "cache-control": "public, max-age=3600",
    },
  });
}
