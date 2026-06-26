import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMember } from "@/lib/member";
import { fmtQty, fmtDateTime } from "@/lib/format";
import type { LocationRow } from "@/lib/types";
import { PrintButton } from "./print-button";

type LineView = {
  quantity: number | string;
  unit: string;
  products: { name: string } | { name: string }[] | null;
};
type BoxView = { id: string; code: string | null; created_at: string; pallet_items: LineView[] };

const productName = (p: LineView["products"]) => (Array.isArray(p) ? p[0]?.name : p?.name);

export default async function PackingListPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>;
}) {
  const member = await getMember();
  if (!member) redirect("/sin-acceso");
  if (member.role !== "owner" && member.role !== "organizer") redirect("/conteo");

  const supabase = await createClient();
  const { loc } = await searchParams;

  const { data: locData } = await supabase
    .from("locations")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const locations = (locData ?? []) as LocationRow[];
  const locationId = loc && locations.some((l) => l.id === loc) ? loc : locations[0]?.id ?? null;
  const location = locations.find((l) => l.id === locationId) ?? null;

  let boxes: BoxView[] = [];
  if (locationId) {
    const { data } = await supabase
      .from("pallets")
      .select("id, code, created_at, pallet_items(quantity, unit, products(name))")
      .eq("location_id", locationId)
      .order("created_at", { ascending: true })
      .order("created_at", { referencedTable: "pallet_items", ascending: true });
    boxes = (data ?? []) as BoxView[];
  }

  const totalLines = boxes.reduce((n, b) => n + b.pallet_items.length, 0);

  return (
    <div className="flex-1">
      <header className="no-print" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto w-full max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <Link href={`/paletizado?loc=${locationId ?? ""}`} className="btn btn-ghost">← Volver al paletizado</Link>
          <PrintButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 grid gap-5">
        <div>
          <h1 className="text-2xl font-bold">Packing List</h1>
          <p className="hint mt-1">
            Ubicación: <strong>{location?.name ?? "—"}</strong> · Generado: {fmtDateTime(new Date().toISOString())} ·{" "}
            {boxes.length} caja{boxes.length === 1 ? "" : "s"}, {totalLines} línea{totalLines === 1 ? "" : "s"}
          </p>
        </div>

        {boxes.length === 0 ? (
          <p className="hint">No hay cajas armadas en esta ubicación.</p>
        ) : (
          boxes.map((b, i) => (
            <section key={b.id} className="card p-5">
              <h2 className="font-bold">
                Caja {i + 1}
                {b.code ? <span className="hint font-normal"> · {b.code}</span> : null}
              </h2>
              {b.pallet_items.length === 0 ? (
                <p className="hint mt-2">(vacía)</p>
              ) : (
                <table className="w-full text-sm mt-3">
                  <thead>
                    <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                      <th className="font-semibold py-1 pr-3">Producto</th>
                      <th className="font-semibold py-1 pl-3 text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.pallet_items.map((l, j) => (
                      <tr key={j} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="py-1 pr-3">{productName(l.products) ?? "—"}</td>
                        <td className="py-1 pl-3 text-right tnum whitespace-nowrap">{fmtQty(Number(l.quantity))} {l.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))
        )}
      </main>
    </div>
  );
}
