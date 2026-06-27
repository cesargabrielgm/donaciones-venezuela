"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMember } from "@/lib/member";
import type { AdminState } from "./state";

// Regla de negocio: counter ⇒ ubicación obligatoria; owner/organizer ⇒ sin ubicación.
const baseMember = z
  .object({
    role: z.enum(["owner", "organizer", "counter"]),
    locationId: z
      .string()
      .uuid()
      .nullish()
      .transform((v) => v || null),
  })
  .refine((d) => d.role !== "counter" || !!d.locationId, {
    message: "El contador necesita una ubicación.",
    path: ["locationId"],
  });

// Normaliza: owner/organizer nunca llevan ubicación.
function normalizeLocation(role: string, locationId: string | null) {
  return role === "counter" ? locationId : null;
}

async function requireOwner() {
  const member = await getMember();
  return member && member.role === "owner" ? member : null;
}

const deny: AdminState = {
  ok: false,
  message: "No tenés permiso para administrar usuarios.",
  variant: "error",
};

function mapMemberError(message: string): string {
  if (/ULTIMO_OWNER/i.test(message))
    return "No podés dejar la campaña sin ningún owner. Asigná otro owner primero.";
  if (/members_role_location_ck/i.test(message))
    return "Revisá el rol y la ubicación (el contador necesita una ubicación).";
  if (/duplicate key|23505/i.test(message))
    return "Esa persona ya tiene acceso.";
  return "No se pudo completar la acción. Intentá de nuevo.";
}

// ---- Invitar persona nueva ----
export async function inviteMember(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  if (!(await requireOwner())) return deny;

  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email("Ingresá un correo válido."),
      fullName: z.string().trim().max(80).optional(),
      role: z.enum(["owner", "organizer", "counter"]),
      locationId: z.string().uuid().nullish().transform((v) => v || null),
    })
    .refine((d) => d.role !== "counter" || !!d.locationId, {
      message: "El contador necesita una ubicación.",
      path: ["locationId"],
    })
    .safeParse({
      email: formData.get("email"),
      fullName: formData.get("fullName") || undefined,
      role: formData.get("role"),
      locationId: formData.get("locationId"),
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos.", variant: "error" };
  }

  const { email, fullName, role } = parsed.data;
  const locationId = normalizeLocation(role, parsed.data.locationId);

  const admin = createAdminClient();
  const origin = (await headers()).get("origin");
  // El invitado llega a /definir-clave para elegir su contraseña.
  const redirectTo = origin ? `${origin}/definir-clave` : undefined;

  // 1) Crear/invitar el usuario en Supabase Auth (envía el email de invitación).
  let userId: string | null = null;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error) {
    // Si ya existe en Auth, lo buscamos y seguimos a crearle el acceso.
    if (/registered|already|exists/i.test(error.message)) {
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      if (!userId) {
        return { ok: false, message: "No se pudo enviar la invitación. Intentá de nuevo.", variant: "error" };
      }
    } else {
      return {
        ok: false,
        message: "No se pudo enviar la invitación (puede ser el límite de correos de Supabase). Probá de nuevo en un rato.",
        variant: "error",
      };
    }
  } else {
    userId = data.user.id;
  }

  // 2) Crear la fila en members con el rol/ubicación, vía el cliente del owner
  //    (RLS vuelve a exigir has_role('owner') — defensa en profundidad).
  const supabase = await createClient();
  const { error: mErr } = await supabase.from("members").insert({
    user_id: userId,
    email,
    full_name: fullName ?? null,
    role,
    location_id: locationId,
  });
  if (mErr) {
    return { ok: false, message: mapMemberError(mErr.message), variant: "error" };
  }

  revalidatePath("/usuarios");
  return { ok: true, message: `Invitamos a ${email}. Le llegará un correo para entrar.`, variant: "success" };
}

// ---- Editar rol / ubicación ----
export async function updateMember(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  if (!(await requireOwner())) return deny;

  const parsed = baseMember
    .and(z.object({ userId: z.string().uuid() }))
    .safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
      locationId: formData.get("locationId"),
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos.", variant: "error" };
  }

  const { userId, role } = parsed.data;
  const locationId = normalizeLocation(role, parsed.data.locationId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .update({ role, location_id: locationId })
    .eq("user_id", userId)
    .select("user_id");

  if (error) return { ok: false, message: mapMemberError(error.message), variant: "error" };
  if (!data || data.length === 0)
    return { ok: false, message: "No se pudo actualizar a esa persona.", variant: "error" };

  revalidatePath("/usuarios");
  return { ok: true, message: "Acceso actualizado.", variant: "success" };
}

// ---- Quitar acceso (borra la fila de members) ----
export async function removeMember(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  if (!(await requireOwner())) return deny;

  const parsed = z.object({ userId: z.string().uuid() }).safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { ok: false, message: "Datos inválidos.", variant: "error" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .delete()
    .eq("user_id", parsed.data.userId)
    .select("user_id");

  if (error) return { ok: false, message: mapMemberError(error.message), variant: "error" };
  if (!data || data.length === 0)
    return { ok: false, message: "No se pudo quitar el acceso.", variant: "error" };

  revalidatePath("/usuarios");
  return { ok: true, message: "Acceso quitado.", variant: "success" };
}
