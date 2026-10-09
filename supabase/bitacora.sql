-- ============================================================
-- SEEDS — BITÁCORA DE CLASES (flipbook de cada docente)
-- Ejecutar UNA vez en Supabase > SQL Editor > Run
-- (después de roles_docentes.sql). Se puede repetir sin problema.
--
-- Cada docente tiene una página por fecha. El docente solo ve y edita
-- su propia bitácora; administración ve la de todos.
-- ============================================================

create table if not exists public.bitacora (
  id text primary key,
  maestro_id text not null references public.maestros(id) on delete cascade,
  seccion_id text references public.secciones(id) on delete set null,
  fecha date not null,
  titulo text,
  contenido text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (maestro_id, fecha)
);
create index if not exists idx_bitacora_maestro_fecha on public.bitacora(maestro_id, fecha);
alter table public.bitacora enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bitacora' and policyname = 'admin_todo') then
    create policy admin_todo on public.bitacora for all to authenticated
      using (public.es_admin()) with check (public.es_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bitacora' and policyname = 'docente_bitacora') then
    create policy docente_bitacora on public.bitacora for all to authenticated
      using (maestro_id = public.mi_maestro_id())
      with check (maestro_id = public.mi_maestro_id() and (seccion_id is null or seccion_id in (select public.mis_secciones())));
  end if;
end $$;
