# Estado del proyecto — Donaciones Venezuela

> Documento de estado para retomar sin perder contexto. Refleja el estado real
> verificado contra git y la base en vivo, no de memoria.
>
> **Última actualización:** 2026-06-29 · **HEAD:** `c44ee91` · **Tree:** limpio
>
> Proyecto **autónomo y separado** de Aguacate: Supabase propio, Vercel propio,
> repo propio. **No** usa el protocolo de cierre, los logs por capas ni la
> numeración S-XX de Aguacate. No comparte docs ni contratos con esos proyectos.

---

## Qué es

Herramienta interna para **contar donaciones** de **una sola campaña** (no es
multi-tenant). Los voluntarios registran cuánto entra de cada producto en su
centro de acopio; luego se arma el paletizado (cajas) y un packing list para
aduana. El aislamiento **no** sale de un tenant: sale del **rol** y de la
**ubicación** de cada persona (lo impone la base con RLS).

Tres roles:

- **owner (dueño):** ve todo, administra usuarios y ubicaciones. Sin ubicación fija.
- **organizer (organizador):** ve/gestiona su ubicación. Sin administrar usuarios.
- **counter (contador):** registra conteos en **su** ubicación; edita/borra solo
  lo propio.

---

## Stack e infraestructura

- **Frontend/Backend:** Next.js 16 (App Router) + React 19. Server Actions para
  escribir; sin API REST propia.
- **Base de datos / Auth:** Supabase **`dpwczisqyaatshlelvrk`** (PostgreSQL 17).
  Migraciones forward-only en `supabase/migrations/`, aplicadas vía Management API.
- **Hosting:** Vercel. En vivo en **https://donaciones.aguacatelatinfood.at**.
- **Login:** email + contraseña (reemplazó al código OTP en la Etapa 4). El
  acceso es solo para usuarios autenticados; `anon`/`PUBLIC` no tienen ningún grant.
- **Idioma:** es-VE, tuteo.

`.env.local` tiene 4 llaves: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo server),
`SUPABASE_ACCESS_TOKEN` (Management API).

---

## Qué está construido y funcionando

Cinco áreas, todas operativas:

1. **Conteo** (`/conteo`) — registrar producto + cantidad. El selector de producto
   tiene **buscador**: filtra por nombre y categoría ignorando acentos y mayúsculas
   ("ninos" encuentra Niños, "salud" muestra Salud y primeros auxilios), agrupado
   por categoría, cómodo en móvil.
2. **Editar / borrar conteos** — con permiso aplicado en la base (RLS): el counter
   solo toca lo propio; owner/organizer, lo de su ubicación.
3. **Paletizado** (`/paletizado`) — cajas con múltiples líneas (producto + cantidad
   + unidad) y **packing list** imprimible (`/paletizado/packing-list`) para aduana.
   El "disponible" = contado − empacado (derivado por suma).
4. **Admin de usuarios** (`/usuarios`) — solo el owner: invitar gente y asignar rol
   + ubicación.
5. **Admin de ubicaciones** (`/ubicaciones`) — solo el owner: alta/edición de los
   centros de acopio (con dirección opcional para el packing list).

Otras rutas: `/login`, `/recuperar` (pedir reseteo), `/definir-clave` (fijar
contraseña desde el enlace del correo), `/sin-acceso` (sin permisos), `/` (home).

### Modelo de productos

- **official:** catálogo global, unidad fija, sin ubicación; lo ven todas las
  ubicaciones presentes y futuras.
- **custom:** por ubicación (define su propia unidad); aparecen en el grupo
  "Personalizados de esta ubicación".
- **blocked_terms:** lista de bloqueo (términos normalizados, match por substring).
  Un trigger rechaza productos **custom** prohibidos con un mensaje amable. Los
  **official** no pasan por la lista.

### Catálogo (verificado en vivo, 2026-06-29)

**89 productos oficiales** en **7 categorías**:

| Categoría | Productos |
|---|---|
| Agua e higiene | 13 |
| Alimentos no perecederos | 23 |
| Salud y primeros auxilios | 22 |
| Limpieza y recuperación | 12 |
| Niños y bebés | 8 |
| Adultos mayores | 6 |
| Refugio y abrigo | 5 |

(Además hay 21 productos custom de las ubicaciones existentes.)

---

## Seguridad (RLS) en resumen

- **RLS habilitado + deny-by-default** en cada tabla; `with_check` en INSERT/UPDATE
  para que nadie inserte/reasigne filas fuera de su alcance.
- La **autorización vive en la base** (RLS es la verdad); el chequeo en TypeScript
  es defensa en profundidad, no la pared.
- **App solo autenticada:** se revoca todo grant a `anon` y `PUBLIC`.
- Helpers `STABLE SECURITY DEFINER` con `search_path` fijo:
  **`has_role`**, **`can_access_location`**, **`is_member`**, **`is_blocked`**.
- Aislamiento: por **ubicación** en conteo/productos; por **rol** en
  members/paletizado/bloqueo. La lista completa de `members` la lee solo el owner.

Tablas (todas con RLS habilitado, verificado en vivo): `members`, `locations`,
`products`, `count_entries`, `pallets`, `pallet_items`, `blocked_terms`.

---

## Migraciones aplicadas (`supabase/migrations/`, forward-only)

| Archivo | Qué hace |
|---|---|
| `20260626120000_init_schema.sql` | Esquema base (sin tenant; aislamiento por rol y ubicación). PostgreSQL 17. |
| `20260626120500_rls_policies.sql` | RLS enabled + deny-by-default + `with_check` en cada tabla; revoca grants a anon/PUBLIC. |
| `20260626121000_seed_reference_data.sql` | Datos de referencia editables: ubicaciones demo, catálogo oficial inicial, lista de bloqueo. |
| `20260626121500_add_missing_fk_indexes.sql` | Índices para toda FK que faltaba (verificación pre/post-apply). |
| `20260626130000_admin_users.sql` | Etapa 2: admin de usuarios (solo owner); email denormalizado en members; select más estricto. |
| `20260626140000_paletizado_rpcs.sql` | Paletizado (cajas con líneas producto+cantidad+unidad); agrega 2 RPCs. |
| `20260627120000_category_address_and_demo_cleanup.sql` | Categoría en products (6 valores), dirección en locations, limpieza de datos demo. |
| `20260627121000_seed_catalog_77.sql` | Catálogo real: 77 productos oficiales con unidad + categoría. |
| `20260627150000_count_entries_edit_delete.sql` | Etapa 6: editar/borrar conteos con permiso en la base. |
| `20260629120000_add_refugio_category_and_12_products.sql` | Amplía categorías 6→7 ("Refugio y abrigo") + 12 productos oficiales nuevos (77→89). |

---

## Cómo se administra el acceso

- Solo el **owner** invita gente desde **`/usuarios`** (asignando rol + ubicación).
- El invitado **define su contraseña** vía el **enlace del correo** de invitación.
- Las **ubicaciones** las gestiona el owner desde **`/ubicaciones`**.

---

## Pendientes conocidos

- **Actualizar el Supabase Site URL** a `https://donaciones.aguacatelatinfood.at` y
  agregar Redirect URL `https://donaciones.aguacatelatinfood.at/**` **ANTES de
  invitar usuarios reales** (si no, los correos de invitación/reseteo apuntan a la
  dirección vieja `.vercel.app`).
- **Los correos de auth (invitación, reseteo) llegan en inglés:** las plantillas no
  son editables en el plan free de Supabase; requeriría configurar SMTP propio o
  subir de plan.
- **Validación instantánea del producto al guardar conteo:** hoy es server-side
  (round-trip); se puede agregar un guard en cliente si se desea.
- **4 advertencias de lint preexistentes** (`react-compiler`/`set-state-in-effect`)
  en `paletizado-board.tsx`, `ubicaciones-admin.tsx`, `usuarios-admin.tsx` — no
  rompen el build, limpieza opcional.
