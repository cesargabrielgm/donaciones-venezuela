import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/types";

// Devuelve el usuario autenticado (validado contra Supabase) o null.
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Devuelve la fila de members del usuario actual (rol + ubicación) o null.
// RLS permite leer la fila propia.
export async function getMember(): Promise<Member | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("members")
    .select("user_id, full_name, role, location_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as Member | null) ?? null;
}
