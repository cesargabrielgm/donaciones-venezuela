"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "./actions";
import { initialAuthState } from "./state";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending} aria-busy={pending}>
      {pending ? "Enviando…" : children}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, initialAuthState);

  return (
    <main className="flex-1 grid place-items-center px-4 py-10">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold">Conteo de Donaciones</h1>
        <p className="hint mt-1">
          {state.step === "email"
            ? "Ingresá tu correo para recibir un código de acceso."
            : "Ingresá el código que te llegó por correo."}
        </p>

        {state.message ? (
          <p
            className={`alert mt-4 ${state.variant === "error" ? "alert-error" : ""}`}
            role="status"
            aria-live="polite"
            style={
              state.variant === "info"
                ? { background: "var(--accent-soft)", color: "var(--accent)" }
                : undefined
            }
          >
            {state.message}
          </p>
        ) : null}

        {state.step === "email" ? (
          <form action={formAction} className="mt-5 grid gap-4">
            <input type="hidden" name="intent" value="request" />
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
                className="input"
                placeholder="tucorreo@ejemplo.com"
                defaultValue={state.email}
              />
            </div>
            <SubmitButton>Enviar código</SubmitButton>
          </form>
        ) : (
          <div className="mt-5 grid gap-3">
            <form action={formAction} className="grid gap-4">
              <input type="hidden" name="intent" value="verify" />
              <input type="hidden" name="email" value={state.email} />
              <div className="field">
                <label className="label" htmlFor="token">Código de 6 dígitos</label>
                <input
                  id="token"
                  name="token"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  spellCheck={false}
                  required
                  className="input tnum tracking-[0.4em] text-lg"
                  placeholder="••••••"
                  autoFocus
                />
                <span className="hint">Enviado a {state.email}. También podés abrir el enlace del correo.</span>
              </div>
              <SubmitButton>Entrar</SubmitButton>
            </form>
            <form action={formAction}>
              <input type="hidden" name="intent" value="request" />
              <input type="hidden" name="email" value={state.email} />
              <button type="submit" className="btn btn-ghost w-full">Reenviar código</button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
