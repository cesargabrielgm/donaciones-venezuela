-- 20260626121000_seed_reference_data.sql
-- Datos de referencia EDITABLES por el dueño: ubicaciones demo, catálogo oficial, lista de bloqueo.
-- La lista de bloqueo guarda términos normalizados (minúscula, sin acento); el match es por substring.

begin;

-- Ubicaciones demo (el dueño renombra/agrega las reales).
insert into public.locations (name) values
  ('Centro de Acopio Caracas'),
  ('Centro de Acopio Valencia');

-- Catálogo oficial (unidad fija). kind='official', location_id null.
insert into public.products (name, kind, unit) values
  ('Arroz',          'official', 'kg'),
  ('Harina',         'official', 'kg'),
  ('Pasta',          'official', 'kg'),
  ('Aceite',         'official', 'litro'),
  ('Leche en polvo', 'official', 'kg'),
  ('Enlatados',      'official', 'unidad'),
  ('Agua',           'official', 'litro');

-- Lista de bloqueo. 'vencid' cubre "comida vencida" y "medicamentos vencidos";
-- 'aerosol' cubre "aerosoles". Términos en minúscula y sin acento.
insert into public.blocked_terms (term, label) values
  ('ropa usada', 'Ropa usada'),
  ('vencid',     'Comida o medicamentos vencidos'),
  ('aerosol',    'Aerosoles');

commit;
