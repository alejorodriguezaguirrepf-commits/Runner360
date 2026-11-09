import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { detectDesktopOs, detectPlatform, iosShortcutProfile, isDesktopOs, shortcutFile } from "@/lib/pwa";
import { APPLE_ICON_BASE64 } from "@/lib/pwa-icon";

/**
 * Descarga del acceso directo: /acceso-directo?so=ios|windows|mac|linux (si falta, se detecta).
 * En iPhone es un perfil que Safari ofrece instalar (va "inline" para que lo abra en vez de guardarlo
 * en Archivos); en la computadora, un archivo para dejar en el escritorio.
 */
export function GET(request: NextRequest) {
  const so = request.nextUrl.searchParams.get("so");
  const ua = request.headers.get("user-agent") ?? "";
  if (so === "ios" || (!so && detectPlatform(ua) === "ios")) {
    const file = iosShortcutProfile(publicEnv.siteUrl, APPLE_ICON_BASE64);
    return new NextResponse(file.body, {
      headers: {
        "content-type": file.contentType,
        "content-disposition": `inline; filename="runner360.mobileconfig"`,
        "cache-control": "public, max-age=3600",
      },
    });
  }
  const os = isDesktopOs(so) ? so : detectDesktopOs(ua);
  const file = shortcutFile(os, publicEnv.siteUrl);
  return new NextResponse(file.body, {
    headers: {
      "content-type": `${file.contentType}; charset=utf-8`,
      "content-disposition": `attachment; filename="${file.filename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "cache-control": "public, max-age=3600",
    },
  });
}
