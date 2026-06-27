"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Phase = "loading" | "ready" | "saving" | "invalid";

export default function DefinirClavePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);

  // El enlace (invitación o reseteo) trae la sesión en el hash (#access_token).
  // La persistimos en cookies con setSession para que el resto del sitio la vea.
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const hash = window.location.hash.startsWith("#")
        ? new URLSearchParams(window.location.hash.slice(1))
        : null;
      const access_token = hash?.get("access_token");
      const refresh_token = hash?.get("refresh_token");

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        window.history.replaceState(null, "", window.location.pathname);
        if (!error) return setPhase("ready");
      }
      // Sin tokens en el hash: quizá ya hay sesión (entró logueado a cambiar su clave).
      const { data } = await supabase.auth.getSession();
      setPhase(data.session ? "ready" : "invalid");
    })();
  }, []);

  async function onSubmit(formData: FormData) {
    setError(null);
    const pass = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (pass.length < 8) return setError("La contraseña tiene que tener al menos 8 caracteres.");
    if (pass !== confirm) return setError("Las dos contraseñas no coinciden.");

    setPhase("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) {
      setPhase("ready");
      setError("No se pudo guardar la contraseña. Si el enlace venció, pedí uno nuevo.");
      return;
    }
    router.replace("/conteo");
  }

  return (
    <main className="flex-1 grid place-items-center px-4 py-10">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold">Definí tu contraseña</h1>

        {phase === "loading" ? (
          <p className="hint mt-2">Verificando el enlace…</p>
        ) : phase === "invalid" ? (
          <>
            <p className="alert alert-error mt-4" role="status">
              El enlace no es válido o ya venció. Pedí uno nuevo desde “¿Olvidaste tu contraseña?”.
            </p>
            <p className="hint mt-4 text-center">
              <Link href="/recuperar" className="underline">Pedir un enlace nuevo</Link>
            </p>
          </>
        ) : (
          <>
            <p className="hint mt-1">Elegí una contraseña de al menos 8 caracteres.</p>
            {error ? <p className="alert alert-error mt-4" role="status" aria-live="polite">{error}</p> : null}
            <form action={onSubmit} className="mt-5 grid gap-4">
              <div className="field">
                <label className="label" htmlFor="password">Contraseña nueva</label>
                <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="input" placeholder="Mínimo 8 caracteres" autoFocus />
              </div>
              <div className="field">
                <label className="label" htmlFor="confirm">Repetí la contraseña</label>
                <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} className="input" placeholder="Escribila de nuevo" />
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={phase === "saving"} aria-busy={phase === "saving"}>
                {phase === "saving" ? "Guardando…" : "Guardar y entrar"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
