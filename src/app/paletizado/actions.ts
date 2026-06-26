"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMember } from "@/lib/member";
import { fmtQty } from "@/lib/format";
import type { PackState } from "./state";

const uuid = z.string().uuid();
const quantitySchema = z
  .string()
  .transform((s) => Number(s.replace(",", ".").trim()))
  .refine((n) => Number.isFinite(n) && n > 0 && n <= 9_999_999, {
    message: "La cantidad debe ser un número mayor a cero.",
  })
  .transform((n) => Math.round(n * 1000) / 1000);

// Gate owner/organizer (la base ya lo exige; esto lo espeja).
async function requirePacker() {
  const m = await getMember();
  return m && (m.role === "owner" || m.role === "organizer") ? m : null;
}

const deny: PackState = { ok: false, message: "No tenés permiso para paletizar.", variant: "error" };

// Crear una caja nueva (acción directa de formulario).
export async function createBox(formData: FormData): Promise<void> {
  if (!(await requirePacker())) return;
  const parsed = z
    .object({ locationId: uuid, code: z.string().trim().max(60).optional() })
    .safeParse({ locationId: formData.get("locationId"), code: formData.get("code") || undefined });
  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("pallets").insert({
    location_id: parsed.data.locationId,
    code: parsed.data.code || null,
    status: "open",
    created_by: user?.id ?? null,
  });
  revalidatePath("/paletizado");
}

// Agregar una línea a una caja (descuento atómico vía RPC). Avisa si te pasaste.
export async function packLine(_prev: PackState, formData: FormData): Promise<PackState> {
  if (!(await requirePacker())) return deny;

  const parsed = z
    .object({ palletId: uuid, productId: uuid, quantity: quantitySchema })
    .safeParse({
      palletId: formData.get("palletId"),
      productId: formData.get("productId"),
      quantity: formData.get("quantity"),
    });
  if (!parsed.success) {
    return { ok: false, message: "Revisá el producto y la cantidad.", variant: "error" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pack_into_box", {
    p_pallet_id: parsed.data.palletId,
    p_product_id: parsed.data.productId,
    p_quantity: parsed.data.quantity,
  });

  if (error) {
    if (/PRODUCTO_OTRA_UBICACION/.test(error.message))
      return { ok: false, message: "Ese producto no es de esta ubicación.", variant: "error" };
    return { ok: false, message: "No se pudo agregar la línea. Intentá de nuevo.", variant: "error" };
  }

  const r = data as {
    unit: string;
    exceeded: boolean;
    exceeded_by: number;
    available_after: number;
  };

  revalidatePath("/paletizado");

  if (r.exceeded) {
    // El nombre del producto para el aviso.
    const { data: prod } = await supabase
      .from("products")
      .select("name")
      .eq("id", parsed.data.productId)
      .maybeSingle();
    const name = prod?.name ?? "ese producto";
    return {
      ok: true,
      variant: "warning",
      message: `Ojo: te pasaste con ${name} por ${fmtQty(Number(r.exceeded_by))} ${r.unit} de lo contado. La línea se guardó igual (queda en negativo).`,
    };
  }

  return { ok: true, message: "Línea agregada.", variant: "success" };
}

// Quitar una línea (acción directa).
export async function deleteLine(formData: FormData): Promise<void> {
  if (!(await requirePacker())) return;
  const id = uuid.safeParse(formData.get("itemId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("pallet_items").delete().eq("id", id.data);
  revalidatePath("/paletizado");
}

// Quitar una caja entera (cascada borra sus líneas).
export async function deleteBox(formData: FormData): Promise<void> {
  if (!(await requirePacker())) return;
  const id = uuid.safeParse(formData.get("palletId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("pallets").delete().eq("id", id.data);
  revalidatePath("/paletizado");
}
