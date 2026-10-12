// ════════════════════════════════════════════════════════════
//  PARTE MENSUAL DE ASISTENCIA
//  Como se maneja en Honduras: por alumno se anotan asistencias e
//  inasistencias (justificadas / injustificadas); el porcentaje se calcula
//  para el GRUPO al final: días trabajados, matrícula, asistencia media y
//  % de asistencia = asistencia media ÷ matrícula × 100.
//  Se ve en administración y en el portal docente, y se descarga en PDF o Excel.
// ════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { LOGO_SEEDS } from "./logo";
import { card, input, btn, btnO } from "./estilo";
import { Download, FileSpreadsheet, Printer, X } from "lucide-react";

const ESTADOS = {
  presente: { k: "P", l: "Presente", c: "#059669" },
  tarde: { k: "T", l: "Tarde", c: "#D97706" },
  ausente: { k: "A", l: "Ausente", c: "#DC2626" },
  justificado: { k: "Pm", l: "Permiso", c: "#2563EB" },
};
const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
const hoyISO = () => new Date().toLocaleDateString("en-CA");
const nombreMes = (mes) => { const t = new Date(mes + "-15T12:00:00").toLocaleDateString("es-HN", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const sinTildes = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f1 = (n) => (Math.round(n * 10) / 10).toLocaleString("es-HN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Cálculos del parte (se usan en pantalla, PDF y Excel)
function calcular(alumnosGrupo, regs, sec) {
  const dias = [...new Set(regs.map((r) => r.fecha))].sort();
  const marca = {}; regs.forEach((r) => { marca[`${r.alumno_id}|${r.fecha}`] = r.estado; });
  const conRegistro = new Set(regs.map((r) => r.alumno_id));
  const lista = alumnosGrupo
    .filter((a) => (a.seccion_id === sec && a.estado === "activo") || conRegistro.has(a.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const filas = lista.map((a) => {
    const est = dias.map((d) => marca[`${a.id}|${d}`] || "");
    const n = (e) => est.filter((x) => x === e).length;
    const retirado = a.estado !== "activo" || a.seccion_id !== sec;
    return { a, est, retirado, asist: n("presente") + n("tarde"), tarde: n("tarde"), perm: n("justificado"), faltas: n("ausente"), sinMarca: est.filter((x) => !x).length };
  });
  const presentesDia = dias.map((_, i) => filas.filter((f) => f.est[i] === "presente" || f.est[i] === "tarde").length);
  const totAsist = filas.reduce((s, f) => s + f.asist, 0);
  const totPerm = filas.reduce((s, f) => s + f.perm, 0);
  const totFaltas = filas.reduce((s, f) => s + f.faltas, 0);
  const matricula = filas.filter((f) => !f.retirado).length;
  const media = dias.length ? totAsist / dias.length : 0;
  const pct = matricula ? (media / matricula) * 100 : 0;
  const sinMarca = filas.reduce((s, f) => s + f.sinMarca, 0);
  return { dias, filas, presentesDia, totAsist, totPerm, totFaltas, totInasist: totPerm + totFaltas, matricula, retirados: filas.length - matricula, media, pct, sinMarca };
}

export function ParteMensual({ secciones, alumnos, docentesDe, sede, avisar, seccionInicial }) {
  const [sec, setSec] = useState(seccionInicial || secciones[0]?.id || "");
  const [mes, setMes] = useState(hoyISO().slice(0, 7));
  const [regs, setRegs] = useState(null);
  const [archivo, setArchivo] = useState(null); // { url, nombre, tipo }
  const [generando, setGenerando] = useState("");
  const s = secciones.find((x) => x.id === sec);

  useEffect(() => { (async () => {
    if (!sec) { setRegs([]); return; }
    setRegs(null);
    const todas = [];
    for (let i = 0; i < 20; i++) {
      const { data, error } = await supabase.from("asistencias").select("alumno_id,fecha,estado").eq("seccion_id", sec).gte("fecha", mes + "-01").lte("fecha", mes + "-31").order("fecha").range(i * 1000, i * 1000 + 999);
      if (error) { avisar && avisar("Error: " + error.message, "error"); setRegs([]); return; }
      todas.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    setRegs(todas);
  })(); }, [sec, mes]);

  const p = regs ? calcular(alumnos, regs, sec) : null;
  const docentes = (docentesDe && docentesDe(sec)) || "";
  const titulo = { grupo: s?.nombre || "", mes: nombreMes(mes), docentes, sede: sede || "" };
  const nombreArchivo = `Parte_mensual_${sinTildes(s?.nombre)}_${mes}`;
  const listo = (blob, ext, tipo) => { if (archivo) URL.revokeObjectURL(archivo.url); setArchivo({ url: URL.createObjectURL(blob), nombre: `${nombreArchivo}.${ext}`, tipo }); };

  const descargarPDF = async () => {
    setGenerando("pdf");
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const blob = await html2pdf().set({ margin: [8, 8, 8, 8], image: { type: "jpeg", quality: 0.96 }, html2canvas: { scale: 2, backgroundColor: "#ffffff" }, jsPDF: { unit: "mm", format: "letter", orientation: "landscape" } })
        .from(documentoHTML(p, titulo), "string").outputPdf("blob");
      listo(blob, "pdf", "PDF");
    } catch (e) { avisar && avisar("No se pudo crear el PDF: " + e.message, "error"); }
    setGenerando("");
  };
  const descargarExcel = async () => {
    setGenerando("excel");
    try {
      const writeExcelFile = (await import("write-excel-file/browser")).default;
      const { datos, columnas } = hojaExcel(p, titulo);
      const blob = await writeExcelFile(datos, { columns: columnas, sheet: "Parte mensual", orientation: "landscape", stickyRowsCount: 6, fontFamily: "Calibri", fontSize: 11 }).toBlob();
      listo(blob, "xlsx", "Excel");
    } catch (e) { avisar && avisar("No se pudo crear el Excel: " + e.message, "error"); }
    setGenerando("");
  };
  const imprimir = () => {
    const w = window.open("", "_blank"); if (!w) { avisar && avisar("Permite las ventanas emergentes para imprimir", "error"); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(nombreArchivo)}</title><style>@page{size:letter landscape;margin:10mm}</style></head><body>${documentoHTML(p, titulo)}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  };

  const celda = { padding: "6px 4px", borderBottom: "1px solid #EEF2F7", textAlign: "center", fontSize: 12 };
  const num = (v, c) => <td style={{ ...celda, fontWeight: 700, color: v ? c : "#CBD5E1" }}>{v}</td>;

  return (<div>
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      <select value={sec} onChange={(e) => setSec(e.target.value)} style={{ ...input, width: "auto", minWidth: 200, cursor: "pointer" }}>
        {secciones.length === 0 && <option value="">Sin grupos</option>}
        {secciones.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
      </select>
      <input type="month" value={mes} max={hoyISO().slice(0, 7)} onChange={(e) => e.target.value && setMes(e.target.value)} style={{ ...input, width: 180 }} />
      <span style={{ flex: 1 }} />
      <button onClick={descargarExcel} disabled={!p?.dias.length || !!generando} style={{ ...btn("#059669"), opacity: !p?.dias.length || generando ? 0.5 : 1 }}><FileSpreadsheet size={15} />{generando === "excel" ? "Creando…" : "Excel"}</button>
      <button onClick={descargarPDF} disabled={!p?.dias.length || !!generando} style={{ ...btn(), opacity: !p?.dias.length || generando ? 0.5 : 1 }}><Download size={15} />{generando === "pdf" ? "Creando…" : "PDF"}</button>
      <button onClick={imprimir} disabled={!p?.dias.length} style={{ ...btnO, opacity: p?.dias.length ? 1 : 0.5 }}><Printer size={15} />Imprimir</button>
    </div>

    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", borderBottom: "2px solid #F97316", paddingBottom: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9A3412", letterSpacing: 1, textTransform: "uppercase" }}>Parte mensual de asistencia</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1E293B" }}>{s?.nombre || "—"} · {nombreMes(mes)}</div>
          {docentes && <div style={{ fontSize: 12, color: "#64748B" }}>Docente{docentes.includes(",") || docentes.includes(" y ") ? "s" : ""}: {docentes}</div>}
        </div>
        {p && <div style={{ fontSize: 12, color: "#64748B", textAlign: "right" }}>{p.dias.length} {p.dias.length === 1 ? "día de clase" : "días de clase"}<br />Matrícula: {p.matricula}{p.retirados ? ` (+${p.retirados} retirado${p.retirados > 1 ? "s" : ""})` : ""}</div>}
      </div>

      {regs === null ? <div style={{ padding: 30, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Cargando…</div>
        : !p.dias.length ? <div style={{ padding: 30, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No hay asistencia registrada para este grupo en {nombreMes(mes)}.</div>
        : (<>
          <div style={{ overflowX: "auto" }}>
            <table data-tarjetas="no" style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead><tr style={{ background: "#FFF7ED" }}>
                <th style={{ ...celda, textAlign: "left", color: "#9A3412", width: 26 }}>N.º</th>
                <th style={{ ...celda, textAlign: "left", color: "#9A3412", minWidth: 170, position: "sticky", left: 0, background: "#FFF7ED" }}>Alumno</th>
                {p.dias.map((d) => { const dt = new Date(d + "T12:00:00"); return <th key={d} style={{ ...celda, color: "#9A3412", minWidth: 26 }}><div style={{ fontSize: 9, fontWeight: 600 }}>{DIAS[dt.getDay()]}</div>{dt.getDate()}</th>; })}
                {["Asist.", "Tarde", "Perm.", "Faltas"].map((h) => <th key={h} style={{ ...celda, background: "#F1F5F9", color: "#475569", minWidth: 46 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {p.filas.map((f, i) => (
                  <tr key={f.a.id}>
                    <td style={{ ...celda, color: "#94A3B8", textAlign: "left" }}>{i + 1}</td>
                    <td style={{ ...celda, textAlign: "left", fontWeight: 600, color: f.retirado ? "#94A3B8" : "#1E293B", position: "sticky", left: 0, background: "rgba(255,255,255,.92)", whiteSpace: "nowrap" }}>{f.a.nombre}{f.retirado && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 6 }}>(retirado)</span>}</td>
                    {f.est.map((e, j) => { const x = ESTADOS[e]; return <td key={j} style={celda}>{x ? <span title={x.l} style={{ display: "inline-block", minWidth: 20, padding: "1px 3px", borderRadius: 5, background: x.c + "1A", color: x.c, fontWeight: 800, fontSize: 11 }}>{x.k}</span> : <span style={{ color: "#E2E8F0" }}>·</span>}</td>; })}
                    {num(f.asist, "#059669")}{num(f.tarde, "#D97706")}{num(f.perm, "#2563EB")}{num(f.faltas, "#DC2626")}
                  </tr>
                ))}
                <tr style={{ background: "#F8FAFC" }}>
                  <td />
                  <td style={{ ...celda, textAlign: "left", fontWeight: 700, color: "#475569", position: "sticky", left: 0, background: "#F8FAFC" }}>Presentes por día</td>
                  {p.presentesDia.map((n, i) => <td key={i} style={{ ...celda, fontWeight: 700, color: "#475569" }}>{n}</td>)}
                  <td style={{ ...celda, fontWeight: 800, color: "#059669" }}>{p.totAsist}</td>
                  <td style={{ ...celda, fontWeight: 800, color: "#D97706" }}>{p.filas.reduce((s2, f) => s2 + f.tarde, 0)}</td>
                  <td style={{ ...celda, fontWeight: 800, color: "#2563EB" }}>{p.totPerm}</td>
                  <td style={{ ...celda, fontWeight: 800, color: "#DC2626" }}>{p.totFaltas}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginTop: 16 }}>
            {[
              ["Días trabajados", p.dias.length],
              ["Matrícula", p.matricula],
              ["Total asistencias", p.totAsist],
              ["Inasistencias", `${p.totInasist}`, `${p.totPerm} con permiso · ${p.totFaltas} sin permiso`],
              ["Asistencia media", f1(p.media), "alumnos por día"],
              ["% de asistencia del grupo", `${f1(p.pct)}%`, "asistencia media ÷ matrícula"],
            ].map(([t, v, sub]) => (
              <div key={t} style={{ background: "rgba(255,247,237,.7)", border: "1px solid #FED7AA", borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9A3412", textTransform: "uppercase", letterSpacing: 0.4 }}>{t}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#1E293B" }}>{v}</div>
                {sub && <div style={{ fontSize: 10, color: "#64748B" }}>{sub}</div>}
              </div>
            ))}
          </div>
          {p.sinMarca > 0 && <div style={{ fontSize: 12, color: "#9A3412", marginTop: 10 }}>⚠ Hay {p.sinMarca} {p.sinMarca === 1 ? "casilla" : "casillas"} sin marcar; no cuentan como asistencia ni como falta.</div>}
          <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "#64748B", flexWrap: "wrap" }}>{Object.values(ESTADOS).map((e) => <span key={e.k}><strong style={{ color: e.c }}>{e.k}</strong> {e.l}</span>)}<span>· Asist. = presentes + tardes</span></div>
        </>)}
    </div>

    {archivo && <div onClick={() => setArchivo(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 22, padding: 24, width: "100%", maxWidth: 380, textAlign: "center", position: "relative" }}>
        <button onClick={() => setArchivo(null)} aria-label="Cerrar" style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={18} /></button>
        <div style={{ width: 54, height: 54, margin: "0 auto", borderRadius: 999, background: archivo.tipo === "Excel" ? "#ECFDF5" : "#FFF7ED", color: archivo.tipo === "Excel" ? "#059669" : "#EA580C", display: "flex", alignItems: "center", justifyContent: "center" }}>{archivo.tipo === "Excel" ? <FileSpreadsheet size={26} /> : <Download size={26} />}</div>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", margin: "10px 0 4px" }}>Parte mensual listo</h3>
        <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 16px", wordBreak: "break-all" }}>{archivo.nombre}</p>
        <a href={archivo.url} download={archivo.nombre} onClick={() => setTimeout(() => setArchivo(null), 400)} style={{ ...btn(archivo.tipo === "Excel" ? "#059669" : undefined), textDecoration: "none", justifyContent: "center", width: "100%", boxSizing: "border-box" }}><Download size={15} />Descargar {archivo.tipo}</a>
      </div>
    </div>}
  </div>);
}

// ── Documento para PDF e impresión ──
function documentoHTML(p, t) {
  const th = "border:1px solid #CBD5E1;padding:4px 3px;font-size:9px;background:#FFF7ED;color:#9A3412";
  const td = "border:1px solid #E2E8F0;padding:3px;font-size:9px;text-align:center";
  return `<div style="font-family:'Segoe UI',Arial,sans-serif;color:#1E293B;width:100%">
    <div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid #F97316;padding-bottom:8px;margin-bottom:8px">
      <img src="${LOGO_SEEDS}" style="width:54px;height:54px;object-fit:contain"/>
      <div style="flex:1"><div style="font-size:15px;font-weight:800">SEEDS ENGLISH SCHOOL</div>
        <div style="font-size:11px;color:#64748B">${t.sede ? esc(t.sede) + " · " : ""}Jesús de Otoro, Intibucá, Honduras</div></div>
      <div style="text-align:right"><div style="font-size:13px;font-weight:800;color:#9A3412">PARTE MENSUAL DE ASISTENCIA</div>
        <div style="font-size:11px">${esc(t.mes)}</div></div>
    </div>
    <div style="display:flex;gap:24px;font-size:11px;margin-bottom:8px"><div><b>Grupo:</b> ${esc(t.grupo)}</div>${t.docentes ? `<div><b>Docente:</b> ${esc(t.docentes)}</div>` : ""}<div><b>Días trabajados:</b> ${p.dias.length}</div><div><b>Matrícula:</b> ${p.matricula}</div></div>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr><th style="${th};width:18px">N.º</th><th style="${th};text-align:left">Alumno</th>
        ${p.dias.map((d) => { const dt = new Date(d + "T12:00:00"); return `<th style="${th};width:18px">${DIAS[dt.getDay()]}<br/>${dt.getDate()}</th>`; }).join("")}
        <th style="${th};background:#F1F5F9;color:#334155">Asist.</th><th style="${th};background:#F1F5F9;color:#334155">Tarde</th><th style="${th};background:#F1F5F9;color:#334155">Perm.</th><th style="${th};background:#F1F5F9;color:#334155">Faltas</th></tr></thead>
      <tbody>${p.filas.map((f, i) => `<tr><td style="${td}">${i + 1}</td><td style="${td};text-align:left;white-space:nowrap${f.retirado ? ";color:#94A3B8" : ""}">${esc(f.a.nombre)}${f.retirado ? " (retirado)" : ""}</td>
        ${f.est.map((e) => { const x = ESTADOS[e]; return `<td style="${td};font-weight:700;color:${x ? x.c : "#CBD5E1"}">${x ? x.k : "·"}</td>`; }).join("")}
        <td style="${td};font-weight:800">${f.asist}</td><td style="${td}">${f.tarde}</td><td style="${td}">${f.perm}</td><td style="${td};font-weight:700;color:${f.faltas ? "#DC2626" : "#1E293B"}">${f.faltas}</td></tr>`).join("")}
        <tr><td style="${td}"></td><td style="${td};text-align:left;font-weight:700">Presentes por día</td>${p.presentesDia.map((n) => `<td style="${td};font-weight:700">${n}</td>`).join("")}
        <td style="${td};font-weight:800">${p.totAsist}</td><td style="${td}">${p.filas.reduce((s, f) => s + f.tarde, 0)}</td><td style="${td}">${p.totPerm}</td><td style="${td};font-weight:800">${p.totFaltas}</td></tr></tbody>
    </table>
    <table style="border-collapse:collapse;margin-top:10px;font-size:10px">
      <tr>${[["Días trabajados", p.dias.length], ["Matrícula", p.matricula], ["Total asistencias", p.totAsist], ["Inasistencias (con permiso / sin permiso)", `${p.totInasist} (${p.totPerm} / ${p.totFaltas})`], ["Asistencia media", f1(p.media)], ["% de asistencia del grupo", f1(p.pct) + "%"]]
        .map(([k, v]) => `<td style="border:1px solid #FED7AA;padding:5px 8px;background:#FFF7ED"><div style="color:#9A3412;font-weight:700">${k}</div><div style="font-size:13px;font-weight:800">${v}</div></td>`).join("")}</tr>
    </table>
    <div style="font-size:9px;color:#64748B;margin-top:4px">P = Presente · T = Tarde · A = Ausente · Pm = Permiso · Asist. = presentes + tardes · % de asistencia = asistencia media ÷ matrícula × 100</div>
    <div style="display:flex;justify-content:space-around;margin-top:36px;font-size:10px;text-align:center">
      <div style="border-top:1px solid #334155;width:220px;padding-top:4px">Firma del docente</div>
      <div style="border-top:1px solid #334155;width:220px;padding-top:4px">Firma y sello de dirección</div>
    </div>
  </div>`;
}

// ── Hoja de Excel ──
function hojaExcel(p, t) {
  const nCols = 2 + p.dias.length + 4;
  const borde = { borderColor: "#CBD5E1", borderStyle: "thin" };
  const enc = { fontWeight: "bold", backgroundColor: "#FFEDD5", textColor: "#9A3412", align: "center", alignVertical: "center", ...borde };
  const fila = (vals) => vals;
  const titulo = (v, extra = {}) => [{ value: v, columnSpan: nCols, ...extra }, ...Array(nCols - 1).fill(null)];
  const datos = [
    titulo("SEEDS ENGLISH SCHOOL — PARTE MENSUAL DE ASISTENCIA", { fontWeight: "bold", fontSize: 14, textColor: "#9A3412" }),
    titulo(`Grupo: ${t.grupo}    ·    Mes: ${t.mes}${t.docentes ? `    ·    Docente: ${t.docentes}` : ""}${t.sede ? `    ·    Sede: ${t.sede}` : ""}`),
    titulo(`Días trabajados: ${p.dias.length}    ·    Matrícula: ${p.matricula}`),
    titulo(""),
    fila([{ value: "N.º", ...enc }, { value: "Alumno", ...enc, align: "left" },
      ...p.dias.map((d) => ({ value: DIAS[new Date(d + "T12:00:00").getDay()], ...enc })),
      { value: "Asist.", ...enc, rowSpan: 2 }, { value: "Tarde", ...enc, rowSpan: 2 }, { value: "Perm.", ...enc, rowSpan: 2 }, { value: "Faltas", ...enc, rowSpan: 2 }]),
    fila([{ value: "", ...enc }, { value: "", ...enc }, ...p.dias.map((d) => ({ value: Number(d.slice(8)), type: Number, ...enc })), null, null, null, null]),
    ...p.filas.map((f, i) => [
      { value: i + 1, type: Number, align: "center", ...borde },
      { value: f.a.nombre + (f.retirado ? " (retirado)" : ""), ...borde, ...(f.retirado ? { textColor: "#94A3B8" } : {}) },
      ...f.est.map((e) => { const x = ESTADOS[e]; return { value: x ? x.k : "", align: "center", fontWeight: "bold", ...(x ? { textColor: x.c } : {}), ...borde }; }),
      { value: f.asist, type: Number, align: "center", fontWeight: "bold", ...borde },
      { value: f.tarde, type: Number, align: "center", ...borde },
      { value: f.perm, type: Number, align: "center", ...borde },
      { value: f.faltas, type: Number, align: "center", fontWeight: "bold", ...(f.faltas ? { textColor: "#DC2626" } : {}), ...borde },
    ]),
    [{ value: "", backgroundColor: "#F1F5F9", ...borde }, { value: "Presentes por día", fontWeight: "bold", backgroundColor: "#F1F5F9", ...borde },
      ...p.presentesDia.map((n) => ({ value: n, type: Number, align: "center", fontWeight: "bold", backgroundColor: "#F1F5F9", ...borde })),
      ...[p.totAsist, p.filas.reduce((s, f) => s + f.tarde, 0), p.totPerm, p.totFaltas].map((n) => ({ value: n, type: Number, align: "center", fontWeight: "bold", backgroundColor: "#F1F5F9", ...borde }))],
    titulo(""),
    ...[["Días trabajados", p.dias.length], ["Matrícula", p.matricula], ["Total de asistencias", p.totAsist], ["Inasistencias con permiso", p.totPerm], ["Inasistencias sin permiso", p.totFaltas],
      ["Asistencia media (alumnos por día)", Math.round(p.media * 10) / 10], ["% de asistencia del grupo", Math.round(p.pct * 10) / 1000]]
      .map(([k, v], i) => [{ value: k, columnSpan: 2, fontWeight: "bold", backgroundColor: "#FFF7ED", textColor: "#9A3412", ...borde }, null,
        { value: v, type: Number, fontWeight: "bold", columnSpan: 2, align: "center", ...(i === 6 ? { format: "0.0%" } : i === 5 ? { format: "0.0" } : {}), ...borde }, null, ...Array(Math.max(0, nCols - 4)).fill(null)]),
    titulo(""),
    titulo("P = Presente · T = Tarde · A = Ausente · Pm = Permiso · Asist. = presentes + tardes · % de asistencia = asistencia media ÷ matrícula × 100", { fontStyle: "italic", textColor: "#64748B" }),
  ];
  const columnas = [{ width: 5 }, { width: 34 }, ...p.dias.map(() => ({ width: 4.5 })), { width: 8 }, { width: 7 }, { width: 7 }, { width: 8 }];
  return { datos, columnas };
}
