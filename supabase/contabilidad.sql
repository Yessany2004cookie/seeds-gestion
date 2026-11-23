-- ════════════════════════════════════════════════════════════
--  CONTABILIDAD (partida doble) — Seeds
--  * Solo administración puede ver o usar estas tablas (es_admin()).
--  * NO cambia ninguna tabla existente ni la forma de cobrar a los padres:
--    los asientos se GENERAN leyendo facturas, gastos, cuentas por pagar,
--    materiales, graduación e ingresos extra.
--  * Arranca el 1 de noviembre de 2026 (julio–octubre quedan como historial).
--  * Un mes cerrado no se vuelve a generar ni se puede modificar.
--  Para deshacer: ver supabase/contabilidad_deshacer.sql
-- ════════════════════════════════════════════════════════════

create table if not exists public.contab_config (
  id int primary key default 1 check (id = 1),
  inicio date not null default '2026-11-01'
);
insert into public.contab_config (id) values (1) on conflict do nothing;

create table if not exists public.contab_cuentas (
  codigo text primary key,
  nombre text not null,
  tipo text not null check (tipo in ('activo','pasivo','patrimonio','ingreso','gasto')),
  descripcion text
);

create table if not exists public.contab_periodos (
  anio int not null,
  mes int not null check (mes between 1 and 12),
  estado text not null default 'abierto' check (estado in ('abierto','cerrado')),
  dinero_contado numeric(14,2),
  notas text,
  cerrado_en timestamptz,
  cerrado_por text,
  primary key (anio, mes)
);

create table if not exists public.contab_asientos (
  id bigserial primary key,
  anio int not null,
  mes int not null check (mes between 1 and 12),
  fecha date not null,
  descripcion text not null,
  clase text not null default 'auto' check (clase in ('auto','apertura','manual')),
  origen text,      -- tabla de donde viene (facturas, gastos, ...)
  origen_id text,   -- id del registro de origen
  creado_en timestamptz not null default now(),
  creado_por text default auth.email()
);
create index if not exists contab_asientos_periodo on public.contab_asientos (anio, mes);
create index if not exists contab_asientos_origen on public.contab_asientos (origen, origen_id);

create table if not exists public.contab_lineas (
  id bigserial primary key,
  asiento_id bigint not null references public.contab_asientos(id) on delete cascade,
  cuenta text not null references public.contab_cuentas(codigo),
  debe numeric(14,2) not null default 0 check (debe >= 0),
  haber numeric(14,2) not null default 0 check (haber >= 0),
  check (debe = 0 or haber = 0)
);
create index if not exists contab_lineas_asiento on public.contab_lineas (asiento_id);

-- ── Catálogo de cuentas ──
insert into public.contab_cuentas (codigo, nombre, tipo, descripcion) values
 ('1.1.01','Efectivo y bancos','activo','Dinero disponible (caja y cuentas de banco)'),
 ('1.2.01','Cuentas por cobrar: mensualidades','activo','Lo que deben los padres'),
 ('1.2.02','Cuentas por cobrar: otros','activo','Otros montos por cobrar'),
 ('1.3.01','Inventario de materiales','activo','Libros comprados sin vender'),
 ('1.4.01','Anticipos a maestros y proveedores','activo','Pagos hechos por adelantado'),
 ('2.1.01','Proveedores y servicios por pagar','pasivo','Renta, luz, internet y otros pendientes'),
 ('2.1.02','Salarios por pagar','pasivo','Planilla pendiente'),
 ('2.2.01','Préstamo de la propietaria','pasivo','Dinero que la propietaria prestó a la escuela'),
 ('2.2.02','Deudas anteriores','pasivo','Deudas de antes de julio 2026 y otros préstamos'),
 ('2.3.01','Fondo de graduación','pasivo','Cuotas de graduación cobradas para el evento'),
 ('3.1.01','Capital','patrimonio','Lo invertido por la propietaria y resultados anteriores al arranque'),
 ('3.2.01','Retiros de la propietaria','patrimonio','Dinero que la propietaria saca para sí'),
 ('3.3.01','Resultados acumulados','patrimonio','Ganancias o pérdidas de meses cerrados'),
 ('4.1.01','Mensualidades','ingreso',null),
 ('4.1.02','Mora por atraso','ingreso',null),
 ('4.2.01','Venta de materiales','ingreso',null),
 ('4.2.02','Excedente de graduación','ingreso','Lo que sobra del fondo al liquidar el evento'),
 ('4.3.01','Otros ingresos','ingreso',null),
 ('4.3.02','Sobrantes de caja','ingreso','Dinero de más encontrado al cerrar'),
 ('5.1.01','Costo de materiales vendidos','gasto',null),
 ('5.2.01','Salarios','gasto',null),
 ('5.2.02','Renta','gasto',null),
 ('5.2.03','Servicios (luz, agua, internet)','gasto',null),
 ('5.2.04','Comisiones bancarias','gasto',null),
 ('5.2.05','Otros gastos de operación','gasto',null),
 ('5.3.01','Faltantes de caja','gasto','Dinero de menos encontrado al cerrar')
on conflict (codigo) do update set nombre = excluded.nombre, tipo = excluded.tipo, descripcion = excluded.descripcion;

-- ── Reglas de integridad ──
-- 1) Cada asiento debe cuadrar (debe = haber). Se revisa al final de la transacción.
create or replace function public.contab_chk_cuadre() returns trigger language plpgsql as $$
declare d numeric; h numeric; aid bigint := coalesce(new.asiento_id, old.asiento_id);
begin
  if not exists (select 1 from public.contab_asientos where id = aid) then return null; end if;
  select coalesce(sum(debe),0), coalesce(sum(haber),0) into d, h from public.contab_lineas where asiento_id = aid;
  if round(d,2) <> round(h,2) then
    raise exception 'El asiento % no cuadra: debe % y haber %', aid, d, h;
  end if;
  return null;
end $$;
drop trigger if exists contab_cuadre on public.contab_lineas;
create constraint trigger contab_cuadre after insert or update or delete on public.contab_lineas
  deferrable initially deferred for each row execute function public.contab_chk_cuadre();

-- 2) Un mes cerrado no se puede tocar.
create or replace function public.contab_chk_periodo() returns trigger language plpgsql as $$
begin
  if tg_op in ('UPDATE','DELETE') and exists (select 1 from public.contab_periodos p where p.anio = old.anio and p.mes = old.mes and p.estado = 'cerrado') then
    raise exception 'El mes %/% está cerrado y no se puede modificar', old.mes, old.anio;
  end if;
  if tg_op in ('INSERT','UPDATE') and exists (select 1 from public.contab_periodos p where p.anio = new.anio and p.mes = new.mes and p.estado = 'cerrado') then
    raise exception 'El mes %/% está cerrado y no se puede modificar', new.mes, new.anio;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists contab_periodo on public.contab_asientos;
create trigger contab_periodo before insert or update or delete on public.contab_asientos
  for each row execute function public.contab_chk_periodo();

-- ── Seguridad: solo administración ──
alter table public.contab_config enable row level security;
alter table public.contab_cuentas enable row level security;
alter table public.contab_periodos enable row level security;
alter table public.contab_asientos enable row level security;
alter table public.contab_lineas enable row level security;
do $$ declare t text; begin
  foreach t in array array['contab_config','contab_cuentas','contab_periodos','contab_asientos','contab_lineas'] loop
    execute format('drop policy if exists admin_todo on public.%I', t);
    execute format('create policy admin_todo on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin())', t);
  end loop;
end $$;
revoke all on public.contab_config, public.contab_cuentas, public.contab_periodos, public.contab_asientos, public.contab_lineas from anon;

-- ── Ayudantes ──
create or replace function public.contab_mes(nombre text) returns int language sql immutable as $$
  select array_position(array['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'], trim(nombre))
$$;
-- Año del mes elegido, a partir de la fecha real (igual que la app: Dic pagado en Ene = año anterior)
create or replace function public.contab_anio(fecha date, mes int) returns int language sql immutable as $$
  select case
    when fecha is null then null
    when mes is null then extract(year from fecha)::int
    when mes >= 11 and extract(month from fecha) <= 2 then extract(year from fecha)::int - 1
    when mes <= 2 and extract(month from fecha) >= 11 then extract(year from fecha)::int + 1
    else extract(year from fecha)::int end
$$;
create or replace function public.contab_fin_mes(a int, m int) returns date language sql immutable as $$
  select (make_date(a, m, 1) + interval '1 month - 1 day')::date
$$;

-- Inserta un asiento con sus líneas. lineas = [["cuenta", debe, haber], ...]; omite líneas en cero.
create or replace function public.contab__asiento(a int, m int, f date, descr text, clase text, origen text, oid text, lineas jsonb)
returns bigint language plpgsql as $$
declare aid bigint; l jsonb;
begin
  if not exists (select 1 from jsonb_array_elements(lineas) x where coalesce((x->>1)::numeric,0) + coalesce((x->>2)::numeric,0) > 0) then return null; end if;
  insert into public.contab_asientos (anio, mes, fecha, descripcion, clase, origen, origen_id)
  values (a, m, f, left(coalesce(descr,'—'), 300), clase, origen, oid) returning id into aid;
  for l in select * from jsonb_array_elements(lineas) loop
    if round(coalesce((l->>1)::numeric,0),2) > 0 or round(coalesce((l->>2)::numeric,0),2) > 0 then
      insert into public.contab_lineas (asiento_id, cuenta, debe, haber)
      values (aid, l->>0, round(coalesce((l->>1)::numeric,0),2), round(coalesce((l->>2)::numeric,0),2));
    end if;
  end loop;
  return aid;
end $$;

-- Cuenta de gasto según el tipo y la descripción
create or replace function public.contab_cta_gasto(tipo text, descr text) returns text language sql immutable as $$
  select case
    when tipo = 'salario' then '5.2.01'
    when tipo = 'renta' then '5.2.02'
    when tipo = 'comision' then '5.2.04'
    when coalesce(descr,'') ~* 'ajuste de caja' then '5.3.01'
    when coalesce(descr,'') ~* '(luz|energ|agua|internet|tel[eé]fono|cable)' then '5.2.03'
    else '5.2.05' end
$$;

-- ════════════════════════════════════════════════════════════
--  GENERAR los asientos automáticos de un mes abierto
--  (borra solo los automáticos de ese mes y los vuelve a crear)
-- ════════════════════════════════════════════════════════════
create or replace function public.contab_generar(p_anio int, p_mes int)
returns int language plpgsql security definer set search_path = public as $$
declare
  ini date := make_date(p_anio, p_mes, 1);
  fin date := public.contab_fin_mes(p_anio, p_mes);
  arranque date;
  r record; n int := 0; v numeric; ya numeric; disp text := '1.1.01';
begin
  if not public.es_admin() then raise exception 'Solo administración'; end if;
  select inicio into arranque from public.contab_config where id = 1;
  if ini < date_trunc('month', arranque)::date then raise exception 'La contabilidad arranca en %', arranque; end if;
  if exists (select 1 from public.contab_periodos where anio = p_anio and mes = p_mes and estado = 'cerrado') then
    raise exception 'El mes %/% ya está cerrado', p_mes, p_anio;
  end if;
  insert into public.contab_periodos (anio, mes) values (p_anio, p_mes) on conflict do nothing;
  delete from public.contab_asientos where anio = p_anio and mes = p_mes and clase = 'auto';

  -- 1) Mensualidades del mes (cobro cargado): CxC / Ingreso. Un solo cobro por alumno, mes y año.
  for r in
    select distinct on (f.alumno_id, public.contab_mes(f.mes_correspondiente)) f.*, a.nombre al_nombre
    from public.facturas f left join public.alumnos a on a.id = f.alumno_id
    where coalesce(f.tipo_factura,'cobro') = 'cobro' and f.estado <> 'anulada'
      and public.contab_mes(f.mes_correspondiente) = p_mes
      and coalesce(f.anio_correspondiente, public.contab_anio(f.fecha_emision, public.contab_mes(f.mes_correspondiente))) = p_anio
    order by f.alumno_id, public.contab_mes(f.mes_correspondiente), f.created_at
  loop
    perform public.contab__asiento(p_anio, p_mes, ini, 'Mensualidad '||r.mes_correspondiente||' · '||coalesce(r.al_nombre,'')||' ('||r.numero_factura||')', 'auto', 'facturas', r.id,
      jsonb_build_array(jsonb_build_array('1.2.01', r.monto_total, 0), jsonb_build_array('4.1.01', 0, r.monto_total)));
    n := n + 1;
  end loop;

  -- 2) Pagos de padres (comprobante): Efectivo y bancos / CxC (+ mora). Un solo comprobante por cobro.
  for r in
    select distinct on (coalesce(f.cobro_id, f.id)) f.*, a.nombre al_nombre
    from public.facturas f left join public.alumnos a on a.id = f.alumno_id
    where f.tipo_factura = 'comprobante' and f.estado <> 'anulada' and f.fecha_pago between ini and fin
    order by coalesce(f.cobro_id, f.id), f.created_at
  loop
    perform public.contab__asiento(p_anio, p_mes, r.fecha_pago, 'Pago mensualidad '||r.mes_correspondiente||' · '||coalesce(r.al_nombre,'')||' ('||r.numero_factura||', '||coalesce(r.tipo_pago,'')||')', 'auto', 'facturas', r.id,
      jsonb_build_array(jsonb_build_array(disp, coalesce(r.monto_total,0) + coalesce(r.mora_cobrada,0), 0),
                        jsonb_build_array('1.2.01', 0, r.monto_total),
                        jsonb_build_array('4.1.02', 0, coalesce(r.mora_cobrada,0))));
    n := n + 1;
  end loop;

  -- 3) Cuentas por pagar del mes (lo que se debe, pagado o no): Gasto / Por pagar
  for r in select c.* from public.cuentas_por_pagar c
    where public.contab_mes(c.mes_correspondiente) = p_mes and coalesce(c.anio_correspondiente, p_anio) = p_anio
  loop
    perform public.contab__asiento(p_anio, p_mes, fin, 'Por pagar: '||r.descripcion, 'auto', 'cuentas_por_pagar', r.id,
      jsonb_build_array(jsonb_build_array(public.contab_cta_gasto(r.tipo, r.descripcion), r.monto, 0),
                        jsonb_build_array(case when r.tipo = 'salario' then '2.1.02' else '2.1.01' end, 0, r.monto)));
    n := n + 1;
  end loop;

  -- 4) Gastos
  for r in
    select g.*, c.id cxp_id, c.tipo cxp_tipo,
      coalesce(public.contab_mes(g.mes_deduccion), public.contab_mes(g.mes_correspondiente), extract(month from g.fecha)::int) mc
    from public.gastos g left join public.cuentas_por_pagar c on c.gasto_id = g.id
    where g.fecha is not null
  loop
    declare
      ac int := public.contab_anio(r.fecha, r.mc);
      kc int := ac * 12 + r.mc;                                                         -- mes al que corresponde
      kf int := extract(year from r.fecha)::int * 12 + extract(month from r.fecha)::int; -- mes en que se pagó
      kp int := p_anio * 12 + p_mes;
      ka int := extract(year from arranque)::int * 12 + extract(month from arranque)::int;
      cta text := public.contab_cta_gasto(r.tipo, r.descripcion);
      pas text := case when r.tipo = 'salario' then '2.1.02' else '2.1.01' end;
    begin
      if r.cxp_id is not null then
        -- Pago de una cuenta por pagar: solo baja la deuda (el gasto ya se contó en su mes)
        if kf = kp then
          perform public.contab__asiento(p_anio, p_mes, r.fecha, 'Pago de cuenta por pagar: '||r.descripcion, 'auto', 'gastos', r.id,
            jsonb_build_array(jsonb_build_array(case when r.cxp_tipo = 'salario' then '2.1.02' else '2.1.01' end, r.monto, 0), jsonb_build_array(disp, 0, r.monto)));
          n := n + 1;
        end if;
      elsif r.tipo = 'deuda' then
        -- Pago de deuda: no es gasto, baja lo que se debe
        if kf = kp then
          perform public.contab__asiento(p_anio, p_mes, r.fecha, 'Pago de deuda: '||coalesce(r.descripcion,''), 'auto', 'gastos', r.id,
            jsonb_build_array(jsonb_build_array(case when coalesce(r.descripcion,'') ~* '(yessany|propietari|due[nñ]a)' then '2.2.01' else '2.2.02' end, r.monto, 0), jsonb_build_array(disp, 0, r.monto)));
          n := n + 1;
        end if;
      elsif kc = kf then
        if kf = kp then
          perform public.contab__asiento(p_anio, p_mes, r.fecha, coalesce(r.descripcion,'Gasto'), 'auto', 'gastos', r.id,
            jsonb_build_array(jsonb_build_array(cta, r.monto, 0), jsonb_build_array(disp, 0, r.monto)));
          n := n + 1;
        end if;
      elsif kc < kf then
        -- Gasto de un mes anterior pagado después: gasto en su mes (como por pagar) y pago en el mes de la fecha
        if kc = kp and kc >= ka then
          perform public.contab__asiento(p_anio, p_mes, public.contab_fin_mes(ac, r.mc), 'Por pagar: '||coalesce(r.descripcion,'Gasto'), 'auto', 'gastos', r.id,
            jsonb_build_array(jsonb_build_array(cta, r.monto, 0), jsonb_build_array(pas, 0, r.monto)));
          n := n + 1;
        end if;
        if kf = kp then
          perform public.contab__asiento(p_anio, p_mes, r.fecha, 'Pago atrasado: '||coalesce(r.descripcion,'Gasto'), 'auto', 'gastos', r.id,
            jsonb_build_array(jsonb_build_array(pas, r.monto, 0), jsonb_build_array(disp, 0, r.monto)));
          n := n + 1;
        end if;
      else
        -- Pagado por adelantado: anticipo al pagar, gasto en el mes que corresponde
        if kf = kp then
          perform public.contab__asiento(p_anio, p_mes, r.fecha, 'Anticipo: '||coalesce(r.descripcion,'Gasto'), 'auto', 'gastos', r.id,
            jsonb_build_array(jsonb_build_array('1.4.01', r.monto, 0), jsonb_build_array(disp, 0, r.monto)));
          n := n + 1;
        end if;
        if kc = kp then
          perform public.contab__asiento(p_anio, p_mes, make_date(ac, r.mc, 1), coalesce(r.descripcion,'Gasto')||' (pagado por adelantado)', 'auto', 'gastos', r.id,
            jsonb_build_array(jsonb_build_array(cta, r.monto, 0), jsonb_build_array('1.4.01', 0, r.monto)));
          n := n + 1;
        end if;
      end if;
    end;
  end loop;

  -- 5) Ingresos extra
  for r in select i.* from public.otros_ingresos i where coalesce(i.fecha_pago, i.fecha) between ini and fin loop
    perform public.contab__asiento(p_anio, p_mes, coalesce(r.fecha_pago, r.fecha), coalesce(r.descripcion,'Ingreso extra'), 'auto', 'otros_ingresos', r.id,
      jsonb_build_array(jsonb_build_array(disp, r.monto, 0),
                        jsonb_build_array(case when coalesce(r.descripcion,'') ~* 'ajuste de caja' then '4.3.02' else '4.3.01' end, 0, r.monto)));
    n := n + 1;
  end loop;

  -- 6) Materiales vendidos y pagados: ingreso por la venta y su costo
  for r in select v.* from public.ventas_material v where v.estado = 'pagado' and coalesce(v.fecha_pago, v.fecha_venta) between ini and fin loop
    perform public.contab__asiento(p_anio, p_mes, coalesce(r.fecha_pago, r.fecha_venta), 'Venta de material: '||coalesce(r.nombre_material,'')||' ('||coalesce(r.numero,'')||')', 'auto', 'ventas_material', r.id,
      jsonb_build_array(jsonb_build_array(disp, r.precio_venta, 0), jsonb_build_array('4.2.01', 0, r.precio_venta),
                        jsonb_build_array('5.1.01', r.costo, 0), jsonb_build_array(disp, 0, r.costo)));
    n := n + 1;
  end loop;

  -- 7) Graduación: lo cobrado entra al fondo (no es ingreso). Solo lo nuevo respecto a otros meses.
  for r in select c.*, case when coalesce(c.abonado,0) > 0 then c.abonado when c.estado = 'pagado' then c.precio_venta else 0 end recibido
    from public.cobros_graduacion c where c.estado in ('pagado','abonado') and c.fecha_pago between ini and fin
  loop
    select coalesce(sum(l.haber - l.debe),0) into ya from public.contab_lineas l join public.contab_asientos a on a.id = l.asiento_id
      where a.origen = 'cobros_graduacion' and a.origen_id = r.id and l.cuenta = '2.3.01';
    v := r.recibido - ya;
    if v > 0 then
      perform public.contab__asiento(p_anio, p_mes, r.fecha_pago, 'Cuota de graduación ('||coalesce(r.numero,'')||')', 'auto', 'cobros_graduacion', r.id,
        jsonb_build_array(jsonb_build_array(disp, v, 0), jsonb_build_array('2.3.01', 0, v)));
      n := n + 1;
    end if;
  end loop;
  for r in select g.* from public.gastos_graduacion g where g.fecha between ini and fin loop
    perform public.contab__asiento(p_anio, p_mes, r.fecha, 'Gasto de graduación: '||coalesce(r.descripcion,''), 'auto', 'gastos_graduacion', r.id,
      jsonb_build_array(jsonb_build_array('2.3.01', r.monto, 0), jsonb_build_array(disp, 0, r.monto)));
    n := n + 1;
  end loop;

  return n;
end $$;

-- Asiento manual o de apertura (desde la pantalla de Contabilidad)
create or replace function public.contab_registrar(p_fecha date, p_descripcion text, p_clase text, p_lineas jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare a int := extract(year from p_fecha)::int; m int := extract(month from p_fecha)::int; aid bigint;
begin
  if not public.es_admin() then raise exception 'Solo administración'; end if;
  if p_clase not in ('manual','apertura') then raise exception 'Clase inválida'; end if;
  if p_clase = 'apertura' then delete from public.contab_asientos where clase = 'apertura'; end if;
  insert into public.contab_periodos (anio, mes) values (a, m) on conflict do nothing;
  aid := public.contab__asiento(a, m, p_fecha, p_descripcion, p_clase, null, null, p_lineas);
  return aid;
end $$;

-- Cerrar un mes: genera por última vez, guarda el dinero contado y bloquea el mes
create or replace function public.contab_cerrar(p_anio int, p_mes int, p_dinero numeric, p_notas text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo administración'; end if;
  perform public.contab_generar(p_anio, p_mes);
  update public.contab_periodos set estado = 'cerrado', dinero_contado = p_dinero, notas = p_notas,
    cerrado_en = now(), cerrado_por = auth.email() where anio = p_anio and mes = p_mes;
end $$;

-- Reabrir un mes (solo si es el último cerrado)
create or replace function public.contab_reabrir(p_anio int, p_mes int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo administración'; end if;
  if exists (select 1 from public.contab_periodos where estado = 'cerrado' and anio * 12 + mes > p_anio * 12 + p_mes) then
    raise exception 'Primero reabre los meses posteriores';
  end if;
  update public.contab_periodos set estado = 'abierto', cerrado_en = null, cerrado_por = null where anio = p_anio and mes = p_mes;
end $$;

revoke all on function public.contab_generar(int,int), public.contab_registrar(date,text,text,jsonb), public.contab_cerrar(int,int,numeric,text), public.contab_reabrir(int,int), public.contab__asiento(int,int,date,text,text,text,text,jsonb) from public, anon;
grant execute on function public.contab_generar(int,int), public.contab_registrar(date,text,text,jsonb), public.contab_cerrar(int,int,numeric,text), public.contab_reabrir(int,int) to authenticated;
