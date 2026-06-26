"use client";

import { useRouter } from "next/navigation";
import type { LocationRow } from "@/lib/types";

// Selector de ubicación para owner/organizer (el counter queda fijo a la suya).
export function LocationPicker({
  locations,
  selectedId,
}: {
  locations: LocationRow[];
  selectedId: string;
}) {
  const router = useRouter();
  return (
    <div className="field">
      <label className="label" htmlFor="loc-picker">Ubicación</label>
      <select
        id="loc-picker"
        className="select"
        defaultValue={selectedId}
        onChange={(e) => router.push(`/conteo?loc=${e.target.value}`)}
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </div>
  );
}
