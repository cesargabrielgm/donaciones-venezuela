"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UNITS } from "@/lib/types";
import type { ActionState } from "./state";

const uuid = z.string().uuid();

// Cantidad: acepta coma o punto decimal (es-VE), positiva, hasta 3 decimales.
const quantitySchema = z
  .string()
  .transform((s) => Number(s.replace(",", ".").trim()))
  .refine((n) => Number.isFinite(n) && n > 0 && n <= 9_999_999, {
    message: "La cantidad debe ser un número mayor a cero.",
  })
  .transform((n) => Math.round(n * 1000) / 1000);

// Guardar una entrada de conteo. La unidad se deriva del producto en el server
// (no se confía en el cliente). RLS valida ubicación + counted_by.
export async function saveCount(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({
      productId: uuid,
      locationId: uuid,
      quantity: quantitySchema,
      note: z.string().trim().max(200).optional().or(z.literal("")),
    })
    .safeParse({
      productId: formData.get("productId"),
      locationId: formData.get("locationId"),
      quantity: formData.get("quantity"),
      note: formData.get("note") ?? "",
    });

  if (!parsed.success) {
    return { ok: false, message: "Revisá el producto y la cantidad (debe ser mayor a cero).", variant: "error" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión vencida. Volvé a entrar.", variant: "error" };

  // Unidad real desde el producto (server-side).
  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("id, unit, kind, location_id")
    .eq("id", parsed.data.productId)
    .maybeSingle();
  if (pErr || !product) {
    return { ok: false, message: "Ese producto no está disponible.", variant: "error" };
  }

  const { error } = await supabase.from("count_entries").insert({
    location_id: parsed.data.locationId,
    product_id: parsed.data.productId,
    quantity: parsed.data.quantity,
    unit: product.unit,
    counted_by: user.id,
    note: parsed.data.note || null,
  });

  if (error) {
    return { ok: false, message: "No se pudo guardar el conteo. Intentá de nuevo.", variant: "error" };
  }

  revalidatePath("/conteo");
  return { ok: true, message: "Conteo guardado.", variant: "success" };
}

// Editar un conteo ya registrado. Solo cambia cantidad y nota; el producto, la
// ubicación y la unidad quedan como estaban (la unidad es snapshot del producto).
// counted_by/location_id NO se tocan acá y, además, la RLS (with_check) impide que
// un counter reasigne la fila a otro o a otra ubicación. Si la fila no es del
// usuario (y no es owner/organizer), la RLS hace que el update afecte 0 filas.
export async function editCount(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({
      entryId: uuid,
      quantity: quantitySchema,
      note: z.string().trim().max(200).optional().or(z.literal("")),
    })
    .safeParse({
      entryId: formData.get("entryId"),
      quantity: formData.get("quantity"),
      note: formData.get("note") ?? "",
    });

  if (!parsed.success) {
    return { ok: false, message: "Revisá la cantidad (debe ser mayor a cero).", variant: "error" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión vencida. Volvé a entrar.", variant: "error" };

  // Solo quantity y note. .select() nos dice si la RLS dejó tocar la fila.
  const { data, error } = await supabase
    .from("count_entries")
    .update({ quantity: parsed.data.quantity, note: parsed.data.note || null })
    .eq("id", parsed.data.entryId)
    .select("id");

  if (error) {
    return { ok: false, message: "No se pudo guardar el cambio. Intentá de nuevo.", variant: "error" };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: "No podés modificar este conteo.", variant: "error" };
  }

  revalidatePath("/conteo");
  return { ok: true, message: "Conteo actualizado.", variant: "success" };
}

// Borrar un conteo. Destructivo: cambia el "disponible" del paletizado (que es
// derivado por suma, así que se recalcula solo). La RLS permite borrar solo lo
// propio al counter; owner/organizer borran cualquiera de su ubicación.
export async function deleteCount(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z.object({ entryId: uuid }).safeParse({
    entryId: formData.get("entryId"),
  });

  if (!parsed.success) {
    return { ok: false, message: "No se pudo identificar el conteo a borrar.", variant: "error" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión vencida. Volvé a entrar.", variant: "error" };

  const { data, error } = await supabase
    .from("count_entries")
    .delete()
    .eq("id", parsed.data.entryId)
    .select("id");

  if (error) {
    return { ok: false, message: "No se pudo borrar el conteo. Intentá de nuevo.", variant: "error" };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: "No podés borrar este conteo.", variant: "error" };
  }

  revalidatePath("/conteo");
  return { ok: true, message: "Conteo borrado.", variant: "success" };
}

// Agregar un producto personalizado para una ubicación. La lista de bloqueo
// (trigger en la base) es la pared real; acá traducimos su error a un mensaje amable.
export async function addCustomProduct(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Poné un nombre.").max(80),
      unit: z.enum(UNITS),
      locationId: uuid,
    })
    .safeParse({
      name: formData.get("name"),
      unit: formData.get("unit"),
      locationId: formData.get("locationId"),
    });

  if (!parsed.success) {
    return { ok: false, message: "Revisá el nombre y la unidad del producto.", variant: "error" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión vencida. Volvé a entrar.", variant: "error" };

  const { error } = await supabase.from("products").insert({
    name: parsed.data.name,
    kind: "custom",
    unit: parsed.data.unit,
    location_id: parsed.data.locationId,
    created_by: user.id,
  });

  if (error) {
    // Mensaje amable de la lista de bloqueo.
    if (/no se puede recibir/i.test(error.message)) {
      return {
        ok: false,
        message:
          "Ese producto no se puede recibir en la campaña. Si creés que es un error, avisá a tu organizador.",
        variant: "error",
      };
    }
    if (error.code === "23505") {
      return { ok: false, message: "Ese producto ya existe en esta ubicación.", variant: "error" };
    }
    return { ok: false, message: "No se pudo agregar el producto. Intentá de nuevo.", variant: "error" };
  }

  revalidatePath("/conteo");
  return { ok: true, message: `Producto "${parsed.data.name}" agregado.`, variant: "success" };
}
