-- ════════════════════════════════════════════════════════════
-- MARKETING RELACIONAL → BIENVENIDA A ALUMNOS NUEVOS
--
-- 1. bienvenidas: una fila por alumno al que ya se le mandó la
--    bienvenida (y si se le ofreció/hizo la llamada).
-- 2. marketing_ajustes: el texto de bienvenida y los datos que lleva
--    (link de matrícula, pago de plataforma, uniforme, horario de
--    llamadas). Nayeli y administración lo pueden editar.
-- Solo administración y marketing pueden ver o cambiar estas tablas.
-- No toca alumnos, cobros ni finanzas. Se puede correr varias veces.
-- Requiere haber corrido antes marketing_relacional.sql.
-- Deshacer: supabase/marketing_bienvenida_deshacer.sql
-- ════════════════════════════════════════════════════════════

create table if not exists public.bienvenidas (
  alumno_id text primary key references public.alumnos(id) on delete cascade,
  enviada_en timestamptz not null default now(),
  llamada text check (llamada in ('ofrecida','hecha')),
  notas text,
  enviada_por text
);

create table if not exists public.marketing_ajustes (
  id int primary key default 1 check (id = 1),
  datos jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- Datos de la bienvenida (Nayeli los puede cambiar en Bienvenida → Editar mensaje)
insert into public.marketing_ajustes (id, datos) values (1, jsonb_build_object(
  'desde', '2026-11-01',
  'pago_plataforma', 'Son L 1,000 en efectivo. Si prefiere transferencia, con gusto le compartimos la cuenta de la escuela.',
  'uniforme', 'Cuesta L 350 y se paga en efectivo.',
  'horario_llamada', 'Dígame qué día y hora le queda mejor.',
  'extra', 'Ya está en el grupo de WhatsApp de la clase, ahí le llegarán los avisos.'
)) on conflict (id) do nothing;

alter table public.bienvenidas enable row level security;
alter table public.marketing_ajustes enable row level security;
do $$
declare t text;
begin
  foreach t in array array['bienvenidas','marketing_ajustes'] loop
    execute format('drop policy if exists admin_marketing on public.%I', t);
    execute format('create policy admin_marketing on public.%I for all to authenticated using (public.es_admin() or public.es_marketing()) with check (public.es_admin() or public.es_marketing())', t);
  end loop;
end $$;
revoke all on public.bienvenidas, public.marketing_ajustes from anon;
