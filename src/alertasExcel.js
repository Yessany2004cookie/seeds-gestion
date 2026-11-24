// ════════════════════════════════════════════════════════════
//  FINANZAS → ALERTAS: libro de Excel ejecutivo
//  Una hoja de resumen y una hoja por pestaña (Quién debe, Sostenibilidad
//  por grupo, Otras alertas). Encabezado con logo y nombre, moneda en L,
//  anchos fijos, filtros, fila de títulos fija y listo para imprimir.
//  Solo arma el archivo; no lee ni escribe en la base de datos.
// ════════════════════════════════════════════════════════════

export const FMT_L = '"L "#,##0.00;[Red]-"L "#,##0.00';
const FMT_PCT = "0%";
const FMT_ENT = "#,##0";

// Paleta sobria (la misma familia que las facturas y reportes)
const AZUL = "#1B2A4A";
const GRIS_TXT = "#5B6576";
const BANDA = "#F4F6F9";
const LINEA = "#D5DAE1";
const TOTAL = "#E8ECF2";
const ROJO = "#8E3131";
const AMBAR = "#8F5E1A";
const VERDE = "#2A5E45";

// Pie de página al imprimir: nombre del reporte y número de página
const PIE = '<headerFooter><oddFooter>&amp;L&amp;8&amp;K5B6576Finanzas · Alertas&amp;R&amp;8&amp;K5B6576Página &amp;P de &amp;N</oddFooter></headerFooter>';

// ── Filtros y ajuste de impresión: el paquete no los trae, se agregan al XML ──
// Cada hoja puede llevar `filtro: "A7:J30"` y `ajustarAncho: true`.
const extraHoja = {
  files: {
    transform: {
      "xl/worksheets/sheet{id}.xml": {
        transform(xml, opciones) {
          if (opciones.filtro && !xml.includes("<autoFilter")) {
            xml = xml.replace("</sheetData>", `</sheetData><autoFilter ref="${opciones.filtro}"/>`);
          }
          if (opciones.ajustarAncho) {
            // Una página de ancho al imprimir
            if (!xml.includes("<sheetPr")) xml = xml.replace(/(<worksheet[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
            if (xml.includes("<pageSetup")) {
              xml = xml.replace(/<pageSetup([^>]*)\/>/, (m, a) => `<pageSetup${a.replace(/\s(fitToWidth|fitToHeight|paperSize)="[^"]*"/g, "")} paperSize="1" fitToWidth="1" fitToHeight="0"/>`);
              xml = xml.replace(/<pageMargins[^>]*\/>/, '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>');
              if (!xml.includes("<headerFooter")) xml = xml.replace(/(<pageSetup[^>]*\/>)/, "$1" + PIE);
            }
            else {
              const margenes = '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>';
              const setup = `<pageSetup paperSize="1" orientation="${opciones.orientation || "landscape"}" fitToWidth="1" fitToHeight="0"/>`;
              const pie = PIE;
              if (xml.includes("<pageMargins")) xml = xml.replace(/<pageMargins[^>]*\/>/, margenes + setup + pie);
              else {
                // Respeta el orden de elementos que exige Excel: los de impresión van antes de <drawing>
                const antes = ["<drawing", "<legacyDrawing", "<tableParts", "<extLst", "</worksheet>"].map((t) => xml.indexOf(t)).filter((i) => i >= 0);
                const pos = Math.min(...antes);
                xml = xml.slice(0, pos) + margenes + setup + pie + xml.slice(pos);
              }
            }
          }
          return xml;
        },
      },
    },
  },
};

// Letra de columna (1 → A, 27 → AA)
const col = (n) => { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

// ── Piezas de celda ──
const borde = { bottomBorderColor: LINEA, bottomBorderStyle: "thin" };
const titulo = (t, a) => ({ value: t, align: a || "left", fontWeight: "bold", textColor: "#FFFFFF", backgroundColor: AZUL, wrap: true, alignVertical: "center", height: 32 });
const txt = (v, o = {}) => ({ value: v == null || v === "" ? "—" : String(v), type: String, alignVertical: "top", ...borde, ...o });
const din = (v, o = {}) => ({ value: Math.round((Number(v) || 0) * 100) / 100, type: Number, format: FMT_L, alignVertical: "top", ...borde, ...o });
const ent = (v, o = {}) => (v == null ? txt("—", { align: "center", ...o }) : { value: Number(v) || 0, type: Number, format: FMT_ENT, align: "center", alignVertical: "top", ...borde, ...o });
const pct = (v, o = {}) => (v == null ? txt("—", { align: "center", ...o }) : { value: v, type: Number, format: FMT_PCT, align: "center", alignVertical: "top", ...borde, ...o });
const estadoCelda = (t, color) => txt(t, { fontWeight: "bold", textColor: color, align: "center" });

// Bandas alternas suaves para leer filas largas
const banda = (fila, i) => (i % 2 ? fila.map((c) => (c ? { ...c, backgroundColor: c.backgroundColor || BANDA } : c)) : fila);

// Encabezado de cada hoja: logo, nombre, título y datos del reporte (filas 1 a 5)
function encabezado({ nombre, subtitulo, tituloHoja, detalle, ancho, conLogo }) {
  const desde = conLogo ? 2 : 1; // con logo, el texto empieza en la columna B
  const span = Math.max(1, ancho - desde + 1);
  const fila = (cel, alto) => { const f = Array(ancho).fill(null); f[desde - 1] = { ...cel, columnSpan: span }; if (alto) f[0] = { ...(f[0] || {}), value: f[0]?.value ?? null, height: alto }; return f; };
  const conAlto = (f, alto) => { f[0] = f[0] ? { ...f[0], height: alto } : { value: null, height: alto }; return f; };
  const raya = Array(ancho).fill(0).map(() => ({ value: null, bottomBorderColor: "#D9641E", bottomBorderStyle: "medium" }));
  raya[0].height = 6;
  return [
    conAlto(fila({ value: nombre, fontWeight: "bold", fontSize: 16, textColor: AZUL, alignVertical: "bottom" }), 24),
    conAlto(fila({ value: subtitulo, fontSize: 10, textColor: GRIS_TXT, alignVertical: "top" }), 15),
    conAlto(fila({ value: tituloHoja, fontWeight: "bold", fontSize: 13, textColor: AZUL, alignVertical: "bottom" }), 20),
    conAlto(fila({ value: detalle, fontSize: 9, textColor: GRIS_TXT, alignVertical: "top", wrap: true }), 26),
    raya,
    [],
  ];
}

// Arma una hoja con tabla: encabezado + títulos + filas + total + notas
function hoja({ marca, nombreHoja, tituloHoja, detalle, columnas, filas, total, notas = [], logo }) {
  const ancho = columnas.length;
  const enc = encabezado({ ...marca, tituloHoja, detalle, ancho, conLogo: !!logo });
  const filaTitulos = enc.length + 1; // número de fila (base 1) de los títulos
  const cuerpo = filas.length ? filas.map(banda) : [[txt("Sin registros en esta lista", { textColor: GRIS_TXT, columnSpan: ancho }), ...Array(ancho - 1).fill(null)]];
  const data = [...enc, columnas.map((c) => titulo(c.t, c.a)), ...cuerpo];
  if (total && filas.length) data.push(total.map((c) => (c ? { ...c, fontWeight: "bold", backgroundColor: TOTAL, topBorderColor: AZUL, topBorderStyle: "thin", bottomBorderColor: AZUL, bottomBorderStyle: "thin" } : { value: null, backgroundColor: TOTAL, topBorderColor: AZUL, topBorderStyle: "thin", bottomBorderColor: AZUL, bottomBorderStyle: "thin" })));
  if (notas.length) { data.push([]); notas.forEach((n) => data.push([{ value: n, fontSize: 9, textColor: GRIS_TXT, wrap: true, columnSpan: ancho, height: 26, alignVertical: "top" }, ...Array(ancho - 1).fill(null)])); }
  const ultimaFila = filaTitulos + Math.max(filas.length, 1);
  return {
    data,
    sheet: nombreHoja.slice(0, 31),
    columns: columnas.map((c) => ({ width: c.w })),
    stickyRowsCount: filaTitulos,
    showGridLines: false,
    orientation: "landscape",
    ajustarAncho: true,
    filtro: filas.length ? `A${filaTitulos}:${col(ancho)}${ultimaFila}` : undefined,
    logo,
  };
}

// ════════════════════════════════════════════════════════════
//  Libro completo. `datos` trae lo que ya calculó la pantalla.
// ════════════════════════════════════════════════════════════
export function armarLibro(datos, logo) {
  const { nombre, sede, generado, deudores, grupos, otras, kpis, parametros } = datos;
  const marca = { nombre, subtitulo: `Finanzas · Alertas${sede ? " · " + sede : ""}` };
  const pie = `Generado el ${generado}. Cifras en Lempiras. Reporte de solo lectura.`;

  // ── Resumen ──
  const colsRes = [{ t: "Estado", w: 12, a: "center" }, { t: "Indicador", w: 36 }, { t: "Valor", w: 18, a: "right" }, { t: "Detalle", w: 60 }];
  const r = (ind, val, det, color) => [estadoCelda(color === ROJO ? "Atención" : color === AMBAR ? "Revisar" : "Bien", color === ROJO ? ROJO : color === AMBAR ? AMBAR : VERDE), txt(ind, { fontWeight: "bold" }), val, txt(det, { textColor: GRIS_TXT, wrap: true })];
  const filasRes = [
    r("Padres con deuda vencida", ent(kpis.deudores, { align: "right", fontWeight: "bold" }), `${kpis.urgentes} urgentes (2 meses o más, o alumno retirado)`, kpis.urgentes ? ROJO : kpis.deudores ? AMBAR : VERDE),
    r("Total vencido por cobrar", din(kpis.totalDeuda, { fontWeight: "bold" }), "Mensualidades que ya pasaron su fecha límite, sin contar cobros repetidos", kpis.totalDeuda > 0 ? AMBAR : VERDE),
    r("Grupos que pierden dinero", ent(kpis.gruposRojo, { align: "right", fontWeight: "bold" }), `${kpis.gruposAmarillo} grupos más en riesgo`, kpis.gruposRojo ? ROJO : VERDE),
    r("Resultado mensual de todos los grupos", din(kpis.resultadoTotal, { fontWeight: "bold" }), "Lo que cobran al mes menos maestros y gastos fijos", kpis.resultadoTotal < 0 ? ROJO : VERDE),
    r("Cuentas por pagar atrasadas", din(kpis.cxpMonto, { fontWeight: "bold" }), `${kpis.cxpN} cuentas de meses anteriores sin pagar`, kpis.cxpN ? AMBAR : VERDE),
    r("Registros repetidos", ent(kpis.repetidos, { align: "right", fontWeight: "bold" }), "Cobros o pagos guardados dos veces; hay que anular las copias", kpis.repetidos ? ROJO : VERDE),
  ];
  const resumen = hoja({ marca, logo, nombreHoja: "Resumen", tituloHoja: "Resumen de alertas", detalle: `${pie} Gastos fijos usados: L ${Math.round(parametros.fijos).toLocaleString("es-HN")} al mes · Ganancia mínima sana: ${parametros.margen}% · Cobranza medida en ${parametros.mes} ${parametros.anio}.`, columnas: colsRes, filas: filasRes });
  delete resumen.filtro;

  // ── Quién debe ──
  const colsDeu = [{ t: "Estado", w: 11, a: "center" }, { t: "Alumno", w: 30 }, { t: "Grupo", w: 24 }, { t: "Padre o encargado", w: 28 }, { t: "Teléfono", w: 13, a: "center" }, { t: "Meses vencidos", w: 10, a: "center" }, { t: "Detalle de meses", w: 34 }, { t: "Días de atraso", w: 10, a: "center" }, { t: "Monto vencido", w: 15, a: "right" }, { t: "Observación", w: 22 }];
  const filasDeu = deudores.map((d) => [
    estadoCelda(d.nivel === "rojo" ? "Urgente" : "Vencido", d.nivel === "rojo" ? ROJO : AMBAR),
    txt(d.alumno, { fontWeight: "bold" }), txt(d.grupo), txt(d.padre), txt(d.telefono, { align: "center" }),
    ent(d.meses), txt(d.detalleMeses, { wrap: true }), ent(d.dias, { textColor: d.dias > 60 ? ROJO : undefined }),
    din(d.monto, { fontWeight: "bold" }), txt(d.observacion || " ", { textColor: d.observacion ? ROJO : GRIS_TXT, wrap: true }),
  ]);
  const totDeu = [txt("Total"), txt(`${deudores.length} alumnos`), null, null, null, ent(deudores.reduce((s, d) => s + d.meses, 0)), null, null, din(kpis.totalDeuda), null];
  const hDeu = hoja({ marca, logo, nombreHoja: "Quién debe", tituloHoja: "Padres con mensualidades vencidas", detalle: `${pie} Ordenado de mayor a menor deuda.`, columnas: colsDeu, filas: filasDeu, total: totDeu,
    notas: ["Urgente: 2 meses o más vencidos, o alumno retirado con deuda. Vencido: 1 mes. «Revisar» marca 6 meses o más, que puede ser un cobro cargado por error."] });

  // ── Sostenibilidad por grupo ──
  const mc = parametros.mes.slice(0, 3);
  const colsGru = [{ t: "Estado", w: 12, a: "center" }, { t: "Grupo", w: 26 }, { t: "Alumnos", w: 9, a: "center" }, { t: "Becas", w: 8, a: "center" }, { t: "Cobra al mes", w: 15, a: "right" }, { t: "Costo maestro", w: 15, a: "right" }, { t: "Gastos fijos", w: 14, a: "right" }, { t: "Resultado", w: 15, a: "right" }, { t: "Margen", w: 9, a: "center" }, { t: `Facturado ${mc}`, w: 15, a: "right" }, { t: `Cobrado ${mc}`, w: 15, a: "right" }, { t: "% cobrado", w: 10, a: "center" }, { t: "Equilibrio", w: 11, a: "center" }, { t: "Maestros", w: 26 }, { t: "Por qué", w: 46 }];
  const etq = { rojo: ["Pierde", ROJO], amarillo: ["En riesgo", AMBAR], verde: ["Sostenible", VERDE] };
  const filasGru = grupos.map((g) => [
    estadoCelda(...etq[g.nivel]), txt(g.grupo, { fontWeight: "bold" }), ent(g.alumnos), ent(g.becas), din(g.esperado), din(g.costoMaestro), din(g.fijo),
    din(g.resultado, { fontWeight: "bold", textColor: g.resultado < 0 ? ROJO : VERDE }), pct(g.esperado > 0 ? g.margen / 100 : null),
    din(g.facturado), din(g.cobrado), pct(g.pctCob == null ? null : g.pctCob / 100, { textColor: g.pctCob != null && g.pctCob < 70 ? ROJO : undefined }),
    ent(g.equilibrio), txt(g.maestros, { wrap: true }), txt(g.motivos || "Sostenible", { wrap: true, textColor: etq[g.nivel][1] }),
  ]);
  const sum = (k) => grupos.reduce((s, g) => s + (Number(g[k]) || 0), 0);
  const esp = sum("esperado"), fac = sum("facturado"), cob = sum("cobrado");
  const totGru = [txt("Total"), txt(`${grupos.length} grupos`), ent(sum("alumnos")), ent(sum("becas")), din(esp), din(sum("costoMaestro")), din(sum("fijo")), din(sum("resultado"), { textColor: sum("resultado") < 0 ? ROJO : VERDE }), pct(esp > 0 ? sum("resultado") / esp : null), din(fac), din(cob), pct(fac > 0 ? cob / fac : null), null, null, null];
  const hGru = hoja({ marca, logo, nombreHoja: "Sostenibilidad por grupo", tituloHoja: "¿Cada grupo se paga solo?", detalle: `${pie} Gastos fijos: L ${Math.round(parametros.fijos).toLocaleString("es-HN")} al mes repartidos por alumno · Ganancia mínima sana: ${parametros.margen}% · Cobranza de ${parametros.mes} ${parametros.anio}.`, columnas: colsGru, filas: filasGru, total: totGru,
    notas: ["Resultado = lo que cobra al mes (sin becados) − salario del maestro repartido entre sus grupos − su parte de gastos fijos. Margen = resultado ÷ lo que cobra.", "Equilibrio = cuántos alumnos pagando necesita el grupo para no perder dinero."] });

  // ── Otras alertas ──
  const colsOtr = [{ t: "Tipo", w: 26 }, { t: "Alumno o concepto", w: 34 }, { t: "Mes", w: 16 }, { t: "Documento", w: 16 }, { t: "Monto", w: 15, a: "right" }, { t: "Qué hacer", w: 50 }];
  const filasOtr = otras.map((o) => [txt(o.tipo, { fontWeight: "bold", textColor: o.grave ? ROJO : AMBAR }), txt(o.quien, { wrap: true }), txt(o.mes), txt(o.doc), din(o.monto), txt(o.accion, { wrap: true, textColor: GRIS_TXT })]);
  const totOtr = [txt("Total"), txt(`${otras.length} alertas`), null, null, din(otras.reduce((s, o) => s + (Number(o.monto) || 0), 0)), null];
  const hOtr = hoja({ marca, logo, nombreHoja: "Otras alertas", tituloHoja: "Pagos atrasados y registros repetidos", detalle: pie, columnas: colsOtr, filas: filasOtr, total: totOtr });

  return [resumen, hDeu, hGru, hOtr];
}

// Escribe el libro. `writeExcelFile` viene de write-excel-file (navegador o node).
// `logo` (opcional): { content: Blob|ArrayBuffer|Buffer, contentType, width, height }
export async function crearExcelAlertas(writeExcelFile, datos, logo) {
  const hojas = armarLibro(datos, logo);
  const libro = hojas.map(({ logo: lg, ...h }) => ({
    ...h,
    images: lg ? [{ ...lg, dpi: 96, anchor: { row: 1, column: 1 }, offsetX: 4, offsetY: 4, title: datos.nombre }] : undefined,
  }));
  return writeExcelFile(libro, { fontFamily: "Calibri", fontSize: 10, features: [extraHoja] });
}
