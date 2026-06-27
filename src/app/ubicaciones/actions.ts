"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMember } from "@/lib/member";
import type { LocState } from "./state";

const uuid = z.string().uuid();

async function requireOwner() {
  const m = await getMember();
  return m && m.role === "owner" ? m : null;
}

const deny: LocState = { ok: false, message: "No tenés permiso para gestionar ubicaciones.", variant: "error" };

const fields = z.object({
  name: z.string().trim().min(2, "Poné un nombre.").max(80),
  address: z.string().trim().max(160).optional().transform((v) => v || null),
});

// Crear ubicación.
export async function createLocation(_prev: LocState, formData: FormData): Promise<LocState> {
  if (!(await requireOwner())) return deny;
  const parsed = fields.safeParse({ name: formData.get("name"), address: formData.get("address") || undefined });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos.", variant: "error" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("locations").insert({ name: parsed.data.name, address: parsed.data.address });
  if (error) {
    if (/duplicate key|23505/i.test(error.message)) return { ok: false, message: "Ya hay una ubicación con ese nombre.", variant: "error" };
    return { ok: false, message: "No se pudo crear la ubicación.", variant: "error" };
  }
  revalidatePath("/ubicaciones");
  return { ok: true, message: `Ubicación "${parsed.data.name}" creada.`, variant: "success" };
}

// Editar nombre / dirección.
export async function updateLocation(_prev: LocState, formData: FormData): Promise<LocState> {
  if (!(await requireOwner())) return deny;
  const parsed = fields.and(z.object({ id: uuid })).safeParse({
    id: formData.get("id"), name: formData.get("name"), address: formData.get("address") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos.", variant: "error" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .update({ name: parsed.data.name, address: parsed.data.address })
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "No se pudo actualizar la ubicación.", variant: "error" };
  revalidatePath("/ubicaciones");
  return { ok: true, message: "Ubicación actualizada.", variant: "success" };
}

// Activar / desactivar (reversible). Acción directa.
export async function setLocationActive(formData: FormData): Promise<void> {
  if (!(await requireOwner())) return;
  const id = uuid.safeParse(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("locations").update({ is_active: active }).eq("id", id.data);
  revalidatePath("/ubicaciones");
}

// Borrar en duro. Solo se ofrece para ubicaciones sin datos asociados; si igual
// choca una FK (conteos/gente), se traduce a un mensaje claro. Acción directa.
export async function deleteLocation(formData: FormData): Promise<void> {
  if (!(await requireOwner())) return;
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("locations").delete().eq("id", id.data);
  revalidatePath("/ubicaciones");
}
