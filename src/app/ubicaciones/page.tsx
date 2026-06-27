import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMember } from "@/lib/member";
import { signOut } from "@/app/login/actions";
import { ROLE_LABEL } from "@/lib/types";
import { UbicacionesAdmin } from "./ubicaciones-admin";

type LocRow = { id: string; name: string; address: string | null; is_active: boolean };

export default async function UbicacionesPage() {
  const member = await getMember();
  if (!member) redirect("/sin-acceso");
  if (member.role !== "owner") redirect("/conteo");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: locData }, { data: ce }, { data: mem }, { data: pal }] = await Promise.all([
    supabase.from("locations").select("id, name, address, is_active").order("name"),
    supabase.from("count_entries").select("location_id"),
    supabase.from("members").select("location_id"),
    supabase.from("pallets").select("location_id"),
  ]);

  // Una ubicación "en uso" (no borrable en duro) si tiene conteos, gente o cajas.
  const inUse = new Set<string>();
  for (const r of ce ?? []) if (r.location_id) inUse.add(r.location_id);
  for (const r of mem ?? []) if (r.location_id) inUse.add(r.location_id);
  for (const r of pal ?? []) if (r.location_id) inUse.add(r.location_id);

  const locations = ((locData ?? []) as LocRow[]).map((l) => ({ ...l, inUse: inUse.has(l.id) }));

  return (
    <div className="flex-1">
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto w-full max-w-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold truncate">Ubicaciones</p>
            <p className="hint truncate">
              <span className="badge mr-2">{ROLE_LABEL[member.role]}</span>
              {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/conteo" className="btn btn-ghost">Conteo</Link>
            <Link href="/usuarios" className="btn btn-ghost">Usuarios</Link>
            <form action={signOut}>
              <button type="submit" className="btn btn-ghost">Salir</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-5">
        <UbicacionesAdmin locations={locations} />
      </main>
    </div>
  );
}
