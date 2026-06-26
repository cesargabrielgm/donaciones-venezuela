import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMember } from "@/lib/member";
import { signOut } from "@/app/login/actions";
import { ROLE_LABEL, type LocationRow, type Role } from "@/lib/types";
import { UsuariosAdmin } from "./usuarios-admin";

type MemberView = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  location_id: string | null;
};

export default async function UsuariosPage() {
  const member = await getMember();
  if (!member) redirect("/sin-acceso");
  // Gate de "solo owner" en la app (la base ya lo garantiza con RLS).
  if (member.role !== "owner") redirect("/conteo");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberData } = await supabase
    .from("members")
    .select("user_id, email, full_name, role, location_id")
    .order("role")
    .order("email");
  const members = (memberData ?? []) as MemberView[];

  const { data: locData } = await supabase
    .from("locations")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const locations = (locData ?? []) as LocationRow[];

  return (
    <div className="flex-1">
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto w-full max-w-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold truncate">Administración de usuarios</p>
            <p className="hint truncate">
              <span className="badge mr-2">{ROLE_LABEL[member.role]}</span>
              {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/conteo" className="btn btn-ghost">Conteo</Link>
            <form action={signOut}>
              <button type="submit" className="btn btn-ghost">Salir</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-5">
        <UsuariosAdmin members={members} locations={locations} currentUserId={user?.id ?? ""} />
      </main>
    </div>
  );
}
