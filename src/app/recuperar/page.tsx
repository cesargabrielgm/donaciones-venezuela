"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestReset } from "./actions";
import { initialResetState } from "./state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending} aria-busy={pending}>
      {pending ? "Enviando…" : "Enviar enlace"}
    </button>
  );
}

export default function RecuperarPage() {
  const [state, formAction] = useActionState(requestReset, initialResetState);

  return (
    <main className="flex-1 grid place-items-center px-4 py-10">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold">Recuperar contraseña</h1>
        <p className="hint mt-1">Te mandamos un enlace para definir una contraseña nueva.</p>

        {state.message ? (
          <p
            className={`alert mt-4 ${state.variant === "error" ? "alert-error" : ""}`}
            role="status"
            aria-live="polite"
            style={state.variant === "info" ? { background: "var(--accent-soft)", color: "var(--accent)" } : undefined}
          >
            {state.message}
          </p>
        ) : null}

        <form action={formAction} className="mt-5 grid gap-4">
          <div className="field">
            <label className="label" htmlFor="email">Correo</label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              required
              autoFocus
              className="input"
              placeholder="tucorreo@ejemplo.com"
            />
          </div>
          <SubmitButton />
        </form>

        <p className="hint mt-4 text-center">
          <Link href="/login" className="underline">Volver a entrar</Link>
        </p>
      </div>
    </main>
  );
}
