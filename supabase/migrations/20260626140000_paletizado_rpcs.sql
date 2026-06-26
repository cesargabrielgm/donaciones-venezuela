-- 20260626140000_paletizado_rpcs.sql
-- Paletizado (Forma A: cajas con múltiples líneas producto+cantidad+unidad).
-- Las tablas pallets/pallet_items ya existen y soportan la Forma A: NO se tocan.
-- Se agregan 2 RPCs:
--   pack_into_box       — agrega una línea de forma ATÓMICA, deriva la unidad del
--                         producto, calcula el aviso de "te pasaste" bajo un
--                         advisory lock por (ubicación, producto). Avisa, no bloquea.
--   inventory_availability — disponible = contado - empacado, por producto/ubicación.
-- Disponible es DERIVADO (suma), nunca un contador mutable → no hay doble-descuento.

begin;

-- ---------------------------------------------------------------------------
-- Empacar una línea en una caja. SECURITY DEFINER + guard de rol explícito.
-- Devuelve jsonb con la info del aviso (no lanza error si te pasás: avisa).
-- ---------------------------------------------------------------------------
create or replace function public.pack_into_box(
  p_pallet_id uuid,
  p_product_id uuid,
  p_quantity numeric
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_loc uuid;
  v_kind text;
  v_unit text;
  v_prod_loc uuid;
  v_counted numeric;
  v_packed_before numeric;
  v_item_id uuid;
  v_packed_after numeric;
  v_over numeric;
begin
  -- Autorización (la pared real; el cliente solo la espeja).
  if not public.has_role(array['owner','organizer']) then
    raise exception 'NO_AUTORIZADO: solo owner u organizer pueden paletizar.'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'CANTIDAD_INVALIDA: la cantidad debe ser mayor a cero.'
      using errcode = '22023';
  end if;

  select location_id into v_loc from public.pallets where id = p_pallet_id;
  if v_loc is null then
    raise exception 'CAJA_INEXISTENTE' using errcode = '23503';
  end if;

  -- Unidad derivada del producto (no la elige el usuario). Valida ubicación del custom.
  select kind, unit, location_id into v_kind, v_unit, v_prod_loc
  from public.products where id = p_product_id and is_active;
  if v_unit is null then
    raise exception 'PRODUCTO_INEXISTENTE' using errcode = '23503';
  end if;
  if v_kind = 'custom' and v_prod_loc is distinct from v_loc then
    raise exception 'PRODUCTO_OTRA_UBICACION: ese producto no es de esta ubicación.'
      using errcode = '23514';
  end if;

  -- Serializa a quienes empacan el MISMO (ubicación, producto): el cálculo de
  -- disponible/aviso es exacto y la inserción no se interleavea. Lock de transacción.
  perform pg_advisory_xact_lock(hashtextextended(v_loc::text || ':' || p_product_id::text, 0));

  select coalesce(sum(quantity), 0) into v_counted
  from public.count_entries
  where location_id = v_loc and product_id = p_product_id;

  select coalesce(sum(pi.quantity), 0) into v_packed_before
  from public.pallet_items pi
  join public.pallets p on p.id = pi.pallet_id
  where p.location_id = v_loc and pi.product_id = p_product_id;

  insert into public.pallet_items (pallet_id, product_id, quantity, unit)
  values (p_pallet_id, p_product_id, p_quantity, v_unit)
  returning id into v_item_id;

  v_packed_after := v_packed_before + p_quantity;
  v_over := v_packed_after - v_counted;

  return jsonb_build_object(
    'item_id', v_item_id,
    'unit', v_unit,
    'counted', v_counted,
    'packed_after', v_packed_after,
    'available_after', v_counted - v_packed_after,
    'exceeded', (v_over > 0),
    'exceeded_by', case when v_over > 0 then v_over else 0 end
  );
end $$;

-- ---------------------------------------------------------------------------
-- Disponible por producto en una ubicación: contado, empacado, disponible.
-- SECURITY DEFINER pero guardado: si el caller no es owner/organizer → sin filas.
-- ---------------------------------------------------------------------------
create or replace function public.inventory_availability(p_location uuid)
returns table (
  product_id uuid,
  product_name text,
  unit text,
  counted numeric,
  packed numeric,
  available numeric
)
language sql stable security definer set search_path = '' as $$
  with counted as (
    select ce.product_id, sum(ce.quantity) q
    from public.count_entries ce
    where ce.location_id = p_location
    group by ce.product_id
  ), packed as (
    select pi.product_id, sum(pi.quantity) q
    from public.pallet_items pi
    join public.pallets p on p.id = pi.pallet_id
    where p.location_id = p_location
    group by pi.product_id
  )
  select pr.id, pr.name, pr.unit,
         coalesce(c.q, 0), coalesce(pk.q, 0), coalesce(c.q, 0) - coalesce(pk.q, 0)
  from public.products pr
  left join counted c on c.product_id = pr.id
  left join packed pk on pk.product_id = pr.id
  where public.has_role(array['owner','organizer'])
    and (pr.kind = 'official' or pr.location_id = p_location)
    and (coalesce(c.q, 0) <> 0 or coalesce(pk.q, 0) <> 0)
  order by pr.name;
$$;

-- Grants: app autenticada; anon/PUBLIC sin nada. Las funciones se auto-guardan por rol.
revoke all on function public.pack_into_box(uuid, uuid, numeric) from anon, public;
revoke all on function public.inventory_availability(uuid) from anon, public;
grant execute on function public.pack_into_box(uuid, uuid, numeric) to authenticated;
grant execute on function public.inventory_availability(uuid) to authenticated;

commit;
