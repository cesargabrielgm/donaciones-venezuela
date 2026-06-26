import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente Supabase para Server Components, Server Actions y Route Handlers.
// Usa la anon key + la sesión del usuario (cookies). RLS aplica como 'authenticated'.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll desde un Server Component (sin permiso de escribir cookies):
            // el refresh de sesión lo maneja el proxy. Se ignora a propósito.
          }
        },
      },
    }
  );
}
