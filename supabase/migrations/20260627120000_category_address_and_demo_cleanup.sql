-- 20260627120000_category_address_and_demo_cleanup.sql
-- (1) Categoría en products (6 valores fijos, custom = null → "Personalizados").
-- (2) Dirección opcional en locations.
-- (3) Limpieza de datos demo en una transacción, respetando el orden de FKs.
--     Mantiene cesargabrielgm@gmail.com (owner real) y blocked_terms (config real).

begin;

-- --- (1) Categoría: columna text + CHECK. Patrón igual a unit/kind. ---
alter table public.products
  add column if not exists category text
  check (category is null or category in (
    'Agua e higiene',
    'Alimentos no perecederos',
    'Salud y primeros auxilios',
    'Niños y bebés',
    'Adultos mayores',
    'Limpieza y recuperación'
  ));
create index if not exists products_category_idx on public.products (category);

-- --- (2) Dirección opcional en locations (útil para el packing list de aduana). ---
alter table public.locations add column if not exists address text;

-- --- (3) Limpieza demo. Orden hija→padre para no chocar FKs.
--     count_entries.counted_by → auth.users (RESTRICT): borrar conteos antes que usuarios.
--     members.location_id → locations (RESTRICT): borrar members demo antes que locations.
--     prevent_last_owner: borrar owner.demo es seguro (cesargabrielgm sigue siendo owner).

delete from public.count_entries;                                   -- todos eran fixtures demo
delete from public.pallet_items;                                    -- vacío
delete from public.pallets;                                         -- vacío
delete from public.products;                                        -- catálogo genérico + custom de prueba
delete from public.members  where email like '%@donaciones.test';   -- 4 demo; NO toca cesargabrielgm
delete from public.locations;                                       -- 2 demo → locations queda vacía
delete from auth.users      where email like '%@donaciones.test';   -- 4 demo; NO toca cesargabrielgm

commit;
