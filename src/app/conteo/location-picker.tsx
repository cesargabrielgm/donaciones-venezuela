"use client";

import { useRouter } from "next/navigation";
import type { LocationRow } from "@/lib/types";

// Selector de ubicación reutilizable (conteo y paletizado). El counter queda fijo
// a la suya y no usa este componente.
export function LocationPicker({
  locations,
  selectedId,
  basePath = "/conteo",
}: {
  locations: LocationRow[];
  selectedId: string;
  basePath?: string;
}) {
  const router = useRouter();
  return (
    <div className="field">
      <label className="label" htmlFor="loc-picker">Ubicación</label>
      <select
        id="loc-picker"
        className="select"
        defaultValue={selectedId}
        onChange={(e) => router.push(`${basePath}?loc=${e.target.value}`)}
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </div>
  );
}
