-- 20260626121500_add_missing_fk_indexes.sql
-- Toda FK debe tener índice (verificación pre/post-apply lo detectó). Tablas vacías → CREATE INDEX directo.
begin;
create index if not exists products_created_by_idx on public.products (created_by);
create index if not exists pallets_created_by_idx  on public.pallets  (created_by);
commit;
