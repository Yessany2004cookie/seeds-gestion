-- Finanzas solo para administración
-- Las tablas deudas, cuentas_por_pagar, gastos_graduacion y otros_ingresos
-- tenían una política "using (true)" que dejaba a cualquier usuario con
-- sesión (incluidos los docentes) leer y modificar sus datos.
-- Este script las deja igual que el resto de finanzas: solo es_admin().
-- Requiere haber ejecutado antes roles_docentes.sql (define es_admin()).

drop policy if exists deudas_auth_all            on public.deudas;
drop policy if exists cxp_auth_all               on public.cuentas_por_pagar;
drop policy if exists auth_all_gastos_graduacion on public.gastos_graduacion;
drop policy if exists auth_all_otros_ingresos    on public.otros_ingresos;

do $$
declare t text;
begin
  foreach t in array array['deudas','cuentas_por_pagar','gastos_graduacion','otros_ingresos']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists admin_todo on public.%I', t);
      execute format('create policy admin_todo on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin())', t);
    end if;
  end loop;
end $$;
