// ════════════════════════════════════════════════════════════
//  CONTABILIDAD (partida doble)
//  Los asientos se generan solos en la base de datos (función contab_generar)
//  leyendo cobros, pagos, gastos, cuentas por pagar, materiales, graduación e
//  ingresos extra. Esta pantalla NO cambia cómo se cobra a los padres.
//  Arranca el 1 de noviembre de 2026. Un mes cerrado queda bloqueado.
// ════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { card, input, label, badge, btn, btnO } from "./estilo";
import { BookOpen, Lock, Unlock, RefreshCw, Info, CheckCircle, AlertTriangle, Download } from "lucide-react";
import { BarraDescargas } from "./documentoFormal";
import { useMarca } from "./marca";
import { Balanza, Ajustes, Antiguedad, calcularBalanza, calcularAntiguedad } from "./contabilidadExtra";
import { useVista, SelectorVista, EstilosVistas, Titular, Kpis, Comparar, Desglose, Movimientos, Hoja, Lc, VERDE as VERDE_S, ROJO as ROJO_S, NARANJA, AZUL as AZUL_M } from "./vistas";
import { fuentesExcel, EXCEL_TEXTO } from "./tipografia";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const ARRANQUE = { anio: 2026, mes: 11 };
const GRIS = "#64748B", ROJO = "#DC2626", VERDE = "#059669", AZUL = "#2563EB";
const L = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; const t = `L ${Math.abs(v).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; return v < 0 ? `(${t})` : t; };
const clave = (a, m) => a * 12 + m;
const th = { textAlign: "left", padding: "7px 8px", fontSize: 11, color: GRIS, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "2px solid #E2E8F0" };
const td = { padding: "6px 8px", borderBottom: "1px solid #F1F5F9", fontSize: 12.5, verticalAlign: "top" };
const fechaC = (f) => String(f || "").split("-").reverse().join("/");
// Pantallas que tienen vista sencilla y vista Excel
const CON_VISTAS = ["resultados", "balance", "flujo", "diario", "mayor", "cierre", "balanza", "ajustes", "antiguedad"];

// Lista de meses desde el arranque hasta el mes actual
const mesesDisponibles = () => {
  const hoy = new Date(); const fin = clave(hoy.getFullYear(), hoy.getMonth() + 1); const r = [];
  for (let k = clave(ARRANQUE.anio, ARRANQUE.mes); k <= fin; k++) r.push({ anio: Math.floor((k - 1) / 12), mes: ((k - 1) % 12) + 1 });
  return r.reverse();
};

// ── Saldos sugeridos al 31 de octubre (para el asiento de apertura) ──
function saldosSugeridos(data) {
  const corte = "2026-10-31", desde = clave(2026, 7);
  const anioF = (f) => Number(f.anio_correspondiente) || Number(String(f.fecha_emision || "").slice(0, 4));
  const mesN = (t) => MESES.indexOf(t) + 1;
  // Pagos guardados hasta el 31 de octubre, por cobro
  const pagadoAntes = new Set((data.facturas || []).filter((f) => f.tipo_factura === "comprobante" && f.estado !== "anulada" && f.fecha_pago && f.fecha_pago <= corte).map((f) => f.cobro_id));
  const vistos = new Set(); let cxc = 0;
  (data.facturas || []).filter((f) => (f.tipo_factura || "cobro") === "cobro" && f.estado !== "anulada").forEach((f) => {
    const k = clave(anioF(f), mesN(f.mes_correspondiente)); if (k < desde || k > clave(2026, 10)) return;
    const u = `${f.alumno_id}|${k}`; if (vistos.has(u)) return; vistos.add(u);
    if (!pagadoAntes.has(f.id)) cxc += Number(f.monto_total) || 0;
  });
  // Pagos adelantados: mensualidades de noviembre en adelante pagadas antes del 31/10 (se restan)
  const cobroPorId = Object.fromEntries((data.facturas || []).filter((f) => (f.tipo_factura || "cobro") === "cobro").map((f) => [f.id, f]));
  const adelantos = new Set();
  (data.facturas || []).filter((f) => f.tipo_factura === "comprobante" && f.estado !== "anulada" && f.fecha_pago && f.fecha_pago <= corte).forEach((f) => {
    const c = cobroPorId[f.cobro_id]; if (!c || c.estado === "anulada" || adelantos.has(c.id)) return;
    if (clave(anioF(c), mesN(c.mes_correspondiente)) >= clave(2026, 11)) { adelantos.add(c.id); cxc -= Number(c.monto_total) || 0; }
  });
  let cxp = 0, sal = 0;
  (data.cuentas_por_pagar || []).forEach((c) => {
    const k = clave(Number(c.anio_correspondiente) || 2026, mesN(c.mes_correspondiente)); if (k > clave(2026, 10)) return;
    if (c.pagada && c.fecha_pago && c.fecha_pago <= corte) return;
    if (c.tipo === "salario") sal += Number(c.monto) || 0; else cxp += Number(c.monto) || 0;
  });
  const recibido = (v) => (Number(v.abonado) > 0 ? Number(v.abonado) : v.estado === "pagado" ? Number(v.precio_venta) || 0 : 0);
  const gradCob = (data.cobros_graduacion || []).filter((v) => ["pagado", "abonado"].includes(v.estado) && v.fecha_pago && v.fecha_pago <= corte).reduce((s, v) => s + recibido(v), 0);
  const gradGas = (data.gastos_graduacion || []).filter((g) => g.fecha && g.fecha <= corte).reduce((s, g) => s + (Number(g.monto) || 0), 0);
  return { cxc, cxp, sal, fondo: Math.max(0, gradCob - gradGas) };
}

// ── Cobrado (facturado) vs. pagado de las mensualidades de un mes ──
// Igual que la contabilidad: un cobro por alumno, mes y año. Solo lectura: no cambia nada.
export function cobranzaDelMes(facturas, anio, mes) {
  const anioF = (f) => Number(f.anio_correspondiente) || Number(String(f.fecha_emision || "").slice(0, 4));
  const grupos = {};
  (facturas || []).filter((f) => (f.tipo_factura || "cobro") === "cobro" && f.estado !== "anulada" && MESES.indexOf(f.mes_correspondiente) + 1 === mes && anioF(f) === anio)
    .forEach((f) => { (grupos[f.alumno_id] || (grupos[f.alumno_id] = [])).push(f); });
  // Pagos confirmados (comprobantes), uno por cobro
  const pagoPorCobro = {};
  (facturas || []).filter((f) => f.tipo_factura === "comprobante" && f.estado !== "anulada" && f.cobro_id)
    .forEach((f) => { const p = pagoPorCobro[f.cobro_id]; if (!p || String(f.created_at || "") < String(p.created_at || "")) pagoPorCobro[f.cobro_id] = f; });
  const ini = `${anio}-${String(mes).padStart(2, "0")}-01`;
  let facturado = 0, pagado = 0, adelantado = 0, alumnos = 0, alumnosPagados = 0;
  Object.values(grupos).forEach((lista) => {
    lista.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
    const monto = Number(lista[0].monto_total) || 0;
    const pago = lista.map((f) => pagoPorCobro[f.id]).find(Boolean);
    alumnos++; facturado += monto;
    if (pago || lista.some((f) => f.estado === "pagada")) {
      const v = pago ? Math.min(monto, Number(pago.monto_total) || monto) : monto;
      pagado += v; alumnosPagados++;
      if (pago?.fecha_pago && pago.fecha_pago < ini) adelantado += v;
    }
  });
  return { facturado, pagado, pendiente: Math.max(0, facturado - pagado), adelantado, alumnos, alumnosPagados };
}

export function ContabilidadPage({ data, showToast, tabFijo }) {
  const meses = useMemo(mesesDisponibles, []);
  const [sel, setSel] = useState(meses[0] || ARRANQUE); // el más reciente
  const [tab, setTab] = useState(tabFijo || "resultados");
  const [cuentas, setCuentas] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [asientos, setAsientos] = useState([]); // todos los asientos con sus líneas
  const [cargando, setCargando] = useState(true);
  const [sinModulo, setSinModulo] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [listo, setListo] = useState(false); // ya terminó la primera carga

  const cargar = useCallback(async () => {
    setCargando(true);
    // Los asientos se leen por páginas (la base devuelve máximo 1000 filas por consulta)
    const leerAsientos = async () => {
      const todos = [];
      for (let i = 0; ; i++) {
        const r = await supabase.from("contab_asientos").select("*, contab_lineas(*)").order("fecha").order("id").range(i * 1000, i * 1000 + 999);
        if (r.error) return r;
        todos.push(...(r.data || []));
        if (!r.data || r.data.length < 1000) return { data: todos };
      }
    };
    const [c, p, a] = await Promise.all([
      supabase.from("contab_cuentas").select("*").order("codigo"),
      supabase.from("contab_periodos").select("*"),
      leerAsientos(),
    ]);
    if (c.error) { setSinModulo(true); setCargando(false); return; }
    setCuentas(c.data || []); setPeriodos(p.data || []); setAsientos(a.data || []); setCargando(false); setListo(true);
  }, []);

  const periodo = periodos.find((p) => p.anio === sel.anio && p.mes === sel.mes);
  const cerrado = periodo?.estado === "cerrado";

  // Al abrir un mes abierto, se vuelven a generar sus asientos para que estén al día
  const generar = useCallback(async (aviso) => {
    setTrabajando(true);
    const { error } = await supabase.rpc("contab_generar", { p_anio: sel.anio, p_mes: sel.mes });
    setTrabajando(false);
    if (error) { if (aviso) showToast("Error: " + error.message, "error"); return; }
    await cargar(); if (aviso) showToast("✓ Asientos actualizados");
  }, [sel, cargar, showToast]);

  useEffect(() => { cargar(); }, [cargar]);
  // Se regenera al abrir la pantalla (cuando termina la primera carga) y al cambiar de mes.
  // Antes solo pasaba al cambiar de mes, y al entrar se veían asientos viejos.
  useEffect(() => { if (listo && !sinModulo && !cerrado) generar(false); /* eslint-disable-next-line */ }, [listo, sel.anio, sel.mes, sinModulo, cerrado]);

  const nombreCta = (c) => cuentas.find((x) => x.codigo === c)?.nombre || c;
  const tipoCta = (c) => cuentas.find((x) => x.codigo === c)?.tipo;
  const kSel = clave(sel.anio, sel.mes);
  const delMes = asientos.filter((a) => a.anio === sel.anio && a.mes === sel.mes);
  const hasta = asientos.filter((a) => clave(a.anio, a.mes) <= kSel);
  const lineasDe = (lista) => lista.flatMap((a) => (a.contab_lineas || []).map((l) => ({ ...l, a })));
  const sumaPor = (lineas) => { const m = {}; lineas.forEach((l) => { m[l.cuenta] = (m[l.cuenta] || 0) + Number(l.debe) - Number(l.haber); }); return m; };
  const movMes = sumaPor(lineasDe(delMes));
  const saldos = sumaPor(lineasDe(hasta));
  const hayApertura = asientos.some((a) => a.clase === "apertura");

  // Estado de resultados del mes
  const ingresos = cuentas.filter((c) => c.tipo === "ingreso").map((c) => ({ c, v: -(movMes[c.codigo] || 0) })).filter((x) => Math.abs(x.v) > 0.004);
  const gastos = cuentas.filter((c) => c.tipo === "gasto").map((c) => ({ c, v: movMes[c.codigo] || 0 })).filter((x) => Math.abs(x.v) > 0.004);
  const totIng = ingresos.reduce((s, x) => s + x.v, 0), totGas = gastos.reduce((s, x) => s + x.v, 0), resultado = totIng - totGas;
  const cob = useMemo(() => cobranzaDelMes(data.facturas, sel.anio, sel.mes), [data.facturas, sel.anio, sel.mes]);
  const nombreIng = (c) => (c.codigo === "4.1.01" ? "Mensualidades cobradas a padres (facturado)" : c.nombre);

  // Balance general al final del mes (los resultados de los meses se suman al patrimonio)
  const resAcum = cuentas.filter((c) => c.tipo === "ingreso" || c.tipo === "gasto").reduce((s, c) => s - (saldos[c.codigo] || 0), 0);
  const filasB = (tipo, signo) => cuentas.filter((c) => c.tipo === tipo).map((c) => ({ c, v: signo * (saldos[c.codigo] || 0) })).filter((x) => Math.abs(x.v) > 0.004);
  const activos = filasB("activo", 1), pasivos = filasB("pasivo", -1), patrimonio = filasB("patrimonio", -1);
  const totA = activos.reduce((s, x) => s + x.v, 0), totP = pasivos.reduce((s, x) => s + x.v, 0), totPat = patrimonio.reduce((s, x) => s + x.v, 0) + resAcum;

  // Flujo de efectivo del mes (cuenta 1.1.01)
  const lineasDisp = lineasDe(delMes).filter((l) => l.cuenta === "1.1.01");
  const entradas = lineasDisp.reduce((s, l) => s + Number(l.debe), 0), salidas = lineasDisp.reduce((s, l) => s + Number(l.haber), 0);
  const dispFinal = saldos["1.1.01"] || 0, dispInicial = dispFinal - entradas + salidas;
  // Desglose del flujo: cada asiento que mueve dinero se clasifica según su otra cuenta
  const flujo = useMemo(() => {
    const cats = {};
    delMes.filter((a) => a.clase !== "apertura").forEach((a) => {
      const ls = a.contab_lineas || [];
      const neto = ls.filter((l) => l.cuenta === "1.1.01").reduce((s, l) => s + Number(l.debe) - Number(l.haber), 0);
      if (Math.abs(neto) < 0.005) return;
      const otras = ls.filter((l) => l.cuenta !== "1.1.01").map((l) => l.cuenta);
      const tiene = (pre) => otras.some((c) => c.startsWith(pre));
      let k;
      if (neto > 0) k = tiene("1.2.01") ? "Mensualidades cobradas (con mora)" : tiene("4.2.01") ? "Venta de materiales (menos su costo)" : tiene("2.3.01") ? "Cuotas de graduación (fondo)" : tiene("4.3") ? "Ingresos extra" : "Otras entradas";
      else k = tiene("2.1.") ? "Pagos de gastos de meses anteriores (salarios, renta, servicios)" : tiene("2.2.") ? "Pagos de deudas y préstamos" : tiene("2.3.01") ? "Gastos del evento de graduación" : tiene("1.4.01") ? "Pagos por adelantado" : tiene("5.") ? "Gastos del mes" : "Otras salidas";
      const c = cats[k] || (cats[k] = { k, v: 0, items: [] });
      c.v += neto; c.items.push({ f: a.fecha, d: a.descripcion, v: neto });
    });
    const lista = Object.values(cats);
    return { ent: lista.filter((c) => c.v > 0).sort((a, b) => b.v - a.v), sal: lista.filter((c) => c.v < 0).sort((a, b) => a.v - b.v) };
  }, [delMes]);
  const [abiertoFlujo, setAbiertoFlujo] = useState({});
  const totEnt = flujo.ent.reduce((t, c) => t + c.v, 0), totSal = flujo.sal.reduce((t, c) => t + c.v, 0);
  const dispIniFlujo = dispFinal - totEnt - totSal; // la apertura cuenta como saldo inicial, no como entrada

  // ── Datos para las dos vistas (solo presentación) ──
  const [vista, setVista] = useVista();
  const marcaC = useMarca();
  const mesTxt = `${MESES[sel.mes - 1]} ${sel.anio}`;
  const pctIng = (v) => (totIng ? Math.abs(v) / totIng * 100 : null);
  const dineroLibre = (saldos["1.1.01"] || 0) + (saldos["2.1.01"] || 0) + (saldos["2.1.02"] || 0);
  const sumaDebe = delMes.reduce((s, a) => s + (a.contab_lineas || []).reduce((t, l) => t + Number(l.debe), 0), 0);
  const sumaHaber = delMes.reduce((s, a) => s + (a.contab_lineas || []).reduce((t, l) => t + Number(l.haber), 0), 0);
  const diarioS = delMes.map((a) => {
    const ls = a.contab_lineas || [];
    const neto = ls.filter((l) => l.cuenta === "1.1.01").reduce((t, l) => t + Number(l.debe) - Number(l.haber), 0);
    const ap = a.clase === "apertura";
    const tipo = ap ? "otro" : neto > 0.005 ? "ent" : neto < -0.005 ? "sal" : "otro";
    const otras = [...new Set(ls.filter((l) => l.cuenta !== "1.1.01").map((l) => nombreCta(l.cuenta)))];
    return { k: a.id, fecha: a.fecha, tipo, t: a.descripcion, signo: tipo !== "otro",
      s: ap ? `Con lo que arrancó la escuela · había ${L(neto)} en caja y banco` : (tipo === "ent" ? "Entró dinero · " : tipo === "sal" ? "Salió dinero · " : "") + otras.join(" · "),
      v: ap ? neto : tipo === "otro" ? ls.reduce((t, l) => t + Number(l.debe), 0) : neto,
      color: tipo === "ent" ? VERDE_S : tipo === "sal" ? NARANJA : GRIS };
  });

  // Excel con una hoja por reporte: estado de resultados, balance general y flujo de efectivo
  const [xls, setXls] = useState(null);
  const descargarExcel = async () => {
    try {
      const writeExcelFile = (await import("write-excel-file/browser")).default;
      const FMT = '"L "#,##0.00;("L "#,##0.00)';
      const n = (v, o = {}) => ({ value: Math.round((Number(v) || 0) * 100) / 100, type: Number, format: FMT, ...o });
      const enc = (t) => [[{ value: "Seeds English School", fontWeight: "bold", fontSize: 14, textColor: "#1B2A4A" }], [{ value: t, fontWeight: "bold", fontSize: 12 }], [{ value: "Cifras en Lempiras", textColor: "#5B6576" }], []];
      const cab = (a, b = "Monto") => [{ value: a, fontWeight: "bold", backgroundColor: "#1B2A4A", textColor: "#FFFFFF" }, { value: b, fontWeight: "bold", backgroundColor: "#1B2A4A", textColor: "#FFFFFF", align: "right" }];
      const sec = (t) => [{ value: t, fontWeight: "bold", backgroundColor: "#E8ECF2" }, { value: null, backgroundColor: "#E8ECF2" }];
      const tot = (t, v, color) => [{ value: t, fontWeight: "bold", topBorderStyle: "thin", textColor: color }, n(v, { fontWeight: "bold", topBorderStyle: "thin", textColor: color })];
      const it = (t, v) => [{ value: t, indent: 1 }, n(v)];
      const mesTxt = `${MESES[sel.mes - 1]} ${sel.anio}`;
      const hRes = [...enc(`Estado de resultados — ${mesTxt}`), cab("Concepto"), sec("Ingresos"), ...ingresos.map((x) => it(nombreIng(x.c), x.v)), tot("Total ingresos", totIng),
        [], sec("Gastos y costos"), ...gastos.map((x) => it(x.c.nombre, x.v)), tot("Total gastos", totGas), [], tot(resultado >= 0 ? "Ganancia del mes (si todos pagan)" : "Pérdida del mes", resultado, resultado >= 0 ? "#2A5E45" : "#8E3131"),
        [], sec(`Mensualidades de ${mesTxt}: cobrado vs. pagado`), it(`Facturado (cobros enviados a ${cob.alumnos} alumnos)`, cob.facturado), it(`Pagado (confirmado, ${cob.alumnosPagados} alumnos)`, cob.pagado), tot("Pendiente de pago", cob.pendiente, "#8E3131")];
      const hBal = [...enc(`Balance general al ${new Date(sel.anio, sel.mes, 0).getDate()} de ${mesTxt}`), cab("Cuenta"), sec("Activos (lo que tengo)"), ...activos.map((x) => it(x.c.nombre, x.v)), tot("Total activos", totA),
        [], sec("Pasivos (lo que debo)"), ...pasivos.map((x) => it(x.c.nombre, x.v)), tot("Total pasivos", totP),
        [], sec("Patrimonio"), ...patrimonio.map((x) => it(x.c.nombre, x.v)), it("Resultados desde noviembre 2026", resAcum), tot("Total patrimonio", totPat), [], tot("Pasivos + patrimonio", totP + totPat)];
      const hFlu = [...enc(`Flujo de efectivo — ${mesTxt}`), cab("Concepto"), it("Efectivo y bancos al iniciar el mes", dispIniFlujo), [], sec("Entradas de dinero"),
        ...flujo.ent.flatMap((c) => [it(c.k, c.v), ...c.items.map((i) => [{ value: `${i.f || ""}  ${i.d || ""}`, indent: 2, textColor: "#5B6576" }, n(i.v, { textColor: "#5B6576" })])]), tot("Total entradas", totEnt),
        [], sec("Salidas de dinero"), ...flujo.sal.flatMap((c) => [it(c.k, c.v), ...c.items.map((i) => [{ value: `${i.f || ""}  ${i.d || ""}`, indent: 2, textColor: "#5B6576" }, n(i.v, { textColor: "#5B6576" })])]), tot("Total salidas", totSal),
        [], tot("Efectivo y bancos al cierre", dispFinal)];
      const cols = [{ width: 58 }, { width: 18 }];
      // Balanza de comprobación
      const bz = calcularBalanza(cuentas, asientos, sel.anio, sel.mes);
      const cabN = (ts) => ts.map((t, i) => ({ value: t, fontWeight: "bold", backgroundColor: "#1B2A4A", textColor: "#FFFFFF", align: i > 1 ? "right" : "left", wrap: true }));
      const nv = (v) => (Math.abs(v) > 0.004 ? n(v) : null);
      const gris = (v) => ({ value: v, fontWeight: "bold", backgroundColor: "#E8ECF2" });
      const totF = (v) => n(v, { fontWeight: "bold", topBorderStyle: "thin" });
      const hBz = [...enc(`Balanza de comprobación — ${mesTxt}`), cabN(["Código", "Cuenta", "Saldo inicial deudor", "Saldo inicial acreedor", "Debe del mes", "Haber del mes", "Saldo final deudor", "Saldo final acreedor"]),
        ...bz.filas.map((x) => [{ value: x.c.codigo }, { value: x.c.nombre }, nv(Math.max(0, x.ini)), nv(Math.max(0, -x.ini)), nv(x.debe), nv(x.haber), nv(Math.max(0, x.fin)), nv(Math.max(0, -x.fin))]),
        [{ value: "" }, { value: "Sumas iguales", fontWeight: "bold", topBorderStyle: "thin" }, ...[bz.t.iniD, bz.t.iniH, bz.t.debe, bz.t.haber, bz.t.finD, bz.t.finH].map(totF)]];
      // Libro diario del mes
      const hDi = [...enc(`Libro diario — ${mesTxt}`), cabN(["Fecha", "Concepto / cuenta", "Código", "Debe", "Haber"]),
        ...delMes.flatMap((a) => [[gris(fechaC(a.fecha)), gris(a.descripcion + (a.clase !== "auto" ? ` (${a.clase})` : "")), gris(null), gris(null), gris(null)],
          ...(a.contab_lineas || []).map((l) => [{ value: "" }, { value: nombreCta(l.cuenta), indent: 1 }, { value: l.cuenta }, nv(Number(l.debe)), nv(Number(l.haber))])]),
        [{ value: "" }, { value: "Sumas iguales", fontWeight: "bold", topBorderStyle: "thin" }, { value: "" }, totF(sumaDebe), totF(sumaHaber)]];
      // Libro mayor: una sección por cuenta con movimientos hasta el mes
      const hMa = [...enc(`Libro mayor hasta ${mesTxt}`), cabN(["Fecha", "Concepto", "Debe", "Haber", "Saldo"])];
      cuentas.forEach((c) => {
        const sg = ["activo", "gasto"].includes(c.tipo) ? 1 : -1; let sd = 0;
        const movs = hasta.flatMap((a) => (a.contab_lineas || []).filter((l) => l.cuenta === c.codigo).map((l) => ({ a, l })));
        if (!movs.length) return;
        hMa.push([gris(`${c.codigo} ${c.nombre}`), gris(null), gris(null), gris(null), gris(null)]);
        movs.forEach(({ a, l }) => { sd += sg * (Number(l.debe) - Number(l.haber)); hMa.push([{ value: fechaC(a.fecha) }, { value: a.descripcion }, nv(Number(l.debe)), nv(Number(l.haber)), n(sd)]); });
        hMa.push([{ value: "" }, { value: "Saldo final", fontWeight: "bold" }, null, null, n(sd, { fontWeight: "bold" })], []);
      });
      // Antigüedad de saldos
      const hoyS = new Date().toISOString().slice(0, 10), finS = `${sel.anio}-${String(sel.mes).padStart(2, "0")}-${String(new Date(sel.anio, sel.mes, 0).getDate()).padStart(2, "0")}`;
      const corteS = finS < hoyS ? finS : hoyS;
      const ant = calcularAntiguedad(data, corteS);
      const hAn = [...enc(`Antigüedad de saldos al ${fechaC(corteS)}`), cabN(["Alumno / cuenta", "Meses", "0–30 días", "31–60 días", "61–90 días", "Más de 90 días", "Total"]),
        [gris("Lo que deben los padres")],
        ...ant.cxc.map((x) => [{ value: x.nombre }, { value: x.meses.length, type: Number }, ...x.tr.map(nv), n(x.total)]),
        [{ value: "Total", fontWeight: "bold", topBorderStyle: "thin" }, { value: "" }, ...ant.tramosCxc.map(totF), totF(ant.totCxc)],
        [], [gris("Lo que debe la escuela")],
        ...ant.cxp.map((x) => [{ value: x.nombre }, { value: x.mes }, ...[0, 1, 2, 3].map((i) => (x.t === i ? n(x.monto) : null)), n(x.monto)]),
        [{ value: "Total", fontWeight: "bold", topBorderStyle: "thin" }, { value: "" }, ...ant.tramosCxp.map(totF), totF(ant.totCxp)]];
      // Hoja 1: Informe financiero (misma estructura que en Reportes), con las cifras contables
      const [{ hojaInforme }, { extraHoja }, { logoParaExcel }] = await Promise.all([import("./informeExcel"), import("./alertasExcel"), import("./alertasFinanzas")]);
      const mesCont = (k) => { const an = Math.floor((k - 1) / 12), me = ((k - 1) % 12) + 1; const ls = lineasDe(asientos.filter((x) => x.anio === an && x.mes === me && x.clase !== "apertura"));
        const mv = (pre) => ls.filter((l) => l.cuenta.startsWith(pre)).reduce((t, l) => t + Number(l.haber) - Number(l.debe), 0); const g = (pre) => -mv(pre);
        const hastaK = asientos.filter((x) => clave(x.anio, x.mes) <= k); const disp = lineasDe(hastaK).filter((l) => l.cuenta === "1.1.01").reduce((t, l) => t + Number(l.debe) - Number(l.haber), 0);
        const dm = ls.filter((l) => l.cuenta === "1.1.01"); const ent = dm.reduce((t, l) => t + Number(l.debe), 0), sal = dm.reduce((t, l) => t + Number(l.haber), 0);
        const r = { mensualidades: mv("4.1.01"), mora: mv("4.1.02"), materiales: mv("4.2.01"), graduacion: mv("4.2.02"), extra: mv("4.3"), costoMat: g("5.1"), costoGrad: 0,
          salarios: g("5.2.01"), renta: g("5.2.02"), servicios: g("5.2.03"), comisiones: g("5.2.04"), otros: g("5.2.05") + g("5.3"), deudas: 0 };
        r.ingresos = r.mensualidades + r.mora + r.materiales + r.graduacion + r.extra; r.costos = r.costoMat + r.costoGrad; r.utilBruta = r.ingresos - r.costos;
        r.gastosOp = r.salarios + r.renta + r.servicios + r.otros; r.utilOp = r.utilBruta - r.gastosOp; r.otrosGastos = r.comisiones; r.neta = r.utilOp - r.otrosGastos;
        const cb = cobranzaDelMes(data.facturas, an, me);
        return { ...r, cajaInicio: disp - ent + sal, entradas: ent, salidas: sal, cajaFin: disp, facturado: cb.facturado, cobrado: cb.pagado, pendiente: cb.pendiente, etq: `${MESES[me - 1].slice(0, 3)} ${String(an).slice(2)}` }; };
      const kIni = clave(ARRANQUE.anio, ARRANQUE.mes), kS = clave(sel.anio, sel.mes);
      const serieC = []; for (let k = Math.max(kIni, kS - 4); k <= kS; k++) serieC.push(mesCont(k));
      const kAnt = kS - 1, antC = kAnt >= kIni ? mesCont(kAnt) : { ...Object.fromEntries(Object.keys(serieC[serieC.length - 1]).map((x) => [x, 0])) };
      const logoX = await logoParaExcel(marcaC.logoSrc);
      const informe = await hojaInforme({ marca: { nombre: marcaC.nombreO("Seeds English School") }, logo: logoX, modulo: "Contabilidad", mesTxt, antTxt: `${MESES[((kAnt - 1) % 12)]} ${Math.floor((kAnt - 1) / 12)}`,
        actual: serieC[serieC.length - 1], anterior: antC, serie: serieC, balance: { caja: saldos["1.1.01"] || 0, porCobrar: totA - (saldos["1.1.01"] || 0), porPagar: totP },
        nota: "Cifras de la contabilidad (partida doble): ingresos cuando se cobran a los padres (facturado) y gastos del mes al que corresponden. La contabilidad arranca en noviembre de 2026, por eso los meses anteriores salen en cero. Cifras en Lempiras." });
      const blob = await writeExcelFile(fuentesExcel([informe, { data: hRes, sheet: "Estado de resultados", columns: cols }, { data: hBal, sheet: "Balance general", columns: cols }, { data: hFlu, sheet: "Flujo de efectivo", columns: cols },
        { data: hBz, sheet: "Balanza de comprobación", columns: [{ width: 10 }, { width: 40 }, ...Array(6).fill({ width: 16 })] },
        { data: hDi, sheet: "Libro diario", columns: [{ width: 12 }, { width: 58 }, { width: 10 }, { width: 16 }, { width: 16 }] },
        { data: hMa, sheet: "Libro mayor", columns: [{ width: 12 }, { width: 58 }, { width: 16 }, { width: 16 }, { width: 16 }] },
        { data: hAn, sheet: "Antigüedad de saldos", columns: [{ width: 40 }, { width: 14 }, ...Array(5).fill({ width: 16 })] }]), { fontFamily: EXCEL_TEXTO, fontSize: 10, features: [extraHoja] }).toBlob();
      if (xls) URL.revokeObjectURL(xls.url);
      setXls({ url: URL.createObjectURL(blob), nombre: `Contabilidad ${mesTxt}.xlsx` });
    } catch (e) { showToast && showToast("No se pudo crear el Excel: " + e.message, "error"); }
  };

  // Hojas de la Vista Excel (las mismas van al Excel y al PDF formales)
  const hRes = { nombre: "Estado de resultados", titulo: `Estado de resultados — ${mesTxt}`, columnas: [{ t: "Concepto" }, { t: "Monto", num: true, ancho: 140 }, { t: "% ingresos", pct: true, ancho: 90 }], filas: [
          { tipo: "sec", c: ["I. Ingresos"] },
          ...ingresos.map((x) => ({ c: [nombreIng(x.c), x.v, pctIng(x.v)] })),
          { tipo: "tot", c: ["Total ingresos", totIng, totIng ? 100 : null], color: VERDE_S },
          { tipo: "sec", c: ["II. Gastos y costos"] },
          ...gastos.map((x) => ({ c: [x.c.nombre, x.v, pctIng(x.v)] })),
          { tipo: "tot", c: ["Total gastos", totGas, pctIng(totGas)], color: ROJO_S },
          { tipo: "gran", c: [resultado >= 0 ? "Ganancia del mes (si todos pagan)" : "Pérdida del mes", resultado, pctIng(resultado)], color: resultado >= 0 ? VERDE_S : ROJO_S },
          ...(cob.facturado > 0 ? [{ tipo: "vacia" }, { tipo: "sec", c: [`Mensualidades de ${mesTxt}: cobrado vs. pagado`] },
            { c: [`Facturado (cobros enviados a ${cob.alumnos} alumnos)`, cob.facturado] },
            { c: [`Pagado (confirmado, ${cob.alumnosPagados} alumnos)`, cob.pagado] },
            { tipo: "tot", c: ["Pendiente de pago", cob.pendiente], color: cob.pendiente > 0 ? ROJO_S : VERDE_S }] : []),
        ], pie: "Cifras en Lempiras." };
  const hBalance = { nombre: "Balance general", titulo: `Balance general al ${new Date(sel.anio, sel.mes, 0).getDate()} de ${mesTxt}`, columnas: [{ t: "Cuenta" }, { t: "Código", ancho: 80 }, { t: "Monto", num: true, ancho: 140 }], filas: [
          { tipo: "sec", c: ["Activos (lo que tengo)"] },
          ...activos.map((x) => ({ c: [x.c.nombre, x.c.codigo, x.v] })),
          { tipo: "tot", c: ["Total activos", "", totA] },
          { tipo: "sec", c: ["Pasivos (lo que debo)"] },
          ...pasivos.map((x) => ({ c: [x.c.nombre, x.c.codigo, x.v] })),
          { tipo: "tot", c: ["Total pasivos", "", totP] },
          { tipo: "sec", c: ["Patrimonio"] },
          ...patrimonio.map((x) => ({ c: [x.c.nombre, x.c.codigo, x.v] })),
          { c: ["Resultados desde noviembre 2026", "", resAcum] },
          { tipo: "tot", c: ["Total patrimonio", "", totPat] },
          { tipo: "gran", c: ["Pasivos + patrimonio", "", totP + totPat] },
          { tipo: "vacia" },
          { c: ["Dinero libre (caja y banco − proveedores y salarios por pagar)", "", dineroLibre], color: dineroLibre >= 0 ? VERDE_S : ROJO_S },
        ] };
  const hFlujo = { nombre: "Flujo de efectivo", titulo: `Flujo de efectivo — ${mesTxt}`, columnas: [{ t: "Concepto" }, { t: "Fecha", ancho: 90 }, { t: "Monto", num: true, ancho: 140 }], filas: [
          { c: ["Efectivo y bancos al iniciar el mes", "", dispIniFlujo] },
          { tipo: "sec", c: ["Entradas de dinero"] },
          ...flujo.ent.flatMap((c) => [{ c: [c.k, "", c.v] }, ...c.items.map((i) => ({ tipo: "det", c: [i.d, fechaC(i.f), i.v] }))]),
          { tipo: "tot", c: ["Total entradas", "", totEnt], color: VERDE_S },
          { tipo: "sec", c: ["Salidas de dinero"] },
          ...flujo.sal.flatMap((c) => [{ c: [c.k, "", c.v] }, ...c.items.map((i) => ({ tipo: "det", c: [i.d, fechaC(i.f), i.v] }))]),
          { tipo: "tot", c: ["Total salidas", "", totSal], color: ROJO_S },
          { tipo: "gran", c: ["Efectivo y bancos al cierre", "", dispFinal] },
        ] };
  const hDiario = { nombre: "Libro diario", titulo: `Libro diario — ${mesTxt}`, columnas: [{ t: "Fecha", ancho: 82 }, { t: "Concepto / cuenta" }, { t: "Código", ancho: 72 }, { t: "Debe", num: true, ancho: 120 }, { t: "Haber", num: true, ancho: 120 }], filas: [
          ...delMes.flatMap((a) => [{ tipo: "sec", c: [fechaC(a.fecha), a.descripcion + (a.clase !== "auto" ? ` (${a.clase})` : "")] },
            ...(a.contab_lineas || []).map((l) => ({ tipo: "it", c: ["", nombreCta(l.cuenta), l.cuenta, Number(l.debe) || "", Number(l.haber) || ""] }))]),
          { tipo: "gran", c: ["", "Sumas iguales", "", sumaDebe, sumaHaber], color: Math.abs(sumaDebe - sumaHaber) < 0.01 ? undefined : ROJO_S },
        ], pie: "Debe = lo que entra o aumenta en esa cuenta. Haber = lo que sale o disminuye. Las dos sumas siempre deben ser iguales.", sangria: false };
  const reporteTab = { resultados: hRes, balance: hBalance, flujo: hFlujo, diario: hDiario }[tab];
  const reporteDe = (h) => h && { titulo: h.nombre, periodo: mesTxt, modulo: "Contabilidad", hojas: [h], firmas: true };
  const Pest = ({ id, txt }) => <button onClick={() => setTab(id)} style={{ ...btnO, background: tab === id ? "#1E293B" : btnO.background, color: tab === id ? "#fff" : btnO.color, fontWeight: 700 }}>{txt}</button>;

  if (sinModulo) return <div style={card}><h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Falta activar la contabilidad</h3><p style={{ fontSize: 13, color: GRIS }}>Hay que correr <code>supabase/contabilidad.sql</code> en Supabase (SQL Editor). Solo crea tablas nuevas; no cambia nada de lo que ya existe.</p></div>;

  return (<div>
    <EstilosVistas />
    {tab === "resultados" && <div style={{ ...card, display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(239,246,255,.75)" }}>
      <Info size={18} color={AZUL} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 12.5, color: "#1E3A8A", lineHeight: 1.5 }}>
        <b>Contabilidad</b> registra lo que pasó, en partida doble, y se llena sola con los cobros, pagos y gastos que ya registras. Las correcciones se hacen con asientos de ajuste, nunca borrando lo automático.
        Empieza el 1 de noviembre de 2026; julio a octubre quedan como historial. Un mes cerrado ya no cambia.
      </div>
    </div>}

    <div style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div><label style={label}>Mes</label>
        <select value={`${sel.anio}-${sel.mes}`} onChange={(e) => { const [a, m] = e.target.value.split("-").map(Number); setSel({ anio: a, mes: m }); }} style={{ ...input, width: "auto", cursor: "pointer" }}>
          {meses.map((m) => { const p = periodos.find((x) => x.anio === m.anio && x.mes === m.mes); return <option key={`${m.anio}-${m.mes}`} value={`${m.anio}-${m.mes}`}>{MESES[m.mes - 1]} {m.anio}{p?.estado === "cerrado" ? " (cerrado)" : ""}</option>; })}
        </select></div>
      <span style={badge(cerrado ? GRIS : VERDE)}>{cerrado ? <><Lock size={11} /> Cerrado</> : "Abierto"}</span>
      {!cerrado && <button onClick={() => generar(true)} disabled={trabajando} style={{ ...btnO, opacity: trabajando ? 0.6 : 1 }}><RefreshCw size={14} />{trabajando ? "Actualizando…" : "Actualizar asientos"}</button>}
      {!hayApertura && <span style={{ ...badge(ROJO) }}>Falta el asiento de apertura</span>}
      {CON_VISTAS.includes(tab) && <><span style={{ flex: 1 }} /><SelectorVista vista={vista} setVista={setVista} /></>}
      {!cargando && reporteTab && <BarraDescargas reporte={() => reporteDe(reporteTab)} showToast={showToast} />}
      {!cargando && CON_VISTAS.includes(tab) && <button onClick={descargarExcel} style={btnO} title="Un solo Excel con estados, balanza, libros y antigüedad"><Download size={14} />Libro completo del mes</button>}
      {xls && <a href={xls.url} download={xls.nombre} onClick={() => setTimeout(() => setXls(null), 500)} style={{ ...btn("#15803D"), textDecoration: "none" }}><Download size={14} />Guardar {xls.nombre}</a>}
    </div>

    {!tabFijo && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
      <Pest id="resultados" txt="Estado de resultados" /><Pest id="balance" txt="Balance general" /><Pest id="flujo" txt="Flujo de efectivo" />
      <Pest id="diario" txt="Libro diario" /><Pest id="mayor" txt="Libro mayor" /><Pest id="balanza" txt="Balanza de comprobación" /><Pest id="antiguedad" txt="Antigüedad de saldos" /><Pest id="ajustes" txt="Asientos de ajuste" /><Pest id="cierre" txt="Cierre de mes" /><Pest id="apertura" txt="Apertura" /><Pest id="catalogo" txt="Catálogo" />
    </div>}

    {cargando ? <div style={card}><p style={{ fontSize: 13, color: GRIS }}>Cargando…</p></div> : <>
      {tab === "resultados" && <div style={card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Estado de resultados — {mesTxt}</h3>
        <p style={{ fontSize: 11.5, color: GRIS, margin: "0 0 14px" }}>Lo que se le <b>cobró</b> a los padres y lo gastado <b>del mes</b>, aunque se pague en otro mes. Cobrar no es lo mismo que recibir el dinero.</p>
        {vista === "sencilla" ? <>
          {totIng === 0 && totGas === 0 ? <Titular>Todavía no hay movimientos en {MESES[sel.mes - 1]}.</Titular> :
            <Titular sub={cob.facturado > 0 && <>Se les cobró a los padres {Lc(cob.facturado)}: ya pagaron {Lc(cob.pagado)}{cob.adelantado > 0 ? <> ({Lc(cob.adelantado)} por adelantado)</> : null} y faltan {Lc(cob.pendiente)}. El dinero que de verdad entró está en Flujo de efectivo.</>}>
              {resultado >= 0 ? <>En {MESES[sel.mes - 1]}, si todos pagan, a la escuela le quedan <span style={{ color: VERDE_S }}>{Lc(resultado)}</span> de ganancia.</> : <>En {MESES[sel.mes - 1]} la escuela gastó <span style={{ color: ROJO_S }}>{Lc(Math.abs(resultado))} más</span> de lo que cobró.</>}
            </Titular>}
          <Kpis items={[
            { t: "Lo que le tocó a la escuela", v: Lc(totIng), color: VERDE_S, s: "Mensualidades, materiales y otros ingresos del mes" },
            { t: "Lo que se gastó", v: Lc(totGas), color: NARANJA, s: "Salarios, renta, servicios y compras del mes" },
            { t: resultado >= 0 ? "Lo que quedó (ganancia)" : "Lo que faltó (pérdida)", v: Lc(resultado), color: resultado >= 0 ? VERDE_S : ROJO_S, dest: true, s: totIng > 0 ? `L ${Math.round(resultado / totIng * 100)} de cada L 100` : "" },
          ]} />
          {cob.facturado > 0 && <Kpis items={[
            { t: "Cobrado a padres (facturado)", v: Lc(cob.facturado), borde: AZUL_M, s: `${cob.alumnos} alumnos` },
            { t: "Ya pagaron", v: Lc(cob.pagado), color: VERDE_S, borde: VERDE_S, s: `${cob.alumnosPagados} alumnos` },
            { t: "Falta que paguen", v: Lc(cob.pendiente), color: cob.pendiente > 0 ? ROJO_S : VERDE_S, borde: cob.pendiente > 0 ? ROJO_S : VERDE_S, s: `${cob.alumnos - cob.alumnosPagados} alumnos` },
          ]} />}
          {(totIng > 0 || totGas > 0) && <Comparar filas={[{ t: "Le tocó", v: totIng, color: VERDE_S }, { t: "Se gastó", v: totGas, color: NARANJA }]} />}
          <div className="vn-dos">
            <Desglose titulo="¿De dónde vino?" color={VERDE_S} items={ingresos.map((x) => ({ t: nombreIng(x.c), v: x.v, d: x.c.codigo === "4.1.01" && cob.facturado > 0 ? `Pagado ${Lc(cob.pagado)} · Pendiente ${Lc(cob.pendiente)}` : x.c.descripcion }))} vacio="No hay ingresos este mes." />
            <Desglose titulo="¿En qué se gastó?" color={NARANJA} items={gastos.map((x) => ({ t: x.c.nombre, v: x.v, d: x.c.descripcion }))} vacio="No hay gastos este mes." />
          </div>
        </> : <Hoja {...hRes} />}
        {!data.cuentas_por_pagar?.some((c) => c.tipo === "renta" && MESES.indexOf(c.mes_correspondiente) + 1 === sel.mes && (Number(c.anio_correspondiente) || sel.anio) === sel.anio) && !gastos.some((x) => x.c.codigo === "5.2.02") &&
          <div style={{ marginTop: 12, fontSize: 12, color: "#92400E", background: "#FEF3C7", padding: "8px 10px", borderRadius: 4, display: "flex", gap: 6 }}><AlertTriangle size={14} style={{ flexShrink: 0 }} />La renta de {MESES[sel.mes - 1]} todavía no está registrada. Regístrala en Finanzas → Cuentas por pagar con mes {MESES[sel.mes - 1]} (aunque se pague el mes siguiente), para que este resultado sea real.</div>}
      </div>}

      {tab === "balance" && <div style={card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Balance general al {new Date(sel.anio, sel.mes, 0).getDate()} de {mesTxt}</h3>
        <p style={{ fontSize: 11.5, color: GRIS, margin: "0 0 14px" }}>Lo que la escuela tiene, lo que debe y lo que es de la propietaria.</p>
        {vista === "sencilla" ? <>
          <Titular sub="Es como una foto del último día del mes.">La escuela tiene {Lc(totA)} y debe {Lc(totP)}. Lo que de verdad es suyo: <span style={{ color: totPat >= 0 ? VERDE_S : ROJO_S }}>{Lc(totPat)}</span>.</Titular>
          <Kpis items={[
            { t: "Lo que tiene", v: Lc(totA), color: AZUL_M, s: "Dinero, lo que le deben y otras cosas" },
            { t: "Lo que debe", v: Lc(totP), color: NARANJA, s: "Proveedores, salarios, préstamos y fondos" },
            { t: "Lo que es de la escuela", v: Lc(totPat), color: totPat >= 0 ? VERDE_S : ROJO_S, dest: true, s: "Lo que tiene menos lo que debe" },
            { t: "Dinero libre", v: Lc(dineroLibre), color: dineroLibre >= 0 ? VERDE_S : ROJO_S, s: dineroLibre >= 0 ? "Caja y banco menos lo que se debe pagar pronto" : "Negativo: ese dinero ya tiene dueño" },
          ]} />
          <Comparar filas={[{ t: "Tiene", v: totA, color: AZUL_M }, { t: "Debe", v: totP, color: NARANJA }]} />
          <div className="vn-dos">
            <Desglose titulo="¿Qué tiene?" color={AZUL_M} items={activos.map((x) => ({ t: x.c.nombre, v: x.v, d: x.c.descripcion }))} vacio="Nada registrado." />
            <Desglose titulo="¿Qué debe?" color={NARANJA} items={pasivos.map((x) => ({ t: x.c.nombre, v: x.v, d: x.c.descripcion }))} vacio="No debe nada. 🎉" />
          </div>
        </> : <Hoja {...hBalance} />}
        <div style={{ marginTop: 12, fontSize: 12, display: "flex", gap: 6, alignItems: "center", color: Math.abs(totA - totP - totPat) < 0.01 ? VERDE : ROJO }}>
          {Math.abs(totA - totP - totPat) < 0.01 ? <><CheckCircle size={14} />Cuadra: lo que tiene = lo que debe + lo que es de la escuela.</> : <><AlertTriangle size={14} />No cuadra por {L(totA - totP - totPat)}.</>}
        </div>
      </div>}

      {tab === "flujo" && <div style={card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Flujo de efectivo — {mesTxt}</h3>
        <p style={{ fontSize: 11.5, color: GRIS, margin: "0 0 14px" }}>El dinero de verdad: lo que entró y salió de caja y banco, por la fecha real.</p>
        {vista === "sencilla" ? <>
          <Titular sub={<>Empezó el mes con {Lc(dispIniFlujo)}. Esto es el dinero real, que no siempre es igual a la ganancia.</>}>En {MESES[sel.mes - 1]} entraron <span style={{ color: VERDE_S }}>{Lc(totEnt)}</span> y salieron <span style={{ color: NARANJA }}>{Lc(Math.abs(totSal))}</span>. Al final quedaron {Lc(dispFinal)} en caja y banco.</Titular>
          <Kpis items={[
            { t: "Había al empezar", v: Lc(dispIniFlujo), color: AZUL_M },
            { t: "Entró", v: Lc(totEnt), color: VERDE_S, s: `${flujo.ent.reduce((t, c) => t + c.items.length, 0)} movimientos` },
            { t: "Salió", v: Lc(Math.abs(totSal)), color: NARANJA, s: `${flujo.sal.reduce((t, c) => t + c.items.length, 0)} movimientos` },
            { t: "Hay al cierre", v: Lc(dispFinal), color: dispFinal >= 0 ? VERDE_S : ROJO_S, dest: true, s: "Efectivo + banco" },
          ]} />
          {(totEnt > 0 || totSal < 0) && <Comparar filas={[{ t: "Entró", v: totEnt, color: VERDE_S }, { t: "Salió", v: Math.abs(totSal), color: NARANJA }]} />}
          <div className="vn-dos">
            <Desglose titulo="¿De dónde entró?" color={VERDE_S} abierto={abiertoFlujo} toggle={(k) => setAbiertoFlujo((p) => ({ ...p, [k]: !p[k] }))} items={flujo.ent.map((c) => ({ t: c.k, v: c.v, d: `${c.items.length} ${c.items.length === 1 ? "movimiento" : "movimientos"} · toca para ver`, sub: c.items.map((i) => ({ t: `${fechaC(i.f)} · ${i.d}`, v: i.v })) }))} vacio="No entró dinero este mes." />
            <Desglose titulo="¿En qué salió?" color={NARANJA} abierto={abiertoFlujo} toggle={(k) => setAbiertoFlujo((p) => ({ ...p, [k]: !p[k] }))} items={flujo.sal.map((c) => ({ t: c.k, v: c.v, d: `${c.items.length} ${c.items.length === 1 ? "movimiento" : "movimientos"} · toca para ver`, sub: c.items.map((i) => ({ t: `${fechaC(i.f)} · ${i.d}`, v: i.v })) }))} vacio="No salió dinero este mes." />
          </div>
        </> : <Hoja {...hFlujo} />}
        <p style={{ fontSize: 11.5, color: GRIS, marginTop: 10, lineHeight: 1.5 }}>Los pagos de salarios, renta o deudas de meses anteriores aparecen aquí como salidas de este mes, aunque no bajan la ganancia del mes (ya se contaron en el mes que corresponden).</p>
      </div>}

      {tab === "diario" && <div style={card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Libro diario — {mesTxt}</h3>
        <p style={{ fontSize: 11.5, color: GRIS, margin: "0 0 14px" }}>Todo lo que se anotó en el mes, en orden de fecha. Se llena solo con los cobros, pagos y gastos.</p>
        {vista === "sencilla" ? <>
          <Kpis items={[
            { t: "Anotaciones del mes", v: String(delMes.length), color: AZUL_M },
            { t: "Con entrada de dinero", v: String(diarioS.filter((m) => m.tipo === "ent").length), color: VERDE_S, s: Lc(diarioS.filter((m) => m.tipo === "ent").reduce((s, m) => s + m.v, 0)) },
            { t: "Con salida de dinero", v: String(diarioS.filter((m) => m.tipo === "sal").length), color: NARANJA, s: Lc(Math.abs(diarioS.filter((m) => m.tipo === "sal").reduce((s, m) => s + m.v, 0))) },
            { t: "Sin mover dinero", v: String(diarioS.filter((m) => m.tipo === "otro").length), color: GRIS, s: "Apertura, cobros enviados, deudas registradas…" },
          ]} />
          <div className="vn-caja"><Movimientos items={diarioS} vacio="No hay anotaciones este mes." /></div>
        </> : <Hoja minWidth={640} sangria={false} {...hDiario} />}
      </div>}

      {tab === "balanza" && <Balanza cuentas={cuentas} asientos={asientos} sel={sel} vista={vista} />}
      {tab === "antiguedad" && <Antiguedad data={data} sel={sel} vista={vista} />}
      {tab === "ajustes" && <Ajustes cuentas={cuentas} asientos={asientos} sel={sel} cerrado={cerrado} nombreCta={nombreCta} recargar={cargar} showToast={showToast} vista={vista} />}
      {tab === "mayor" && <Mayor cuentas={cuentas} asientos={hasta} nombreCta={nombreCta} tipoCta={tipoCta} sel={sel} vista={vista} />}
      {tab === "cierre" && <Cierre sel={sel} periodo={periodo} saldoDisp={saldos["1.1.01"] || 0} hayApertura={hayApertura} recargar={cargar} showToast={showToast} resultado={resultado} vista={vista} />}
      {tab === "apertura" && <Apertura data={data} asientos={asientos} recargar={cargar} showToast={showToast} periodos={periodos} />}
      {tab === "catalogo" && <div style={card}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Catálogo de cuentas</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th style={th}>Código</th><th style={th}>Cuenta</th><th style={th}>Tipo</th><th style={th}>Para qué</th></tr></thead>
          <tbody>{cuentas.map((c) => <tr key={c.codigo}><td style={td}>{c.codigo}</td><td style={{ ...td, fontWeight: 600 }}>{c.nombre}</td><td style={td}>{c.tipo}</td><td style={{ ...td, color: GRIS }}>{c.descripcion || ""}</td></tr>)}</tbody></table>
      </div>}
    </>}
  </div>);
}

function Mayor({ cuentas, asientos, nombreCta, tipoCta, sel, vista }) {
  const [cta, setCta] = useState("1.1.01");
  const signo = ["activo", "gasto"].includes(tipoCta(cta)) ? 1 : -1;
  // Cada movimiento con su saldo acumulado
  let saldo = 0;
  const filas = asientos.flatMap((a) => (a.contab_lineas || []).filter((l) => l.cuenta === cta).map((l) => ({ a, l })))
    .map(({ a, l }) => { const v = signo * (Number(l.debe) - Number(l.haber)); saldo += v; return { a, l, v, saldo }; });
  const sube = filas.filter((f) => f.v > 0).reduce((t, f) => t + f.v, 0), baja = filas.filter((f) => f.v < 0).reduce((t, f) => t + f.v, 0);
  const sumD = filas.reduce((t, f) => t + Number(f.l.debe), 0), sumH = filas.reduce((t, f) => t + Number(f.l.haber), 0);
  const nombre = nombreCta(cta);
  const hMayor = { nombre: "Libro mayor", titulo: `Libro mayor: ${cta} ${nombre} hasta ${MESES[sel.mes - 1]} ${sel.anio}`, columnas: [{ t: "Fecha", ancho: 82 }, { t: "Concepto" }, { t: "Debe", num: true, ancho: 115 }, { t: "Haber", num: true, ancho: 115 }, { t: "Saldo", num: true, ancho: 120 }], filas: [
      { tipo: "sec", c: ["", `${cta} ${nombre}`] },
      ...(filas.length === 0 ? [{ c: ["", `Sin movimientos en ${nombre}`] }] : filas.map((f) => ({ c: [fechaC(f.a.fecha), f.a.descripcion, Number(f.l.debe) || "", Number(f.l.haber) || "", f.saldo] }))),
      { tipo: "gran", c: ["", "Totales y saldo final", sumD, sumH, saldo] },
    ], sangria: false };
  return (<div style={card}>
    <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 4 }}>
      <h3 style={{ margin: 0, fontSize: 15 }}>Libro mayor hasta {MESES[sel.mes - 1]} {sel.anio}</h3>
      <span style={{ flex: 1 }} /><BarraDescargas compacto reporte={() => ({ titulo: `Libro mayor ${cta}`, periodo: `${MESES[sel.mes - 1]} ${sel.anio}`, modulo: "Contabilidad", hojas: [hMayor], firmas: true })} />
      <select value={cta} onChange={(e) => setCta(e.target.value)} style={{ ...input, width: "auto", maxWidth: "100%", cursor: "pointer" }}>{cuentas.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} {c.nombre}</option>)}</select>
    </div>
    <p style={{ fontSize: 11.5, color: GRIS, margin: "0 0 14px" }}>Todos los movimientos de una sola cuenta y cuánto queda en ella después de cada uno.</p>
    {vista === "sencilla" ? <>
      <Titular sub={`${filas.length} ${filas.length === 1 ? "movimiento" : "movimientos"} desde noviembre de 2026.`}>{nombre}: quedan <span style={{ color: saldo >= 0 ? AZUL_M : ROJO_S }}>{Lc(saldo)}</span> al cierre de {MESES[sel.mes - 1]}.</Titular>
      <Kpis items={[
        { t: "Subió", v: Lc(sube), color: VERDE_S, s: "Suma de lo que aumentó" },
        { t: "Bajó", v: Lc(Math.abs(baja)), color: NARANJA, s: "Suma de lo que disminuyó" },
        { t: "Queda", v: Lc(saldo), color: saldo >= 0 ? AZUL_M : ROJO_S, dest: true, s: "Saldo de la cuenta" },
      ]} />
      <div className="vn-caja"><Movimientos vacio={`Sin movimientos en ${nombre}.`} items={[...filas].reverse().map((f) => ({ k: f.l.id, fecha: f.a.fecha, t: f.a.descripcion, s: `Después quedó ${L(f.saldo)}`, v: f.v, signo: true, color: f.v >= 0 ? VERDE_S : NARANJA }))} /></div>
    </> : <Hoja minWidth={620} sangria={false} {...hMayor} />}
  </div>);
}

function Cierre({ sel, periodo, saldoDisp, hayApertura, recargar, showToast, resultado, vista }) {
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const cerrado = periodo?.estado === "cerrado";
  const dif = contado === "" ? null : Math.round((parseFloat(contado) - saldoDisp) * 100) / 100;
  const cerrar = async () => {
    if (!hayApertura) { showToast("Primero registra el asiento de apertura", "error"); return; }
    if (contado === "" || isNaN(parseFloat(contado))) { showToast("Escribe cuánto dinero hay realmente (efectivo + banco)", "error"); return; }
    if (dif !== 0 && !notas.trim()) { showToast("Hay diferencia: explica en las notas qué pasó", "error"); return; }
    if (!confirm(`¿Cerrar ${MESES[sel.mes - 1]} ${sel.anio}? Después ya no se podrá modificar.`)) return;
    const { error } = await supabase.rpc("contab_cerrar", { p_anio: sel.anio, p_mes: sel.mes, p_dinero: parseFloat(contado), p_notas: notas.trim() || null });
    if (error) { showToast("Error: " + error.message, "error"); return; }
    await recargar(); showToast(`✓ ${MESES[sel.mes - 1]} cerrado`);
  };
  const reabrir = async () => {
    if (!confirm(`¿Reabrir ${MESES[sel.mes - 1]} ${sel.anio}? Úsalo solo para corregir un error.`)) return;
    const { error } = await supabase.rpc("contab_reabrir", { p_anio: sel.anio, p_mes: sel.mes });
    if (error) { showToast("Error: " + error.message, "error"); return; }
    await recargar(); showToast("Mes reabierto");
  };
  // Resumen del cierre en las dos vistas
  const real = cerrado ? Number(periodo.dinero_contado) : contado === "" ? null : parseFloat(contado);
  const difR = real === null || isNaN(real) ? null : Math.round((real - saldoDisp) * 100) / 100;
  const hCierre = { nombre: "Cierre de mes", titulo: `Cierre de ${MESES[sel.mes - 1]} ${sel.anio}`, columnas: [{ t: "Concepto" }, { t: "Monto", num: true, ancho: 140 }], filas: [
    { c: ["Dinero según la contabilidad (caja + banco)", saldoDisp] },
    { c: ["Dinero contado", real === null || isNaN(real) ? "" : real] },
    { tipo: "tot", c: ["Diferencia (contado − contabilidad)", difR === null ? "" : difR], color: difR === null ? undefined : difR === 0 ? VERDE_S : ROJO_S },
    { tipo: "vacia" },
    { tipo: "gran", c: [resultado >= 0 ? "Ganancia del mes" : "Pérdida del mes", resultado], color: resultado >= 0 ? VERDE_S : ROJO_S },
  ] };
  const descCierre = <BarraDescargas compacto reporte={() => ({ titulo: "Cierre de mes", periodo: `${MESES[sel.mes - 1]} ${sel.anio}`, modulo: "Contabilidad", hojas: [{ ...hCierre, pie: periodo?.notas ? `Notas: ${periodo.notas}` : undefined }], firmas: true })} />;
  const resumen = vista === "sencilla" ? <Kpis items={[
    { t: "Según la contabilidad", v: Lc(saldoDisp), color: AZUL_M, s: "Caja + banco que debería haber" },
    { t: "Dinero contado", v: real === null || isNaN(real) ? "—" : Lc(real), color: AZUL_M, s: cerrado ? "Lo que se contó al cerrar" : "Escríbelo abajo" },
    { t: "Diferencia", v: difR === null ? "—" : Lc(difR), color: difR === null ? GRIS : difR === 0 ? VERDE_S : ROJO_S, dest: true, s: difR === null ? "" : difR === 0 ? "Todo cuadra" : difR > 0 ? "Sobra dinero" : "Falta dinero" },
    { t: resultado >= 0 ? "Ganancia del mes" : "Pérdida del mes", v: Lc(resultado), color: resultado >= 0 ? VERDE_S : ROJO_S },
  ]} /> : <div style={{ marginBottom: 14 }}><Hoja minWidth={420} {...hCierre} /></div>;
  if (cerrado) return (<div style={card}>
    <h3 style={{ margin: "0 0 8px", fontSize: 15, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><Lock size={16} />{MESES[sel.mes - 1]} {sel.anio} está cerrado<span style={{ flex: 1 }} />{descCierre}</h3>
    {resumen}
    <p style={{ fontSize: 13, color: GRIS }}>Cerrado el {new Date(periodo.cerrado_en).toLocaleString("es-HN")} por {periodo.cerrado_por || "—"}. Dinero contado: {L(periodo.dinero_contado)}.{periodo.notas ? ` Notas: ${periodo.notas}` : ""}</p>
    <p style={{ fontSize: 12, color: GRIS }}>Si aparece algo de este mes después del cierre, se registra en el mes abierto. Solo reabre para corregir un error.</p>
    <button onClick={reabrir} style={btnO}><Unlock size={14} />Reabrir mes</button>
  </div>);
  const paso = (ok, txt) => <li style={{ fontSize: 13, margin: "6px 0", color: ok ? VERDE : "#334155" }}>{ok ? "✓ " : "○ "}{txt}</li>;
  return (<div style={card}>
    <h3 style={{ margin: "0 0 10px", fontSize: 15, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>Cierre de {MESES[sel.mes - 1]} {sel.anio}<span style={{ flex: 1 }} />{descCierre}</h3>
    {resumen}
    <ol style={{ paddingLeft: 18, margin: "0 0 14px" }}>
      {paso(hayApertura, "Asiento de apertura registrado (pestaña Apertura).")}
      {paso(false, `Registrar lo que se debe del mes aunque no esté pagado: renta, luz, internet, salarios (Finanzas → Cuentas por pagar, mes ${MESES[sel.mes - 1]}).`)}
      {paso(false, "Contar el efectivo y revisar el saldo del banco; escribir la suma abajo.")}
      {paso(dif === 0, "Si hay diferencia, buscarla. Si no aparece, registrarla en Finanzas → Cerrar mes (ajuste de caja) y explicarla en las notas.")}
      {paso(false, "Revisar el estado de resultados y el balance, y cerrar.")}
    </ol>
    <div style={{ display: "grid", gridTemplateColumns: window.innerWidth > 700 ? "1fr 1fr" : "1fr", gap: 12 }}>
      <div><label style={label}>Dinero real hoy (efectivo + banco)</label><input type="number" value={contado} onChange={(e) => setContado(e.target.value)} style={input} />
        <div style={{ fontSize: 12, marginTop: 4, color: GRIS }}>Según la contabilidad: <b>{L(saldoDisp)}</b>{dif !== null && <> · Diferencia: <b style={{ color: dif === 0 ? VERDE : ROJO }}>{L(dif)}</b></>}</div></div>
      <div><label style={label}>Notas del cierre</label><input value={notas} onChange={(e) => setNotas(e.target.value)} style={input} placeholder="Ej. faltan L 50 de vuelto" /></div>
    </div>
    <div style={{ marginTop: 10, fontSize: 12.5 }}>Resultado del mes: <b style={{ color: resultado >= 0 ? VERDE : ROJO }}>{L(resultado)}</b></div>
    <button onClick={cerrar} style={{ ...btn("#1E293B"), marginTop: 14 }}><Lock size={14} />Cerrar {MESES[sel.mes - 1]}</button>
  </div>);
}

function Apertura({ data, asientos, recargar, showToast, periodos }) {
  const sug = useMemo(() => saldosSugeridos(data), [data]);
  const actual = asientos.find((a) => a.clase === "apertura");
  const deActual = (cta, lado) => { const l = (actual?.contab_lineas || []).find((x) => x.cuenta === cta); return l ? String(Number(l[lado])) : ""; };
  const [f, setF] = useState(() => ({
    disp: deActual("1.1.01", "debe"),
    cxc: deActual("1.2.01", "debe") || String(sug.cxc),
    cxp: deActual("2.1.01", "haber") || String(sug.cxp),
    sal: deActual("2.1.02", "haber") || String(sug.sal),
    prest: deActual("2.2.01", "haber"),
    deuda: deActual("2.2.02", "haber"),
    fondo: deActual("2.3.01", "haber") || String(sug.fondo),
  }));
  const n = (k) => parseFloat(f[k]) || 0;
  const activos = n("disp") + n("cxc"), pasivos = n("cxp") + n("sal") + n("prest") + n("deuda") + n("fondo");
  const capital = activos - pasivos;
  const novCerrado = periodos.some((p) => p.anio === 2026 && p.mes === 11 && p.estado === "cerrado");
  const guardar = async () => {
    if (f.disp === "") { showToast("Escribe cuánto dinero había al 31 de octubre", "error"); return; }
    const lineas = [["1.1.01", n("disp"), 0], ["1.2.01", n("cxc"), 0], ["2.1.01", 0, n("cxp")], ["2.1.02", 0, n("sal")], ["2.2.01", 0, n("prest")], ["2.2.02", 0, n("deuda")], ["2.3.01", 0, n("fondo")],
      capital >= 0 ? ["3.1.01", 0, capital] : ["3.1.01", -capital, 0]];
    const { error } = await supabase.rpc("contab_registrar", { p_fecha: "2026-11-01", p_descripcion: "Saldos de apertura al 31 de octubre de 2026", p_clase: "apertura", p_lineas: lineas });
    if (error) { showToast("Error: " + error.message, "error"); return; }
    await recargar(); showToast("✓ Apertura guardada");
  };
  const campo = (k, t, ayuda) => <div><label style={label}>{t}</label><input type="number" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} style={input} disabled={novCerrado} />{ayuda && <div style={{ fontSize: 10.5, color: GRIS, marginTop: 3 }}>{ayuda}</div>}</div>;
  return (<div style={card}>
    <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Saldos de apertura (31 de octubre de 2026)</h3>
    <p style={{ fontSize: 12, color: GRIS, margin: "0 0 14px" }}>Es la foto de lo que la escuela tenía y debía al terminar octubre. Los valores sugeridos salen de tus registros; corrígelos si sabes el dato real.</p>
    <div style={{ display: "grid", gridTemplateColumns: window.innerWidth > 700 ? "1fr 1fr" : "1fr", gap: 12 }}>
      {campo("disp", "Efectivo y bancos (dinero real contado)", "Obligatorio: lo que había en caja y en el banco.")}
      {campo("cxc", "Lo que debían los padres (julio a octubre)", `Sugerido ${L(sug.cxc)}: mensualidades de julio a octubre sin pagar al 31/10, sin repetidos, menos pagos adelantados de noviembre en adelante.`)}
      {campo("cxp", "Proveedores y servicios por pagar", `Sugerido ${L(sug.cxp)}: cuentas por pagar de octubre o antes.`)}
      {campo("sal", "Salarios por pagar", `Sugerido ${L(sug.sal)}.`)}
      {campo("prest", "Lo que se le debe a la propietaria (sueldos atrasados o préstamo)", "Al pagártelo, regístralo en Gastos como «Pago de deuda» con tu nombre en la descripción: baja esta deuda y no cuenta como gasto.")}
      {campo("deuda", "Otras deudas anteriores", "Si queda algo de la deuda de antes de julio.")}
      {campo("fondo", "Fondo de graduación sin gastar", `Sugerido ${L(sug.fondo)}: cobrado menos gastado. Pon 0 si el evento ya pasó y el sobrante es de la escuela.`)}
    </div>
    <div style={{ marginTop: 14, fontSize: 13, background: "#F8FAFC", padding: "10px 12px", borderRadius: 12 }}>
      Activos {L(activos)} − Pasivos {L(pasivos)} = <b>Capital {L(capital)}</b> (lo que es de la escuela/propietaria al arrancar).
    </div>
    {novCerrado ? <p style={{ fontSize: 12, color: GRIS }}>Noviembre ya está cerrado; la apertura no se puede cambiar.</p> :
      <button onClick={guardar} style={{ ...btn(AZUL), marginTop: 14 }}><BookOpen size={14} />{actual ? "Actualizar apertura" : "Guardar apertura"}</button>}
  </div>);
}
