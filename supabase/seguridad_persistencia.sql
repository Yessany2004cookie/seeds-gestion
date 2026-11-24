-- ════════════════════════════════════════════════════════════════
--  Revisión de seguridad y persistencia (24 nov 2026)
--
--  1) ajustes_sistema: valores que administración escribe en pantallas
--     (gastos fijos y margen mínimo de Alertas financieras, texto del
--     recordatorio a padres). Antes solo quedaban en el navegador.
--  2) alertas_ignoradas: alumnos que administración decidió "ignorar por
--     30 días" en la alerta de inactividad. Antes solo en el navegador.
--  3) recordatorios_enviados: historial de recordatorios de pago enviados
--     por WhatsApp o correo (quién, de qué mes, cuándo). Antes se perdía
--     al recargar la página.
--  Las tres son SOLO de administración (docentes no las ven).
--  Entran solas en los respaldos automáticos (se copian todas las tablas).
--
--  4) Fija el search_path de 7 funciones de contabilidad (aviso de
--     seguridad de Supabase). No cambia lo que hacen.
--
--  No toca cobros, facturas ni datos financieros.
--
--  Para deshacer:
--     drop table if exists public.ajustes_sistema, public.alertas_ignoradas, public.recordatorios_enviados;
-- ════════════════════════════════════════════════════════════════

create table if not exists public.ajustes_sistema (
  clave text primary key,
  valor jsonb not null,
  actualizado timestamptz not null default now(),
  actualizado_por uuid default auth.uid()
);
alter table public.ajustes_sistema enable row level security;
drop policy if exists admin_todo on public.ajustes_sistema;
create policy admin_todo on public.ajustes_sistema for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
revoke all on public.ajustes_sistema from anon;

create table if not exists public.alertas_ignoradas (
  tipo text not null default 'inactividad',
  alumno_id text not null,
  hasta timestamptz not null,
  ignorado_por uuid default auth.uid(),
  creado timestamptz not null default now(),
  primary key (tipo, alumno_id)
);
alter table public.alertas_ignoradas enable row level security;
drop policy if exists admin_todo on public.alertas_ignoradas;
create policy admin_todo on public.alertas_ignoradas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
revoke all on public.alertas_ignoradas from anon;

create table if not exists public.recordatorios_enviados (
  id bigint generated always as identity primary key,
  alumno_id text not null,
  mes text not null,
  anio int not null,
  canal text not null check (canal in ('whatsapp', 'correo')),
  enviado_en timestamptz not null default now(),
  enviado_por uuid default auth.uid()
);
create index if not exists recordatorios_enviados_mes on public.recordatorios_enviados (anio, mes, alumno_id);
alter table public.recordatorios_enviados enable row level security;
drop policy if exists admin_todo on public.recordatorios_enviados;
create policy admin_todo on public.recordatorios_enviados for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
revoke all on public.recordatorios_enviados from anon;

-- Aviso de Supabase "Function Search Path Mutable"
alter function public.contab_chk_cuadre() set search_path = public;
alter function public.contab_chk_periodo() set search_path = public;
alter function public.contab_mes(text) set search_path = public;
alter function public.contab_anio(date, integer) set search_path = public;
alter function public.contab_fin_mes(integer, integer) set search_path = public;
alter function public.contab__asiento(integer, integer, date, text, text, text, text, jsonb) set search_path = public;
alter function public.contab_cta_gasto(text, text) set search_path = public;
