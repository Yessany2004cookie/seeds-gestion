-- ============================================================
-- SEEDS — ROLES (ADMINISTRACIÓN / DOCENTES)
-- Ejecutar UNA vez en Supabase > SQL Editor > New query > Run.
-- Se puede volver a ejecutar sin problema (no borra datos).
--
-- Qué hace:
--  1. Crea la tabla "perfiles" con el rol de cada usuario.
--  2. Todos los usuarios que ya existen quedan como ADMINISTRACIÓN.
--  3. Crea las tablas de docentes: asistencias, reflections,
--     reportes_clase y solicitudes.
--  4. Cambia la seguridad: administración ve todo; un docente solo ve
--     sus grupos, sus alumnos y los padres de esos alumnos. Nunca
--     facturas, gastos, planilla, materiales ni graduación.
-- ============================================================

-- 1. PERFILES ------------------------------------------------
create table if not exists public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null check (rol in ('admin','docente')),
  maestro_id text references public.maestros(id) on delete set null,
  email text,
  created_at timestamptz not null default now()
);

-- 2. Los usuarios actuales quedan como administración
insert into public.perfiles (user_id, rol, email)
select id, 'admin', email from auth.users
on conflict (user_id) do nothing;

-- Funciones de apoyo (se ejecutan con permisos del sistema para no
-- quedar atrapadas en las mismas reglas que protegen)
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where user_id = auth.uid() and rol = 'admin');
$$;

create or replace function public.mi_maestro_id() returns text
language sql stable security definer set search_path = public as $$
  select maestro_id from public.perfiles where user_id = auth.uid() and rol = 'docente';
$$;

create or replace function public.mis_secciones() returns setof text
language sql stable security definer set search_path = public as $$
  select jsonb_array_elements_text(coalesce(m.secciones_ids, '[]'::jsonb))
  from public.maestros m where m.id = public.mi_maestro_id();
$$;

create or replace function public.mis_padres() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct a.padre_id from public.alumnos a
  where a.seccion_id in (select public.mis_secciones());
$$;

-- Las funciones solo las usan usuarios con sesión iniciada
revoke execute on function public.es_admin(), public.mi_maestro_id(), public.mis_secciones(), public.mis_padres() from public, anon;
grant execute on function public.es_admin(), public.mi_maestro_id(), public.mis_secciones(), public.mis_padres() to authenticated;

-- 3. TABLAS DE DOCENTES ---------------------------------------
create table if not exists public.asistencias (
  id text primary key,
  seccion_id text not null references public.secciones(id) on delete cascade,
  alumno_id text not null references public.alumnos(id) on delete cascade,
  maestro_id text references public.maestros(id) on delete set null,
  fecha date not null,
  estado text not null check (estado in ('presente','ausente','tarde','justificado')),
  nota text,
  created_at timestamptz not null default now(),
  unique (seccion_id, alumno_id, fecha)
);
create index if not exists idx_asistencias_seccion_fecha on public.asistencias(seccion_id, fecha);

create table if not exists public.reflections (
  id text primary key,
  seccion_id text references public.secciones(id) on delete set null,
  alumno_id text not null references public.alumnos(id) on delete cascade,
  maestro_id text references public.maestros(id) on delete set null,
  fecha date not null default current_date,
  categoria text,
  texto text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_reflections_alumno on public.reflections(alumno_id);

create table if not exists public.reportes_clase (
  id text primary key,
  seccion_id text references public.secciones(id) on delete set null,
  maestro_id text references public.maestros(id) on delete set null,
  fecha date not null default current_date,
  respuestas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_reportes_seccion on public.reportes_clase(seccion_id, fecha);

create table if not exists public.solicitudes (
  id text primary key,
  maestro_id text references public.maestros(id) on delete set null,
  tipo text not null,
  asunto text not null,
  detalle text,
  estado text not null default 'pendiente' check (estado in ('pendiente','en_proceso','resuelta','rechazada')),
  respuesta text,
  respondido_at timestamptz,
  created_at timestamptz not null default now()
);

-- 4. SEGURIDAD ------------------------------------------------
-- Quitar las reglas anteriores ("cualquier usuario puede todo")
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in (
      'sucursales','secciones','maestros','padres','alumnos','facturas','gastos',
      'materiales','ventas_material','conceptos_graduacion','cobros_graduacion',
      'perfiles','asistencias','reflections','reportes_clase','solicitudes')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Administración: acceso completo a todas las tablas
do $$
declare t text;
begin
  foreach t in array array[
    'sucursales','secciones','maestros','padres','alumnos','facturas','gastos',
    'materiales','ventas_material','conceptos_graduacion','cobros_graduacion',
    'perfiles','asistencias','reflections','reportes_clase','solicitudes']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('create policy admin_todo on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin())', t);
    end if;
  end loop;
end $$;

-- Docentes: solo lectura de lo suyo
create policy docente_ver_perfil on public.perfiles for select to authenticated
  using (user_id = auth.uid());
create policy docente_ver_maestro on public.maestros for select to authenticated
  using (id = public.mi_maestro_id());
create policy docente_ver_secciones on public.secciones for select to authenticated
  using (id in (select public.mis_secciones()));
create policy docente_ver_alumnos on public.alumnos for select to authenticated
  using (seccion_id in (select public.mis_secciones()));
create policy docente_ver_padres on public.padres for select to authenticated
  using (id in (select public.mis_padres()));
do $$ begin
  if to_regclass('public.sucursales') is not null then
    execute 'create policy docente_ver_sucursales on public.sucursales for select to authenticated using (public.mi_maestro_id() is not null)';
  end if;
end $$;

-- Docentes: asistencia, reflections y reportes de sus grupos
create policy docente_asistencias on public.asistencias for all to authenticated
  using (seccion_id in (select public.mis_secciones()))
  with check (seccion_id in (select public.mis_secciones()) and maestro_id = public.mi_maestro_id());
create policy docente_reflections on public.reflections for all to authenticated
  using (seccion_id in (select public.mis_secciones()))
  with check (seccion_id in (select public.mis_secciones()) and maestro_id = public.mi_maestro_id());
create policy docente_reportes on public.reportes_clase for all to authenticated
  using (maestro_id = public.mi_maestro_id())
  with check (seccion_id in (select public.mis_secciones()) and maestro_id = public.mi_maestro_id());

-- Docentes: ver y enviar sus solicitudes (no pueden cambiar la respuesta)
create policy docente_ver_solicitudes on public.solicitudes for select to authenticated
  using (maestro_id = public.mi_maestro_id());
create policy docente_crear_solicitudes on public.solicitudes for insert to authenticated
  with check (maestro_id = public.mi_maestro_id() and estado = 'pendiente' and respuesta is null);
create policy docente_borrar_solicitudes on public.solicitudes for delete to authenticated
  using (maestro_id = public.mi_maestro_id() and estado = 'pendiente');

-- ============================================================
-- Para agregar otra persona de ADMINISTRACIÓN más adelante:
--   1. Créala en Authentication > Users (Add user).
--   2. Ejecuta (cambiando el correo):
--      insert into public.perfiles (user_id, rol, email)
--      select id, 'admin', email from auth.users where email = 'correo@ejemplo.com'
--      on conflict (user_id) do update set rol = 'admin', maestro_id = null;
-- ============================================================
