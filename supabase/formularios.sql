-- ============================================================
-- SEEDS — FORMULARIO EDITABLE DEL CHECK LIST DE LA CLASE
-- Ejecutar UNA vez en Supabase > SQL Editor (no borra datos).
--  - "formularios": las preguntas del check list (las edita administración).
--  - reportes_clase.campos: copia de las preguntas al momento de enviar,
--    para que editar el formulario no cambie los reportes ya enviados.
--  - reportes_clase.leido_at: para la bandeja de administración.
-- ============================================================
create table if not exists public.formularios (
  id text primary key,
  titulo text not null,
  descripcion text,
  despedida text,
  campos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.formularios enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'formularios' and policyname = 'admin_todo') then
    create policy admin_todo on public.formularios for all to authenticated using (public.es_admin()) with check (public.es_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'formularios' and policyname = 'docente_ver_formularios') then
    create policy docente_ver_formularios on public.formularios for select to authenticated using (public.mi_maestro_id() is not null);
  end if;
end $$;

alter table public.reportes_clase add column if not exists campos jsonb;
alter table public.reportes_clase add column if not exists titulo_form text;
alter table public.reportes_clase add column if not exists leido_at timestamptz;
create index if not exists idx_reportes_created on public.reportes_clase(created_at desc);
alter table public.formularios add column if not exists despedida text;
