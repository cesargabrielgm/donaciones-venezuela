export type Role = "owner" | "organizer" | "counter";

export const UNITS = [
  "kg",
  "litro",
  "unidad",
  "paquete",
  "caja",
  "saco",
  "bulto",
  "botella",
] as const;
export type Unit = (typeof UNITS)[number];

export type Member = {
  user_id: string;
  full_name: string | null;
  role: Role;
  location_id: string | null;
};

export type LocationRow = { id: string; name: string };

export type Product = {
  id: string;
  name: string;
  kind: "official" | "custom";
  unit: Unit;
  location_id: string | null;
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Dueño",
  organizer: "Organizador",
  counter: "Contador",
};
