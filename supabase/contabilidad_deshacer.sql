-- Quita por completo el módulo de Contabilidad (no toca ninguna otra tabla)
drop function if exists public.contab_generar(int,int), public.contab_registrar(date,text,text,jsonb), public.contab_cerrar(int,int,numeric,text), public.contab_reabrir(int,int), public.contab__asiento(int,int,date,text,text,text,text,jsonb), public.contab_cta_gasto(text,text), public.contab_fin_mes(int,int), public.contab_anio(date,int), public.contab_mes(text);
drop table if exists public.contab_lineas, public.contab_asientos, public.contab_periodos, public.contab_cuentas, public.contab_config cascade;
drop function if exists public.contab_chk_cuadre(), public.contab_chk_periodo();
