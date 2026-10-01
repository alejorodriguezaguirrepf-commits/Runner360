"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

export async function setRoleAction(fd: FormData) {
  await requireAdmin();
  const userId = String(fd.get("userId") ?? "");
  const role = String(fd.get("role") ?? "");
  const grant = fd.get("grant") === "true";
  if (!UUID.test(userId) || !["coach", "admin"].includes(role)) redirect("/admin/usuarios?error=datos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", { p_user_id: userId, p_role: role, p_grant: grant });
  if (error) redirect(`/admin/usuarios?error=rol`);
  revalidatePath("/admin/usuarios");
}

export async function grantSubscriptionAction(fd: FormData) {
  await requireAdmin();
  const userId = String(fd.get("userId") ?? "");
  const days = Number(fd.get("days") ?? 0);
  if (!UUID.test(userId) || !Number.isInteger(days) || days < 1 || days > 730) redirect("/admin/usuarios?error=datos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_grant_subscription", { p_user_id: userId, p_product_code: "premium", p_days: days });
  if (error) redirect(`/admin/usuarios?error=suscripcion`);
  revalidatePath("/admin/usuarios");
}

export async function cancelManualSubscriptionAction(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("subscriptionId") ?? "");
  if (!UUID.test(id)) redirect("/admin/usuarios?error=datos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_subscription", { p_subscription_id: id });
  if (error) redirect(`/admin/usuarios?error=suscripcion`);
  revalidatePath("/admin/usuarios");
}
