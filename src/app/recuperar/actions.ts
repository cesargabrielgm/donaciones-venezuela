"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createClient as createSupabase } from "@supabase/supabase-js";
import type { ResetState } from "./state";

const SITE_URL = "https://donaciones-venezuela-nu.vercel.app";

// Dispara el correo de reseteo de Supabase. Mensaje neutro (sin enumeración).
// Usa un cliente con flowType 'implicit' para que el enlace traiga la sesión en
// el hash (#access_token) y la maneje /definir-clave en el navegador.
export async function requestReset(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!parsed.success) {
    return { message: "Ingresá un correo válido.", variant: "error" };
  }

  const origin = (await headers()).get("origin") ?? SITE_URL;
  const supabase = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } }
  );

  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/definir-clave`,
  });

  return {
    message:
      "Si el correo tiene acceso, te enviamos un enlace para definir una contraseña nueva. Revisá tu bandeja (y spam).",
    variant: "info",
  };
}
