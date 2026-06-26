"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { inviteMember, updateMember, removeMember } from "./actions";
import { idleAdmin, type AdminState } from "./state";
import { ROLE_LABEL, type LocationRow, type Role } from "@/lib/types";

type MemberView = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  location_id: string | null;
};

function Submit({ children, busy, variant = "primary" }: { children: React.ReactNode; busy: string; variant?: "primary" | "ghost" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn btn-${variant}`} disabled={pending} aria-busy={pending}>
      {pending ? busy : children}
    </button>
  );
}

function Alert({ state }: { state: AdminState }) {
  if (!state.message) return null;
  return (
    <p className={`alert ${state.variant === "error" ? "alert-error" : "alert-success"}`} role="status" aria-live="polite">
      {state.message}
    </p>
  );
}

// Selector de rol + ubicación (la ubicación aparece solo si el rol es contador).
function RoleLocationFields({
  locations,
  idPrefix,
  role,
  setRole,
  defaultLocationId,
}: {
  locations: LocationRow[];
  idPrefix: string;
  role: Role | "";
  setRole: (r: Role) => void;
  defaultLocationId?: string | null;
}) {
  return (
    <>
      <div className="field">
        <label className="label" htmlFor={`${idPrefix}-role`}>Rol</label>
        <select
          id={`${idPrefix}-role`}
          name="role"
          className="select"
          required
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          <option value="" disabled>Elegí un rol…</option>
          <option value="owner">Dueño (acceso total)</option>
          <option value="organizer">Organizador (conteo + paletizado)</option>
          <option value="counter">Contador (solo su ubicación)</option>
        </select>
      </div>
      {role === "counter" && (
        <div className="field">
          <label className="label" htmlFor={`${idPrefix}-loc`}>Ubicación</label>
          <select id={`${idPrefix}-loc`} name="locationId" className="select" required defaultValue={defaultLocationId ?? ""}>
            <option value="" disabled>Elegí una ubicación…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

function InviteForm({ locations }: { locations: LocationRow[] }) {
  const [state, action] = useActionState(inviteMember, idleAdmin);
  const [role, setRole] = useState<Role | "">("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setRole("");
    }
  }, [state]);

  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold">Invitar persona</h2>
      <p className="hint mt-1">Le llega un correo para entrar. Queda habilitada con el rol que elijas.</p>
      <form ref={formRef} action={action} className="mt-4 grid gap-4">
        <div className="field">
          <label className="label" htmlFor="invite-email">Correo</label>
          <input id="invite-email" name="email" type="email" inputMode="email" autoComplete="off" spellCheck={false} required className="input" placeholder="persona@ejemplo.com" />
        </div>
        <div className="field">
          <label className="label" htmlFor="invite-name">Nombre (opcional)</label>
          <input id="invite-name" name="fullName" type="text" maxLength={80} className="input" placeholder="Ej: María Pérez" />
        </div>
        <RoleLocationFields locations={locations} idPrefix="invite" role={role} setRole={setRole} />
        <Alert state={state} />
        <div><Submit busy="Invitando…">Enviar invitación</Submit></div>
      </form>
    </section>
  );
}

function MemberRow({
  member,
  locations,
  isSelf,
}: {
  member: MemberView;
  locations: LocationRow[];
  isSelf: boolean;
}) {
  const [editState, editAction] = useActionState(updateMember, idleAdmin);
  const [removeState, removeAction] = useActionState(removeMember, idleAdmin);
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<Role | "">(member.role);

  const locationName = locations.find((l) => l.id === member.location_id)?.name ?? "—";

  useEffect(() => {
    if (editState.ok) setEditing(false);
  }, [editState]);

  return (
    <li className="py-3" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">
            {member.full_name || member.email || "—"}
            {isSelf ? <span className="badge ml-2">vos</span> : null}
          </p>
          <p className="hint truncate">{member.email}</p>
          <p className="hint mt-1">
            <span className="badge mr-2">{ROLE_LABEL[member.role]}</span>
            {member.role === "counter" ? locationName : "Todas las ubicaciones"}
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            className="btn btn-ghost"
            aria-expanded={editing}
            onClick={() => { setEditing((v) => !v); setRole(member.role); }}
          >
            {editing ? "Cancelar" : "Editar"}
          </button>
          <form
            action={removeAction}
            onSubmit={(e) => {
              if (!confirm(`¿Quitarle el acceso a ${member.email}? Podés volver a invitarla después.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="userId" value={member.user_id} />
            <Submit busy="Quitando…" variant="ghost">Quitar acceso</Submit>
          </form>
        </div>
      </div>

      {editing && (
        <form action={editAction} className="mt-3 grid gap-3 sm:max-w-sm">
          <input type="hidden" name="userId" value={member.user_id} />
          <RoleLocationFields
            locations={locations}
            idPrefix={`edit-${member.user_id}`}
            role={role}
            setRole={setRole}
            defaultLocationId={member.location_id}
          />
          <Alert state={editState} />
          <div><Submit busy="Guardando…">Guardar cambios</Submit></div>
        </form>
      )}

      {!editing && removeState.message ? <Alert state={removeState} /> : null}
    </li>
  );
}

export function UsuariosAdmin({
  members,
  locations,
  currentUserId,
}: {
  members: MemberView[];
  locations: LocationRow[];
  currentUserId: string;
}) {
  return (
    <div className="grid gap-6">
      <InviteForm locations={locations} />

      <section className="card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">Personas con acceso</h2>
          <span className="hint tnum">{members.length}</span>
        </div>
        {members.length === 0 ? (
          <p className="hint mt-3">Todavía no hay nadie. Invitá a la primera persona arriba.</p>
        ) : (
          <ul className="mt-1">
            {members.map((m) => (
              <MemberRow key={m.user_id} member={m} locations={locations} isSelf={m.user_id === currentUserId} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
