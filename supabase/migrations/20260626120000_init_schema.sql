-- 20260626120000_init_schema.sql
-- Donaciones Venezuela · Etapa 1 · esquema base (sin tenant; aislamiento por rol y ubicación)
-- Forward-only. Aplicada vía Management API. PostgreSQL 17, pgcrypto disponible (gen_random_uuid).
--
-- Tablas: locations, members, products, blocked_terms, count_entries, pallets, pallet_items.
-- Helpers STABLE SECURITY DEFINER con search_path fijo para usar dentro de las policies RLS.
-- Las policies RLS van en la migración 20260626120500_rls_policies.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1) Tablas de referencia
-- ---------------------------------------------------------------------------

-- Ubicaciones físicas de acopio.
create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index locations_name_key on public.locations (lower(name));

-- Identidad → rol (+ ubicación para counter). Reemplaza el modelo employees/roles del Hub.
-- owner/organizer: location_id null (acceso a todas). counter: location_id obligatoria (solo la suya).
create table public.members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        text not null check (role in ('owner','organizer','counter')),
  location_id uuid references public.locations (id) on delete restrict,
  created_at  timestamptz not null default now(),
  constraint members_role_location_ck check (
    (role = 'counter'   and location_id is not null) or
    (role in ('owner','organizer') and location_id is null)
  )
);
create index members_location_idx on public.members (location_id);

-- Productos: oficiales (catálogo global, unidad fija) + custom (por ubicación, definen su unidad).
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('official','custom')),
  unit        text not null check (unit in ('kg','litro','unidad','paquete','caja','saco','bulto','botella')),
  location_id uuid references public.locations (id) on delete cascade,
  created_by  uuid references auth.users (id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint products_kind_location_ck check (
    (kind = 'official' and location_id is null) or
    (kind = 'custom'   and location_id is not null)
  )
);
-- Unicidad: un oficial por nombre; un custom por (nombre, ubicación). Case-insensitive.
create unique index products_official_name_key on public.products (lower(name)) where kind = 'official';
create unique index products_custom_name_key   on public.products (lower(name), location_id) where kind = 'custom';
create index products_location_idx on public.products (location_id);

-- Lista de bloqueo: términos normalizados (minúscula, sin acento) que no se pueden recibir.
create table public.blocked_terms (
  id          uuid primary key default gen_random_uuid(),
  term        text not null unique,
  label       text,                       -- texto legible para el dueño
  created_at  timestamptz not null default now()
);

-- Entradas de conteo: producto + cantidad + unidad + ubicación + quién contó.
create table public.count_entries (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete restrict,
  product_id  uuid not null references public.products (id) on delete restrict,
  quantity    numeric(14,3) not null check (quantity > 0),
  unit        text not null,              -- snapshot de la unidad al momento del conteo
  counted_by  uuid not null references auth.users (id) on delete restrict,
  note        text,
  created_at  timestamptz not null default now()
);
create index count_entries_location_created_idx on public.count_entries (location_id, created_at desc);
create index count_entries_product_idx on public.count_entries (product_id);
create index count_entries_counted_by_idx on public.count_entries (counted_by);

-- ---------------------------------------------------------------------------
-- 2) Paletizado (Etapa 2; sin UI). Se crean con RLS para dejar el lugar listo.
-- ---------------------------------------------------------------------------
create table public.pallets (
  id          uuid primary key default gen_random_uuid(),
  code        text,
  location_id uuid references public.locations (id) on delete set null,
  status      text not null default 'open' check (status in ('open','closed')),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index pallets_location_idx on public.pallets (location_id);

create table public.pallet_items (
  id          uuid primary key default gen_random_uuid(),
  pallet_id   uuid not null references public.pallets (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete restrict,
  quantity    numeric(14,3) not null check (quantity > 0),
  unit        text not null,
  created_at  timestamptz not null default now()
);
create index pallet_items_pallet_idx on public.pallet_items (pallet_id);
create index pallet_items_product_idx on public.pallet_items (product_id);

-- ---------------------------------------------------------------------------
-- 3) Helpers para RLS (STABLE SECURITY DEFINER, search_path fijo).
--    SECURITY DEFINER (owner=postgres) evita recursión de RLS al leer members.
--    Se evalúan una vez por query (InitPlan) gracias a (select auth.uid()).
-- ---------------------------------------------------------------------------
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.user_id = (select auth.uid()));
$$;

create or replace function public.has_role(allowed text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.user_id = (select auth.uid()) and m.role = any(allowed)
  );
$$;

create or replace function public.can_access_location(loc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.user_id = (select auth.uid())
      and (m.role in ('owner','organizer') or m.location_id = loc)
  );
$$;

-- ---------------------------------------------------------------------------
-- 4) Normalización + lista de bloqueo (defensa en la base, no solo en la app).
-- ---------------------------------------------------------------------------
create or replace function public.normalize_text(t text)
returns text language sql immutable set search_path = '' as $$
  select translate(lower(coalesce(t, '')), 'áéíóúüñ', 'aeiouun');
$$;

create or replace function public.is_blocked(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocked_terms b
    where public.normalize_text(p_name) like '%' || b.term || '%'
  );
$$;

create or replace function public.reject_blocked_product()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind = 'custom' and public.is_blocked(new.name) then
    raise exception 'PRODUCTO_BLOQUEADO: "%" no se puede recibir en la campaña.', new.name
      using errcode = 'check_violation',
            hint = 'Si creés que es un error, avisá a tu organizador.';
  end if;
  return new;
end $$;

create trigger trg_reject_blocked_product
  before insert or update on public.products
  for each row execute function public.reject_blocked_product();

-- ---------------------------------------------------------------------------
-- 5) Integridad conteo ↔ producto/ubicación (un custom solo se cuenta en SU ubicación).
-- ---------------------------------------------------------------------------
create or replace function public.check_count_product_location()
returns trigger language plpgsql set search_path = '' as $$
declare p record;
begin
  select kind, location_id, is_active into p from public.products where id = new.product_id;
  if not found then
    raise exception 'Producto inexistente' using errcode = 'foreign_key_violation';
  end if;
  if p.kind = 'custom' and p.location_id is distinct from new.location_id then
    raise exception 'El producto personalizado no pertenece a esta ubicación'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger trg_check_count_product_location
  before insert or update on public.count_entries
  for each row execute function public.check_count_product_location();

commit;
