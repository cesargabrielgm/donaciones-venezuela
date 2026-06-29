-- 20260629120000_add_refugio_category_and_12_products.sql
-- Carga INCREMENTAL (no toca los 77 oficiales ya cargados ni ningún conteo):
-- (1) Amplía la restricción de categorías de products: 6 → 7 valores
--     (agrega la séptima, "Refugio y abrigo").
-- (2) Inserta 12 productos oficiales nuevos (kind=official, sin location_id).
-- El orden importa: la categoría debe aceptarse ANTES de insertar los de
-- "Refugio y abrigo", o el CHECK rechaza el insert.

begin;

-- --- (1) Reemplazar el CHECK de category (6 → 7 valores). ---
-- El CHECK original se creó inline al agregar la columna (ver
-- 20260627120000), por lo que su nombre por defecto es products_category_check.
-- Lo dropeamos de forma robusta (cualquier CHECK de products que mencione la
-- lista vieja) y re-creamos uno con nombre estable y los 7 valores.
do $$
declare c text;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where rel.relname = 'products' and n.nspname = 'public'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%Agua e higiene%'
  loop
    execute format('alter table public.products drop constraint %I', c);
  end loop;
end $$;

alter table public.products
  add constraint products_category_check
  check (category is null or category in (
    'Agua e higiene',
    'Alimentos no perecederos',
    'Salud y primeros auxilios',
    'Niños y bebés',
    'Adultos mayores',
    'Limpieza y recuperación',
    'Refugio y abrigo'
  ));

-- --- (2) 12 productos oficiales nuevos. ---
-- Oficiales: kind='official', location_id NULL (catálogo global). No pasan por
-- la lista de bloqueo (el trigger solo aplica a custom).
insert into public.products (name, kind, unit, category) values
  ('Multivitamínicos', 'official', 'caja', 'Adultos mayores'),
  ('Complejo B', 'official', 'caja', 'Adultos mayores'),
  ('Galletas', 'official', 'paquete', 'Alimentos no perecederos'),
  ('Mermelada', 'official', 'unidad', 'Alimentos no perecederos'),
  ('Miel', 'official', 'unidad', 'Alimentos no perecederos'),
  ('Juguetes nuevos', 'official', 'unidad', 'Niños y bebés'),
  ('Cobijas / mantas', 'official', 'unidad', 'Refugio y abrigo'),
  ('Sábanas', 'official', 'unidad', 'Refugio y abrigo'),
  ('Carpas', 'official', 'unidad', 'Refugio y abrigo'),
  ('Almohadas', 'official', 'unidad', 'Refugio y abrigo'),
  ('Radios', 'official', 'unidad', 'Refugio y abrigo'),
  ('Cinta médica quirúrgica', 'official', 'unidad', 'Salud y primeros auxilios');

commit;
