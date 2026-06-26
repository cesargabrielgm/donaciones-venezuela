"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "./state";

const emailSchema = z.string().trim().toLowerCase().email();

// Paso 1: pedir el código por email. shouldCreateUser:false → solo entran
// usuarios que el dueño ya dio de alta. Respuesta genérica para no revelar
// si el correo existe (owasp: sin enumeración de cuentas).
export async function loginAction(
  prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const intent = String(formData.get("intent") ?? "");
  const supabase = await createClient();

  if (intent === "request") {
    const parsed = emailSchema.safeParse(formData.get("email"));
    if (!parsed.success) {
      return { step: "email", email: "", message: "Ingresá un correo válido.", variant: "error" };
    }
    const origin = (await headers()).get("origin") ?? "";
    await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: origin ? `${origin}/auth/confirm` : undefined,
      },
    });
    // Siempre avanzamos al paso del código con mensaje genérico.
    return {
      step: "code",
      email: parsed.data,
      message:
        "Si el correo tiene acceso, te enviamos un código y un enlace. Revisá tu bandeja (y spam).",
      variant: "info",
    };
  }

  if (intent === "verify") {
    const email = String(formData.get("email") ?? "");
    const token = String(formData.get("token") ?? "").trim();
    const parsed = z
      .object({ email: emailSchema, token: z.string().regex(/^\d{6}$/) })
      .safeParse({ email, token });
    if (!parsed.success) {
      return { step: "code", email, message: "Ingresá el código de 6 dígitos.", variant: "error" };
    }
    const { error } = await supabase.auth.verifyOtp({
      email: parsed.data.email,
      token: parsed.data.token,
      type: "email",
    });
    if (error) {
      return {
        step: "code",
        email,
        message: "El código no es válido o ya venció. Pedí uno nuevo.",
        variant: "error",
      };
    }
    redirect("/conteo");
  }

  return prev;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
