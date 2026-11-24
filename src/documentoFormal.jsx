// ════════════════════════════════════════════════════════════
//  DOCUMENTOS FORMALES (Excel y PDF) PARA LAS PANTALLAS DE NÚMEROS
//  Cada pantalla de Finanzas y Contabilidad arma un "reporte" con las mismas
//  hojas que muestra en la Vista Excel (columnas + filas) y esta barra lo
//  convierte en:
//   · Excel con encabezado formal, logo, filas fijas y listo para imprimir.
//   · PDF tamaño carta con encabezado, logo y número de página, que primero
//     se ve dentro del sistema y luego se guarda.
//  Solo arma archivos: no lee ni escribe en la base de datos.
//
//  reporte = { titulo, periodo, modulo, hojas: [{ nombre, titulo, columnas, filas, pie }] }
//  columnas = [{ t, num?, pct?, ancho? }] · filas = [{ tipo?: sec|it|det|tot|gran|vacia, c: [...], color? }]
// ════════════════════════════════════════════════════════════
import { useState } from "react";
import { FileSpreadsheet, FileText, Download, X } from "lucide-react";
import { btn, btnO } from "./estilo";
import { useMarca } from "./marca";
import { logoParaExcel } from "./alertasFinanzas";
import "./alertasFinanzas.css";
import { fuentesExcel, EXCEL_TEXTO, cargarFuentesInforme } from "./tipografia";

const AZUL = "#1B2A4A", NARANJA = "#D9641E", GRIS = "#5B6576", BANDA = "#F4F6F9", LINEA = "#D5DAE1", TOTAL = "#E8ECF2";
const FMT_L = '"L "#,##0.00;[Red]-"L "#,##0.00';
const SANS = "IBM Plex Sans", MONO = "IBM Plex Mono"; // títulos y textos / cifras y %
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const Lh = (v) => { const n = Math.round((Number(v) || 0) * 100) / 100; const t = `L&nbsp;${Math.abs(n).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; return n < 0 ? `(${t})` : t; };
const generadoTxt = () => new Date().toLocaleString("es-HN", { dateStyle: "long", timeStyle: "short" });
const archivoTxt = (r) => `${r.titulo}${r.periodo ? " " + r.periodo : ""}`.replace(/[\\/:*?"<>|]/g, "-");

// ── Excel ──
// ── Encabezado del Excel ──
// "A" membrete centrado: nombre y título centrados sobre toda la tabla, franja gris fina con periodo y fecha.
// "B" ejecutivo a dos lados: logo y nombre a la izquierda, periodo y fecha a la derecha, línea azul fina.
export function encabezadoExcel(estilo, { ancho, logo, nombre, sub, titulo, periodo, generado }) {
  const vacia = (alto) => { const f = Array(ancho).fill(null); f[0] = { value: null, height: alto }; return f; };
  const conAlto = (f, alto) => { f[0] = { ...(f[0] || { value: null }), height: alto }; return f; };
  const fechaCorta = new Date().toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (estilo === "B") {
    const izq = ancho > 1 ? ancho - 1 : 1;
    const fila = (a, d, alto) => { const f = Array(ancho).fill(null); f[0] = { align: "left", ...a, columnSpan: izq, indent: logo ? 8 : undefined }; if (ancho > 1) f[ancho - 1] = { align: "right", ...d }; return conAlto(f, alto); };
    const raya = Array(ancho).fill(0).map(() => ({ value: null, bottomBorderColor: AZUL, bottomBorderStyle: "thin" })); raya[0].height = 4;
    return [
      fila({ value: nombre, fontWeight: "bold", fontSize: 15, textColor: AZUL, alignVertical: "bottom" }, { value: periodo || "", fontWeight: "bold", fontSize: 11, textColor: AZUL, alignVertical: "bottom" }, 24),
      fila({ value: sub, fontSize: 9.5, textColor: GRIS, alignVertical: "top" }, { value: `Emitido el ${fechaCorta}`, fontSize: 9, textColor: GRIS, alignVertical: "top" }, 15),
      fila({ value: titulo, fontWeight: "bold", fontSize: 12.5, textColor: "#1F2937", alignVertical: "bottom" }, { value: "Cifras en Lempiras (L)", fontSize: 9, textColor: GRIS, alignVertical: "bottom" }, 22),
      raya, vacia(10),
    ];
  }
  const centro = (cel, alto) => { const f = Array(ancho).fill(null); f[0] = { align: "center", ...cel, columnSpan: ancho }; return conAlto(f, alto); };
  const franja = Array(ancho).fill(null);
  franja[0] = { value: [periodo ? `Periodo: ${periodo}` : null, `Emitido el ${fechaCorta}`, "Cifras en Lempiras (L)"].filter(Boolean).join("     |     "), columnSpan: ancho, align: "center", alignVertical: "center", fontSize: 9, textColor: GRIS, backgroundColor: BANDA, topBorderColor: "#C9D1DC", topBorderStyle: "thin", bottomBorderColor: "#C9D1DC", bottomBorderStyle: "thin", height: 20 };
  return [
    centro({ value: nombre, fontWeight: "bold", fontSize: 16, textColor: AZUL, alignVertical: "bottom" }, 28),
    centro({ value: sub, fontSize: 9.5, textColor: GRIS, alignVertical: "top" }, 16),
    centro({ value: titulo, fontWeight: "bold", fontSize: 12.5, textColor: "#1F2937", alignVertical: "center" }, 24),
    vacia(6), franja, vacia(10),
  ];
}

export async function crearExcelFormal(writeExcelFile, extraHoja, reporte, marca, logo, estilo = "A") {
  const generado = generadoTxt();
  const libro = reporte.hojas.map((h) => {
    const ancho = h.columnas.length;
    const enc = encabezadoExcel(estilo, { ancho, logo, nombre: marca.nombre, sub: `${reporte.modulo}${marca.sede ? " · " + marca.sede : ""}`, titulo: h.titulo || reporte.titulo, periodo: reporte.periodo, generado });
    const titulos = h.columnas.map((c) => ({ value: c.t, align: c.num || c.pct ? "right" : "left", fontWeight: "bold", textColor: "#FFFFFF", backgroundColor: AZUL, wrap: true, alignVertical: "center", height: 30 }));
    let par = 0;
    const cuerpo = h.filas.filter((f) => f.tipo !== "vacia").map((f) => {
      const t = f.tipo || "it"; const neg = ["sec", "tot", "gran"].includes(t);
      const fondo = t === "sec" ? TOTAL : t === "gran" ? TOTAL : t === "it" && (par++ % 2) ? BANDA : undefined;
      const lin = t === "tot" || t === "gran" ? { topBorderColor: AZUL, topBorderStyle: "thin", bottomBorderColor: AZUL, bottomBorderStyle: t === "gran" ? "double" : "thin" } : { bottomBorderColor: LINEA, bottomBorderStyle: "thin" };
      return h.columnas.map((c, i) => {
        const v = (f.c || [])[i];
        const base = { fontWeight: neg ? "bold" : undefined, backgroundColor: fondo, textColor: t === "det" ? GRIS : (c.num && f.color) || undefined, alignVertical: "top", indent: i === 0 && t === "det" ? 2 : i === 0 && t === "it" && h.sangria !== false ? 1 : undefined, ...lin };
        if (c.num && typeof v === "number") return { ...base, value: Math.round(v * 100) / 100, type: Number, format: FMT_L, fontFamily: MONO };
        if (c.pct && typeof v === "number") return { ...base, value: v / 100, type: Number, format: "0.0%", align: "right", fontFamily: MONO };
        return { ...base, value: v === undefined || v === null || v === "" ? null : String(v), type: String, wrap: i === 0 || !c.ancho };
      });
    });
    const notas = h.pie ? [[], [{ value: h.pie, fontSize: 9, textColor: GRIS, wrap: true, columnSpan: ancho, height: 28, alignVertical: "top" }, ...Array(ancho - 1).fill(null)]] : [];
    return {
      data: [...enc, titulos, ...cuerpo, ...notas],
      sheet: (h.nombre || h.titulo || "Hoja").replace(/[\\/?*[\]:]/g, "-").slice(0, 31),
      columns: h.columnas.map((c, i) => ({ width: c.ancho ? Math.max(11, Math.round(c.ancho / 7)) : i === 0 ? 46 : 30 })),
      stickyRowsCount: enc.length + 1, showGridLines: false,
      orientation: ancho > 4 ? "landscape" : "portrait", ajustarAncho: true, pie: `${marca.nombre} · ${reporte.modulo} · ${reporte.titulo}`,
      images: logo ? [{ ...logo, dpi: 96, anchor: { row: 1, column: 1 }, offsetX: 4, offsetY: 4, title: marca.nombre }] : undefined,
    };
  });
  return writeExcelFile(fuentesExcel(libro), { fontFamily: EXCEL_TEXTO, fontSize: 10, features: [extraHoja] });
}

// ── PDF (HTML que html2pdf convierte) ──
const CSS = `
.pf{width:100%;background:#fff;color:#1F2937;font-family:"IBM Plex Sans",Arial,sans-serif;font-size:10.5px;line-height:1.4}
.pf td.der,.pf .p b{font-family:"IBM Plex Mono",Consolas,monospace;font-size:10px}
.pf *{box-sizing:border-box}
.pf .cab{display:flex;align-items:center;gap:16px;padding-bottom:11px;border-bottom:2px solid ${NARANJA}}
.pf .cab img{width:60px;height:60px;object-fit:contain}
.pf .cab .t{flex:1}
.pf .cab .n{font-family:"IBM Plex Sans",Arial,sans-serif;font-size:18px;font-weight:700;color:${AZUL}}
.pf .cab .s{font-size:10.5px;color:${GRIS};margin-top:1px}
.pf .cab .d{font-size:15px;font-weight:700;color:${AZUL};margin-top:5px}
.pf .cab .p{text-align:right;font-size:9.5px;color:${GRIS};line-height:1.6}
.pf .cab .p b{color:#1F2937}
.pf .sec{margin-top:16px}
.pf .salto{page-break-before:always;break-before:page;margin-top:0}
.pf h2{font-family:"IBM Plex Sans",Arial,sans-serif;font-size:13px;margin:0 0 6px;color:${AZUL}}
.pf table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.pf th{background:${AZUL};color:#fff;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:.3px;padding:6px 7px;text-align:left}
.pf th.der{text-align:right}
.pf td{padding:4px 7px;border-bottom:1px solid #E4E8EE;vertical-align:top}
.pf tr.it:nth-child(even) td{background:#F6F7F9}
.pf tr.sec td{background:${TOTAL};font-weight:700;color:${AZUL}}
.pf tr.det td{color:${GRIS};font-size:9.5px}
.pf tr.det td.c0{padding-left:22px}
.pf tr.it td.c0.sg{padding-left:14px}
.pf tr.tot td{font-weight:700;border-top:1px solid ${AZUL}}
.pf tr.gran td{font-weight:800;background:${TOTAL};border-top:1px solid ${AZUL};border-bottom:3px double ${AZUL}}
.pf tr.vacia td{border:0;height:8px}
.pf .der{text-align:right;white-space:nowrap;font-family:"IBM Plex Mono",Consolas,monospace}
.pf .nota{font-size:9px;color:${GRIS};margin-top:5px;line-height:1.5}
.pf .firmas{display:flex;gap:40px;margin-top:38px}
.pf .firmas div{flex:1;border-top:1px solid #1F2937;padding-top:4px;font-size:9.5px;text-align:center;color:${GRIS}}
.pf .pie{margin-top:14px;padding-top:6px;border-top:1px solid #DCE1E8;font-size:8.5px;color:${GRIS};display:flex;justify-content:space-between}
`;
export function documentoFormal(reporte, marca) {
  const celda = (c, v) => (c.num && typeof v === "number" ? Lh(v) : c.pct && typeof v === "number" ? `${v.toFixed(1)}%` : esc(v ?? ""));
  const tabla = (h) => `<table><thead><tr>${h.columnas.map((c) => `<th class="${c.num || c.pct ? "der" : ""}"${c.ancho ? ` style="width:${c.ancho}px"` : ""}>${esc(c.t)}</th>`).join("")}</tr></thead><tbody>
    ${h.filas.map((f) => { const t = f.tipo || "it"; if (t === "vacia") return `<tr class="vacia"><td colspan="${h.columnas.length}"></td></tr>`;
      return `<tr class="${t}">${h.columnas.map((c, i) => `<td class="${i === 0 ? "c0" + (h.sangria !== false ? " sg" : "") : ""} ${c.num || c.pct ? "der" : ""}"${f.color && c.num ? ` style="color:${f.color}"` : ""}>${celda(c, (f.c || [])[i])}</td>`).join("")}</tr>`; }).join("")}
  </tbody></table>${h.pie ? `<div class="nota">${esc(h.pie)}</div>` : ""}`;
  const cab = `<div class="cab">${marca.logo ? `<img src="${esc(marca.logo)}" alt="">` : ""}<div class="t"><div class="n">${esc(marca.nombre)}</div><div class="s">${esc(reporte.modulo)}${marca.sede ? " · " + esc(marca.sede) : ""}</div><div class="d">${esc(reporte.titulo)}</div></div>
    <div class="p">${reporte.periodo ? `Periodo: <b>${esc(reporte.periodo)}</b><br>` : ""}Generado el <b>${esc(generadoTxt())}</b><br>Cifras en Lempiras (L)</div></div>`;
  const secciones = reporte.hojas.map((h, i) => `<div class="sec${i > 0 && reporte.hojas.length > 1 && h.filas.length > 18 ? " salto" : ""}">${reporte.hojas.length > 1 || h.titulo !== reporte.titulo ? `<h2>${esc(h.titulo || h.nombre)}</h2>` : ""}${tabla(h)}</div>`).join("");
  const firmas = reporte.firmas ? `<div class="firmas"><div>Elaborado por</div><div>Revisado por</div><div>Administración</div></div>` : "";
  return `<div class="pf"><style>${CSS}</style>${cab}${secciones}${firmas}<div class="pie"><span>${esc(marca.nombre)} · ${esc(reporte.modulo)} · ${esc(reporte.titulo)}</span><span>Documento generado por el sistema</span></div></div>`;
}

// ── Barra con los dos botones y la vista previa del PDF ──
// `reporte` puede ser el objeto o una función que lo devuelve (se arma al tocar el botón).
export function BarraDescargas({ reporte, showToast, sede, compacto }) {
  const m = useMarca();
  const [generando, setGenerando] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [verPdf, setVerPdf] = useState(false);
  const marca = { nombre: m.nombreO("Seeds English School"), logo: m.logoSrc, sede };
  const obtener = () => (typeof reporte === "function" ? reporte() : reporte);
  const listo = (blob, ext, tipo, r) => {
    if (archivo) URL.revokeObjectURL(archivo.url);
    setArchivo({ url: URL.createObjectURL(blob), nombre: `${archivoTxt(r)}.${ext}`, tipo });
    if (tipo === "PDF") setVerPdf(true);
  };
  const excel = async () => {
    if (generando) return; setGenerando("excel");
    try {
      const r = obtener();
      const [{ default: writeExcelFile }, { extraHoja }] = await Promise.all([import("write-excel-file/browser"), import("./alertasExcel")]);
      const logo = await logoParaExcel(marca.logo);
      listo(await (await crearExcelFormal(writeExcelFile, extraHoja, r, marca, logo)).toBlob(), "xlsx", "Excel", r);
    } catch (e) { showToast ? showToast("No se pudo crear el Excel: " + e.message, "error") : console.error(e); }
    finally { setGenerando(""); }
  };
  const pdf = async () => {
    if (generando) return; setGenerando("pdf");
    try {
      const r = obtener();
      const horizontal = r.hojas.some((h) => h.columnas.length > 4);
      const { default: html2pdf } = await import("html2pdf.js");
      await cargarFuentesInforme();
      const doc = await html2pdf().set({
        margin: [10, 10, 12, 10], image: { type: "jpeg", quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollY: 0 },
        jsPDF: { unit: "mm", format: "letter", orientation: horizontal ? "landscape" : "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".cab", "h2", ".firmas"] },
      }).from(documentoFormal(r, marca), "string").toPdf().get("pdf");
      const total = doc.internal.getNumberOfPages(), an = doc.internal.pageSize.getWidth(), al = doc.internal.pageSize.getHeight();
      for (let i = 1; i <= total; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(91, 101, 118); doc.text(`Página ${i} de ${total}`, an - 10, al - 5, { align: "right" }); }
      listo(new Blob([doc.output("blob")], { type: "application/pdf" }), "pdf", "PDF", r);
    } catch (e) { showToast ? showToast("No se pudo crear el PDF: " + e.message, "error") : console.error(e); }
    finally { setGenerando(""); }
  };
  const chico = compacto ? { fontSize: 12, padding: "6px 10px" } : {};
  return (<>
    <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" onClick={excel} disabled={!!generando} style={{ ...btnO, ...chico, opacity: generando === "excel" ? 0.6 : 1 }}><FileSpreadsheet size={14} />{generando === "excel" ? "Creando Excel…" : "Excel"}</button>
      <button type="button" onClick={pdf} disabled={!!generando} style={{ ...btnO, ...chico, opacity: generando === "pdf" ? 0.6 : 1 }}><FileText size={14} />{generando === "pdf" ? "Creando PDF…" : "PDF"}</button>
      {archivo?.tipo === "Excel" && <a href={archivo.url} download={archivo.nombre} onClick={() => { const u = archivo.url; setTimeout(() => setArchivo((x) => (x && x.url === u ? null : x)), 500); }} style={{ ...btn("#15803D"), ...chico, textDecoration: "none" }}><Download size={14} />Guardar Excel</a>}
      {archivo?.tipo === "PDF" && !verPdf && <button type="button" onClick={() => setVerPdf(true)} style={{ ...btn("#15803D"), ...chico }}><FileText size={14} />Ver PDF</button>}
    </div>
    {verPdf && archivo?.tipo === "PDF" && <div className="af-modal" role="dialog" aria-label="Vista previa del PDF" onClick={(e) => e.target === e.currentTarget && setVerPdf(false)}>
      <div className="af-modal-caja" style={{ background: "#fff" }}>
        <div className="af-modal-cab">
          <b>Vista previa · {archivo.nombre}</b>
          <div style={{ display: "flex", gap: 8 }}>
            <a href={archivo.url} download={archivo.nombre} onClick={() => setTimeout(() => { setVerPdf(false); setArchivo(null); }, 500)} style={{ ...btn("#15803D"), textDecoration: "none" }}><Download size={14} />Guardar PDF</a>
            <button type="button" onClick={() => setVerPdf(false)} style={btnO} aria-label="Cerrar"><X size={15} />Cerrar</button>
          </div>
        </div>
        <iframe title="Vista previa del PDF" src={archivo.url + "#view=FitH"} className="af-modal-pdf" />
      </div>
    </div>}
  </>);
}
