import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMember } from "@/lib/member";
import { signOut } from "@/app/login/actions";
import { fmtQty, fmtDateTime } from "@/lib/format";
import { ROLE_LABEL, type LocationRow, type Product } from "@/lib/types";
import { CountingForm } from "./counting-form";
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
    .select("id, name, kind, unit, location_id")
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

        {entries.length === 0 ? (
          <p className="hint mt-3">
            Todavía no contaste nada acá. Registrá el primer producto arriba y aparecerá en esta lista.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                  <th className="font-semibold py-2 pr-3">Producto</th>
                  <th className="font-semibold py-2 px-3 text-right">Cantidad</th>
                  <th className="font-semibold py-2 pl-3">Cuándo</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{productName(e.products) ?? "—"}</span>
                      {e.note ? <span className="hint block">{e.note}</span> : null}
                    </td>
                    <td className="py-2 px-3 text-right tnum whitespace-nowrap">
                      {fmtQty(Number(e.quantity))} {e.unit}
                    </td>
                    <td className="py-2 pl-3 whitespace-nowrap">
                      <span className="tnum">{fmtDateTime(e.created_at)}</span>
                      {user && e.counted_by === user.id ? (
                        <span className="badge ml-2">vos</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
          <form action={signOut}>
            <button type="submit" className="btn btn-ghost">Salir</button>
          </form>
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
