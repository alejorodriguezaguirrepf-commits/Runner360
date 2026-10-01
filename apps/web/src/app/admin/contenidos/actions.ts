"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { educationalContentSchema } from "@runner360/shared";
import { requireStaff } from "@/lib/auth";
import { str, strOrNull } from "@/lib/form";
import { createClient } from "@/lib/supabase/server";

export async function saveContentAction(fd: FormData) {
  const viewer = await requireStaff();
  const parsed = educationalContentSchema.safeParse({
    slug: str(fd, "slug"), title: str(fd, "title"), category: str(fd, "category"), summary: strOrNull(fd, "summary"), body: str(fd, "body"), accessTier: str(fd, "accessTier"),
  });
  if (!parsed.success) redirect(`/admin/contenidos?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Datos inválidos")}`);
  const c = parsed.data;
  const row = { slug: c.slug, title: c.title, category: c.category, summary: c.summary, body: c.body, access_tier: c.accessTier };
  const supabase = await createClient();
  const id = str(fd, "id");
  const { error } = id
    ? await supabase.from("educational_contents").update(row).eq("id", id)
    : await supabase.from("educational_contents").insert({ ...row, author_id: viewer.id });
  if (error) redirect(`/admin/contenidos?error=${encodeURIComponent(error.code === "23505" ? "El slug ya existe" : "No se pudo guardar")}`);
  revalidatePath("/admin/contenidos");
  redirect("/admin/contenidos?ok=1");
}

export async function setContentStatusAction(fd: FormData) {
  await requireStaff();
  const status = str(fd, "status");
  if (!["draft", "published", "archived"].includes(status)) redirect("/admin/contenidos");
  const supabase = await createClient();
  await supabase
    .from("educational_contents")
    .update({ status, published_at: status === "published" ? new Date().toISOString() : null })
    .eq("id", str(fd, "id"));
  revalidatePath("/admin/contenidos");
}
