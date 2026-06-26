import { signOut } from "@/app/login/actions";

// Usuario autenticado pero sin fila en members (el dueño aún no le asignó rol).
export default function SinAccesoPage() {
  return (
    <main className="flex-1 grid place-items-center px-4 py-10">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-xl font-bold">Tu cuenta todavía no tiene acceso</h1>
        <p className="hint mt-2">
          Entraste bien, pero el dueño de la campaña aún no te asignó un rol ni una
          ubicación. Avisale para que te habilite el conteo.
        </p>
        <form action={signOut} className="mt-5">
          <button type="submit" className="btn btn-ghost w-full">Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
