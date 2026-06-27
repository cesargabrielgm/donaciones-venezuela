"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createLocation, updateLocation, setLocationActive, deleteLocation } from "./actions";
import { idleLoc, type LocState } from "./state";

type LocView = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  inUse: boolean;
};

function Submit({ children, busy, variant = "primary" }: { children: React.ReactNode; busy: string; variant?: "primary" | "ghost" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn btn-${variant}`} disabled={pending} aria-busy={pending}>
      {pending ? busy : children}
    </button>
  );
}

function Alert({ state }: { state: LocState }) {
  if (!state.message) return null;
  return (
    <p className={`alert ${state.variant === "error" ? "alert-error" : "alert-success"}`} role="status" aria-live="polite">
      {state.message}
    </p>
  );
}

function CreateLocationForm() {
  const [state, action] = useActionState(createLocation, idleLoc);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);

  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold">Nueva ubicación</h2>
      <form ref={ref} action={action} className="mt-4 grid gap-4">
        <div className="field">
          <label className="label" htmlFor="loc-name">Nombre</label>
          <input id="loc-name" name="name" type="text" required minLength={2} maxLength={80} className="input" placeholder="Ej: Aguacate" />
        </div>
        <div className="field">
          <label className="label" htmlFor="loc-address">Dirección (opcional)</label>
          <input id="loc-address" name="address" type="text" maxLength={160} className="input" placeholder="Ej: Mohsgasse 28" />
        </div>
        <Alert state={state} />
        <div><Submit busy="Creando…">Crear ubicación</Submit></div>
      </form>
    </section>
  );
}

function LocationItem({ loc }: { loc: LocView }) {
  const [editState, editAction] = useActionState(updateLocation, idleLoc);
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (editState.ok) setEditing(false); }, [editState]);

  return (
    <li className="py-3" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">
            {loc.name}
            {!loc.is_active ? <span className="badge ml-2" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>Inactiva</span> : null}
          </p>
          {loc.address ? <p className="hint truncate">{loc.address}</p> : null}
          {loc.inUse ? <p className="hint">Con conteos o gente asignada</p> : null}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button type="button" className="btn btn-ghost" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancelar" : "Editar"}
          </button>
          <form action={setLocationActive}>
            <input type="hidden" name="id" value={loc.id} />
            <input type="hidden" name="active" value={(!loc.is_active).toString()} />
            <Submit busy="…" variant="ghost">{loc.is_active ? "Desactivar" : "Activar"}</Submit>
          </form>
          {!loc.inUse ? (
            <form
              action={deleteLocation}
              onSubmit={(e) => { if (!confirm(`¿Borrar la ubicación "${loc.name}"?`)) e.preventDefault(); }}
            >
              <input type="hidden" name="id" value={loc.id} />
              <Submit busy="Borrando…" variant="ghost">Borrar</Submit>
            </form>
          ) : null}
        </div>
      </div>

      {editing && (
        <form action={editAction} className="mt-3 grid gap-3 sm:max-w-sm">
          <input type="hidden" name="id" value={loc.id} />
          <div className="field">
            <label className="label" htmlFor={`name-${loc.id}`}>Nombre</label>
            <input id={`name-${loc.id}`} name="name" type="text" required minLength={2} maxLength={80} className="input" defaultValue={loc.name} />
          </div>
          <div className="field">
            <label className="label" htmlFor={`addr-${loc.id}`}>Dirección</label>
            <input id={`addr-${loc.id}`} name="address" type="text" maxLength={160} className="input" defaultValue={loc.address ?? ""} placeholder="Opcional" />
          </div>
          <Alert state={editState} />
          <div><Submit busy="Guardando…">Guardar cambios</Submit></div>
        </form>
      )}
    </li>
  );
}

export function UbicacionesAdmin({ locations }: { locations: LocView[] }) {
  return (
    <div className="grid gap-6">
      <CreateLocationForm />
      <section className="card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">Ubicaciones</h2>
          <span className="hint tnum">{locations.length}</span>
        </div>
        {locations.length === 0 ? (
          <p className="hint mt-3">Todavía no hay ubicaciones. Creá la primera arriba.</p>
        ) : (
          <ul className="mt-1">
            {locations.map((l) => <LocationItem key={l.id} loc={l} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
