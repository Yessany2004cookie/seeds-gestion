-- DESHACER marketing_relacional.sql
-- Borra las encuestas de satisfacción (y sus respuestas), quita el rol
-- marketing y deja la seguridad como estaba. Las cuentas con rol
-- marketing pasan a "docente" para que el cambio de regla no falle.
drop function if exists public.satisfaccion_responder(text, jsonb);
drop function if exists public.satisfaccion_ver(text);
drop function if exists public.satisfaccion_crear(text, jsonb, boolean);
drop table if exists public.satisfaccion_respuestas;
drop table if exists public.satisfaccion_campanas;

drop policy if exists marketing_ver on public.secciones;
drop policy if exists marketing_ver on public.alumnos;
drop policy if exists marketing_ver on public.padres;
drop policy if exists marketing_ver on public.sucursales;
drop policy if exists marketing_ver on public.encuestas_desercion;
drop policy if exists marketing_enviar on public.encuestas_desercion;

create or replace function public.mi_maestro_id() returns text
language sql stable security definer set search_path = public as $$
  select maestro_id from public.perfiles where user_id = auth.uid() and rol = 'docente';
$$;
drop function if exists public.es_marketing();

update public.perfiles set rol = 'docente' where rol = 'marketing';
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check (rol in ('admin','docente'));
-- El respaldo (esquema respaldo_20261125_marketing) se deja por seguridad.
