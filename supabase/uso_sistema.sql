-- ════════════════════════════════════════════════════════════════
--  Contador de tiempo de trabajo real (uso del sistema por administrador)
--  Guarda, por usuario, día, hora, sección y dispositivo, los segundos de
--  trabajo REAL (con actividad de mouse, clics, scroll, teclado o toques)
--  y cuántos envíos por WhatsApp hizo.
--  Solo los administradores pueden ver estos datos.
--  Para deshacer: drop function public.registrar_uso; drop table public.uso_sistema;
--  (No toca ninguna tabla existente.)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.uso_sistema (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  email       text,
  fecha       date        not null,                 -- día (hora local de Honduras)
  hora        smallint    not null check (hora between 0 and 23),
  seccion     text        not null default '',      -- pantalla del sistema (facturas, finanzas…)
  dispositivo text        not null default 'compu' check (dispositivo in ('compu','celular')),
  segundos    integer     not null default 0,       -- tiempo de trabajo real
  descartados integer     not null default 0,       -- tiempo con actividad que no era trabajo (solo mover el mouse, clics repetidos)
  repetidos   integer     not null default 0,       -- clics/teclas repetidos que no contaron
  clics       integer     not null default 0,
  scrolls     integer     not null default 0,
  teclas      integer     not null default 0,
  whatsapp    integer     not null default 0,       -- envíos por WhatsApp
  primera     timestamptz,                          -- primera actividad en esa hora
  ultima      timestamptz,                          -- última actividad en esa hora
  primary key (user_id, fecha, hora, seccion, dispositivo)
);

create index if not exists uso_sistema_fecha_idx on public.uso_sistema (fecha);

alter table public.uso_sistema enable row level security;

-- Todos los administradores pueden ver el uso de todos. Nadie escribe directo:
-- solo a través de registrar_uso(), que suma a la fila de su propio usuario.
drop policy if exists uso_admin_ver on public.uso_sistema;
create policy uso_admin_ver on public.uso_sistema
  for select to authenticated using (public.es_admin());

create or replace function public.registrar_uso(
  p_fecha date, p_hora int, p_seccion text, p_dispositivo text,
  p_segundos int, p_descartados int, p_repetidos int, p_clics int, p_scrolls int, p_teclas int, p_whatsapp int,
  p_primera timestamptz, p_ultima timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.es_admin() then return; end if;
  insert into public.uso_sistema as u
    (user_id, email, fecha, hora, seccion, dispositivo, segundos, descartados, repetidos, clics, scrolls, teclas, whatsapp, primera, ultima)
  values (
    auth.uid(), (select email from auth.users where id = auth.uid()),
    p_fecha, p_hora, coalesce(left(p_seccion, 40), ''),
    case when p_dispositivo = 'celular' then 'celular' else 'compu' end,
    least(greatest(coalesce(p_segundos,0),0), 3600),
    least(greatest(coalesce(p_descartados,0),0), 3600), greatest(coalesce(p_repetidos,0),0),
    greatest(coalesce(p_clics,0),0), greatest(coalesce(p_scrolls,0),0),
    greatest(coalesce(p_teclas,0),0), greatest(coalesce(p_whatsapp,0),0),
    p_primera, p_ultima)
  on conflict (user_id, fecha, hora, seccion, dispositivo) do update set
    segundos = least(u.segundos + excluded.segundos, 3600),   -- una hora no puede tener más de 60 min
    descartados = least(u.descartados + excluded.descartados, 3600),
    repetidos = u.repetidos + excluded.repetidos,
    clics    = u.clics    + excluded.clics,
    scrolls  = u.scrolls  + excluded.scrolls,
    teclas   = u.teclas   + excluded.teclas,
    whatsapp = u.whatsapp + excluded.whatsapp,
    primera  = least(u.primera, excluded.primera),
    ultima   = greatest(u.ultima, excluded.ultima);
end $$;

revoke all on function public.registrar_uso(date,int,text,text,int,int,int,int,int,int,int,timestamptz,timestamptz) from public, anon;
grant execute on function public.registrar_uso(date,int,text,text,int,int,int,int,int,int,int,timestamptz,timestamptz) to authenticated;
