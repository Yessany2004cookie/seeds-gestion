-- Evitar pagos / cobros repetidos por doble clic
-- ------------------------------------------------------------------
-- Rechaza un cobro o comprobante IGUAL a otro (mismo alumno, mismo tipo,
-- mismo mes y año, mismo monto, no anulado) que se guardó hace menos de
-- 10 minutos. Eso solo pasa con un doble clic o un reintento: el flujo
-- normal de enviar cobros y confirmar pagado no cambia.
-- No toca datos existentes (los meses anteriores quedan como están).
--
-- Deshacer:
--   drop trigger if exists facturas_evitar_repetidos on public.facturas;
--   drop function if exists public.facturas_evitar_repetidos();

create or replace function public.facturas_evitar_repetidos()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.estado, '') = 'anulada' then
    return new;
  end if;
  -- Si llegan dos clics casi al mismo tiempo, el segundo espera al primero
  perform pg_advisory_xact_lock(hashtext(coalesce(new.alumno_id,'') || '|' || coalesce(new.tipo_factura,'cobro') || '|' || coalesce(new.mes_correspondiente,'')));
  if exists (
    select 1 from public.facturas f
    where f.alumno_id = new.alumno_id
      and coalesce(f.tipo_factura, 'cobro') = coalesce(new.tipo_factura, 'cobro')
      and f.mes_correspondiente is not distinct from new.mes_correspondiente
      and f.anio_correspondiente is not distinct from new.anio_correspondiente
      and f.monto_total is not distinct from new.monto_total
      and coalesce(f.estado, '') <> 'anulada'
      and f.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'Este % de % ya se guardó hace un momento (posible doble clic). No se guardó de nuevo.',
      case when new.tipo_factura = 'comprobante' then 'pago' else 'cobro' end,
      new.mes_correspondiente
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists facturas_evitar_repetidos on public.facturas;
create trigger facturas_evitar_repetidos
  before insert on public.facturas
  for each row execute function public.facturas_evitar_repetidos();
