"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createBox, packLine, deleteLine, deleteBox } from "./actions";
import { idlePack, type PackState } from "./state";
import { fmtQty } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ProductCombobox } from "@/app/_components/product-combobox";

type Availability = {
  product_id: string;
  product_name: string;
  unit: string;
  counted: number;
  packed: number;
  available: number;
};
type LineView = {
  id: string;
  quantity: number | string;
  unit: string;
  products: { name: string } | { name: string }[] | null;
};
type BoxView = {
  id: string;
  code: string | null;
  status: string;
  created_at: string;
  pallet_items: LineView[];
};
// Caja abierta lista para el selector de la fila de inventario.
type BoxOption = { id: string; label: string };

// Precarga: string con coma decimal (como se muestra el disponible), sin
// separador de miles → quantitySchema lo parsea limpio (acepta coma y punto).
const qtyDefault = (n: number) => String(n).replace(".", ",");

const productName = (p: LineView["products"]) =>
  Array.isArray(p) ? p[0]?.name : p?.name;

function PendingButton({ children, busy, variant = "primary" }: { children: React.ReactNode; busy: string; variant?: "primary" | "ghost" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn btn-${variant}`} disabled={pending} aria-busy={pending}>
      {pending ? busy : children}
    </button>
  );
}

function PackAlert({ state }: { state: PackState }) {
  if (!state.message) return null;
  const cls = state.variant === "error" ? "alert-error" : state.variant === "warning" ? "alert-warning" : "alert-success";
  return <p className={`alert ${cls}`} role="status" aria-live="polite">{state.message}</p>;
}

// Atajo por fila: elegir caja abierta, ajustar la cantidad (precargada con el
// disponible) y empacar con la MISMA action packLine. Una línea por acción.
function PackRowForm({ row, boxOptions }: { row: Availability; boxOptions: BoxOption[] }) {
  const [state, action] = useActionState(packLine, idlePack);
  const avail = Number(row.available);

  // Cantidad editable, precargada con el disponible. Se reinicia sola cuando el
  // disponible cambia tras revalidar (mismo patrón derivar-en-render del combobox).
  const [qty, setQty] = useState(() => qtyDefault(avail));
  const [prevAvail, setPrevAvail] = useState(avail);
  if (avail !== prevAvail) {
    setPrevAvail(avail);
    setQty(qtyDefault(avail));
  }

  const [palletId, setPalletId] = useState(() => boxOptions[0]?.id ?? "");
  // Si la caja elegida ya no existe (se borró), cae a la primera disponible.
  const selectedPallet = boxOptions.some((b) => b.id === palletId)
    ? palletId
    : boxOptions[0]?.id ?? "";

  // Borde disponible ≤ 0: sin atajo (precargar 0/negativo rompería quantitySchema).
  if (avail <= 0) return <span className="hint">—</span>;
  if (boxOptions.length === 0) return <span className="hint whitespace-nowrap">Creá una caja</span>;

  return (
    <div className="grid gap-2">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="productId" value={row.product_id} />
        <select
          name="palletId"
          value={selectedPallet}
          onChange={(e) => setPalletId(e.target.value)}
          className="input"
          aria-label="Caja destino"
          style={{ minWidth: "8rem" }}
        >
          {boxOptions.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
        <input
          name="quantity"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          type="text"
          inputMode="decimal"
          required
          className="input tnum"
          aria-label={`Cantidad a empacar (${row.unit})`}
          style={{ width: "5.5rem" }}
        />
        <PendingButton busy="…">Empacar</PendingButton>
      </form>
      <PackAlert state={state} />
    </div>
  );
}

function AvailabilityTable({ rows, boxOptions }: { rows: Availability[]; boxOptions: BoxOption[] }) {
  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold">Inventario disponible</h2>
      <p className="hint mt-1">Disponible = contado − empacado. En negativo = empacaste de más.</p>
      {rows.length === 0 ? (
        <p className="hint mt-3">No hay nada contado todavía en esta ubicación.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                <th className="font-semibold py-2 pr-3">Producto</th>
                <th className="font-semibold py-2 px-3 text-right">Contado</th>
                <th className="font-semibold py-2 px-3 text-right">Empacado</th>
                <th className="font-semibold py-2 px-3 text-right">Disponible</th>
                <th className="font-semibold py-2 pl-3">Empacar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product_id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="py-2 pr-3 font-medium">{r.product_name}</td>
                  <td className="py-2 px-3 text-right tnum whitespace-nowrap">{fmtQty(Number(r.counted))} {r.unit}</td>
                  <td className="py-2 px-3 text-right tnum whitespace-nowrap">{fmtQty(Number(r.packed))} {r.unit}</td>
                  <td className={`py-2 px-3 text-right tnum whitespace-nowrap ${Number(r.available) < 0 ? "neg font-semibold" : ""}`}>
                    {fmtQty(Number(r.available))} {r.unit}
                  </td>
                  <td className="py-2 pl-3 align-top">
                    <PackRowForm row={r} boxOptions={boxOptions} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CreateBoxForm({ locationId }: { locationId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => { await createBox(fd); ref.current?.reset(); }}
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="locationId" value={locationId} />
      <div className="field grow">
        <label className="label" htmlFor="box-code">Etiqueta de la caja (opcional)</label>
        <input id="box-code" name="code" type="text" maxLength={60} className="input" placeholder="Ej: Caja frágil, medicinas…" />
      </div>
      <PendingButton busy="Creando…">Crear caja</PendingButton>
    </form>
  );
}

function LineRow({ line }: { line: LineView }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2" style={{ borderTop: "1px solid var(--border)" }}>
      <span className="min-w-0">
        <span className="font-medium">{productName(line.products) ?? "—"}</span>
      </span>
      <span className="flex items-center gap-3 shrink-0">
        <span className="tnum whitespace-nowrap">{fmtQty(Number(line.quantity))} {line.unit}</span>
        <form
          action={deleteLine}
          onSubmit={(e) => { if (!confirm("¿Quitar esta línea de la caja?")) e.preventDefault(); }}
        >
          <input type="hidden" name="itemId" value={line.id} />
          <button type="submit" className="btn btn-ghost" aria-label="Quitar línea">Quitar</button>
        </form>
      </span>
    </li>
  );
}

function BoxCard({ box, number, products }: { box: BoxView; number: number; products: Product[] }) {
  const [state, action] = useActionState(packLine, idlePack);
  const formRef = useRef<HTMLFormElement>(null);
  const [productId, setProductId] = useState("");

  const selected = products.find((p) => p.id === productId);

  useEffect(() => {
    if (state.ok) { formRef.current?.reset(); setProductId(""); }
  }, [state]);

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold">Caja {number}</h3>
          {box.code ? <p className="hint">{box.code}</p> : null}
        </div>
        <form
          action={deleteBox}
          onSubmit={(e) => { if (!confirm(`¿Quitar la Caja ${number} y todo su contenido?`)) e.preventDefault(); }}
        >
          <input type="hidden" name="palletId" value={box.id} />
          <button type="submit" className="btn btn-ghost">Quitar caja</button>
        </form>
      </div>

      {box.pallet_items.length === 0 ? (
        <p className="hint mt-2">Caja vacía. Agregá la primera línea abajo.</p>
      ) : (
        <ul className="mt-2">
          {box.pallet_items.map((l) => <LineRow key={l.id} line={l} />)}
        </ul>
      )}

      <form ref={formRef} action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <input type="hidden" name="palletId" value={box.id} />
        <div className="field">
          <label className="label" htmlFor={`prod-${box.id}`}>Producto</label>
          <ProductCombobox
            id={`prod-${box.id}`}
            name="productId"
            products={products}
            value={productId}
            onChange={setProductId}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor={`qty-${box.id}`}>Cantidad{selected ? ` (${selected.unit})` : ""}</label>
          <input id={`qty-${box.id}`} name="quantity" type="text" inputMode="decimal" required className="input tnum" placeholder="Ej: 12,5" />
        </div>
        <div className="sm:col-span-2"><PackAlert state={state} /></div>
        <div className="sm:col-span-2"><PendingButton busy="Agregando…">Agregar a la caja</PendingButton></div>
      </form>
    </section>
  );
}

export function PaletizadoBoard({
  locationId,
  products,
  availability,
  boxes,
}: {
  locationId: string;
  products: Product[];
  availability: Availability[];
  boxes: BoxView[];
}) {
  // Cajas abiertas para el selector de cada fila. El número ("Caja N") sigue la
  // misma posición que muestran los BoxCard (orden por created_at).
  const boxOptions: BoxOption[] = boxes
    .map((b, i) => ({ b, number: i + 1 }))
    .filter(({ b }) => b.status === "open")
    .map(({ b, number }) => ({ id: b.id, label: `Caja ${number}${b.code ? ` · ${b.code}` : ""}` }));

  return (
    <div className="grid gap-6">
      <AvailabilityTable rows={availability} boxOptions={boxOptions} />

      <section className="card p-5">
        <h2 className="text-lg font-bold">Cajas</h2>
        <p className="hint mt-1 mb-4">Cada caja puede mezclar varios productos.</p>
        <CreateBoxForm locationId={locationId} />
      </section>

      {boxes.length === 0 ? (
        <p className="hint">Todavía no hay cajas. Creá la primera arriba.</p>
      ) : (
        boxes.map((b, i) => <BoxCard key={b.id} box={b} number={i + 1} products={products} />)
      )}
    </div>
  );
}
