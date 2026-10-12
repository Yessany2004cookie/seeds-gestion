-- ============================================================
-- SEEDS — ASISTENCIA COMPARTIDA (varios docentes en la misma clase)
-- Ya aplicado en Supabase. Se guarda aquí como registro.
--  - maestro_id: quién marcó primero (no cambia).
--  - actualizado_por / updated_at: quién hizo el último cambio y cuándo.
--  - Para un docente, la autoría la pone la base de datos (no el navegador).
--  - mis_companeros(): solo id y nombre de quienes comparten grupo.
--  - Reflections: cada docente solo borra/edita las suyas.
-- ============================================================
alter table public.asistencias add column if not exists actualizado_por text references public.maestros(id) on delete set null;
alter table public.asistencias add column if not exists updated_at timestamptz not null default now();

create or replace function public.asistencia_autoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare yo text := public.mi_maestro_id();
begin
  if tg_op = 'INSERT' then
    if yo is not null then new.maestro_id := yo; end if;
    new.actualizado_por := new.maestro_id;
    new.updated_at := now();
  else
    new.maestro_id := old.maestro_id;
    if new.estado is distinct from old.estado or new.nota is distinct from old.nota then
      new.actualizado_por := coalesce(yo, new.actualizado_por, old.actualizado_por);
      new.updated_at := now();
    else
      new.actualizado_por := old.actualizado_por;
      new.updated_at := old.updated_at;
    end if;
  end if;
  return new;
end $$;
create or replace trigger asistencias_autoria before insert or update on public.asistencias
  for each row execute function public.asistencia_autoria();

create or replace function public.mis_companeros() returns table(id text, nombre text)
language sql stable security definer set search_path = public as $$
  select m.id, m.nombre from public.maestros m
  where exists (select 1 from jsonb_array_elements_text(coalesce(m.secciones_ids, '[]'::jsonb)) s(v) where s.v in (select public.mis_secciones()));
$$;
revoke execute on function public.mis_companeros() from public, anon;
revoke execute on function public.asistencia_autoria() from public, anon;
grant execute on function public.mis_companeros() to authenticated;

alter policy docente_asistencias on public.asistencias
  using (seccion_id in (select public.mis_secciones()))
  with check (seccion_id in (select public.mis_secciones()));

create policy reflections_solo_propias_borrar on public.reflections as restrictive for delete to authenticated
  using (public.es_admin() or maestro_id = public.mi_maestro_id());
create policy reflections_solo_propias_editar on public.reflections as restrictive for update to authenticated
  using (public.es_admin() or maestro_id = public.mi_maestro_id());
