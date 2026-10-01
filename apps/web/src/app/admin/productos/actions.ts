"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FEATURES, parseMoneyToMinor, priceSchema } from "@runner360/shared";
import { requireAdmin } from "@/lib/auth";
import { bool, str } from "@/lib/form";
import { createClient } from "@/lib/supabase/server";

export async function updateProductAction(fd: FormData) {
  await requireAdmin();
  const features = fd.getAll("features").map(String).filter((f) => (FEATURES as readonly string[]).includes(f));
  const supabase = await createClient();
  const { error } = await supabase
    .from("subscription_products")
    .update({ name: str(fd, "name").slice(0, 80), description: str(fd, "description").slice(0, 500), features, active: bool(fd, "active") })
    .eq("id", str(fd, "productId"));
  if (error) redirect("/admin/productos?error=producto");
  revalidatePath("/admin/productos");
  revalidatePath("/");
}

export async function addPriceAction(fd: FormData) {
  await requireAdmin();
  const parsed = priceSchema.safeParse({
    productId: str(fd, "productId"),
    currency: str(fd, "currency"),
    amountMinor: parseMoneyToMinor(str(fd, "amount")) ?? Number.NaN,
    interval: str(fd, "interval"),
    active: true,
  });
  if (!parsed.success) redirect("/admin/productos?error=precio");
  const p = parsed.data;
  const providerIds: Record<string, string> = {};
  if (str(fd, "stripePriceId")) providerIds.stripe = str(fd, "stripePriceId").slice(0, 100);
  const supabase = await createClient();
  // Un solo precio activo por producto/moneda/período: el anterior se desactiva (queda en el historial).
  await supabase.from("subscription_prices").update({ active: false })
    .eq("product_id", p.productId).eq("currency", p.currency).eq("billing_interval", p.interval).eq("active", true);
  const { error } = await supabase.from("subscription_prices").insert({
    product_id: p.productId, currency: p.currency, amount_minor: p.amountMinor, billing_interval: p.interval, provider_price_ids: providerIds, active: true,
  });
  if (error) redirect("/admin/productos?error=precio");
  revalidatePath("/admin/productos");
  revalidatePath("/");
}

export async function deactivatePriceAction(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("subscription_prices").update({ active: false }).eq("id", str(fd, "priceId"));
  revalidatePath("/admin/productos");
  revalidatePath("/");
}
