import { CATEGORIES, type Product } from "@/lib/types";

// Opciones de un <select> de productos, agrupadas por categoría (oficiales) +
// un grupo "Personalizados" para los custom de la ubicación. Compartido por
// el conteo y el paletizado.
export function ProductOptions({ products }: { products: Product[] }) {
  const official = products.filter((p) => p.kind === "official");
  const custom = products.filter((p) => p.kind === "custom");

  return (
    <>
      {CATEGORIES.map((cat) => {
        const items = official
          .filter((p) => p.category === cat)
          .sort((a, b) => a.name.localeCompare(b.name, "es"));
        if (items.length === 0) return null;
        return (
          <optgroup key={cat} label={cat}>
            {items.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
            ))}
          </optgroup>
        );
      })}
      {custom.length > 0 && (
        <optgroup label="Personalizados de esta ubicación">
          {custom
            .sort((a, b) => a.name.localeCompare(b.name, "es"))
            .map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
            ))}
        </optgroup>
      )}
    </>
  );
}
