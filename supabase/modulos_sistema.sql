-- ════════════════════════════════════════════════════════════════
--  Módulos del sistema: activar o desactivar partes del sistema
--  (portal docente, materiales, graduación, contabilidad, etc.).
--  Una sola fila (id = 1). En "apagados" se guarda la lista de módulos
--  desactivados; todo lo que no esté en la lista sigue encendido.
--  Apagar un módulo solo lo oculta en la app: NO borra ningún dato.
--  Todos los usuarios con sesión pueden leerla (el portal docente
--  necesita saber qué mostrar); solo administración puede cambiarla.
--  Para deshacer: drop table public.modulos_sistema;
--  (No toca ninguna tabla existente.)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.modulos_sistema (
  id             smallint    primary key default 1 check (id = 1),
  apagados       text[]      not null default '{}',
  actualizado    timestamptz not null default now(),
  actualizado_por uuid       references auth.users(id) on delete set null
);

insert into public.modulos_sistema (id) values (1) on conflict (id) do nothing;

alter table public.modulos_sistema enable row level security;

drop policy if exists modulos_leer on public.modulos_sistema;
create policy modulos_leer on public.modulos_sistema
  for select to authenticated using (true);

drop policy if exists modulos_admin_cambiar on public.modulos_sistema;
create policy modulos_admin_cambiar on public.modulos_sistema
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

grant select, update on public.modulos_sistema to authenticated;
