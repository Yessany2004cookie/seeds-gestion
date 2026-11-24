-- ════════════════════════════════════════════════════════════════
--  Plantilla personalizable + clave de seguridad
--
--  1) marca_sistema (una sola fila, id = 1): nombre de la institución,
--     subtítulo, logo (imagen guardada como texto data:image/...),
--     nombres propios de las pestañas del menú (etiquetas) y la lista de
--     pestañas ocultas. Todos pueden LEER (la pantalla de entrada muestra
--     el logo y el nombre antes de iniciar sesión). Solo administración
--     puede cambiar nombre, logo y nombres de pestañas.
--     Ocultar una pestaña NO se puede hacer directo: pasa por la función
--     cambiar_pestanas_ocultas, que pide la clave de seguridad.
--
--  2) seguridad_sistema: guarda la clave de seguridad CIFRADA (bcrypt).
--     Nadie puede leer esta tabla desde la app; solo las funciones de
--     abajo la consultan. 5 intentos fallidos = bloqueo de 10 minutos.
--
--  3) modulos_sistema (ya existía): desde ahora, APAGAR un módulo u
--     OCULTAR una pestaña pide la clave de seguridad (lo revisa la base de
--     datos, no solo la pantalla). Encender o volver a mostrar no la pide.
--
--  Ningún dato se borra: ocultar o apagar solo esconde en la app.
--
--  ¿Olvidó la clave? En el SQL Editor de Supabase:
--     update public.seguridad_sistema set clave_hash = null, intentos = 0, bloqueado_hasta = null;
--  y luego créela otra vez en Configuración → Sistema y respaldos.
--
--  Para deshacer todo (vuelve a como estaba antes):
--     drop function if exists public.cambiar_modulos(text[], text);
--     drop function if exists public.cambiar_pestanas_ocultas(text[], text);
--     drop function if exists public.fijar_clave_seguridad(text, text);
--     drop function if exists public.estado_clave_seguridad();
--     drop function if exists public._clave_correcta(text);
--     drop table if exists public.seguridad_sistema;
--     drop table if exists public.marca_sistema;
--     create policy modulos_admin_cambiar on public.modulos_sistema
--       for update to authenticated using (public.es_admin()) with check (public.es_admin());
--     grant update on public.modulos_sistema to authenticated;
-- ════════════════════════════════════════════════════════════════

-- ── 1) Marca / plantilla ──
create table if not exists public.marca_sistema (
  id              smallint    primary key default 1 check (id = 1),
  nombre          text,
  subtitulo       text,
  logo            text,
  etiquetas       jsonb       not null default '{}'::jsonb,
  ocultas         text[]      not null default '{}',
  actualizado     timestamptz not null default now(),
  actualizado_por uuid        references auth.users(id) on delete set null
);
insert into public.marca_sistema (id) values (1) on conflict (id) do nothing;

alter table public.marca_sistema enable row level security;

drop policy if exists marca_leer on public.marca_sistema;
create policy marca_leer on public.marca_sistema
  for select to anon, authenticated using (true);

drop policy if exists marca_admin_cambiar on public.marca_sistema;
create policy marca_admin_cambiar on public.marca_sistema
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

revoke all on public.marca_sistema from anon, authenticated;
grant select on public.marca_sistema to anon, authenticated;
-- La columna "ocultas" NO se incluye: solo se cambia con la clave.
grant update (nombre, subtitulo, logo, etiquetas, actualizado, actualizado_por)
  on public.marca_sistema to authenticated;

-- ── 2) Clave de seguridad ──
create table if not exists public.seguridad_sistema (
  id              smallint    primary key default 1 check (id = 1),
  clave_hash      text,
  intentos        int         not null default 0,
  bloqueado_hasta timestamptz,
  cambiada        timestamptz,
  cambiada_por    uuid        references auth.users(id) on delete set null
);
insert into public.seguridad_sistema (id) values (1) on conflict (id) do nothing;
alter table public.seguridad_sistema enable row level security;
revoke all on public.seguridad_sistema from anon, authenticated;

-- Revisa la clave. Devuelve null si está bien, o el motivo si no.
-- Cuenta los intentos fallidos (no usa "raise" para que el conteo se guarde).
create or replace function public._clave_correcta(p_clave text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare s public.seguridad_sistema;
begin
  if not public.es_admin() then return 'Solo administración puede hacer esto.'; end if;
  select * into s from public.seguridad_sistema where id = 1 for update;
  if s.clave_hash is null then
    return 'Primero cree la clave de seguridad en Configuración → Sistema y respaldos.';
  end if;
  if s.bloqueado_hasta is not null and s.bloqueado_hasta > now() then
    return 'Demasiados intentos con clave incorrecta. Espere ' ||
      greatest(1, ceil(extract(epoch from s.bloqueado_hasta - now()) / 60))::int || ' minuto(s).';
  end if;
  if p_clave is null or crypt(p_clave, s.clave_hash) <> s.clave_hash then
    if s.intentos + 1 >= 5 then
      update public.seguridad_sistema set intentos = 0, bloqueado_hasta = now() + interval '10 minutes' where id = 1;
      return 'Clave incorrecta. Por seguridad se bloqueó por 10 minutos.';
    end if;
    update public.seguridad_sistema set intentos = s.intentos + 1 where id = 1;
    return 'Clave de seguridad incorrecta. Le quedan ' || (4 - s.intentos) || ' intento(s).';
  end if;
  update public.seguridad_sistema set intentos = 0, bloqueado_hasta = null where id = 1;
  return null;
end $$;
revoke all on function public._clave_correcta(text) from public, anon, authenticated;

-- ¿Ya hay clave? (para que la pantalla sepa si debe pedir crearla)
create or replace function public.estado_clave_seguridad()
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.seguridad_sistema;
begin
  if not public.es_admin() then return jsonb_build_object('existe', false); end if;
  select * into s from public.seguridad_sistema where id = 1;
  return jsonb_build_object('existe', s.clave_hash is not null, 'cambiada', s.cambiada);
end $$;
revoke all on function public.estado_clave_seguridad() from public, anon;
grant execute on function public.estado_clave_seguridad() to authenticated;

-- Crear o cambiar la clave. Para cambiarla hay que dar la clave actual.
create or replace function public.fijar_clave_seguridad(p_actual text, p_nueva text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare s public.seguridad_sistema; motivo text;
begin
  if not public.es_admin() then return 'Solo administración puede hacer esto.'; end if;
  if p_nueva is null or length(p_nueva) < 4 then return 'La clave nueva debe tener al menos 4 caracteres.'; end if;
  select * into s from public.seguridad_sistema where id = 1;
  if s.clave_hash is not null then
    motivo := public._clave_correcta(p_actual);
    if motivo is not null then return motivo; end if;
  end if;
  update public.seguridad_sistema
     set clave_hash = crypt(p_nueva, gen_salt('bf')), intentos = 0, bloqueado_hasta = null,
         cambiada = now(), cambiada_por = auth.uid()
   where id = 1;
  return null;
end $$;
revoke all on function public.fijar_clave_seguridad(text, text) from public, anon;
grant execute on function public.fijar_clave_seguridad(text, text) to authenticated;

-- ── 3) Apagar módulos y ocultar pestañas: con clave ──
create or replace function public.cambiar_modulos(p_apagados text[], p_clave text default null)
returns text language plpgsql security definer set search_path = public as $$
declare actual text[]; motivo text;
begin
  if not public.es_admin() then return 'Solo administración puede hacer esto.'; end if;
  select apagados into actual from public.modulos_sistema where id = 1;
  -- Si se apaga algo que estaba encendido, se pide la clave
  if exists (select 1 from unnest(coalesce(p_apagados, '{}')) x where not x = any(coalesce(actual, '{}'))) then
    motivo := public._clave_correcta(p_clave);
    if motivo is not null then return motivo; end if;
  end if;
  update public.modulos_sistema
     set apagados = coalesce(p_apagados, '{}'), actualizado = now(), actualizado_por = auth.uid()
   where id = 1;
  return null;
end $$;
revoke all on function public.cambiar_modulos(text[], text) from public, anon;
grant execute on function public.cambiar_modulos(text[], text) to authenticated;

create or replace function public.cambiar_pestanas_ocultas(p_ocultas text[], p_clave text default null)
returns text language plpgsql security definer set search_path = public as $$
declare actual text[]; motivo text;
begin
  if not public.es_admin() then return 'Solo administración puede hacer esto.'; end if;
  -- Estas pestañas siempre se quedan (Inicio, Facturas y pagos, Configuración y Sistema)
  if p_ocultas && array['dashboard','facturas','config','sistema'] then
    return 'Esa pestaña no se puede ocultar.';
  end if;
  select ocultas into actual from public.marca_sistema where id = 1;
  if exists (select 1 from unnest(coalesce(p_ocultas, '{}')) x where not x = any(coalesce(actual, '{}'))) then
    motivo := public._clave_correcta(p_clave);
    if motivo is not null then return motivo; end if;
  end if;
  update public.marca_sistema
     set ocultas = coalesce(p_ocultas, '{}'), actualizado = now(), actualizado_por = auth.uid()
   where id = 1;
  return null;
end $$;
revoke all on function public.cambiar_pestanas_ocultas(text[], text) from public, anon;
grant execute on function public.cambiar_pestanas_ocultas(text[], text) to authenticated;

-- Ya no se puede apagar un módulo cambiando la tabla directamente:
-- solo con cambiar_modulos (que pide la clave).
drop policy if exists modulos_admin_cambiar on public.modulos_sistema;
revoke update on public.modulos_sistema from authenticated;
