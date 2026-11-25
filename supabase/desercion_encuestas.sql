-- ════════════════════════════════════════════════════════════
-- MATRÍCULA: deserción por sección + encuesta al padre
--
-- 1. alumnos.fecha_baja: el día en que el alumno se dio de baja.
-- 2. encuestas_desercion: una encuesta por cada baja, con un enlace
--    público (token) que se manda al padre por WhatsApp.
-- 3. Disparador: cuando un alumno pasa de "activo" a "inactivo" se
--    guarda la fecha de baja y se crea su encuesta automáticamente.
--    Si se reactiva, se borra la fecha de baja (la encuesta queda).
-- 4. encuesta_ver / encuesta_responder: lo único que puede usar el padre
--    (sin sesión). Solo ven y responden SU encuesta, con el token.
--
-- Respaldo previo: esquema respaldo_20261125_desercion (tabla alumnos).
-- Se puede correr varias veces sin problema.
-- ════════════════════════════════════════════════════════════

alter table public.alumnos add column if not exists fecha_baja date;

create table if not exists public.encuestas_desercion (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  alumno_id text not null references public.alumnos(id) on delete cascade,
  seccion_id text references public.secciones(id) on delete set null,
  fecha_baja date not null default current_date,
  enviada_en timestamptz,
  respondida_en timestamptz,
  motivo text,
  satisfaccion int check (satisfaccion between 1 and 5),
  volveria text check (volveria in ('si','tal_vez','no')),
  comentario text,
  created_at timestamptz not null default now()
);
create index if not exists idx_encuestas_desercion_alumno on public.encuestas_desercion(alumno_id);

alter table public.encuestas_desercion enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='encuestas_desercion' and policyname='admin_todo') then
    create policy admin_todo on public.encuestas_desercion for all to authenticated using (public.es_admin()) with check (public.es_admin());
  end if;
end $$;
revoke all on public.encuestas_desercion from anon;

-- Disparador: baja → fecha + encuesta
create or replace function public.alumno_baja_encuesta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'inactivo' and coalesce(old.estado, '') <> 'inactivo' then
    new.fecha_baja := coalesce(new.fecha_baja, current_date);
    insert into public.encuestas_desercion (alumno_id, seccion_id, fecha_baja)
    values (new.id, new.seccion_id, new.fecha_baja);
  elsif new.estado = 'activo' and old.estado = 'inactivo' then
    new.fecha_baja := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_alumno_baja_encuesta on public.alumnos;
create trigger trg_alumno_baja_encuesta before update of estado on public.alumnos
  for each row execute function public.alumno_baja_encuesta();

-- Lo que ve el padre al abrir el enlace (sin datos de otros alumnos)
create or replace function public.encuesta_ver(p_token text) returns json
language sql security definer set search_path = public stable as $$
  select json_build_object(
    'alumno', a.nombre,
    'seccion', s.nombre,
    'respondida', e.respondida_en is not null
  )
  from public.encuestas_desercion e
  join public.alumnos a on a.id = e.alumno_id
  left join public.secciones s on s.id = e.seccion_id
  where e.token = p_token and length(p_token) >= 32;
$$;

-- El padre responde una sola vez
create or replace function public.encuesta_responder(
  p_token text, p_motivo text, p_satisfaccion int, p_volveria text, p_comentario text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_motivo is null or length(trim(p_motivo)) = 0 then raise exception 'Falta el motivo'; end if;
  update public.encuestas_desercion set
    motivo = left(trim(p_motivo), 120),
    satisfaccion = case when p_satisfaccion between 1 and 5 then p_satisfaccion end,
    volveria = case when p_volveria in ('si','tal_vez','no') then p_volveria end,
    comentario = nullif(left(trim(coalesce(p_comentario, '')), 1500), ''),
    respondida_en = now()
  where token = p_token and length(p_token) >= 32 and respondida_en is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.encuesta_ver(text) from public;
revoke all on function public.encuesta_responder(text, text, int, text, text) from public;
grant execute on function public.encuesta_ver(text) to anon, authenticated;
grant execute on function public.encuesta_responder(text, text, int, text, text) to anon, authenticated;
revoke all on function public.alumno_baja_encuesta() from public, anon, authenticated;
