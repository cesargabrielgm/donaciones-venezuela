import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMember } from "@/lib/member";
import { signOut } from "@/app/login/actions";
import { ROLE_LABEL, type LocationRow, type Product } from "@/lib/types";
import { CountingForm } from "./counting-form";
import { CountedList, type CountedEntry } from "./counted-list";
import { LocationPicker } from "./location-picker";

type EntryRow = {
  id: string;
  quantity: number | string;
  unit: string;
  created_at: string;
  note: string | null;
  counted_by: string;
  products: { name: string } | { name: string }[] | null;
};

const productName = (p: EntryRow["products"]) =>
  Array.isArray(p) ? p[0]?.name : p?.name;

export default async function ConteoPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>;
}) {
  const member = await getMember();
  if (!member) redirect("/sin-acceso");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPrivileged = member.role === "owner" || member.role === "organizer";

  // Ubicaciones visibles según rol (RLS también las filtra).
  const { data: locData } = await supabase
    .from("locations")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const locations = (locData ?? []) as LocationRow[];

  // Ubicación seleccionada: counter → la suya; owner/organizer → ?loc o la primera.
  const { loc } = await searchParams;
  let selectedLocationId: string | null;
  if (member.role === "counter") {
    selectedLocationId = member.location_id;
  } else {
    const requested = loc && locations.some((l) => l.id === loc) ? loc : null;
    selectedLocationId = requested ?? locations[0]?.id ?? null;
  }

  const selectedLocation = locations.find((l) => l.id === selectedLocationId) ?? null;

  if (!selectedLocationId || !selectedLocation) {
    return (
      <Shell
        member={member}
        email={user?.email ?? ""}
        locationName="—"
        picker={null}
      >
        <div className="card p-5">
          <p className="hint">
            Todavía no hay ninguna ubicación asignada. Pedile al dueño que cree una.
          </p>
        </div>
      </Shell>
    );
  }

  // Productos disponibles: oficiales + custom de esta ubicación.
  const { data: prodData } = await supabase
    .from("products")
    .select("id, name, kind, unit, location_id, category")
    .eq("is_active", true)
    .or(`kind.eq.official,location_id.eq.${selectedLocationId}`)
    .order("kind")
    .order("name");
  const products = (prodData ?? []) as Product[];

  // Lo ya contado en esta ubicación.
  const { data: entryData } = await supabase
    .from("count_entries")
    .select("id, quantity, unit, created_at, note, counted_by, products(name)")
    .eq("location_id", selectedLocationId)
    .order("created_at", { ascending: false })
    .limit(100);
  const entries = (entryData ?? []) as EntryRow[];

  // canModify espeja la RLS: counter solo lo suyo; owner/organizer cualquiera.
  const countedEntries: CountedEntry[] = entries.map((e) => {
    const isMine = !!user && e.counted_by === user.id;
    return {
      id: e.id,
      productName: productName(e.products) ?? "—",
      quantity: Number(e.quantity),
      unit: e.unit,
      created_at: e.created_at,
      note: e.note,
      isMine,
      canModify: isPrivileged || isMine,
    };
  });

  return (
    <Shell
      member={member}
      email={user?.email ?? ""}
      locationName={selectedLocation.name}
      picker={
        isPrivileged && locations.length > 1 ? (
          <LocationPicker locations={locations} selectedId={selectedLocationId} />
        ) : null
      }
    >
      <CountingForm locationId={selectedLocationId} products={products} />

      <section className="card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">Contado en esta ubicación</h2>
          <span className="hint tnum">{entries.length} registro{entries.length === 1 ? "" : "s"}</span>
        </div>

        <CountedList entries={countedEntries} />
      </section>
    </Shell>
  );
}

function Shell({
  member,
  email,
  locationName,
  picker,
  children,
}: {
  member: { role: "owner" | "organizer" | "counter" };
  email: string;
  locationName: string;
  picker: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1">
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto w-full max-w-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold truncate">Conteo de Donaciones</p>
            <p className="hint truncate">
              <span className="badge mr-2">{ROLE_LABEL[member.role]}</span>
              {email}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {member.role === "owner" || member.role === "organizer" ? (
              <Link href="/paletizado" className="btn btn-ghost">Paletizado</Link>
            ) : null}
            {member.role === "owner" ? (
              <>
                <Link href="/ubicaciones" className="btn btn-ghost">Ubicaciones</Link>
                <Link href="/usuarios" className="btn btn-ghost">Usuarios</Link>
              </>
            ) : null}
            <form action={signOut}>
              <button type="submit" className="btn btn-ghost">Salir</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-5 grid gap-6">
        <div className="card p-5">
          <h1 className="text-xl font-bold">{locationName}</h1>
          <p className="hint mt-1">Registrá los productos recibidos en esta ubicación.</p>
          {picker ? <div className="mt-4">{picker}</div> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
