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

// Categorías oficiales, en orden de visualización.
export const CATEGORIES = [
  "Agua e higiene",
  "Alimentos no perecederos",
  "Salud y primeros auxilios",
  "Niños y bebés",
  "Adultos mayores",
  "Limpieza y recuperación",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type LocationRow = { id: string; name: string; address?: string | null; is_active?: boolean };

export type Product = {
  id: string;
  name: string;
  kind: "official" | "custom";
  unit: Unit;
  location_id: string | null;
  category: Category | null;
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Dueño",
  organizer: "Organizador",
  counter: "Contador",
};
