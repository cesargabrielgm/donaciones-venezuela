import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMember } from "@/lib/member";
import { signOut } from "@/app/login/actions";
import { ROLE_LABEL, type LocationRow, type Product } from "@/lib/types";
import { LocationPicker } from "@/app/conteo/location-picker";
import { PaletizadoBoard } from "./paletizado-board";

export default async function PaletizadoPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>;
}) {
  const member = await getMember();
  if (!member) redirect("/sin-acceso");
  // Gate en la app (la base ya lo garantiza con RLS). counter fuera.
  if (member.role !== "owner" && member.role !== "organizer") redirect("/conteo");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: locData } = await supabase
    .from("locations")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const locations = (locData ?? []) as LocationRow[];

  const { loc } = await searchParams;
  const selectedLocationId =
    loc && locations.some((l) => l.id === loc) ? loc : locations[0]?.id ?? null;
  const selectedLocation = locations.find((l) => l.id === selectedLocationId) ?? null;

  let availability: unknown[] = [];
  let products: Product[] = [];
  let boxes: unknown[] = [];

  if (selectedLocationId) {
    const [{ data: avail }, { data: prodData }, { data: boxData }] = await Promise.all([
      supabase.rpc("inventory_availability", { p_location: selectedLocationId }),
      supabase
        .from("products")
        .select("id, name, kind, unit, location_id, category")
        .eq("is_active", true)
        .or(`kind.eq.official,location_id.eq.${selectedLocationId}`)
        .order("kind")
        .order("name"),
      supabase
        .from("pallets")
        .select("id, code, status, created_at, pallet_items(id, quantity, unit, products(name))")
        .eq("location_id", selectedLocationId)
        .order("created_at", { ascending: true })
        .order("created_at", { referencedTable: "pallet_items", ascending: true }),
    ]);
    availability = avail ?? [];
    products = (prodData ?? []) as Product[];
    boxes = boxData ?? [];
  }

  return (
    <div className="flex-1">
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto w-full max-w-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold truncate">Paletizado</p>
            <p className="hint truncate">
              <span className="badge mr-2">{ROLE_LABEL[member.role]}</span>
              {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/conteo" className="btn btn-ghost">Conteo</Link>
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{selectedLocation?.name ?? "—"}</h1>
              <p className="hint mt-1">Armá las cajas para el packing list de aduana.</p>
            </div>
            {selectedLocationId ? (
              <Link href={`/paletizado/packing-list?loc=${selectedLocationId}`} className="btn btn-ghost shrink-0">
                Packing list
              </Link>
            ) : null}
          </div>
          {locations.length > 1 && selectedLocationId ? (
            <div className="mt-4">
              <LocationPicker locations={locations} selectedId={selectedLocationId} basePath="/paletizado" />
            </div>
          ) : null}
        </div>

        {selectedLocationId ? (
          <PaletizadoBoard
            locationId={selectedLocationId}
            products={products}
            availability={availability as never}
            boxes={boxes as never}
          />
        ) : (
          <div className="card p-5"><p className="hint">No hay ubicaciones. Pedile al dueño que cree una.</p></div>
        )}
      </main>
    </div>
  );
}
