"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CATEGORIES, type Product } from "@/lib/types";

// Normaliza para buscar sin acentos ni mayúsculas: "Niños" → "ninos",
// "Limón" → "limon". NFD separa la tilde como diacrítico combinante y la
// removemos (rango U+0300–U+036F); la ñ se descompone en n + tilde, así que
// "ninos" también encuentra "Niños".
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const labelOf = (p: Product) => `${p.name} (${p.unit})`;

const CUSTOM_GROUP = "Personalizados de esta ubicación";

type Group = { key: string; label: string; items: Product[] };

// Combobox accesible (patrón WAI-ARIA editable combobox + listbox). Reemplaza al
// <select> nativo para poder filtrar escribiendo. Mantiene el agrupamiento por
// categoría y un <input type="hidden"> con el id elegido, para no cambiar el
// submit del formulario (la unidad se sigue derivando del producto afuera).
export function ProductCombobox({
  products,
  value,
  onChange,
  id,
  name,
  placeholder = "Buscá o elegí un producto…",
}: {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  id: string;
  name: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  const baseId = useId();
  const listId = `${baseId}-list`;
  const optDomId = (pid: string) => `${baseId}-opt-${pid}`;

  const selected = useMemo(
    () => products.find((p) => p.id === value) ?? null,
    [products, value]
  );

  // Espejo del valor en el texto: al elegir (o si el padre resetea el valor,
  // p. ej. tras empacar) el input muestra el nombre del producto. Se ajusta en
  // render comparando con el valor previo (patrón recomendado para derivar de
  // props sin un efecto que dispare renders en cascada).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(selected ? labelOf(selected) : "");
  }

  // Productos agrupados por categoría (oficiales) + grupo de custom. Mismo orden
  // y criterio que tenía <ProductOptions>.
  const groups = useMemo<Group[]>(() => {
    const official = products.filter((p) => p.kind === "official");
    const custom = products.filter((p) => p.kind === "custom");
    const out: Group[] = [];
    for (const cat of CATEGORIES) {
      const items = official
        .filter((p) => p.category === cat)
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      if (items.length) out.push({ key: cat, label: cat, items });
    }
    if (custom.length) {
      out.push({
        key: "__custom__",
        label: CUSTOM_GROUP,
        items: custom.slice().sort((a, b) => a.name.localeCompare(b.name, "es")),
      });
    }
    return out;
  }, [products]);

  // Si el texto es exactamente el nombre del producto ya elegido, no filtra:
  // abrir el combo muestra toda la lista para poder cambiar de producto.
  const showingLabel = selected !== null && query === labelOf(selected);
  const q = norm(showingLabel ? "" : query.trim());

  const filtered = useMemo<Group[]>(() => {
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((p) => {
          const cat = p.category ?? g.label; // custom: busca por su grupo
          return norm(p.name).includes(q) || norm(cat).includes(q);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, q]);

  const visible = useMemo(() => filtered.flatMap((g) => g.items), [filtered]);

  // Opción activa "efectiva": si la guardada ya no está visible, cae a la
  // seleccionada o a la primera. Derivar en render (en vez de un efecto que
  // setea estado) evita renders en cascada.
  const effectiveActiveId =
    activeId && visible.some((p) => p.id === activeId)
      ? activeId
      : value && visible.some((p) => p.id === value)
        ? value
        : (visible[0]?.id ?? null);

  // Desplazar la opción activa a la vista (navegación con teclado). Solo lee/
  // escribe el DOM, sin estado.
  useEffect(() => {
    if (!open || !effectiveActiveId) return;
    document.getElementById(optDomId(effectiveActiveId))?.scrollIntoView({ block: "nearest" });
    // optDomId es estable (deriva de useId); no hace falta en las deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveActiveId, open]);

  function revertText() {
    setQuery(selected ? labelOf(selected) : "");
  }

  function commit(p: Product) {
    onChange(p.id);
    setQuery(labelOf(p)); // cubre el re-elegir el mismo valor (no cambia value)
    setActiveId(p.id);
    setOpen(false);
  }

  function moveActive(dir: 1 | -1) {
    if (!visible.length) return;
    const i = visible.findIndex((x) => x.id === effectiveActiveId);
    const next =
      i < 0 ? (dir > 0 ? 0 : visible.length - 1) : Math.min(visible.length - 1, Math.max(0, i + dir));
    setActiveId(visible[next].id);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) setOpen(true);
        else moveActive(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) setOpen(true);
        else moveActive(-1);
        break;
      case "Enter":
        if (open && effectiveActiveId) {
          const p = visible.find((x) => x.id === effectiveActiveId);
          if (p) {
            e.preventDefault(); // no enviar el formulario al elegir
            commit(p);
          }
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
          revertText();
        }
        break;
      case "Home":
        if (open && visible.length) {
          e.preventDefault();
          setActiveId(visible[0].id);
        }
        break;
      case "End":
        if (open && visible.length) {
          e.preventDefault();
          setActiveId(visible[visible.length - 1].id);
        }
        break;
      case "Tab":
        if (open) {
          setOpen(false);
          revertText();
        }
        break;
    }
  }

  return (
    <div className="combo" ref={rootRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="input"
        style={query ? { paddingRight: "2.5rem" } : undefined}
        placeholder={placeholder}
        value={query}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={open && effectiveActiveId ? optDomId(effectiveActiveId) : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => {
          setOpen(true);
          e.target.select(); // primer tecleo reemplaza el nombre mostrado
        }}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          // Cierra al salir del componente (Tab o tocar afuera). Las opciones no
          // toman foco (se eligen con mousedown+preventDefault), así que no
          // disparan este blur.
          if (!rootRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
            revertText();
          }
        }}
      />

      {query && (
        <button
          type="button"
          className="combo-clear"
          aria-label="Limpiar búsqueda"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()} // no robar el foco del input
          onClick={() => {
            setQuery("");
            onChange("");
            setOpen(true);
          }}
        >
          ×
        </button>
      )}

      {/* Campo real que viaja en el submit: el id del producto elegido. */}
      <input type="hidden" name={name} value={value} />

      {open && (
        <ul className="combo-pop" id={listId} role="listbox" aria-label="Productos">
          {visible.length === 0 ? (
            <li className="combo-empty" role="presentation">
              No hay productos que coincidan con «{query.trim()}».
            </li>
          ) : (
            filtered.map((g) => (
              <li key={g.key} className="combo-group" role="group" aria-label={g.label}>
                <div className="combo-group-label" aria-hidden="true">
                  {g.label}
                </div>
                <ul role="presentation">
                  {g.items.map((p) => (
                    <li
                      key={p.id}
                      id={optDomId(p.id)}
                      role="option"
                      aria-selected={value === p.id}
                      data-active={effectiveActiveId === p.id}
                      className="combo-opt"
                      onMouseEnter={() => setActiveId(p.id)}
                      onMouseDown={(e) => e.preventDefault()} // conservar foco en el input
                      onClick={() => commit(p)}
                    >
                      <span>{p.name}</span>
                      <span className="combo-opt-unit">{p.unit}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
