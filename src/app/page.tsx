import { redirect } from "next/navigation";

// El proxy ya garantiza sesión. La única herramienta de esta etapa es el conteo.
export default function Home() {
  redirect("/conteo");
}
