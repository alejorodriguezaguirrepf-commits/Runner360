import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeByToken } from "@/lib/actions/email-preferences";

/**
 * Baja con un toque desde el programa de correo (List-Unsubscribe-Post, RFC 8058): el programa manda un
 * POST a esta dirección. Un GET (alguien que abre el link) va a la página de baja con confirmación.
 */
export async function POST(request: NextRequest) {
  const ok = await unsubscribeByToken(request.nextUrl.searchParams.get("t") ?? "");
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

export async function GET(request: NextRequest) {
  const url = new URL("/correos/baja", request.url);
  url.searchParams.set("t", request.nextUrl.searchParams.get("t") ?? "");
  return NextResponse.redirect(url);
}
