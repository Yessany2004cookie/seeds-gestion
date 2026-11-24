// ════════════════════════════════════════════════════════════
//  RESUMEN DEL MES (solo lectura)
//  Cifras del mes para Inicio y para Finanzas → Alertas:
//  · Planilla: lo que cuesta al mes (salario de cada maestro) y lo registrado.
//  · Servicios: renta, luz, internet y agua (los mismos «gastos fijos» de Alertas).
//  · Meta del mes: planilla + servicios = lo que la escuela debe generar para cubrirse.
//  · Cobrado a padres / ya entró / falta: igual que Contabilidad (cobranzaDelMes).
//  No escribe nada en la base de datos ni cambia el flujo de cobros.
// ════════════════════════════════════════════════════════════
import { cobranzaDelMes } from "./contabilidad";
import { gastosFijosSugeridos } from "./alertasFinanzas";

export const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const num = (v) => Number(v) || 0;
const suma = (arr, f) => arr.reduce((s, x) => s + num(f(x)), 0);
const L = (n) => `L ${Math.round(num(n)).toLocaleString("es-HN")}`;

// Mismo criterio que el resto de la app para saber a qué mes y año cuenta un gasto
const mesDeFecha = (f) => { const m = parseInt(String(f || "").split("-")[1]); return m >= 1 && m <= 12 ? MESES[m - 1] : null; };
const mesGasto = (g) => g.mes_deduccion || g.mes_correspondiente || mesDeFecha(g.fecha) || null;
const anioAsignado = (fecha, mes, respaldo) => {
  const [y, m] = String(fecha || "").split("-").map(Number);
  if (!y) return Number(respaldo) || null;
  const ma = MESES.indexOf(mes), mf = (m || 0) - 1;
  if (ma < 0 || mf < 0) return y;
  if (ma >= 10 && mf <= 1) return y - 1;
  if (ma <= 1 && mf >= 10) return y + 1;
  return y;
};
const gastoDe = (g, mes, anio) => mesGasto(g) === mes && (anioAsignado(g.fecha, mesGasto(g), g.anio_correspondiente) ?? anio) === anio;
// Cuentas por pagar del mes que todavía no se convirtieron en gasto (si ya se pagaron, el gasto ya cuenta)
const cxpDe = (c, mes, anio) => c.mes_correspondiente === mes && (num(c.anio_correspondiente) || anio) === anio && !c.gasto_id;

// ¿Qué servicio es? (renta, luz, internet, agua). Lo demás es «otro gasto».
const SERVICIOS = [
  { k: "renta", t: "Renta", es: (r) => r.tipo === "renta" || /renta|alquiler/i.test(r.descripcion || "") },
  { k: "luz", t: "Luz", es: (r) => /\bluz\b|energ/i.test(r.descripcion || "") },
  { k: "internet", t: "Internet", es: (r) => /internet|wifi|cable/i.test(r.descripcion || "") },
  { k: "agua", t: "Agua", es: (r) => /\bagua\b/i.test(r.descripcion || "") },
];
const servicioDe = (r) => (r.tipo === "salario" ? null : SERVICIOS.find((s) => s.es(r))?.k || null);

// Gastos fijos que la usuaria escribió en Alertas (si no, lo último registrado)
const fijosGuardados = () => { try { return num(localStorage.getItem("seeds_gastos_fijos")); } catch (e) { return 0; } };

export function resumenDelMes(data, anio, mesIdx) {
  const mes = MESES[mesIdx];
  const gastos = (data.gastos || []).filter((g) => gastoDe(g, mes, anio));
  const cxp = (data.cuentas_por_pagar || []).filter((c) => cxpDe(c, mes, anio));

  // ── Planilla ──
  const maestros = (data.maestros || []).filter((m) => num(m.salario) > 0);
  const planillaMes = suma(maestros, (m) => m.salario);
  const salPagado = gastos.filter((g) => g.tipo === "salario");
  const salDebe = cxp.filter((c) => c.tipo === "salario");
  const planillaPagada = suma(salPagado, (g) => g.monto);
  const planillaPorPagar = suma(salDebe, (c) => c.monto);
  const conPago = new Set([...salPagado, ...salDebe].map((g) => g.maestro_id).filter(Boolean));
  const sinPago = maestros.filter((m) => !conPago.has(m.id));

  // ── Servicios (renta, luz, internet, agua) ──
  const regs = [...gastos.map((g) => ({ ...g, pagado: true })), ...cxp.map((c) => ({ ...c, pagado: false }))];
  const detalle = SERVICIOS.map((s) => {
    const r = regs.filter((x) => servicioDe(x) === s.k);
    return { ...s, registrado: suma(r, (x) => x.monto), pagado: suma(r.filter((x) => x.pagado), (x) => x.monto), hay: r.length > 0 };
  });
  const sugeridos = gastosFijosSugeridos(data);
  const serviciosMes = fijosGuardados() || sugeridos;
  const serviciosReg = suma(detalle, (d) => d.registrado);
  const otrosGastos = suma(regs.filter((x) => x.tipo !== "salario" && x.tipo !== "deuda" && !servicioDe(x)), (x) => x.monto);

  // ── Meta y cobranza ──
  const meta = planillaMes + serviciosMes;
  const cob = cobranzaDelMes(data.facturas, anio, mesIdx + 1);

  return {
    mes, anio, mesIdx,
    planilla: { mes: planillaMes, pagada: planillaPagada, porPagar: planillaPorPagar, registrada: planillaPagada + planillaPorPagar, maestros: maestros.length, sinPago, sinGrupo: maestros.filter((m) => !Array.isArray(m.secciones_ids) || m.secciones_ids.length === 0) },
    servicios: { mes: serviciosMes, registrado: serviciosReg, detalle, manual: fijosGuardados() > 0 },
    otrosGastos, meta,
    cobrado: cob.facturado, entro: cob.pagado, falta: cob.pendiente, alumnos: cob.alumnos, alumnosPagados: cob.alumnosPagados,
    // Si todos pagan: lo que sobra (+) o falta (−) después de planilla y servicios
    siTodosPagan: cob.facturado - meta,
    // Con lo que ya entró: cuánto falta para cubrir la meta
    faltaParaMeta: Math.max(0, meta - cob.pagado),
  };
}

// ── Alertas del mes y de datos (para Finanzas → Alertas, pestaña «Otras alertas») ──
// Cada alerta: { tipo, quien, mes, doc, monto, accion, grave }  (mismo formato que el Excel/PDF)
export function alertasDelSistema(data, hoy = new Date()) {
  const anio = hoy.getFullYear(), mi = hoy.getMonth(), dia = hoy.getDate();
  const r = resumenDelMes(data, anio, mi);
  const ant = mi === 0 ? resumenDelMes(data, anio - 1, 11) : resumenDelMes(data, anio, mi - 1);
  const etq = (x) => `${x.mes} ${x.anio}`;
  const out = [];
  const add = (o) => out.push({ doc: "", monto: 0, grave: false, ...o });

  // 1) Lo cobrado no cubre planilla + servicios
  if (r.cobrado > 0 && r.siTodosPagan < 0) add({ tipo: "Lo cobrado no cubre los gastos", quien: `Se cobró ${L(r.cobrado)}; planilla + servicios ${L(r.meta)}`, mes: etq(r), monto: -r.siTodosPagan, accion: "Aunque todos paguen, falta este monto. Revisar grupos que pierden o gastos.", grave: true });
  if (r.cobrado === 0 && dia >= 5) add({ tipo: "Sin cobros del mes", quien: "No se han enviado cobros de mensualidad", mes: etq(r), monto: r.meta, accion: "Enviar los cobros del mes desde Facturas.", grave: true });
  // 2) Lo que ya entró va atrasado (después del día 20)
  if (r.cobrado > 0 && dia >= 20 && r.entro < r.meta) add({ tipo: "Lo que entró aún no cubre el mes", quien: `Entró ${L(r.entro)} de ${L(r.meta)} (${Math.round((r.entro / Math.max(1, r.meta)) * 100)}%)`, mes: etq(r), monto: r.faltaParaMeta, accion: `Faltan ${L(r.falta)} por cobrar a padres. Enviar recordatorios.`, grave: r.entro < r.meta * 0.5 });
  // 3) El mes pasado sin renta / servicios registrados (la renta se paga al mes siguiente: se registra como cuenta por pagar)
  // Solo los servicios que la escuela ya ha registrado alguna vez (si nunca pagó agua, no avisa)
  const historial = [...(data.gastos || []), ...(data.cuentas_por_pagar || [])];
  const usaServicio = (k) => historial.some((x) => servicioDe(x) === k);
  ant.servicios.detalle.filter((d) => !d.hay && usaServicio(d.k)).forEach((d) => add({ tipo: `Falta registrar ${d.t.toLowerCase()}`, quien: `${d.t} de ${ant.mes} sin gasto ni cuenta por pagar`, mes: etq(ant), accion: "Registrarla en Finanzas (si aún no se paga, como cuenta por pagar de ese mes).", grave: d.k === "renta" }));
  if (dia >= 28) r.servicios.detalle.filter((d) => d.k === "renta" && !d.hay).forEach(() => add({ tipo: "Renta del mes sin registrar", quien: `Renta de ${r.mes}`, mes: etq(r), accion: "Si se paga el mes siguiente, dejarla como cuenta por pagar de este mes." }));
  // 4) Maestros sin salario registrado el mes pasado
  if (ant.planilla.sinPago.length > 0) add({ tipo: "Planilla incompleta", quien: `${ant.planilla.sinPago.length} maestro${ant.planilla.sinPago.length > 1 ? "s" : ""} sin pago: ${ant.planilla.sinPago.map((m) => m.nombre).join(", ")}`, mes: etq(ant), monto: suma(ant.planilla.sinPago, (m) => m.salario), accion: "Registrar su salario (pagado o como cuenta por pagar). Si no trabajó ese mes, ignorar." });
  // 5) Maestro con salario y sin grupo
  r.planilla.sinGrupo.forEach((m) => add({ tipo: "Maestro sin grupo asignado", quien: m.nombre, mes: "", monto: num(m.salario), accion: "Su salario no se reparte en «Sostenibilidad por grupo». Marcar sus grupos en Maestros." }));

  // ── Revisión de datos ──
  const alumnos = data.alumnos || [], secPorId = Object.fromEntries((data.secciones || []).map((s) => [s.id, s]));
  const activos = alumnos.filter((a) => (a.estado || "activo") === "activo");
  const facturas = (data.facturas || []).filter((f) => f.estado !== "anulada");
  const anioF = (f) => num(f.anio_correspondiente) || num(String(f.fecha_emision || "").slice(0, 4));
  // 6) Alumnos activos que pagan y no tienen cobro de este mes (si ya se enviaron cobros)
  const conCobro = new Set(facturas.filter((f) => (f.tipo_factura || "cobro") === "cobro" && f.mes_correspondiente === r.mes && anioF(f) === anio).map((f) => f.alumno_id));
  if (conCobro.size > 0) {
    const cuota = (a) => (num(a.monto_personalizado) > 0 ? num(a.monto_personalizado) : num(secPorId[a.seccion_id]?.mensualidad));
    const sinCobro = activos.filter((a) => a.beca !== true && secPorId[a.seccion_id] && cuota(a) > 0 && !conCobro.has(a.id));
    if (sinCobro.length) add({ tipo: "Alumnos activos sin cobro del mes", quien: `${sinCobro.length} alumno${sinCobro.length > 1 ? "s" : ""}: ${sinCobro.slice(0, 6).map((a) => a.nombre).join(", ")}${sinCobro.length > 6 ? "…" : ""}`, mes: etq(r), monto: suma(sinCobro, cuota), accion: "Enviarles el cobro, o marcarlos como becados o retirados si ya no pagan." });
  }
  // 7) Alumnos activos sin grupo
  const sinGrupo = activos.filter((a) => !a.seccion_id || !secPorId[a.seccion_id]);
  if (sinGrupo.length) add({ tipo: "Alumnos activos sin grupo", quien: `${sinGrupo.length}: ${sinGrupo.slice(0, 6).map((a) => a.nombre).join(", ")}${sinGrupo.length > 6 ? "…" : ""}`, mes: "", accion: "Asignarles grupo en Alumnos: sin grupo no se calcula su mensualidad." });
  // 8) Pagos cuyo monto no coincide con su cobro
  const cobroPorId = Object.fromEntries(facturas.filter((f) => (f.tipo_factura || "cobro") === "cobro").map((f) => [f.id, f]));
  facturas.filter((f) => f.tipo_factura === "comprobante" && f.cobro_id && cobroPorId[f.cobro_id] && num(f.monto_total) !== num(cobroPorId[f.cobro_id].monto_total)).forEach((f) => {
    const c = cobroPorId[f.cobro_id];
    add({ tipo: "Pago distinto al cobro", quien: alumnos.find((a) => a.id === f.alumno_id)?.nombre || "—", mes: `${c.mes_correspondiente || ""} ${anioF(c) || ""}`.trim(), doc: f.numero_factura || "", monto: Math.abs(num(f.monto_total) - num(c.monto_total)), accion: `Cobro ${L(c.monto_total)}, pago ${L(f.monto_total)}. Revisar si fue abono, descuento o error.` });
  });
  // 9) Pagos sin cobro (comprobante suelto)
  const sueltos = facturas.filter((f) => f.tipo_factura === "comprobante" && !f.cobro_id);
  if (sueltos.length) add({ tipo: "Pagos sin cobro", quien: `${sueltos.length} comprobante${sueltos.length > 1 ? "s" : ""} sin cobro enlazado`, mes: "", monto: suma(sueltos, (f) => f.monto_total), accion: "No aparecen en «cobrado vs. pagado». Revisar a qué mes corresponden." });
  // 10) Números de factura repetidos
  const porNum = new Map();
  facturas.forEach((f) => { if (f.numero_factura) porNum.set(f.numero_factura, (porNum.get(f.numero_factura) || 0) + 1); });
  const numsRep = [...porNum.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  if (numsRep.length) add({ tipo: "Números de factura repetidos", quien: `${numsRep.length} número${numsRep.length > 1 ? "s" : ""} usados más de una vez`, mes: "", doc: numsRep.slice(0, 5).join(", ") + (numsRep.length > 5 ? "…" : ""), accion: "Dos documentos con el mismo número confunden a padres y contador. Corregir la numeración." });

  return { alertas: out, resumen: r, anterior: ant };
}
