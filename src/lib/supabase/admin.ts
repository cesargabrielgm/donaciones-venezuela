import { createClient } from "@supabase/supabase-js";

// Cliente con service_role. SOLO servidor. NUNCA importar desde un componente
// de cliente. Lee SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_), así nunca llega
// al bundle del navegador. Bypassa RLS: usar solo tras autorizar al caller.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
