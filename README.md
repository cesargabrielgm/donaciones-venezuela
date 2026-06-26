# Conteo de Donaciones

Herramienta interna y acotada para controlar las donaciones de **una** campaña
humanitaria. App web en español (es-VE). **No es multi-tenant**: el aislamiento es
por **rol** y por **ubicación**, no por inquilino.

- Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Auth + Postgres + RLS).
- Proyecto Supabase: `dpwczisqyaatshlelvrk` (separado de cualquier otro).

## Puesta en marcha

```bash
cp .env.example .env.local   # completá las keys (ver .env.example)
npm install
npm run dev                  # http://localhost:3000
```

## Roles

| Rol | Puede |
|---|---|
| `owner` | Todo: ubicaciones, productos oficiales, lista de bloqueo, conteo y (futuro) paletizado. |
| `organizer` | Conteo de todas las ubicaciones + (futuro) paletizado. |
| `counter` | Solo conteo, solo de **su** ubicación. |

El **dueño administra los accesos**: crea el usuario en Supabase (Authentication →
Add user, por email) y le asigna rol/ubicación en la tabla `members`. Un usuario
autenticado sin fila en `members` ve la pantalla "tu cuenta todavía no tiene acceso".

Ejemplo para habilitar a alguien (SQL, como owner/service_role):

```sql
-- counter atado a una ubicación:
insert into public.members (user_id, full_name, role, location_id)
values ('<auth-user-id>', 'Nombre', 'counter', '<location-id>');

-- owner / organizer (sin ubicación → ven todas):
insert into public.members (user_id, full_name, role, location_id)
values ('<auth-user-id>', 'Nombre', 'owner', null);
```

## Base de datos

Migraciones versionadas (forward-only) en `supabase/migrations/`. Modelo:

- `locations` — centros de acopio.
- `members` — `user_id → rol (+ location_id para counter)`. Reemplaza el modelo de
  tenant: el aislamiento sale de acá.
- `products` — `kind = official` (catálogo global, unidad fija) | `custom` (por
  ubicación, define su unidad). Constraint impide custom sin ubicación / oficial con ubicación.
- `blocked_terms` — lista de bloqueo (términos normalizados, match por substring).
  Un trigger en la base rechaza productos custom prohibidos con mensaje amable.
- `count_entries` — producto + cantidad (`numeric`) + unidad + ubicación + quién contó.
- `pallets` / `pallet_items` — paletizado (Etapa 2): tablas con RLS listas, sin UI todavía.

### Seguridad (RLS)

- RLS **enabled + deny-by-default** en cada tabla; `with_check` en INSERT/UPDATE.
- Autorización en la base (RLS es la verdad); el chequeo en TS es defensa en profundidad.
- Helpers `STABLE SECURITY DEFINER` con `search_path` fijo: `has_role`,
  `can_access_location`, `is_member`, `is_blocked`.
- App **solo autenticada**: `anon` y `PUBLIC` no tienen ningún grant.
