-- 20260626120500_rls_policies.sql
-- RLS: enabled + deny-by-default + with_check en INSERT/UPDATE para CADA tabla.
-- Aislamiento por UBICACIÓN en conteo/productos; por ROL en members/paletizado/bloqueo.
-- Grants: app autenticada solamente → se revoca todo a anon y PUBLIC.

begin;

-- ---------------------------------------------------------------------------
-- Enable RLS explícito (el event trigger ensure_rls también lo hace; redundante a propósito).
-- ---------------------------------------------------------------------------
alter table public.locations     enable row level security;
alter table public.members       enable row level security;
alter table public.products      enable row level security;
alter table public.blocked_terms enable row level security;
alter table public.count_entries enable row level security;
alter table public.pallets       enable row level security;
alter table public.pallet_items  enable row level security;

-- ---------------------------------------------------------------------------
-- LOCATIONS — lectura: cualquier miembro; escritura: owner.
-- ---------------------------------------------------------------------------
create policy locations_select on public.locations for select to authenticated
  using (public.is_member());
create policy locations_insert on public.locations for insert to authenticated
  with check (public.has_role(array['owner']));
create policy locations_update on public.locations for update to authenticated
  using (public.has_role(array['owner']))
  with check (public.has_role(array['owner']));
create policy locations_delete on public.locations for delete to authenticated
  using (public.has_role(array['owner']));

-- ---------------------------------------------------------------------------
-- MEMBERS — lectura: la fila propia, o todo si owner/organizer; escritura: owner.
-- ---------------------------------------------------------------------------
create policy members_select on public.members for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role(array['owner','organizer']));
create policy members_insert on public.members for insert to authenticated
  with check (public.has_role(array['owner']));
create policy members_update on public.members for update to authenticated
  using (public.has_role(array['owner']))
  with check (public.has_role(array['owner']));
create policy members_delete on public.members for delete to authenticated
  using (public.has_role(array['owner']));

-- ---------------------------------------------------------------------------
-- PRODUCTS — oficiales visibles a todos los miembros; custom según ubicación.
--   INSERT: oficial→owner; custom→quien accede a esa ubicación.
--   UPDATE: misma lógica. DELETE: owner/organizer.
-- ---------------------------------------------------------------------------
create policy products_select on public.products for select to authenticated
  using (kind = 'official' or public.can_access_location(location_id));
create policy products_insert on public.products for insert to authenticated
  with check (
    (kind = 'official' and public.has_role(array['owner'])) or
    (kind = 'custom'   and public.can_access_location(location_id))
  );
create policy products_update on public.products for update to authenticated
  using (
    (kind = 'official' and public.has_role(array['owner'])) or
    (kind = 'custom'   and public.can_access_location(location_id))
  )
  with check (
    (kind = 'official' and public.has_role(array['owner'])) or
    (kind = 'custom'   and public.can_access_location(location_id))
  );
create policy products_delete on public.products for delete to authenticated
  using (public.has_role(array['owner','organizer']));

-- ---------------------------------------------------------------------------
-- BLOCKED_TERMS — lectura: miembros (para pre-chequeo en UI); escritura: owner.
-- ---------------------------------------------------------------------------
create policy blocked_terms_select on public.blocked_terms for select to authenticated
  using (public.is_member());
create policy blocked_terms_insert on public.blocked_terms for insert to authenticated
  with check (public.has_role(array['owner']));
create policy blocked_terms_update on public.blocked_terms for update to authenticated
  using (public.has_role(array['owner']))
  with check (public.has_role(array['owner']));
create policy blocked_terms_delete on public.blocked_terms for delete to authenticated
  using (public.has_role(array['owner']));

-- ---------------------------------------------------------------------------
-- COUNT_ENTRIES — scope por UBICACIÓN. counter inserta/edita lo suyo;
--   owner/organizer ven y corrigen todo. DELETE solo owner/organizer.
-- ---------------------------------------------------------------------------
create policy count_entries_select on public.count_entries for select to authenticated
  using (public.can_access_location(location_id));
create policy count_entries_insert on public.count_entries for insert to authenticated
  with check (
    public.can_access_location(location_id)
    and counted_by = (select auth.uid())
  );
create policy count_entries_update on public.count_entries for update to authenticated
  using (
    public.can_access_location(location_id)
    and (counted_by = (select auth.uid()) or public.has_role(array['owner','organizer']))
  )
  with check (public.can_access_location(location_id));
create policy count_entries_delete on public.count_entries for delete to authenticated
  using (public.has_role(array['owner','organizer']));

-- ---------------------------------------------------------------------------
-- PALETIZADO — solo owner/organizer (counter sin acceso). Listo para Etapa 2.
-- ---------------------------------------------------------------------------
create policy pallets_all on public.pallets for all to authenticated
  using (public.has_role(array['owner','organizer']))
  with check (public.has_role(array['owner','organizer']));
create policy pallet_items_all on public.pallet_items for all to authenticated
  using (public.has_role(array['owner','organizer']))
  with check (public.has_role(array['owner','organizer']));

-- ---------------------------------------------------------------------------
-- GRANTS — app autenticada solamente. anon y PUBLIC: nada.
--   authenticated conserva privilegios de tabla; RLS es la pared real de filas.
--   service_role conserva todo (bypassa RLS) para seeds/admin/tests.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all tables in schema public from public;
revoke all on all routines in schema public from public;

-- Las funciones helper de las policies se evalúan como 'authenticated': mantener su EXECUTE.
grant execute on function public.is_member()                 to authenticated;
grant execute on function public.has_role(text[])            to authenticated;
grant execute on function public.can_access_location(uuid)   to authenticated;
grant execute on function public.is_blocked(text)            to authenticated;
grant execute on function public.normalize_text(text)        to authenticated;

commit;
