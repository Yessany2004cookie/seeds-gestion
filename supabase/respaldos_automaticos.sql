-- ════════════════════════════════════════════════════════════════
--  Respaldos automáticos
--  Todos los días a las 2:00 AM (hora de Honduras) la base de datos se
--  copia sola dentro de Supabase, en el esquema privado "respaldos".
--  Cada copia guarda TODAS las tablas de la app en el mismo formato que el
--  botón "Descargar respaldo", así que se puede bajar desde la app y volver
--  a cargar con "Restaurar respaldo".
--
--  Se guardan: las copias de los últimos 30 días + la primera copia de cada
--  mes durante un año. Lo más viejo se borra solo.
--
--  El esquema "respaldos" no es visible desde la app: solo administración
--  puede ver la lista y descargar copias, a través de las funciones de abajo.
--
--  Para deshacer:
--    select cron.unschedule('respaldo-diario');
--    drop function public.respaldos_lista(); drop function public.respaldo_descargar(bigint);
--    drop function public.respaldo_hacer_ahora(); drop schema respaldos cascade;
--  (No toca ninguna tabla existente.)
-- ════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

create schema if not exists respaldos;
revoke all on schema respaldos from public, anon, authenticated;

create table if not exists respaldos.copias (
  id      bigserial   primary key,
  creado  timestamptz not null default now(),
  tipo    text        not null default 'automatico' check (tipo in ('automatico','manual')),
  tablas  integer     not null,
  filas   integer     not null,
  datos   jsonb       not null
);
create index if not exists copias_creado_idx on respaldos.copias (creado desc);

-- Hace una copia de todas las tablas de public y limpia las viejas.
create or replace function respaldos.hacer_copia(p_tipo text default 'automatico')
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  t record;
  filas_t jsonb;
  todo jsonb := jsonb_build_object('fecha', now(), 'version', 5, 'origen', 'respaldo_' || p_tipo);
  n_tablas int := 0;
  n_filas int := 0;
  nuevo bigint;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t.table_name)
      into filas_t;
    todo := todo || jsonb_build_object(t.table_name, filas_t);
    n_tablas := n_tablas + 1;
    n_filas := n_filas + jsonb_array_length(filas_t);
  end loop;

  insert into respaldos.copias (tipo, tablas, filas, datos)
  values (case when p_tipo = 'manual' then 'manual' else 'automatico' end, n_tablas, n_filas, todo)
  returning id into nuevo;

  -- Limpieza: se queda lo de los últimos 30 días, la primera copia de cada
  -- mes del último año, y siempre las 7 más recientes.
  delete from respaldos.copias c
  where c.creado < now() - interval '30 days'
    and c.id not in (select id from respaldos.copias order by creado desc limit 7)
    and (c.creado < now() - interval '365 days'
         or c.id not in (
           select distinct on (date_trunc('month', creado at time zone 'America/Tegucigalpa')) id
           from respaldos.copias
           order by date_trunc('month', creado at time zone 'America/Tegucigalpa'), creado));

  return nuevo;
end $$;
revoke all on function respaldos.hacer_copia(text) from public, anon, authenticated;

-- Lista de copias (sin los datos) para la pantalla Sistema y respaldos.
create or replace function public.respaldos_lista()
returns table (id bigint, creado timestamptz, tipo text, tablas int, filas int, tamano_kb int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then return; end if;
  return query
    select c.id, c.creado, c.tipo, c.tablas, c.filas, (pg_column_size(c.datos) / 1024)::int
    from respaldos.copias c order by c.creado desc limit 60;
end $$;

-- Descargar una copia completa (mismo formato que "Descargar respaldo").
create or replace function public.respaldo_descargar(p_id bigint)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then return null; end if;
  return (select datos from respaldos.copias where id = p_id);
end $$;

-- Hacer una copia en este momento (por ejemplo antes de un cambio grande).
create or replace function public.respaldo_hacer_ahora()
returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then return null; end if;
  return respaldos.hacer_copia('manual');
end $$;

revoke all on function public.respaldos_lista() from public, anon;
revoke all on function public.respaldo_descargar(bigint) from public, anon;
revoke all on function public.respaldo_hacer_ahora() from public, anon;
grant execute on function public.respaldos_lista() to authenticated;
grant execute on function public.respaldo_descargar(bigint) to authenticated;
grant execute on function public.respaldo_hacer_ahora() to authenticated;

-- Programar: todos los días 08:00 UTC = 2:00 AM en Honduras.
select cron.schedule('respaldo-diario', '0 8 * * *', $$select respaldos.hacer_copia('automatico')$$);
