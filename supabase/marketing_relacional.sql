-- ════════════════════════════════════════════════════════════
-- MARKETING RELACIONAL
--
-- 1. Nuevo rol "marketing" en perfiles (además de admin y docente).
--    Ve SOLO: secciones, alumnos y padres (para leer, no para cambiar),
--    las encuestas de deserción (puede marcarlas como enviadas) y las
--    encuestas de satisfacción. Nada de facturas, gastos, planilla,
--    materiales, graduación, contabilidad ni configuración.
--    Si su cuenta está enlazada a un maestro, también conserva su
--    portal docente (sus grupos), igual que un docente.
-- 2. Encuestas de satisfacción: cada "encuesta" (campaña) tiene sus
--    preguntas y crea un enlace por familia con alumnos activos, que se
--    manda por WhatsApp. El padre la abre sin sesión: /?satisfaccion=<token>.
-- 3. satisfaccion_ver / satisfaccion_responder: lo único que puede usar
--    el padre sin sesión, y solo con SU enlace.
--
-- Respaldo previo: esquema respaldo_20261125_marketing (perfiles y
-- encuestas_desercion). Se puede correr varias veces sin problema.
-- Deshacer: supabase/marketing_relacional_deshacer.sql
-- ════════════════════════════════════════════════════════════

-- 0. RESPALDO -------------------------------------------------
create schema if not exists respaldo_20261125_marketing;
do $$ begin
  if to_regclass('respaldo_20261125_marketing.perfiles') is null then
    create table respaldo_20261125_marketing.perfiles as table public.perfiles;
    create table respaldo_20261125_marketing.encuestas_desercion as table public.encuestas_desercion;
  end if;
end $$;
revoke all on schema respaldo_20261125_marketing from public, anon, authenticated;

-- 1. ROL ------------------------------------------------------
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check (rol in ('admin','docente','marketing'));

create or replace function public.es_marketing() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where user_id = auth.uid() and rol = 'marketing');
$$;
revoke execute on function public.es_marketing() from public, anon;
grant execute on function public.es_marketing() to authenticated;

-- Marketing enlazado a un maestro conserva su portal docente (sus grupos)
create or replace function public.mi_maestro_id() returns text
language sql stable security definer set search_path = public as $$
  select maestro_id from public.perfiles where user_id = auth.uid() and rol in ('docente','marketing');
$$;

-- Lectura para marketing (solo leer)
do $$
declare t text;
begin
  foreach t in array array['secciones','alumnos','padres','sucursales'] loop
    execute format('drop policy if exists marketing_ver on public.%I', t);
    execute format('create policy marketing_ver on public.%I for select to authenticated using (public.es_marketing())', t);
  end loop;
end $$;

-- Encuestas de deserción: ver y marcar como enviada
drop policy if exists marketing_ver on public.encuestas_desercion;
create policy marketing_ver on public.encuestas_desercion for select to authenticated using (public.es_marketing());
drop policy if exists marketing_enviar on public.encuestas_desercion;
create policy marketing_enviar on public.encuestas_desercion for update to authenticated using (public.es_marketing()) with check (public.es_marketing());

-- 2. ENCUESTAS DE SATISFACCIÓN ---------------------------------
create table if not exists public.satisfaccion_campanas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  preguntas jsonb not null default '[]'::jsonb,
  anonima boolean not null default false,
  cerrada boolean not null default false,
  creada_por text,
  created_at timestamptz not null default now()
);

create table if not exists public.satisfaccion_respuestas (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  campana_id uuid not null references public.satisfaccion_campanas(id) on delete cascade,
  padre_id text references public.padres(id) on delete set null,
  alumnos text,          -- nombres de sus hijos activos al crear la encuesta
  secciones text,        -- sus secciones, para filtrar
  enviada_en timestamptz,
  respondida_en timestamptz,
  respuestas jsonb,
  created_at timestamptz not null default now(),
  unique (campana_id, padre_id)
);
create index if not exists idx_satisf_resp_campana on public.satisfaccion_respuestas(campana_id);

alter table public.satisfaccion_campanas enable row level security;
alter table public.satisfaccion_respuestas enable row level security;
do $$
declare t text;
begin
  foreach t in array array['satisfaccion_campanas','satisfaccion_respuestas'] loop
    execute format('drop policy if exists admin_marketing on public.%I', t);
    execute format('create policy admin_marketing on public.%I for all to authenticated using (public.es_admin() or public.es_marketing()) with check (public.es_admin() or public.es_marketing())', t);
  end loop;
end $$;
revoke all on public.satisfaccion_campanas, public.satisfaccion_respuestas from anon;

-- Crear una encuesta: un enlace por cada familia con algún alumno activo
create or replace function public.satisfaccion_crear(p_nombre text, p_preguntas jsonb, p_anonima boolean)
returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not (public.es_admin() or public.es_marketing()) then raise exception 'Sin permiso'; end if;
  if p_nombre is null or length(trim(p_nombre)) = 0 then raise exception 'Falta el nombre'; end if;
  if jsonb_typeof(p_preguntas) <> 'array' or jsonb_array_length(p_preguntas) = 0 then raise exception 'Faltan las preguntas'; end if;
  insert into public.satisfaccion_campanas (nombre, preguntas, anonima, creada_por)
  values (left(trim(p_nombre), 120), p_preguntas, coalesce(p_anonima, false),
          (select email from public.perfiles where user_id = auth.uid()))
  returning id into cid;
  insert into public.satisfaccion_respuestas (campana_id, padre_id, alumnos, secciones)
  select cid, a.padre_id,
         string_agg(a.nombre, ', ' order by a.nombre),
         string_agg(distinct trim(s.nombre), ', ')
  from public.alumnos a
  left join public.secciones s on s.id = a.seccion_id
  where a.estado = 'activo' and a.padre_id is not null
  group by a.padre_id;
  return cid;
end $$;

-- Lo que ve el padre al abrir el enlace
create or replace function public.satisfaccion_ver(p_token text) returns json
language sql security definer set search_path = public stable as $$
  select json_build_object(
    'encuesta', c.nombre,
    'preguntas', c.preguntas,
    'anonima', c.anonima,
    'cerrada', c.cerrada,
    'padre', case when c.anonima then null else split_part(p.nombre, ' ', 1) end,
    'alumnos', case when c.anonima then null else r.alumnos end,
    'respondida', r.respondida_en is not null
  )
  from public.satisfaccion_respuestas r
  join public.satisfaccion_campanas c on c.id = r.campana_id
  left join public.padres p on p.id = r.padre_id
  where r.token = p_token and length(p_token) >= 32;
$$;

-- El padre responde una sola vez
create or replace function public.satisfaccion_responder(p_token text, p_respuestas jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if jsonb_typeof(p_respuestas) <> 'object' or length(p_respuestas::text) > 8000 then raise exception 'Respuesta no válida'; end if;
  update public.satisfaccion_respuestas r set respuestas = p_respuestas, respondida_en = now()
  from public.satisfaccion_campanas c
  where c.id = r.campana_id and not c.cerrada
    and r.token = p_token and length(p_token) >= 32 and r.respondida_en is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.satisfaccion_crear(text, jsonb, boolean) from public, anon;
grant execute on function public.satisfaccion_crear(text, jsonb, boolean) to authenticated;
revoke all on function public.satisfaccion_ver(text) from public;
revoke all on function public.satisfaccion_responder(text, jsonb) from public;
grant execute on function public.satisfaccion_ver(text) to anon, authenticated;
grant execute on function public.satisfaccion_responder(text, jsonb) to anon, authenticated;
