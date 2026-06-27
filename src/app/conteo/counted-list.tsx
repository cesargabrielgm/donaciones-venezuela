"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { editCount, deleteCount } from "./actions";
import { idleState, type ActionState } from "./state";
import { fmtQty, fmtDateTime } from "@/lib/format";

// Cada registro ya viene resuelto desde el server (page.tsx), con canModify
// calculado según rol/autoría — el mismo criterio que la RLS. El gate visual
// espeja la RLS: la base es la pared real, esto solo evita mostrar botones inútiles.
export type CountedEntry = {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  created_at: string;
  note: string | null;
  isMine: boolean;
  canModify: boolean;
};

function SubmitBtn({
  children,
  busy,
  className,
}: {
  children: React.ReactNode;
  busy: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? busy : children}
    </button>
  );
}

function AlertLine({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={`alert ${state.ok ? "alert-success" : "alert-error"} mt-1`}
      role="status"
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

// Form de edición: se monta fresco cada vez que se abre (no se renderiza en modo
// vista), así su useActionState arranca limpio y no arrastra mensajes viejos.
// Tras un guardado exitoso muestra la confirmación y se cierra con "Cerrar".
function EditForm({ entry, onClose }: { entry: CountedEntry; onClose: () => void }) {
  const [state, action] = useActionState(editCount, idleState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="entryId" value={entry.id} />
      <p className="font-medium">{entry.productName}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor={`qty-${entry.id}`}>
            Cantidad ({entry.unit})
          </label>
          <input
            id={`qty-${entry.id}`}
            name="quantity"
            type="text"
            inputMode="decimal"
            required
            className="input tnum"
            defaultValue={fmtQty(entry.quantity)}
            placeholder="Ej: 12,5"
          />
          <span className="hint">La unidad la define el producto, no se cambia.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor={`note-${entry.id}`}>
            Nota (opcional)
          </label>
          <input
            id={`note-${entry.id}`}
            name="note"
            type="text"
            maxLength={200}
            className="input"
            defaultValue={entry.note ?? ""}
            placeholder="Ej: lote nuevo, caja dañada…"
          />
        </div>
      </div>
      <AlertLine state={state} />
      <div className="flex gap-2">
        {!state.ok ? (
          <SubmitBtn className="btn btn-primary" busy="Guardando…">
            Guardar cambios
          </SubmitBtn>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {state.ok ? "Cerrar" : "Cancelar"}
        </button>
      </div>
    </form>
  );
}

function EntryRow({ entry }: { entry: CountedEntry }) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [delState, delAction] = useActionState(deleteCount, idleState);

  if (mode === "edit") {
    return (
      <tr style={{ borderTop: "1px solid var(--border)" }}>
        <td colSpan={4} className="py-3">
          <EditForm entry={entry} onClose={() => setMode("view")} />
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td className="py-2 pr-3">
        <span className="font-medium">{entry.productName}</span>
        {entry.note ? <span className="hint block">{entry.note}</span> : null}
      </td>
      <td className="py-2 px-3 text-right tnum whitespace-nowrap">
        {fmtQty(entry.quantity)} {entry.unit}
      </td>
      <td className="py-2 px-3 whitespace-nowrap">
        <span className="tnum">{fmtDateTime(entry.created_at)}</span>
        {entry.isMine ? <span className="badge ml-2">vos</span> : null}
      </td>
      <td className="py-2 pl-3 text-right whitespace-nowrap align-top">
        {!entry.canModify ? null : mode === "confirm-delete" ? (
          <form action={delAction} className="inline-flex items-center gap-2">
            <input type="hidden" name="entryId" value={entry.id} />
            <span className="hint">¿Borrar este conteo?</span>
            <SubmitBtn className="btn btn-danger" busy="Borrando…">
              Sí, borrar
            </SubmitBtn>
            <button type="button" className="btn btn-ghost" onClick={() => setMode("view")}>
              No
            </button>
          </form>
        ) : (
          <div className="inline-flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setMode("edit")}>
              Editar
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMode("confirm-delete")}
            >
              Borrar
            </button>
          </div>
        )}
        {delState.message && !delState.ok ? <AlertLine state={delState} /> : null}
      </td>
    </tr>
  );
}

export function CountedList({ entries }: { entries: CountedEntry[] }) {
  // ¿Algún registro modificable por el usuario? Define si mostramos la columna.
  const anyModifiable = entries.some((e) => e.canModify);

  if (entries.length === 0) {
    return (
      <p className="hint mt-3">
        Todavía no contaste nada acá. Registrá el primer producto arriba y aparecerá en esta lista.
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: "var(--text-muted)" }}>
            <th className="font-semibold py-2 pr-3">Producto</th>
            <th className="font-semibold py-2 px-3 text-right">Cantidad</th>
            <th className="font-semibold py-2 px-3">Cuándo</th>
            <th className="font-semibold py-2 pl-3 text-right">
              {anyModifiable ? "Acciones" : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
