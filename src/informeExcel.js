// ════════════════════════════════════════════════════════════
//  INFORME FINANCIERO EN EXCEL (hoja tipo tablero)
//  Estructura pedida por la usuaria (foto "Financial Report"):
//   · Membrete centrado (logo, institución, módulo) y franja azul con el título.
//   · Izquierda: estado de resultados del mes vs. mes anterior, variación %
//     y % sobre ingresos, con subtotales resaltados.
//   · Centro: bloques de balance, resultados, cobranza y flujo de efectivo.
//   · Derecha: gráficas de los últimos meses (imágenes dentro del Excel).
//  Solo arma el archivo: no lee ni escribe en la base de datos.
// ════════════════════════════════════════════════════════════
import { encabezadoExcel } from "./documentoFormal";

const AZUL = "#1B2A4A", AZUL2 = "#2B4C7E", CELESTE = "#DCE6F2", CELESTE2 = "#EEF3F9", GRIS = "#5B6576", LINEA = "#C9D1DC";
const FMT_L = '"L "#,##0;[Red]-"L "#,##0';
const FMT_P = '0.0%;[Red]-0.0%';
const ANCHO = 15; // columnas A..O
// Tipografía: IBM Plex Sans para textos y títulos, IBM Plex Mono para cifras y porcentajes.
// Si la computadora no la tiene instalada, Excel usa su letra por defecto.
const SANS = "IBM Plex Sans", MONO = "IBM Plex Mono";

// ── Gráficas (se dibujan en un canvas y se insertan como imagen) ──
const PALETA = [AZUL, "#5B7DB1", "#9DB4D6", "#D9641E"];
function lienzo(w, h) { const k = 2, cv = document.createElement("canvas"); cv.width = w * k; cv.height = h * k; const cx = cv.getContext("2d"); cx.scale(k, k); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); return { cv, cx }; }
const corto = (n) => { const a = Math.abs(n); return (n < 0 ? "−" : "") + (a >= 1000 ? `${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : Math.round(a)); };
async function png(cv) { const content = await new Promise((ok) => cv.toBlob(ok, "image/png")); return content; }

export async function grafica({ tipo, titulo, etiquetas, series, w = 430, h = 190 }) {
  const { cv, cx } = lienzo(w, h);
  const F = '"IBM Plex Sans", "Segoe UI", Arial, sans-serif', FM = '"IBM Plex Mono", Consolas, monospace';
  cx.fillStyle = AZUL; cx.font = `bold 12px ${F}`; cx.textBaseline = "top"; cx.fillText(titulo, 10, 8);
  // Leyenda
  let lx = 10; cx.font = `10px ${F}`;
  series.forEach((s, i) => { cx.fillStyle = s.color || PALETA[i]; cx.beginPath(); cx.arc(lx + 4, 31, 4, 0, 7); cx.fill(); cx.fillStyle = GRIS; cx.fillText(s.nombre, lx + 11, 25); lx += cx.measureText(s.nombre).width + 26; });
  const x0 = 46, x1 = w - 12, y0 = 46, y1 = h - 24;
  const todos = series.flatMap((s) => s.valores);
  let max = Math.max(0, ...todos), min = Math.min(0, ...todos); if (max === min) max = min + 1;
  const pad = (max - min) * 0.12; max += pad; if (min < 0) min -= pad;
  const Y = (v) => y1 - ((v - min) / (max - min)) * (y1 - y0);
  // Rejilla
  cx.strokeStyle = "#E4E8EE"; cx.lineWidth = 1; cx.fillStyle = GRIS; cx.font = `9px ${FM}`; cx.textBaseline = "middle"; cx.textAlign = "right";
  for (let i = 0; i <= 4; i++) { const v = min + ((max - min) * i) / 4, y = Y(v); cx.beginPath(); cx.moveTo(x0, y); cx.lineTo(x1, y); cx.stroke(); cx.fillText(corto(v), x0 - 5, y); }
  if (min < 0) { cx.strokeStyle = "#8A95A6"; cx.beginPath(); cx.moveTo(x0, Y(0)); cx.lineTo(x1, Y(0)); cx.stroke(); }
  const n = etiquetas.length, paso = (x1 - x0) / n, X = (i) => x0 + paso * (i + 0.5);
  cx.textAlign = "center"; cx.textBaseline = "top"; cx.fillStyle = GRIS;
  etiquetas.forEach((e, i) => cx.fillText(e, X(i), y1 + 6));
  if (tipo === "barras") {
    const bw = Math.min(26, (paso * 0.7) / series.length);
    series.forEach((s, j) => s.valores.forEach((v, i) => {
      const x = X(i) - (bw * series.length) / 2 + j * bw; cx.fillStyle = s.color || PALETA[j];
      const ya = Y(Math.max(0, v)), yb = Y(Math.min(0, v)); cx.fillRect(x + 1, ya, bw - 2, Math.max(1, yb - ya));
    }));
  } else {
    series.forEach((s, j) => {
      const col = s.color || PALETA[j];
      if (tipo === "area") {
        cx.beginPath(); cx.moveTo(X(0), Y(0)); s.valores.forEach((v, i) => cx.lineTo(X(i), Y(v))); cx.lineTo(X(n - 1), Y(0)); cx.closePath();
        cx.fillStyle = "rgba(91,125,177,.25)"; cx.fill();
      }
      cx.strokeStyle = col; cx.lineWidth = 2; cx.beginPath(); s.valores.forEach((v, i) => (i ? cx.lineTo(X(i), Y(v)) : cx.moveTo(X(i), Y(v)))); cx.stroke();
      cx.fillStyle = col; cx.font = `9px ${FM}`; cx.textBaseline = "bottom";
      s.valores.forEach((v, i) => { cx.beginPath(); cx.arc(X(i), Y(v), 2.5, 0, 7); cx.fill(); cx.fillText(corto(v), X(i), Y(v) - 4); });
    });
  }
  return { content: await png(cv), contentType: "image/png", width: w, height: h };
}

// ── Celdas ──
const vacia = () => ({ value: null });
const celda = (v, o = {}) => ({ value: v ?? null, type: typeof v === "number" ? Number : String, alignVertical: "center", fontFamily: SANS, ...o });
const din = (v, o = {}) => ({ value: Math.round(Number(v) || 0), type: Number, format: FMT_L, align: "right", alignVertical: "center", ...o, fontFamily: MONO });
const pct = (v, o = {}) => (v == null || !isFinite(v) ? celda("—", { align: "right", textColor: GRIS, ...o }) : { value: v, type: Number, format: FMT_P, align: "right", alignVertical: "center", ...o, fontFamily: MONO });

// datos = { marca:{nombre,sede}, logo, mesTxt, antTxt, actual, anterior, serie:[{etq,...calcularMes}], balance:{caja,porCobrar,porPagar} }
export async function hojaInforme(datos) {
  const { marca, logo, mesTxt, antTxt, actual: a, anterior: p, serie, balance, modulo = "Finanzas", nota } = datos;
  const enc = encabezadoExcel("A", { ancho: ANCHO, logo, nombre: marca.nombre, sub: `${modulo}${marca.sede ? " · " + marca.sede : ""}`, titulo: "Informe financiero", periodo: mesTxt });
  // Franja azul con el mes y el título (como en la foto)
  const banda = Array(ANCHO).fill(null);
  banda[0] = { fontFamily: SANS, value: `Mes: ${mesTxt}`, backgroundColor: AZUL, textColor: "#FFFFFF", fontSize: 10, alignVertical: "center", height: 34, leftBorderColor: AZUL };
  banda[1] = { fontFamily: SANS, fontWeight: "bold", value: "Informe financiero", columnSpan: ANCHO - 1, backgroundColor: AZUL, textColor: "#FFFFFF", fontSize: 20, align: "center", alignVertical: "center" };
  // Membrete: logo, institución y módulo (el título va en la franja azul)
  const filas = [...enc.slice(0, 2), [], banda, []];
  const filaIni = filas.length + 1;

  // ── Tabla del estado de resultados (columnas A–E) ──
  const ing = a.ingresos || 0;
  const tipos = {
    tit: { fontWeight: "bold", textColor: "#FFFFFF", backgroundColor: AZUL2, wrap: true },
    main: { fontWeight: "bold" }, sub: {}, tot: { fontWeight: "bold", backgroundColor: CELESTE }, gran: { fontWeight: "bold", backgroundColor: CELESTE, bottomBorderStyle: "double", bottomBorderColor: AZUL },
  };
  const linea = (t, k, tipo = "sub", signo = 1, sinPct) => {
    const va = signo * (a[k] || 0), vp = signo * (p[k] || 0);
    // Variación sobre el monto sin signo: si un gasto baja, la variación es negativa
    const ra = a[k] || 0, rp = p[k] || 0, varp = rp ? (ra - rp) / Math.abs(rp) : null;
    const st = { ...tipos[tipo], bottomBorderColor: tipos[tipo].bottomBorderColor || LINEA, bottomBorderStyle: tipos[tipo].bottomBorderStyle || "thin" };
    return [celda(t, { ...st, indent: tipo === "sub" ? 1 : undefined }), din(va, st), din(vp, st), pct(varp, st), sinPct ? celda("", st) : pct(ing ? va / ing : null, st)];
  };
  const tabla = [
    [celda("Indicador", { ...tipos.tit, height: 32 }), celda(mesTxt, { ...tipos.tit, align: "right" }), celda(antTxt, { ...tipos.tit, align: "right" }), celda("Variación %", { ...tipos.tit, align: "right" }), celda("% sobre ingresos", { ...tipos.tit, align: "right" })],
    linea("Ingresos", "ingresos", "main"),
    linea("Mensualidades", "mensualidades"), linea("Mora cobrada", "mora"), linea("Venta de materiales", "materiales"), linea("Graduación", "graduacion"), linea("Ingresos extra", "extra"),
    linea("Costo de lo vendido", "costos", "main", -1),
    linea("Costo de materiales", "costoMat", "sub", -1), linea("Gastos de graduación", "costoGrad", "sub", -1),
    linea("Utilidad bruta", "utilBruta", "tot"),
    linea("Gastos de operación", "gastosOp", "main", -1),
    linea("Salarios", "salarios", "sub", -1), linea("Renta", "renta", "sub", -1), linea("Servicios (luz, agua, internet)", "servicios", "sub", -1), linea("Otros gastos", "otros", "sub", -1),
    linea("Utilidad de operación", "utilOp", "tot"),
    linea("Otros gastos y pagos", "otrosGastos", "main", -1),
    linea("Comisiones bancarias", "comisiones", "sub", -1), linea("Pagos de deudas anteriores", "deudas", "sub", -1),
    linea("Utilidad neta del mes", "neta", "gran"),
    [],
    linea("Dinero en caja al cierre", "cajaFin", "main", 1, true),
  ];

  // ── Bloques del centro (columnas G–H) ──
  const bt = (t) => [celda(t, { fontWeight: "bold", fontSize: 11.5, textColor: AZUL, bottomBorderColor: AZUL, bottomBorderStyle: "thin" }), celda("", { bottomBorderColor: AZUL, bottomBorderStyle: "thin" })];
  const bl = (t, v, o = {}) => [celda(t, { indent: o.sangria ? 1 : undefined, fontWeight: o.b ? "bold" : undefined }), o.pct ? pct(v, { fontWeight: o.b ? "bold" : undefined }) : din(v, { fontWeight: o.b ? "bold" : undefined, backgroundColor: o.b ? CELESTE2 : undefined })];
  const activos = balance.caja + balance.porCobrar;
  const gastosTot = a.costos + a.gastosOp + a.otrosGastos;
  const bloques = [
    bt("Balance general"), bl("Activos", activos, { b: true }), bl("Efectivo y bancos", balance.caja, { sangria: true }), bl("Cuentas por cobrar", balance.porCobrar, { sangria: true }),
    bl("Pasivos", balance.porPagar, { b: true }), bl("Cuentas por pagar", balance.porPagar, { sangria: true }), bl("Patrimonio", activos - balance.porPagar, { b: true }), [],
    bt("Estado de resultados"), bl("Ingresos", a.ingresos, { sangria: true }), bl("Gastos y costos", gastosTot, { sangria: true }), bl("Utilidad neta", a.neta, { b: true }), [],
    bt("Cobranza del mes"), bl("Facturado a padres", a.facturado, { sangria: true }), bl("Cobrado", a.cobrado, { sangria: true }), bl("Pendiente", a.pendiente, { sangria: true }), bl("% cobrado", a.facturado ? a.cobrado / a.facturado : null, { b: true, pct: true }), [],
    bt("Flujo de efectivo"), bl("Caja al iniciar el mes", a.cajaInicio, { sangria: true }), bl("Entradas", a.entradas, { sangria: true }), bl("Salidas", -a.salidas, { sangria: true }), bl("Caja al cierre", a.cajaFin, { b: true }),
  ];

  const n = Math.max(tabla.length, bloques.length);
  for (let i = 0; i < n; i++) {
    const t = tabla[i] && tabla[i].length ? tabla[i] : [vacia(), vacia(), vacia(), vacia(), vacia()];
    const b = bloques[i] && bloques[i].length ? bloques[i] : [vacia(), vacia()];
    const fila = [...t, vacia(), ...b, ...Array(ANCHO - 8).fill(null)];
    fila[0] = { ...fila[0], height: fila[0].height || 19 };
    filas.push(fila);
  }
  filas.push([], [celda(nota || `Ingresos por la fecha en que entró el dinero; gastos por el mes al que corresponden. "Cuentas por cobrar" son todas las mensualidades sin pagar a la fecha. Cifras en Lempiras.`, { fontSize: 9, textColor: GRIS, wrap: true, columnSpan: ANCHO, height: 28 }), ...Array(ANCHO - 1).fill(null)]);

  // ── Gráficas (columnas J–O) ──
  const etq = serie.map((m) => m.etq);
  const g1 = await grafica({ tipo: "barras", titulo: "Ingresos y gastos por mes", etiquetas: etq, series: [{ nombre: "Ingresos", valores: serie.map((m) => m.ingresos) }, { nombre: "Gastos y costos", valores: serie.map((m) => m.costos + m.gastosOp + m.otrosGastos), color: "#9DB4D6" }] });
  const g2 = await grafica({ tipo: "lineas", titulo: "Utilidad neta por mes", etiquetas: etq, series: [{ nombre: "Utilidad neta", valores: serie.map((m) => m.neta), color: "#D9641E" }] });
  const g3 = await grafica({ tipo: "area", titulo: "Dinero en caja al cierre de cada mes", etiquetas: etq, series: [{ nombre: "Caja al cierre", valores: serie.map((m) => m.cajaFin), color: AZUL2 }] });
  const img = (g, fila) => ({ ...g, dpi: 96, anchor: { row: fila, column: 10 }, offsetX: 4, offsetY: 2, title: "Gráfica" });

  return {
    data: filas, sheet: "Informe financiero",
    columns: [{ width: 34 }, { width: 15 }, { width: 15 }, { width: 12 }, { width: 13 }, { width: 2 }, { width: 26 }, { width: 14 }, { width: 2 }, ...Array(6).fill({ width: 10 })],
    showGridLines: false, orientation: "landscape", ajustarAncho: true, pie: `${marca.nombre} · ${modulo} · Informe financiero ${mesTxt}`,
    images: [...(logo ? [{ ...logo, dpi: 96, anchor: { row: 1, column: 1 }, offsetX: 4, offsetY: 4, title: marca.nombre }] : []), img(g1, filaIni), img(g2, filaIni + 10), img(g3, filaIni + 20)],
  };
}
