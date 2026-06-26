"use client";

import { useActionState, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveCount, addCustomProduct } from "./actions";
import { idleState, type ActionState } from "./state";
import { UNITS, type Product } from "@/lib/types";

function Submit({ children, busy }: { children: React.ReactNode; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
      {pending ? busy : children}
    </button>
  );
}

function Alert({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={`alert ${state.variant === "error" ? "alert-error" : "alert-success"}`}
      role="status"
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

export function CountingForm({
  locationId,
  products,
}: {
  locationId: string;
  products: Product[];
}) {
  const official = products.filter((p) => p.kind === "official");
  const custom = products.filter((p) => p.kind === "custom");

  const [saveState, saveAction] = useActionState(saveCount, idleState);
  const [addState, addAction] = useActionState(addCustomProduct, idleState);

  const [productId, setProductId] = useState("");
  const [qtyError, setQtyError] = useState<string | null>(null);
  const qtyHintId = useId();

  const selected = products.find((p) => p.id === productId);
  const formRef = useRef<HTMLFormElement>(null);

  function validateQty(value: string) {
    const n = Number(value.replace(",", ".").trim());
    if (!value.trim()) return "Ingresá una cantidad.";
    if (!Number.isFinite(n) || n <= 0) return "La cantidad debe ser mayor a cero.";
    return null;
  }

  return (
    <div className="grid gap-6">
      {/* --- Registrar conteo --- */}
      <section className="card p-5">
        <h2 className="text-lg font-bold">Registrar conteo</h2>
        <p className="hint mt-1">Elegí un producto, poné la cantidad y guardá.</p>

        <form ref={formRef} action={saveAction} className="mt-4 grid gap-4">
          <input type="hidden" name="locationId" value={locationId} />

          <div className="field">
            <label className="label" htmlFor="productId">Producto</label>
            <select
              id="productId"
              name="productId"
              className="select"
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="" disabled>Elegí un producto…</option>
              {official.length > 0 && (
                <optgroup label="Oficiales">
                  {official.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                  ))}
                </optgroup>
              )}
              {custom.length > 0 && (
                <optgroup label="Personalizados de esta ubicación">
                  {custom.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="quantity">
              Cantidad{selected ? ` (${selected.unit})` : ""}
            </label>
            <input
              id="quantity"
              name="quantity"
              type="text"
              inputMode="decimal"
              required
              className="input tnum"
              placeholder="Ej: 12,5"
              aria-invalid={qtyError ? true : undefined}
              aria-describedby={qtyError ? qtyHintId : undefined}
              onBlur={(e) => setQtyError(validateQty(e.target.value))}
              onChange={() => qtyError && setQtyError(null)}
            />
            {qtyError ? (
              <span id={qtyHintId} className="hint" style={{ color: "var(--danger)" }} aria-live="polite">
                {qtyError}
              </span>
            ) : (
              <span className="hint">La unidad la define el producto.</span>
            )}
          </div>

          <div className="field">
            <label className="label" htmlFor="note">Nota (opcional)</label>
            <input id="note" name="note" type="text" maxLength={200} className="input" placeholder="Ej: lote nuevo, caja dañada…" />
          </div>

          <Alert state={saveState} />

          <div>
            <Submit busy="Guardando…">Guardar conteo</Submit>
          </div>
        </form>
      </section>

      {/* --- Agregar producto personalizado --- */}
      <section className="card p-5">
        <details>
          <summary className="cursor-pointer font-bold">
            ¿No está en la lista? Agregar producto personalizado
          </summary>
          <form action={addAction} className="mt-4 grid gap-4">
            <input type="hidden" name="locationId" value={locationId} />
            <div className="field">
              <label className="label" htmlFor="custom-name">Nombre del producto</label>
              <input id="custom-name" name="name" type="text" required minLength={2} maxLength={80} className="input" placeholder="Ej: Caraotas negras" />
            </div>
            <div className="field">
              <label className="label" htmlFor="custom-unit">Unidad</label>
              <select id="custom-unit" name="unit" className="select" required defaultValue="">
                <option value="" disabled>Elegí una unidad…</option>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <Alert state={addState} />
            <div>
              <Submit busy="Agregando…">Agregar producto</Submit>
            </div>
          </form>
        </details>
      </section>
    </div>
  );
}
