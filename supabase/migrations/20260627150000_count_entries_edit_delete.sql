-- 20260627150000_count_entries_edit_delete.sql
-- Etapa 6: editar y borrar conteos ya registrados, con permiso en la BASE.
--
-- Regla de negocio (cerrada por el dueño):
--   * counter: solo puede EDITAR/BORRAR los conteos que él mismo registró
--     (counted_by = su uid) y solo en su ubicación. Los de otros, NO.
--   * owner/organizer: cualquier conteo en las ubicaciones que les corresponden
--     (can_access_location ya los cubre con true para ambos roles).
--
-- Qué cambia respecto de Etapa 1:
--   1) UPDATE: el USING ya era correcto; reforzamos el with_check para que espeje
--      al USING. Antes el with_check era solo can_access_location(location_id), lo
--      que dejaba que un counter, editando, reasignara counted_by a otro usuario
--      (la ubicación no cambiaba, así que pasaba). Ahora el NEW row debe seguir
--      siendo del propio counter (o el editor ser owner/organizer) Y la ubicación
--      accesible → no se puede reasignar a otro counter ni a otra ubicación.
--   2) DELETE: antes solo owner/organizer. Ahora un counter puede borrar lo suyo
--      en su ubicación; owner/organizer siguen pudiendo borrar cualquiera.
--
-- Lo que NO cambia editando: producto, ubicación y unidad. La unidad sigue siendo
-- el snapshot del producto (no editable). El server action solo toca quantity y note;
-- el trigger trg_check_count_product_location ya impide mover un custom de ubicación.
-- Forward-only. Idempotente (drop policy if exists antes de recrear).

begin;

-- --- UPDATE: with_check espejando el USING (counter solo lo suyo; no reasignar) ---
drop policy if exists count_entries_update on public.count_entries;
create policy count_entries_update on public.count_entries for update to authenticated
  using (
    public.can_access_location(location_id)
    and (counted_by = (select auth.uid()) or public.has_role(array['owner','organizer']))
  )
  with check (
    public.can_access_location(location_id)
    and (counted_by = (select auth.uid()) or public.has_role(array['owner','organizer']))
  );

-- --- DELETE: counter borra lo suyo en su ubicación; owner/organizer cualquiera ---
drop policy if exists count_entries_delete on public.count_entries;
create policy count_entries_delete on public.count_entries for delete to authenticated
  using (
    public.can_access_location(location_id)
    and (counted_by = (select auth.uid()) or public.has_role(array['owner','organizer']))
  );

commit;
