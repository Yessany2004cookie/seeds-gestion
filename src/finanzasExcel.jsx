// ════════════════════════════════════════════════════════════
//  FINANZAS EN VISTA EXCEL
//  Las mismas cifras de Finanzas → Gastos, deudas y caja e Ingresos extra,
//  en cuadrícula tipo hoja de cálculo, con botón para descargar el Excel.
//  Solo presentación: no guarda ni cambia nada.
// ════════════════════════════════════════════════════════════
import { card } from "./estilo";
import { BarraDescargas } from "./documentoFormal";
import { Hoja, VERDE, ROJO } from "./vistas";

const fechaC = (f) => String(f || "").split("-").reverse().join("/");
const TIPO = { salario: "Salario", renta: "Renta", deuda: "Pago de deuda", comision: "Comisión bancaria", otro: "Otro gasto" };

// Botones Excel y PDF formales (encabezado y logo de la escuela)
export const reporteFinanzas = (titulo, hojas, periodo) => ({ titulo, periodo, modulo: "Finanzas", hojas: hojas.map((h) => ({ ...h, nombre: h.sheet })) });
export const DescargasFinanzas = ({ titulo, hojas, showToast }) => <BarraDescargas compacto showToast={showToast} reporte={() => reporteFinanzas(titulo, hojas())} />;

// ── Resumen: lo que queda hoy, deuda anterior y caja de cada mes ──
export function hojasResumen({ cajaHoy, rentasPend, cxp, quedaHoy, deuda, meses }) {
  const h1 = { sheet: "Lo que queda hoy", titulo: "Lo que realmente queda hoy", columnas: [{ t: "Concepto" }, { t: "Mes", ancho: 110 }, { t: "Monto", num: true, ancho: 130 }], filas: [
    { c: ["Dinero en caja hoy", "", cajaHoy] },
    { tipo: "sec", c: ["(−) Lo que falta pagar"] },
    ...rentasPend.map((x) => ({ c: ["Renta por pagar", x.mes, -x.monto] })),
    ...cxp.map((c) => ({ c: [c.descripcion, c.mes_correspondiente || "", -(Number(c.monto) || 0)] })),
    ...(rentasPend.length + cxp.length === 0 ? [{ c: ["No hay nada pendiente", "", ""] }] : []),
    { tipo: "gran", c: [quedaHoy >= 0 ? "Queda libre" : "Faltante", "", quedaHoy], color: quedaHoy >= 0 ? VERDE : ROJO },
  ] };
  const h2 = deuda ? { sheet: "Deuda anterior", titulo: "Deuda que venía de antes", columnas: [{ t: "Concepto" }, { t: "Monto", num: true, ancho: 130 }], filas: [
    ...deuda.iniciales.map((d) => ({ c: [d.descripcion || "Deuda", Number(d.monto) || 0] })),
    { tipo: "tot", c: ["Total de la deuda", deuda.total] },
    ...deuda.porMes.map(([m, v]) => ({ c: [`(−) Pagado en ${m}`, -v] })),
    ...(deuda.enGastos > 0 ? [{ c: ["(−) Pagado dentro de otros gastos", -deuda.enGastos] }] : []),
    { tipo: "gran", c: [deuda.falta > 0 ? "Falta pagar" : "Pagada por completo", Math.max(0, deuda.falta)] },
  ] } : null;
  const h3 = { sheet: "Caja por mes", titulo: "Caja de cada mes", columnas: [{ t: "Mes" }, { t: "Había al iniciar", num: true, ancho: 120 }, { t: "Entró", num: true, ancho: 115 }, { t: "Salió", num: true, ancho: 115 }, { t: "Hay al cierre", num: true, ancho: 120 }, { t: "Falta pagar", num: true, ancho: 115 }, { t: "Libre", num: true, ancho: 115 }], filas: [
    ...meses.map((m) => ({ c: [m.mes, m.inicio, m.entradas, -m.salidas, m.saldo, -m.pendiente, m.libre], color: m.libre < 0 ? ROJO : undefined })),
  ] };
  return [h1, h2, h3].filter(Boolean);
}
export function FinResumenExcel(props) {
  const hojas = hojasResumen(props);
  return (<div style={card}>
    {hojas.map((h) => <div key={h.sheet} style={{ marginBottom: 16 }}><h4 style={{ fontSize: 13.5, margin: "0 0 6px" }}>{h.titulo}</h4><Hoja minWidth={h.columnas.length > 3 ? 720 : 460} columnas={h.columnas} filas={h.filas} /></div>)}
  </div>);
}

// ── Pagos a maestros: cuadro maestro × mes ──
export function hojasMaestros({ maestros, gastos, meses }) {
  const filas = maestros.map((m) => {
    const pagos = gastos.filter((g) => g.tipo === "salario" && g.maestro_id === m.id);
    const porMes = meses.map((mes) => pagos.filter((p) => p.mes_correspondiente === mes).reduce((s, p) => s + (Number(p.monto) || 0), 0));
    return { c: [m.nombre, Number(m.salario) || 0, ...porMes.map((v) => v || ""), porMes.reduce((s, v) => s + v, 0)] };
  });
  const tot = meses.map((_, i) => filas.reduce((s, f) => s + (Number(f.c[i + 2]) || 0), 0));
  const h = { sheet: "Pagos a maestros", titulo: "Pagos a maestros por mes", columnas: [{ t: "Maestro" }, { t: "Salario", num: true, ancho: 100 }, ...meses.map((m) => ({ t: m.slice(0, 3), num: true, ancho: 95 })), { t: "Total", num: true, ancho: 110 }],
    filas: [...filas, { tipo: "gran", c: ["Total", "", ...tot, tot.reduce((s, v) => s + v, 0)] }], sangria: false };
  return [h];
}
export function FinMaestrosExcel(props) {
  const [h] = hojasMaestros(props); const meses = props.meses;
  return (<div style={card}>
    <Hoja minWidth={300 + meses.length * 95} sangria={false} columnas={h.columnas} filas={h.filas} />
  </div>);
}

// ── Todos los gastos ──
export function hojasGastos({ gastos, nombreMaestro }) {
  const lista = [...gastos].sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
  const total = lista.reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const porTipo = {}; lista.forEach((g) => { const t = TIPO[g.tipo] || "Otro gasto"; porTipo[t] = (porTipo[t] || 0) + (Number(g.monto) || 0); });
  const h = { sheet: "Gastos", titulo: "Todos los gastos", columnas: [{ t: "Fecha", ancho: 85 }, { t: "Tipo", ancho: 120 }, { t: "Descripción" }, { t: "Mes que corresponde", ancho: 120 }, { t: "Monto", num: true, ancho: 120 }], filas: [
    ...lista.map((g) => ({ c: [fechaC(g.fecha), TIPO[g.tipo] || "Otro gasto", g.descripcion || (g.maestro_id ? nombreMaestro(g.maestro_id) : ""), g.mes_correspondiente || "", Number(g.monto) || 0] })),
    { tipo: "gran", c: ["", "", "Total", "", total] },
    { tipo: "vacia" }, { tipo: "sec", c: ["", "", "Por tipo"] },
    ...Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ c: ["", "", t, "", v] })),
  ], sangria: false };
  return [h];
}
export function FinGastosExcel(props) {
  const [h] = hojasGastos(props);
  return (<div style={card}>
    <Hoja minWidth={680} sangria={false} columnas={h.columnas} filas={h.filas} />
  </div>);
}

// ── Ingresos extra ──
export function hojasIngresos({ lista, nombreAlumno }) {
  const filas = [...lista].sort((a, b) => String(b.fecha_pago || b.fecha || "").localeCompare(String(a.fecha_pago || a.fecha || "")));
  const total = filas.reduce((s, i) => s + (Number(i.monto) || 0), 0);
  const h = { sheet: "Ingresos extra", titulo: "Ingresos extra", columnas: [{ t: "Fecha", ancho: 85 }, { t: "Descripción" }, { t: "Categoría", ancho: 120 }, { t: "Alumno", ancho: 160 }, { t: "Mes", ancho: 100 }, { t: "Monto", num: true, ancho: 120 }], filas: [
    ...filas.map((i) => ({ c: [fechaC(i.fecha_pago || i.fecha), i.descripcion || "", i.categoria || "", i.alumno_id ? nombreAlumno(i.alumno_id) : "", i.mes_ingreso || "", Number(i.monto) || 0] })),
    { tipo: "gran", c: ["", "Total", "", "", "", total] },
  ], sangria: false };
  return [h];
}
export function IngresosExcel(props) {
  const [h] = hojasIngresos(props);
  return (<div style={card}>
    <Hoja minWidth={720} sangria={false} columnas={h.columnas} filas={h.filas} />
  </div>);
}
