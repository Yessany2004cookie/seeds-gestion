// ════════════════════════════════════════════════════════════
//  FINANZAS EN VISTA EXCEL
//  Las mismas cifras de Finanzas → Gastos, deudas y caja e Ingresos extra,
//  en cuadrícula tipo hoja de cálculo, con botón para descargar el Excel.
//  Solo presentación: no guarda ni cambia nada.
// ════════════════════════════════════════════════════════════
import { useState } from "react";
import { Download } from "lucide-react";
import { card, btn, btnO } from "./estilo";
import { Hoja, VERDE, ROJO } from "./vistas";

const fechaC = (f) => String(f || "").split("-").reverse().join("/");
const TIPO = { salario: "Salario", renta: "Renta", deuda: "Pago de deuda", comision: "Comisión bancaria", otro: "Otro gasto" };

// Botón "Descargar Excel" que arma el archivo al tocarlo
function BotonExcel({ nombre, hojas }) {
  const [xls, setXls] = useState(null);
  const crear = async () => {
    const writeExcelFile = (await import("write-excel-file/browser")).default;
    const FMT = '"L "#,##0.00;("L "#,##0.00)';
    const data = hojas.map((h) => ({
      sheet: h.sheet,
      columns: h.columnas.map((c) => ({ width: c.ancho ? Math.max(10, Math.round(c.ancho / 7)) : 44 })),
      data: [
        [{ value: "Seeds English School", fontWeight: "bold", fontSize: 14, textColor: "#1B2A4A" }], [{ value: h.titulo, fontWeight: "bold", fontSize: 12 }], [{ value: "Cifras en Lempiras", textColor: "#5B6576" }], [],
        h.columnas.map((c) => ({ value: c.t, fontWeight: "bold", backgroundColor: "#1B2A4A", textColor: "#FFFFFF", align: c.num ? "right" : "left" })),
        ...h.filas.filter((f) => f.tipo !== "vacia").map((f) => h.columnas.map((c, i) => {
          const v = (f.c || [])[i]; const negrita = ["sec", "tot", "gran"].includes(f.tipo);
          const base = { fontWeight: negrita ? "bold" : undefined, backgroundColor: f.tipo === "sec" ? "#E8ECF2" : undefined, topBorderStyle: f.tipo === "tot" || f.tipo === "gran" ? "thin" : undefined };
          return c.num && typeof v === "number" ? { ...base, value: Math.round(v * 100) / 100, type: Number, format: FMT } : { ...base, value: v === undefined || v === "" ? null : String(v) };
        })),
      ],
    }));
    const blob = await writeExcelFile(data, { fontFamily: "Calibri", fontSize: 11 }).toBlob();
    if (xls) URL.revokeObjectURL(xls.url);
    setXls({ url: URL.createObjectURL(blob), nombre: `${nombre}.xlsx` });
  };
  return (<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
    <button onClick={crear} style={btnO}><Download size={14} />Descargar Excel</button>
    {xls && <a href={xls.url} download={xls.nombre} onClick={() => setTimeout(() => setXls(null), 500)} style={{ ...btn("#15803D"), textDecoration: "none" }}><Download size={14} />Guardar {xls.nombre}</a>}
  </div>);
}

// ── Resumen: lo que queda hoy, deuda anterior y caja de cada mes ──
export function FinResumenExcel({ cajaHoy, rentasPend, cxp, quedaHoy, deuda, meses }) {
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
  const hojas = [h1, h2, h3].filter(Boolean);
  return (<div style={card}>
    <BotonExcel nombre="Finanzas - resumen" hojas={hojas} />
    {hojas.map((h) => <div key={h.sheet} style={{ marginBottom: 16 }}><h4 style={{ fontSize: 13.5, margin: "0 0 6px" }}>{h.titulo}</h4><Hoja minWidth={h.columnas.length > 3 ? 720 : 460} columnas={h.columnas} filas={h.filas} /></div>)}
  </div>);
}

// ── Pagos a maestros: cuadro maestro × mes ──
export function FinMaestrosExcel({ maestros, gastos, meses }) {
  const filas = maestros.map((m) => {
    const pagos = gastos.filter((g) => g.tipo === "salario" && g.maestro_id === m.id);
    const porMes = meses.map((mes) => pagos.filter((p) => p.mes_correspondiente === mes).reduce((s, p) => s + (Number(p.monto) || 0), 0));
    return { c: [m.nombre, Number(m.salario) || 0, ...porMes.map((v) => v || ""), porMes.reduce((s, v) => s + v, 0)] };
  });
  const tot = meses.map((_, i) => filas.reduce((s, f) => s + (Number(f.c[i + 2]) || 0), 0));
  const h = { sheet: "Pagos a maestros", titulo: "Pagos a maestros por mes", columnas: [{ t: "Maestro" }, { t: "Salario", num: true, ancho: 100 }, ...meses.map((m) => ({ t: m.slice(0, 3), num: true, ancho: 95 })), { t: "Total", num: true, ancho: 110 }],
    filas: [...filas, { tipo: "gran", c: ["Total", "", ...tot, tot.reduce((s, v) => s + v, 0)] }] };
  return (<div style={card}>
    <BotonExcel nombre="Pagos a maestros" hojas={[h]} />
    <Hoja minWidth={300 + meses.length * 95} sangria={false} columnas={h.columnas} filas={h.filas} />
  </div>);
}

// ── Todos los gastos ──
export function FinGastosExcel({ gastos, nombreMaestro }) {
  const lista = [...gastos].sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
  const total = lista.reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const porTipo = {}; lista.forEach((g) => { const t = TIPO[g.tipo] || "Otro gasto"; porTipo[t] = (porTipo[t] || 0) + (Number(g.monto) || 0); });
  const h = { sheet: "Gastos", titulo: "Todos los gastos", columnas: [{ t: "Fecha", ancho: 85 }, { t: "Tipo", ancho: 120 }, { t: "Descripción" }, { t: "Mes que corresponde", ancho: 120 }, { t: "Monto", num: true, ancho: 120 }], filas: [
    ...lista.map((g) => ({ c: [fechaC(g.fecha), TIPO[g.tipo] || "Otro gasto", g.descripcion || (g.maestro_id ? nombreMaestro(g.maestro_id) : ""), g.mes_correspondiente || "", Number(g.monto) || 0] })),
    { tipo: "gran", c: ["", "", "Total", "", total] },
    { tipo: "vacia" }, { tipo: "sec", c: ["", "", "Por tipo"] },
    ...Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ c: ["", "", t, "", v] })),
  ] };
  return (<div style={card}>
    <BotonExcel nombre="Gastos" hojas={[h]} />
    <Hoja minWidth={680} sangria={false} columnas={h.columnas} filas={h.filas} />
  </div>);
}

// ── Ingresos extra ──
export function IngresosExcel({ lista, nombreAlumno }) {
  const filas = [...lista].sort((a, b) => String(b.fecha_pago || b.fecha || "").localeCompare(String(a.fecha_pago || a.fecha || "")));
  const total = filas.reduce((s, i) => s + (Number(i.monto) || 0), 0);
  const h = { sheet: "Ingresos extra", titulo: "Ingresos extra", columnas: [{ t: "Fecha", ancho: 85 }, { t: "Descripción" }, { t: "Categoría", ancho: 120 }, { t: "Alumno", ancho: 160 }, { t: "Mes", ancho: 100 }, { t: "Monto", num: true, ancho: 120 }], filas: [
    ...filas.map((i) => ({ c: [fechaC(i.fecha_pago || i.fecha), i.descripcion || "", i.categoria || "", i.alumno_id ? nombreAlumno(i.alumno_id) : "", i.mes_ingreso || "", Number(i.monto) || 0] })),
    { tipo: "gran", c: ["", "Total", "", "", "", total] },
  ] };
  return (<div style={card}>
    <BotonExcel nombre="Ingresos extra" hojas={[h]} />
    <Hoja minWidth={720} sangria={false} columnas={h.columnas} filas={h.filas} />
  </div>);
}
