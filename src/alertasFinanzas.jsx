// ════════════════════════════════════════════════════════════
//  FINANZAS → ALERTAS
//  Pantalla de solo lectura: no escribe nada en la base de datos.
//  1) Quién debe (por alumno, con meses vencidos y antigüedad)
//  2) Sostenibilidad de cada grupo (lo que cobra vs. lo que cuesta)
//  3) Otras alertas: cuentas por pagar atrasadas y registros repetidos
// ════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { input, label, btn, btnO } from "./estilo";
import { useAjuste } from "./ajustes";
import { useMarca } from "./marca";
import { Phone, Info, FileSpreadsheet, FileText, Download, Eye, X } from "lucide-react";
import "./alertasFinanzas.css";
import { alertasDelSistema } from "./resumenMes";
import { cargarFuentesInforme } from "./tipografia";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const L = (n) => `L ${Math.round(Number(n) || 0).toLocaleString("es-HN")}`;
const DIA = 1000 * 60 * 60 * 24;

// Teléfono a formato WhatsApp de Honduras (igual que en Recordatorios)
const telWA = (tel) => {
  let d = String(tel || "").replace(/[^0-9]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = "504" + d;
  return d;
};

// Año de un cobro: el guardado o el de su fecha de emisión
const anioDe = (f) => Number(f.anio_correspondiente) || Number(String(f.fecha_emision || "").slice(0, 4)) || new Date().getFullYear();
// Fecha límite de pago de un cobro (día de vencimiento de su sección, por defecto 28)
const limiteDe = (f, sec) => {
  const mi = MESES.indexOf(f.mes_correspondiente);
  if (mi < 0) return null;
  const dia = Math.min(Math.max(Number(sec?.dia_vencimiento) || 28, 1), 31);
  return new Date(anioDe(f), mi, dia, 23, 59, 59);
};
// Mensualidad de un alumno: 0 si es becado, el monto personalizado si tiene, si no la de la sección
const cuotaDe = (al, sec) => (al.beca === true ? 0 : (Number(al.monto_personalizado) > 0 ? Number(al.monto_personalizado) : Number(sec?.mensualidad) || 0));
const esActivo = (al) => (al.estado || "activo") === "activo";

// Gastos fijos del mes: la última renta + la última luz + el último internet/agua registrados
export function gastosFijosSugeridos(data) {
  const regs = [
    ...(data.gastos || []).map((g) => ({ t: g.tipo, d: g.descripcion, m: Number(g.monto) || 0, f: g.fecha || g.created_at || "" })),
    ...(data.cuentas_por_pagar || []).map((c) => ({ t: c.tipo, d: c.descripcion, m: Number(c.monto) || 0, f: c.created_at || "" })),
  ].sort((a, b) => String(b.f).localeCompare(String(a.f)));
  const ultimo = (fn) => regs.find(fn)?.m || 0;
  return ultimo((r) => r.t === "renta")
    + ultimo((r) => /luz|energ/i.test(r.d || ""))
    + ultimo((r) => /internet/i.test(r.d || ""))
    + ultimo((r) => /agua/i.test(r.d || ""));
}

const CLASE = { rojo: "rojo", amarillo: "ambar", verde: "verde" };

const Kpi = ({ c, t, v, s }) => (
  <div className="af-kpi" style={{ "--af-c": c }}>
    <div className="af-kpi-t">{t}</div>
    <div className="af-kpi-v">{v}</div>
    {s && <div className="af-kpi-s">{s}</div>}
  </div>
);

// Logo para el Excel: se reduce a 56 px de alto (nítido) y se pasa a PNG.
// Si no se puede leer (por ejemplo, un logo externo sin permiso), el Excel sale sin logo.
export async function logoParaExcel(src) {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode();
    const alto = 56, ancho = Math.min(84, Math.round((img.naturalWidth / img.naturalHeight) * alto));
    const k = 3, cv = document.createElement("canvas");
    cv.width = ancho * k; cv.height = alto * k;
    const cx = cv.getContext("2d");
    cx.imageSmoothingQuality = "high";
    const esc = Math.min(cv.width / img.naturalWidth, cv.height / img.naturalHeight);
    const w = img.naturalWidth * esc, h = img.naturalHeight * esc;
    cx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
    const content = await new Promise((ok) => cv.toBlob(ok, "image/png"));
    return content ? { content, contentType: "image/png", width: ancho, height: alto } : null;
  } catch (e) { return null; }
}


export function AlertasFinanzasPage({ data, showToast, sucursalActiva }) {
  const hoy = new Date();
  const marca = useMarca();
  const nombreInst = marca.nombreO("Seeds English School");
  const sede = (data.sucursales || []).find((s) => s.id === sucursalActiva)?.nombre || "";
  const [tab, setTab] = useState("deudores");
  const [filtro, setFiltro] = useState("todos"); // todos | rojo | retirados
  const sugeridoFijos = useMemo(() => gastosFijosSugeridos(data), [data]);
  // Guardados en la base de datos (tabla ajustes_sistema), no solo en este navegador
  const [fijos, setFijosRaw] = useAjuste("gastos_fijos", 0);
  const fijosMes = fijos > 0 ? fijos : sugeridoFijos;
  const setFijos = (v) => setFijosRaw(Math.max(0, Number(v) || 0));
  const [margenMin, setMargenRaw] = useAjuste("margen_min", 15);
  const setMargen = (v) => setMargenRaw(Math.min(90, Math.max(0, Number(v) || 0)));
  // Mes para medir la cobranza: el mes anterior (ya vencido)
  const mesPrevIdx = (hoy.getMonth() + 11) % 12;
  const [mesCob, setMesCob] = useState(MESES[mesPrevIdx]);
  // Un mes "después" del actual es del año pasado (ej. en enero, Diciembre = año anterior)
  const anioCob = MESES.indexOf(mesCob) > hoy.getMonth() ? hoy.getFullYear() - 1 : hoy.getFullYear();

  const secPorId = useMemo(() => Object.fromEntries((data.secciones || []).map((s) => [s.id, s])), [data.secciones]);
  const alPorId = useMemo(() => Object.fromEntries((data.alumnos || []).map((a) => [a.id, a])), [data.alumnos]);
  const padrePorId = useMemo(() => Object.fromEntries((data.padres || []).map((p) => [p.id, p])), [data.padres]);

  // ── Cobros de mensualidad activos, sin repetidos (mismo alumno, mes y año cuentan una vez) ──
  const { cobrosUnicos, repetidos } = useMemo(() => {
    const vistos = new Map(); const rep = [];
    (data.facturas || []).filter((f) => (f.tipo_factura || "cobro") === "cobro" && f.estado !== "anulada").forEach((f) => {
      const k = `${f.alumno_id}|${f.mes_correspondiente}|${anioDe(f)}`;
      if (vistos.has(k)) rep.push({ f, primero: vistos.get(k) }); else vistos.set(k, f);
    });
    return { cobrosUnicos: [...vistos.values()], repetidos: rep };
  }, [data.facturas]);

  // ── 1) Deudores: cobros pendientes que ya pasaron su fecha límite ──
  const deudores = useMemo(() => {
    const porAlumno = new Map();
    cobrosUnicos.filter((f) => f.estado === "pendiente").forEach((f) => {
      const al = alPorId[f.alumno_id]; if (!al) return;
      const sec = secPorId[al.seccion_id];
      const lim = limiteDe(f, sec); if (!lim || lim > hoy) return; // aún no vence
      const saldo = Number(f.saldo) > 0 ? Number(f.saldo) : Number(f.monto_total) || 0;
      const r = porAlumno.get(al.id) || { al, sec, meses: [], monto: 0, masViejo: lim };
      r.meses.push(`${f.mes_correspondiente.slice(0, 3)} ${String(anioDe(f)).slice(2)}`);
      r.monto += saldo; if (lim < r.masViejo) r.masViejo = lim;
      porAlumno.set(al.id, r);
    });
    return [...porAlumno.values()].map((r) => {
      const dias = Math.floor((hoy - r.masViejo) / DIA);
      const retirado = !esActivo(r.al);
      const nivel = retirado || r.meses.length >= 2 ? "rojo" : "amarillo";
      const padre = padrePorId[r.al.padre_id];
      return { ...r, dias, retirado, nivel, padre, revisar: r.meses.length >= 6 };
    }).sort((a, b) => b.monto - a.monto);
  }, [cobrosUnicos, alPorId, secPorId, padrePorId]);

  // ── 2) Sostenibilidad por grupo ──
  const grupos = useMemo(() => {
    const secs = (data.secciones || []).filter((s) => s.activa !== false);
    const activosDe = (sid) => (data.alumnos || []).filter((a) => a.seccion_id === sid && esActivo(a));
    const totalAlumnos = secs.reduce((s, x) => s + activosDe(x.id).length, 0);
    const fijoPorAlumno = totalAlumnos > 0 ? fijosMes / totalAlumnos : 0;
    return secs.map((s) => {
      const als = activosDe(s.id);
      const becas = als.filter((a) => a.beca === true).length;
      const esperado = als.reduce((t, a) => t + cuotaDe(a, s), 0);
      const maestros = (data.maestros || []).filter((m) => Array.isArray(m.secciones_ids) && m.secciones_ids.includes(s.id));
      const costoMaestro = maestros.reduce((t, m) => t + (Number(m.salario) || 0) / Math.max(1, m.secciones_ids.length), 0);
      const fijo = fijoPorAlumno * als.length;
      const resultado = esperado - costoMaestro - fijo;
      const margen = esperado > 0 ? (resultado / esperado) * 100 : -100;
      // Cobranza real del mes elegido (cobros de alumnos de este grupo)
      const delMes = cobrosUnicos.filter((f) => f.mes_correspondiente === mesCob && anioDe(f) === anioCob && alPorId[f.alumno_id]?.seccion_id === s.id);
      const cobrado = delMes.filter((f) => f.estado === "pagada").reduce((t, f) => t + (Number(f.monto_total) || 0), 0);
      const facturado = delMes.reduce((t, f) => t + (Number(f.monto_total) || 0), 0);
      const pctCob = facturado > 0 ? (cobrado / facturado) * 100 : null;
      const cuotaProm = Number(s.mensualidad) || (als.length ? esperado / Math.max(1, als.length - becas) : 0);
      const equilibrio = cuotaProm > 0 ? Math.ceil((costoMaestro + fijo) / cuotaProm) : null;
      const motivos = [];
      if (resultado < 0) motivos.push(`Pierde ${L(-resultado)} al mes`);
      else if (margen < margenMin) motivos.push(`Deja solo ${margen.toFixed(0)}% de lo que cobra`);
      if (als.length > 0 && becas / als.length >= 0.5) motivos.push(`${becas} de ${als.length} alumnos becados`);
      if (pctCob !== null && pctCob < 70) motivos.push(`Cobró ${pctCob.toFixed(0)}% de ${mesCob}`);
      if (maestros.length === 0) motivos.push("Sin maestro asignado en la app (costo incompleto)");
      const nivel = resultado < 0 ? "rojo" : motivos.length ? "amarillo" : "verde";
      return { s, n: als.length, becas, esperado, maestros, costoMaestro, fijo, resultado, margen, cobrado, facturado, pctCob, equilibrio, motivos, nivel };
    }).sort((a, b) => a.resultado - b.resultado);
  }, [data.secciones, data.alumnos, data.maestros, fijosMes, cobrosUnicos, alPorId, mesCob, anioCob, margenMin]);

  // ── 3) Otras alertas ──
  const cxpAtrasadas = (data.cuentas_por_pagar || []).filter((c) => !c.pagada).filter((c) => {
    const mi = MESES.indexOf(c.mes_correspondiente); const an = Number(c.anio_correspondiente) || hoy.getFullYear();
    return an < hoy.getFullYear() || (an === hoy.getFullYear() && mi < hoy.getMonth());
  });
  const compRepetidos = useMemo(() => {
    const m = new Map();
    (data.facturas || []).filter((f) => f.tipo_factura === "comprobante" && f.cobro_id && f.estado !== "anulada").forEach((f) => m.set(f.cobro_id, [...(m.get(f.cobro_id) || []), f]));
    return [...m.values()].filter((v) => v.length > 1);
  }, [data.facturas]);
  // Alertas del mes (planilla, servicios, cobranza) y revisión de datos del sistema
  const { alertas: delSistema, resumen: resMes } = useMemo(() => alertasDelSistema(data, new Date(), fijos), [data, fijos]); // eslint-disable-line
  const nOtras = cxpAtrasadas.length + repetidos.length + compRepetidos.length + delSistema.length;

  const totDeuda = deudores.reduce((s, d) => s + d.monto, 0);
  const rojosDeu = deudores.filter((d) => d.nivel === "rojo").length;
  const gruposRojo = grupos.filter((g) => g.nivel === "rojo").length;
  const gruposAmarillo = grupos.filter((g) => g.nivel === "amarillo").length;

  const verDeudores = deudores.filter((d) => filtro === "todos" || (filtro === "rojo" ? d.nivel === "rojo" : d.retirado));
  const msgWA = (d) => `Estimado padre de familia, le recordamos que ${d.al.nombre} tiene pendiente${d.meses.length > 1 ? "s" : ""} ${d.meses.length} mensualidad${d.meses.length > 1 ? "es" : ""} (${d.meses.join(", ")}), por un total de ${L(d.monto)}. Favor ponerse al día o comunicarse con administración. ${nombreInst}`;
  const totCxp = cxpAtrasadas.reduce((s, c) => s + (Number(c.monto) || 0), 0);
  const tot = (k) => grupos.reduce((s, g) => s + (Number(g[k]) || 0), 0);

  // ── Datos para exportar (Excel y PDF): lo mismo que ya se ve en pantalla ──
  const armarDatos = () => {
    const otras = [
      ...cxpAtrasadas.map((c) => ({ tipo: "Cuenta por pagar atrasada", quien: c.descripcion, mes: `${c.mes_correspondiente || ""} ${c.anio_correspondiente || ""}`.trim(), doc: "", monto: Number(c.monto) || 0, accion: "Pagar desde Finanzas → Cuentas por pagar. El gasto sigue contando en su mes.", grave: false })),
      ...repetidos.map(({ f }) => ({ tipo: "Cobro repetido", quien: alPorId[f.alumno_id]?.nombre || "—", mes: `${f.mes_correspondiente} ${anioDe(f)}`, doc: f.numero_factura || "", monto: Number(f.monto_total) || 0, accion: "Anular la copia. No se cuenta dos veces en «Quién debe».", grave: true })),
      ...delSistema,
      ...compRepetidos.map((v) => ({ tipo: `Pago guardado ${v.length} veces`, quien: alPorId[v[0].alumno_id]?.nombre || "—", mes: v[0].mes_correspondiente || "", doc: v[0].numero_factura || "", monto: (Number(v[0].monto_total) || 0) * (v.length - 1), accion: `Anular ${v.length - 1} copia${v.length > 2 ? "s" : ""}. El monto es lo que sobra.`, grave: true })),
    ];
    const datos = {
      nombre: nombreInst, sede, generado: hoy.toLocaleString("es-HN", { dateStyle: "long", timeStyle: "short" }),
      parametros: { fijos: fijosMes, margen: margenMin, mes: mesCob, anio: anioCob },
      kpis: { deudores: deudores.length, urgentes: rojosDeu, totalDeuda: totDeuda, gruposRojo, gruposAmarillo, resultadoTotal: tot("resultado"), cxpN: cxpAtrasadas.length, cxpMonto: totCxp, repetidos: repetidos.length + compRepetidos.length },
      deudores: deudores.map((d) => ({ nivel: d.nivel, alumno: d.al.nombre, grupo: d.sec?.nombre || "", padre: d.padre?.nombre || "", telefono: d.padre?.telefono || d.al.telefono || "", meses: d.meses.length, detalleMeses: d.meses.join(", "), dias: d.dias, monto: d.monto, observacion: [d.retirado && "Alumno retirado", d.revisar && `Revisar: ${d.meses.length} meses`].filter(Boolean).join(" · ") })),
      grupos: grupos.map((g) => ({ nivel: g.nivel, grupo: g.s.nombre, alumnos: g.n, becas: g.becas, esperado: g.esperado, costoMaestro: g.costoMaestro, fijo: g.fijo, resultado: g.resultado, margen: g.margen, facturado: g.facturado, cobrado: g.cobrado, pctCob: g.pctCob, equilibrio: g.equilibrio, maestros: g.maestros.map((m) => m.nombre).join(", ") || "Sin maestro asignado", motivos: g.motivos.join(" · ") })),
      otras,
    };
    return datos;
  };
  const rangoMeses = (m) => (m.length === 1 ? m[0] : `${m[0]} – ${m[m.length - 1]}`);

  const [generando, setGenerando] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [verPdf, setVerPdf] = useState(false);
  const listo = (blob, ext, tipo) => {
    if (archivo) URL.revokeObjectURL(archivo.url);
    setArchivo({ url: URL.createObjectURL(blob), nombre: `Alertas de finanzas ${hoy.toISOString().slice(0, 10)}.${ext}`, tipo });
    if (tipo === "PDF") setVerPdf(true); // el PDF se abre primero en vista previa
  };
  const descargarExcel = async () => {
    if (generando) return; setGenerando("excel");
    try {
      const [{ default: writeExcelFile }, { crearExcelAlertas }] = await Promise.all([import("write-excel-file/browser"), import("./alertasExcel")]);
      const logo = await logoParaExcel(marca.logoSrc);
      listo(await (await crearExcelAlertas(writeExcelFile, armarDatos(), logo)).toBlob(), "xlsx", "Excel");
    } catch (e) { showToast ? showToast("No se pudo crear el Excel: " + e.message, "error") : console.error(e); }
    finally { setGenerando(""); }
  };
  const descargarPDF = async () => {
    if (generando) return; setGenerando("pdf");
    try {
      const [{ default: html2pdf }, { documentoAlertas, OPCIONES_PDF }] = await Promise.all([import("html2pdf.js"), import("./alertasPdf")]);
      await cargarFuentesInforme();
      const pdf = await html2pdf().set(OPCIONES_PDF).from(documentoAlertas(armarDatos(), marca.logoSrc), "string").toPdf().get("pdf");
      // Número de página al pie de cada hoja
      const total = pdf.internal.getNumberOfPages(), an = pdf.internal.pageSize.getWidth(), al = pdf.internal.pageSize.getHeight();
      for (let i = 1; i <= total; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(91, 101, 118); pdf.text(`Página ${i} de ${total}`, an - 9, al - 5, { align: "right" }); }
      listo(new Blob([pdf.output("blob")], { type: "application/pdf" }), "pdf", "PDF");
    } catch (e) { showToast ? showToast("No se pudo crear el PDF: " + e.message, "error") : console.error(e); }
    finally { setGenerando(""); }
  };

  const Estado = ({ nivel, txt }) => <span className={`af-est ${CLASE[nivel]}`}>{txt}</span>;
  const Pest = ({ id, txt, n }) => (
    <button type="button" role="tab" aria-selected={tab === id} className="af-tab" onClick={() => setTab(id)}>{txt}<span className="af-num">{n}</span></button>
  );
  const Cobranza = ({ g }) => g.pctCob === null ? <span className="chico">Sin cobros en {mesCob}</span> : (
    <div className="af-cob">
      <div className="nowrap"><span className={g.pctCob < 70 ? "rojo fuerte" : "fuerte"}>{g.pctCob.toFixed(0)}%</span> <span className="chico">· {L(g.cobrado)} de {L(g.facturado)}</span></div>
      <div className="af-cob-barra"><i className={g.pctCob < 70 ? "bajo" : ""} style={{ width: `${Math.min(100, g.pctCob)}%` }} /></div>
    </div>
  );
  const etqGrupo = { rojo: "Pierde", amarillo: "En riesgo", verde: "Sostenible" };

  return (<div className="af">
    <div className="af-aviso">
      <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>Quién debe, qué grupo no se sostiene y qué hay que pagar. <b>Solo lectura</b>: esta pantalla no cambia datos.</div>
    </div>

    <div className="af-kpis">
      <Kpi c={deudores.length ? "var(--af-rojo)" : "var(--af-verde)"} t="Padres con deuda vencida" v={deudores.length} s={`${rojosDeu} urgentes (2+ meses o retirados)`} />
      <Kpi c={totDeuda ? "var(--af-ambar)" : "var(--af-verde)"} t="Total vencido por cobrar" v={L(totDeuda)} s="Sin contar cobros repetidos" />
      <Kpi c={gruposRojo ? "var(--af-rojo)" : "var(--af-verde)"} t="Grupos que pierden dinero" v={`${gruposRojo} de ${grupos.length}`} s={`${gruposAmarillo} más en riesgo`} />
      <Kpi c={nOtras ? "var(--af-ambar)" : "var(--af-verde)"} t="Otras alertas" v={nOtras} s="Del mes, pagos atrasados y datos por revisar" />
    </div>

    <div className="af-barra">
      <div className="af-tabs" role="tablist">
        <Pest id="deudores" txt="Quién debe" n={deudores.length} />
        <Pest id="grupos" txt="Sostenibilidad por grupo" n={gruposRojo + gruposAmarillo} />
        <Pest id="otras" txt="Otras alertas" n={nOtras} />
      </div>
      <div className="af-acciones">
        <button type="button" onClick={descargarPDF} disabled={!!generando} style={{ ...btnO, opacity: generando ? 0.7 : 1, cursor: generando ? "wait" : "pointer" }}><FileText size={15} />{generando === "pdf" ? "Preparando PDF…" : "PDF"}</button>
        <button type="button" onClick={descargarExcel} disabled={!!generando} style={{ ...btnO, opacity: generando ? 0.7 : 1, cursor: generando ? "wait" : "pointer" }}><FileSpreadsheet size={15} />{generando === "excel" ? "Preparando Excel…" : "Excel"}</button>
        {archivo?.tipo === "PDF" && <button type="button" onClick={() => setVerPdf(true)} style={btnO}><Eye size={15} />Vista previa</button>}
        {archivo && <a href={archivo.url} download={archivo.nombre} onClick={() => setTimeout(() => setArchivo(null), 500)} style={{ ...btn("#15803D"), textDecoration: "none" }}><Download size={14} />Guardar {archivo.tipo}</a>}
      </div>
    </div>

    {tab === "deudores" && <section className="af-panel">
      <div className="af-panel-cab">
        <div><h3 className="af-h">Padres con mensualidades vencidas</h3><div className="af-sub">{verDeudores.length} alumnos · {L(verDeudores.reduce((s, d) => s + d.monto, 0))} vencido · de mayor a menor deuda</div></div>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ ...input, width: "auto", cursor: "pointer" }}>
          <option value="todos">Todos ({deudores.length})</option>
          <option value="rojo">Urgentes: 2+ meses o retirados ({rojosDeu})</option>
          <option value="retirados">Alumnos retirados con deuda ({deudores.filter((d) => d.retirado).length})</option>
        </select>
      </div>
      {verDeudores.length === 0 ? <p className="af-vacio">✓ Nadie en esta lista</p> :
        <div className="af-tabla-caja"><table>
          <thead><tr><th>Estado</th><th>Alumno</th><th>Meses vencidos</th><th className="der">Atraso</th><th className="der">Debe</th><th>Encargado</th><th className="cen" aria-label="WhatsApp"></th></tr></thead>
          <tbody>{verDeudores.map((d) => {
            const tel = telWA(d.padre?.telefono || d.al.telefono);
            return (<tr key={d.al.id}>
              <td><Estado nivel={d.nivel} txt={d.nivel === "rojo" ? "Urgente" : "Vencido"} /></td>
              <td className="af-corto"><div className="fuerte" title={d.al.nombre}>{d.al.nombre}</div><div className="chico">{d.sec?.nombre || "Sin grupo"}{d.retirado && <span className="rojo"> · Retirado</span>}{d.revisar && <span className="ambar"> · Revisar</span>}</div></td>
              <td className="nowrap" title={d.meses.join(", ")}><b>{d.meses.length}</b> <span className="chico" style={{ display: "inline" }}>· {rangoMeses(d.meses)}</span></td>
              <td className={`der nowrap ${d.dias > 60 ? "rojo fuerte" : d.dias > 30 ? "ambar" : ""}`}>{d.dias} días</td>
              <td className="der fuerte nowrap">{L(d.monto)}</td>
              <td className="af-corto" title={[d.padre?.nombre, d.padre?.telefono || d.al.telefono].filter(Boolean).join(" · ")}>{d.padre?.nombre || "—"}</td>
              <td className="cen">{tel ? <a className="af-wa" href={`https://wa.me/${tel}?text=${encodeURIComponent(msgWA(d))}`} target="_blank" rel="noreferrer" title="Enviar recordatorio por WhatsApp"><Phone size={14} /></a> : <span className="chico" title="Sin teléfono registrado">—</span>}</td>
            </tr>);
          })}</tbody>
          <tfoot><tr><td colSpan={2}>Total ({verDeudores.length})</td><td className="nowrap">{verDeudores.reduce((s, d) => s + d.meses.length, 0)} meses</td><td /><td className="der nowrap">{L(verDeudores.reduce((s, d) => s + d.monto, 0))}</td><td colSpan={2} /></tr></tfoot>
        </table></div>}
      <p className="af-nota">Solo cuenta mensualidades que ya pasaron su fecha límite. <b>Urgente:</b> 2 o más meses, o alumno retirado. <b>Vencido:</b> 1 mes. <b>Revisar</b> marca 6 meses o más, que puede ser un cobro cargado por error.</p>
    </section>}

    {tab === "grupos" && <section className="af-panel">
      <div className="af-panel-cab">
        <div><h3 className="af-h">¿Cada grupo se paga solo?</h3><div className="af-sub">{grupos.length} grupos · resultado mensual total <span className={tot("resultado") < 0 ? "rojo fuerte" : "verde fuerte"}>{tot("resultado") < 0 ? "−" : ""}{L(Math.abs(tot("resultado")))}</span></div></div>
      </div>
      <div className="af-param">
        <div><label style={label}>Gastos fijos al mes (renta, luz, internet)</label>
          <input type="number" value={fijos > 0 ? fijos : ""} placeholder={`Sugerido: ${Math.round(sugeridoFijos)}`} onChange={(e) => setFijos(e.target.value)} style={input} />
          <div className="af-ayuda">Se reparten por alumno entre todos los grupos. Vacío = usa lo último registrado ({L(sugeridoFijos)}).</div></div>
        <div><label style={label}>Ganancia mínima sana por grupo (%)</label>
          <input type="number" value={margenMin} onChange={(e) => setMargen(e.target.value)} style={input} />
          <div className="af-ayuda">Debajo de este margen el grupo queda «En riesgo».</div></div>
        <div><label style={label}>Mes para medir la cobranza</label>
          <select value={mesCob} onChange={(e) => setMesCob(e.target.value)} style={{ ...input, cursor: "pointer" }}>{MESES.map((m) => <option key={m}>{m}</option>)}</select>
          <div className="af-ayuda">Compara lo cobrado contra lo facturado de {mesCob} {anioCob}.</div></div>
      </div>

      <div className="af-tabla-caja af-solo-ancho"><table>
        <thead><tr><th>Estado</th><th>Grupo</th><th className="der">Cobra al mes</th><th className="der">Costos al mes</th><th className="der">Resultado</th><th>Cobranza {mesCob.slice(0, 3)}</th><th className="der">Equilibrio</th></tr></thead>
        <tbody>{grupos.map((g) => [
          <tr key={g.s.id} className={g.motivos.length ? "af-sinlinea" : ""}>
            <td><Estado nivel={g.nivel} txt={etqGrupo[g.nivel]} /></td>
            <td><div className="fuerte">{g.s.nombre}</div><div className="chico">{g.n} alumnos{g.becas > 0 && ` · ${g.becas} beca${g.becas > 1 ? "s" : ""}`}{g.maestros.length > 0 && ` · ${g.maestros.map((m) => m.nombre).join(", ")}`}</div></td>
            <td className="der nowrap">{L(g.esperado)}</td>
            <td className="der nowrap" title={g.maestros.map((m) => `${m.nombre}: ${L(m.salario)} entre ${m.secciones_ids.length} grupo(s)`).join("\n")}>{L(g.costoMaestro + g.fijo)}<div className="chico">Maestro {L(g.costoMaestro)} · Fijos {L(g.fijo)}</div></td>
            <td className={`der nowrap fuerte ${g.resultado < 0 ? "rojo" : "verde"}`}>{g.resultado < 0 ? "−" : ""}{L(Math.abs(g.resultado))}<div className="chico">{g.esperado > 0 ? `Margen ${g.margen.toFixed(0)}%` : "Sin cobro"}</div></td>
            <td><Cobranza g={g} /></td>
            <td className="der nowrap">{g.equilibrio === null ? "—" : <span title="Alumnos pagando que necesita para no perder">{g.equilibrio} pagando</span>}<div className="chico">tiene {g.n - g.becas}</div></td>
          </tr>,
          g.motivos.length > 0 && <tr key={g.s.id + "m"} className="af-motivo"><td /><td colSpan={6}><div className={`af-motivos ${CLASE[g.nivel]}`}>{g.motivos.map((m, i) => <span key={i}>{m}</span>)}</div></td></tr>,
        ])}</tbody>
        <tfoot><tr><td colSpan={2}>Total ({tot("n")} alumnos)</td><td className="der nowrap">{L(tot("esperado"))}</td><td className="der nowrap">{L(tot("costoMaestro") + tot("fijo"))}</td><td className={`der nowrap ${tot("resultado") < 0 ? "rojo" : "verde"}`}>{tot("resultado") < 0 ? "−" : ""}{L(Math.abs(tot("resultado")))}</td><td className="nowrap">{tot("facturado") > 0 ? `${((tot("cobrado") / tot("facturado")) * 100).toFixed(0)}% · ${L(tot("cobrado"))}` : "—"}</td><td /></tr></tfoot>
      </table></div>

      <div className="af-tarjetas">{grupos.map((g) => (
        <div key={g.s.id} className="af-tg">
          <div className="af-tg-cab"><div><div className="fuerte">{g.s.nombre}</div><div className="chico">{g.n} alumnos{g.becas > 0 && ` · ${g.becas} becas`}</div></div><Estado nivel={g.nivel} txt={etqGrupo[g.nivel]} /></div>
          <dl className="af-tg-dl">
            <dt>Cobra al mes</dt><dd>{L(g.esperado)}</dd>
            <dt>Maestro</dt><dd>{L(g.costoMaestro)}</dd>
            <dt>Gastos fijos</dt><dd>{L(g.fijo)}</dd>
            <dt className="fuerte">Resultado</dt><dd className={`fuerte ${g.resultado < 0 ? "rojo" : "verde"}`}>{g.resultado < 0 ? "−" : ""}{L(Math.abs(g.resultado))}{g.esperado > 0 && ` (${g.margen.toFixed(0)}%)`}</dd>
            <dt>Cobranza {mesCob.slice(0, 3)}</dt><dd>{g.pctCob === null ? "—" : `${g.pctCob.toFixed(0)}%`}</dd>
            <dt>Equilibrio</dt><dd>{g.equilibrio === null ? "—" : `${g.equilibrio} pagando`}</dd>
          </dl>
          {g.motivos.length > 0 && <div className={`af-motivos ${CLASE[g.nivel]}`} style={{ marginTop: 8 }}>{g.motivos.map((m, i) => <span key={i}>{m}</span>)}</div>}
        </div>))}
      </div>

      <p className="af-nota">
        <b>Resultado</b> = lo que cobra al mes (sin becados) − salario del maestro repartido entre sus grupos − su parte de gastos fijos.
        <b> Equilibrio</b> = cuántos alumnos pagando necesita para no perder. El costo del maestro depende de que cada maestro tenga bien marcados sus grupos en Maestros.
      </p>
    </section>}

    {tab === "otras" && <section className="af-panel">
      <div className="af-panel-cab"><div><h3 className="af-h">Otras alertas</h3><div className="af-sub">El mes en curso, pagos atrasados de la escuela y datos por revisar</div></div></div>
      {nOtras === 0 && <p className="af-vacio">✓ Sin alertas</p>}
      <div className="af-bloque">
        <div className="af-lista-t"><span>{resMes.mes} {resMes.anio}: ¿alcanza para cubrir el mes?</span></div>
        <div className="af-tabla-caja"><table>
          <thead><tr><th>Planilla</th><th>Servicios</th><th>Debe generar</th><th>Cobrado</th><th>Ya entró</th><th>Falta</th></tr></thead>
          <tbody><tr>
            <td className="nowrap">{L(resMes.planilla.mes)}</td><td className="nowrap">{L(resMes.servicios.mes)}</td><td className="nowrap fuerte">{L(resMes.meta)}</td>
            <td className="nowrap">{L(resMes.cobrado)}</td><td className="nowrap verde fuerte">{L(resMes.entro)}</td><td className={`nowrap fuerte ${resMes.falta > 0 ? "rojo" : ""}`}>{L(resMes.falta)}</td>
          </tr></tbody>
        </table></div>
      </div>
      {delSistema.length > 0 && <div className="af-bloque">
        <div className="af-lista-t"><span>Del mes y revisión de datos</span><span className="nowrap">{delSistema.length}</span></div>
        <div className="af-tabla-caja"><table>
          <thead><tr><th>Alerta</th><th>Detalle</th><th>Mes</th><th className="der">Monto</th><th>Qué hacer</th></tr></thead>
          <tbody>{delSistema.map((a, i) => <tr key={i}>
            <td><Estado nivel={a.grave ? "rojo" : "amarillo"} txt={a.tipo} /></td>
            <td className="af-corto" title={a.quien + (a.doc ? ` · ${a.doc}` : "")}>{a.quien}{a.doc && <div className="chico">{a.doc}</div>}</td>
            <td className="nowrap">{a.mes || "—"}</td>
            <td className="der nowrap">{a.monto ? L(a.monto) : "—"}</td>
            <td className="chico" style={{ minWidth: 220 }}>{a.accion}</td>
          </tr>)}</tbody>
        </table></div>
      </div>}
      {cxpAtrasadas.length > 0 && <div className="af-bloque">
        <div className="af-lista-t"><span>Cuentas por pagar de meses anteriores sin pagar</span><span className="ambar nowrap">{L(totCxp)}</span></div>
        <div className="af-tabla-caja"><table>
          <thead><tr><th>Concepto</th><th>Mes</th><th className="der">Monto</th></tr></thead>
          <tbody>{cxpAtrasadas.map((c) => <tr key={c.id}><td>{c.descripcion}</td><td className="nowrap">{c.mes_correspondiente} {c.anio_correspondiente || ""}</td><td className="der fuerte nowrap">{L(c.monto)}</td></tr>)}</tbody>
        </table></div>
        <div className="af-ayuda" style={{ marginTop: 6 }}>Se pagan desde Finanzas → Cuentas por pagar. Al pagarlas, el gasto sigue contando en su mes.</div>
      </div>}
      {(repetidos.length > 0 || compRepetidos.length > 0) && <div className="af-bloque">
        <div className="af-lista-t"><span className="rojo">Registros repetidos (inflan deudas o ingresos)</span><span className="nowrap">{repetidos.length + compRepetidos.length}</span></div>
        <div className="af-tabla-caja"><table>
          <thead><tr><th>Tipo</th><th>Alumno</th><th>Mes</th><th>Documento</th><th className="der">Monto</th></tr></thead>
          <tbody>
            {repetidos.map(({ f }) => <tr key={f.id}><td><Estado nivel="rojo" txt="Cobro repetido" /></td><td className="fuerte">{alPorId[f.alumno_id]?.nombre || "—"}</td><td className="nowrap">{f.mes_correspondiente} {anioDe(f)}</td><td className="nowrap">{f.numero_factura || "—"}</td><td className="der nowrap">{L(f.monto_total)}</td></tr>)}
            {compRepetidos.map((v) => <tr key={v[0].id}><td><Estado nivel="rojo" txt={`Pago guardado ${v.length} veces`} /></td><td className="fuerte">{alPorId[v[0].alumno_id]?.nombre || "—"}</td><td className="nowrap">{v[0].mes_correspondiente}</td><td className="nowrap">{v[0].numero_factura || "—"}</td><td className="der nowrap">{L(v[0].monto_total * (v.length - 1))}<div className="chico">de más ({L(v[0].monto_total)} c/u)</div></td></tr>)}
          </tbody>
        </table></div>
        <div className="af-ayuda" style={{ marginTop: 6 }}>Hay que anular las copias. Estas alertas no se cuentan dos veces en «Quién debe».</div>
      </div>}
    </section>}

    {verPdf && archivo?.tipo === "PDF" && <div className="af-modal" role="dialog" aria-label="Vista previa del PDF" onClick={(e) => e.target === e.currentTarget && setVerPdf(false)}>
      <div className="af-modal-caja">
        <div className="af-modal-cab">
          <b>Vista previa · {archivo.nombre}</b>
          <div className="af-acciones">
            <a href={archivo.url} download={archivo.nombre} onClick={() => setTimeout(() => { setVerPdf(false); setArchivo(null); }, 500)} style={{ ...btn("#15803D"), textDecoration: "none" }}><Download size={14} />Guardar PDF</a>
            <button type="button" onClick={() => setVerPdf(false)} style={btnO} aria-label="Cerrar"><X size={15} />Cerrar</button>
          </div>
        </div>
        <iframe title="Vista previa del PDF" src={archivo.url + "#view=FitH"} className="af-modal-pdf" />
      </div>
    </div>}
  </div>);
}
