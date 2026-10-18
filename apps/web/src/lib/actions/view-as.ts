"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { parseViewAs, VIEW_AS_COOKIE } from "@/lib/view-as";

/** El admin pasa a ver la app como usuario sin suscripción ("free") o con suscripción ("premium"). */
export async function startViewAsAction(formData: FormData): Promise<void> {
  const session = await getSession();
  // Solo el rol real de la base habilita la vista; para cualquier otra cuenta, la acción no existe.
  if (!session || session.profile.role !== "admin") notFound();
  const mode = parseViewAs(String(formData.get("mode") ?? ""));
  if (!mode) return;
  (await cookies()).set(VIEW_AS_COOKIE, mode, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 });
  redirect("/inicio");
}

/** Vuelve a la vista de administrador. */
export async function stopViewAsAction(): Promise<void> {
  (await cookies()).delete(VIEW_AS_COOKIE);
  redirect("/admin");
}
