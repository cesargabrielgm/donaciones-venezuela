-- 20260626130000_admin_users.sql
-- Etapa 2: administración de usuarios (solo owner).
--   1) email denormalizado en members (para listar sin tocar auth.users / service_role).
--   2) members_select más estricto: la LISTA completa la lee solo el owner; cada
--      quien sigue leyendo SU propia fila (la app la necesita para getMember).
--   3) trigger anti-último-owner: no se puede borrar/degradar al único owner.
-- INSERT/UPDATE/DELETE de members ya estaban gateados a has_role('owner') desde Etapa 1.

begin;

-- 1) Email en members (la lista lo muestra). Backfill de las filas existentes.
alter table public.members add column if not exists email text;
update public.members m
  set email = u.email
  from auth.users u
  where u.id = m.user_id and m.email is null;

-- 2) Lectura: la fila propia para todos; la lista completa solo el owner.
--    (organizer/counter dejan de poder leer la administración de usuarios.)
drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role(array['owner'])
  );

-- 3) Anti-lockout: nunca dejar la app sin ningún owner.
create or replace function public.prevent_last_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_count int;
begin
  select count(*) into owner_count from public.members where role = 'owner';

  if tg_op = 'DELETE' then
    if old.role = 'owner' and owner_count <= 1 then
      raise exception 'ULTIMO_OWNER: no podés quitar al último owner. Primero asigná otro owner.'
        using errcode = 'check_violation';
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.role = 'owner' and new.role <> 'owner' and owner_count <= 1 then
      raise exception 'ULTIMO_OWNER: no podés degradar al último owner. Primero asigná otro owner.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;
  return new;
end $$;

drop trigger if exists trg_prevent_last_owner on public.members;
create trigger trg_prevent_last_owner
  before update or delete on public.members
  for each row execute function public.prevent_last_owner();

commit;
