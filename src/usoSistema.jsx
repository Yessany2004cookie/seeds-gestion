// ════════════════════════════════════════════════════════════
//  TIEMPO DE TRABAJO (uso real del sistema por cada administrador)
//
//  1) useContadorUso: escucha la actividad REAL en el panel de administración
//     (mover el mouse, clics, scroll, teclado, toques en el celular y envíos
//     por WhatsApp). Solo suma el tiempo entre una acción y la siguiente si no
//     pasaron más de 2 minutos; si alguien deja la pestaña abierta sin usarla,
//     ese tiempo NO cuenta. Al enviar por WhatsApp se esperan hasta 5 minutos,
//     porque la persona sale un momento a la app de WhatsApp y vuelve.
//     Cada minuto guarda lo acumulado en la tabla uso_sistema (por usuario,
//     día, hora, sección y dispositivo).
//
//  2) UsoSistemaPanel: reporte para administradores con el total del mes por
//     usuario, el registro por día y por hora, y descarga a Excel.
// ════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { card, input, btn, btnO } from "./estilo";
import { Clock, FileSpreadsheet, Download, X, ChevronDown, ChevronRight, Monitor, Smartphone, RefreshCw } from "lucide-react";

const INACTIVO_MS = 2 * 60 * 1000;     // sin actividad por 2 min → deja de contar
const ESPERA_WA_MS = 5 * 60 * 1000;    // después de enviar por WhatsApp se espera hasta 5 min
const GUARDAR_CADA_MS = 60 * 1000;     // se guarda cada minuto

const pad = (n) => String(n).padStart(2, "0");
const fechaLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const esCelular = () => {
  try {
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
    return window.matchMedia && window.matchMedia("(pointer: coarse)").matches && window.innerWidth <= 1024;
  } catch (e) { return false; }
};
const esLinkWhatsApp = (url) => /(^|\/\/|\.)wa\.me\b|whatsapp/i.test(String(url || ""));

// ── 1) Contador ──────────────────────────────────────────────
export function useContadorUso({ activo, seccion }) {
  const secRef = useRef(seccion);
  secRef.current = seccion;

  useEffect(() => {
    if (!activo) return;
    const dispositivo = esCelular() ? "celular" : "compu";
    const pendiente = new Map();   // "fecha|hora|sección" → acumulado sin guardar
    let ultima = 0;                // momento de la última actividad que cuenta
    let limite = INACTIVO_MS;      // cuánto puede durar la pausa y seguir contando
    let ultimoWA = 0, ultimoMov = 0, ultimoScroll = 0;

    const cubeta = (t) => {
      const d = new Date(t);
      const fecha = fechaLocal(d), hora = d.getHours(), sec = secRef.current || "";
      const k = `${fecha}|${hora}|${sec}`;
      let b = pendiente.get(k);
      if (!b) { b = { fecha, hora, sec, seg: 0, clics: 0, scrolls: 0, teclas: 0, wa: 0, primera: t, ultima: t }; pendiente.set(k, b); }
      b.ultima = t;
      return b;
    };
    const actividad = (tipo) => {
      const t = Date.now();
      const b = cubeta(t);
      if (ultima && t - ultima <= limite) b.seg += (t - ultima) / 1000;
      ultima = t; limite = INACTIVO_MS;
      if (tipo) b[tipo] += 1;
    };
    const marcarWA = () => { actividad("wa"); ultimoWA = Date.now(); limite = ESPERA_WA_MS; };

    // Eventos de actividad real
    const onMove = () => { const t = Date.now(); if (t - ultimoMov > 1000) { ultimoMov = t; actividad(null); } };
    const onClick = (e) => {
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (e.isTrusted) actividad("clics");
      if (a && esLinkWhatsApp(a.getAttribute("href"))) marcarWA();   // después del clic, para que quede la espera de 5 min
    };
    const onScroll = () => { const t = Date.now(); if (t - ultimoScroll > 1000) { ultimoScroll = t; actividad("scrolls"); } else actividad(null); };
    const onKey = (e) => { if (e.isTrusted) actividad("teclas"); };
    const onToque = () => actividad(null);
    const onVisible = () => {
      if (document.visibilityState === "visible") { actividad(null); return; }
      // Al salir de la pestaña: si fue para mandar por WhatsApp, se espera a que vuelva;
      // si no, el tiempo fuera no cuenta.
      if (Date.now() - ultimoWA > 15000) ultima = 0;
      guardar();
    };

    // Envíos por WhatsApp que no pasan por un clic en un enlace
    const openOriginal = window.open;
    window.open = function (url, ...resto) { if (esLinkWhatsApp(url)) marcarWA(); return openOriginal.call(window, url, ...resto); };
    const shareOriginal = navigator.share;
    let sharePatch = false;
    if (typeof shareOriginal === "function") {
      try {
        Object.defineProperty(navigator, "share", { configurable: true, writable: true, value: function (...args) { marcarWA(); return shareOriginal.apply(navigator, args); } });
        sharePatch = true;
      } catch (e) { /* el navegador no lo permite; no pasa nada */ }
    }

    let guardando = false;
    const guardar = async () => {
      if (guardando || pendiente.size === 0) return;
      guardando = true;
      const lote = [...pendiente.values()];
      pendiente.clear();
      for (const b of lote) {
        const seg = Math.round(b.seg);
        if (!seg && !b.clics && !b.scrolls && !b.teclas && !b.wa) continue;
        const { error } = await supabase.rpc("registrar_uso", {
          p_fecha: b.fecha, p_hora: b.hora, p_seccion: b.sec, p_dispositivo: dispositivo,
          p_segundos: seg, p_clics: b.clics, p_scrolls: b.scrolls, p_teclas: b.teclas, p_whatsapp: b.wa,
          p_primera: new Date(b.primera).toISOString(), p_ultima: new Date(b.ultima).toISOString(),
        });
        if (error) {
          // Se devuelve a la cola para intentar en el siguiente minuto
          const k = `${b.fecha}|${b.hora}|${b.sec}`;
          const ya = pendiente.get(k);
          if (ya) { ya.seg += b.seg; ya.clics += b.clics; ya.scrolls += b.scrolls; ya.teclas += b.teclas; ya.wa += b.wa; ya.primera = Math.min(ya.primera, b.primera); }
          else pendiente.set(k, b);
        }
      }
      guardando = false;
    };

    const opc = { capture: true, passive: true };
    document.addEventListener("mousemove", onMove, opc);
    document.addEventListener("click", onClick, opc);
    document.addEventListener("scroll", onScroll, opc);
    document.addEventListener("wheel", onScroll, opc);
    document.addEventListener("keydown", onKey, opc);
    document.addEventListener("touchstart", onToque, opc);
    document.addEventListener("touchmove", onScroll, opc);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", guardar);
    const reloj = setInterval(guardar, GUARDAR_CADA_MS);
    actividad(null);

    return () => {
      document.removeEventListener("mousemove", onMove, opc);
      document.removeEventListener("click", onClick, opc);
      document.removeEventListener("scroll", onScroll, opc);
      document.removeEventListener("wheel", onScroll, opc);
      document.removeEventListener("keydown", onKey, opc);
      document.removeEventListener("touchstart", onToque, opc);
      document.removeEventListener("touchmove", onScroll, opc);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", guardar);
      clearInterval(reloj);
      if (window.open !== openOriginal) window.open = openOriginal;
      if (sharePatch) { try { delete navigator.share; } catch (e) { /* nada */ } }
      guardar();
    };
  }, [activo]);
}

// ── 2) Reporte ───────────────────────────────────────────────
const duracion = (s) => {
  s = Math.round(s || 0);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${pad(m)} min` : `${m} min`;
};
const horaCorta = (iso) => iso ? new Date(iso).toLocaleTimeString("es-HN", { hour: "numeric", minute: "2-digit" }) : "—";
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const nombreMes = (ym) => { const [a, m] = ym.split("-"); return `${MESES[Number(m) - 1]} ${a}`; };
const fechaBonita = (f) => { const [a, m, d] = f.split("-").map(Number); return new Date(a, m - 1, d).toLocaleDateString("es-HN", { weekday: "short", day: "numeric", month: "short" }); };
const rangoHora = (h) => `${pad(h)}:00 – ${pad((h + 1) % 24)}:00`;

function agrupar(filas, nombreSeccion) {
  const usuarios = new Map();
  for (const r of filas) {
    let u = usuarios.get(r.user_id);
    if (!u) { u = { id: r.user_id, email: r.email || "(sin correo)", seg: 0, clics: 0, scrolls: 0, teclas: 0, wa: 0, compu: 0, celular: 0, dias: new Map() }; usuarios.set(r.user_id, u); }
    u.seg += r.segundos; u.clics += r.clics; u.scrolls += r.scrolls; u.teclas += r.teclas; u.wa += r.whatsapp;
    u[r.dispositivo === "celular" ? "celular" : "compu"] += r.segundos;
    let d = u.dias.get(r.fecha);
    if (!d) { d = { fecha: r.fecha, seg: 0, clics: 0, wa: 0, primera: r.primera, ultima: r.ultima, horas: new Map() }; u.dias.set(r.fecha, d); }
    d.seg += r.segundos; d.clics += r.clics; d.wa += r.whatsapp;
    if (r.primera && (!d.primera || r.primera < d.primera)) d.primera = r.primera;
    if (r.ultima && (!d.ultima || r.ultima > d.ultima)) d.ultima = r.ultima;
    let h = d.horas.get(r.hora);
    if (!h) { h = { hora: r.hora, seg: 0, clics: 0, wa: 0, secciones: new Map() }; d.horas.set(r.hora, h); }
    h.seg += r.segundos; h.clics += r.clics; h.wa += r.whatsapp;
    const sn = nombreSeccion(r.seccion);
    h.secciones.set(sn, (h.secciones.get(sn) || 0) + r.segundos);
  }
  return [...usuarios.values()].sort((a, b) => b.seg - a.seg);
}

export function UsoSistemaPanel({ secciones = [], showToast }) {
  const hoy = new Date();
  const [mes, setMes] = useState(`${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}`);
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(null);     // usuario abierto
  const [diaAbierto, setDiaAbierto] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  const nombreSeccion = useMemo(() => {
    const m = new Map(secciones.map((s) => [s.id, s.label]));
    return (id) => m.get(id) || id || "Otra";
  }, [secciones]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setFilas(null); setError("");
      const [a, m] = mes.split("-").map(Number);
      const desde = `${mes}-01`, hasta = fechaLocal(new Date(a, m, 0));
      const todas = [];
      for (let i = 0; ; i += 1000) {
        const { data, error } = await supabase.from("uso_sistema").select("*").gte("fecha", desde).lte("fecha", hasta)
          .order("fecha").order("hora").range(i, i + 999);
        if (error) { if (vivo) setError(error.message); return; }
        todas.push(...data);
        if (data.length < 1000) break;
      }
      if (vivo) setFilas(todas);
    })();
    return () => { vivo = false; };
  }, [mes, recarga]);

  const usuarios = useMemo(() => filas ? agrupar(filas, nombreSeccion) : [], [filas, nombreSeccion]);
  const totalMes = usuarios.reduce((s, u) => s + u.seg, 0);

  const descargarExcel = async () => {
    setGenerando(true);
    try {
      const writeExcelFile = (await import("write-excel-file/browser")).default;
      const titulo = (t) => ({ value: t, fontWeight: "bold", backgroundColor: "#FFEDD5", color: "#9A3412" });
      const horasDec = (s) => Math.round((s / 3600) * 100) / 100;
      const resumen = [
        [{ value: `Tiempo de trabajo real · ${nombreMes(mes)}`, fontWeight: "bold", fontSize: 14 }],
        [],
        ["Usuario", "Tiempo total", "Horas (decimal)", "Días trabajados", "Compu", "Celular", "Clics", "Scrolls", "Teclas", "Envíos WhatsApp"].map(titulo),
        ...usuarios.map((u) => [u.email, duracion(u.seg), horasDec(u.seg), u.dias.size, duracion(u.compu), duracion(u.celular), u.clics, u.scrolls, u.teclas, u.wa]),
        [{ value: "TOTAL", fontWeight: "bold" }, { value: duracion(totalMes), fontWeight: "bold" }, { value: horasDec(totalMes), fontWeight: "bold" }],
      ];
      const porDia = [["Usuario", "Fecha", "Primera actividad", "Última actividad", "Tiempo de trabajo", "Horas (decimal)", "Clics", "Envíos WhatsApp"].map(titulo)];
      const porHora = [["Usuario", "Fecha", "Hora", "Sección", "Dispositivo", "Minutos", "Clics", "Scrolls", "Teclas", "Envíos WhatsApp"].map(titulo)];
      for (const u of usuarios) {
        for (const d of [...u.dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
          porDia.push([u.email, d.fecha, horaCorta(d.primera), horaCorta(d.ultima), duracion(d.seg), horasDec(d.seg), d.clics, d.wa]);
        }
      }
      for (const r of filas || []) {
        porHora.push([r.email || "", r.fecha, rangoHora(r.hora), nombreSeccion(r.seccion), r.dispositivo === "celular" ? "Celular" : "Compu",
          Math.round((r.segundos / 60) * 10) / 10, r.clics, r.scrolls, r.teclas, r.whatsapp]);
      }
      const blob = await writeExcelFile([
        { data: resumen, sheet: "Resumen del mes", columns: [{ width: 34 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 16 }] },
        { data: porDia, sheet: "Por día", stickyRowsCount: 1, columns: [{ width: 34 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 10 }, { width: 16 }] },
        { data: porHora, sheet: "Por hora", stickyRowsCount: 1, columns: [{ width: 34 }, { width: 12 }, { width: 16 }, { width: 22 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 16 }] },
      ], { fontFamily: "Calibri", fontSize: 11 }).toBlob();
      const nombre = `Tiempo de trabajo ${nombreMes(mes)}.xlsx`;
      setArchivo({ url: URL.createObjectURL(blob), nombre });
    } catch (e) { showToast && showToast("No se pudo crear el Excel: " + e.message, "error"); }
    setGenerando(false);
  };

  const th = { padding: "8px 6px", fontSize: 11, color: "#64748B", fontWeight: 700, textAlign: "left", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" };
  const td = { padding: "8px 6px", fontSize: 13, borderBottom: "1px solid #EEF2F7", whiteSpace: "nowrap" };

  return (<div style={card}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
      <Clock size={18} color="#EA580C" />
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E293B" }}>Tiempo de trabajo</h3>
      <span style={{ flex: 1 }} />
      <input type="month" value={mes} max={`${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}`} onChange={(e) => e.target.value && setMes(e.target.value)} style={{ ...input, width: 170 }} />
      <button onClick={() => setRecarga((n) => n + 1)} title="Actualizar" style={{ ...btnO, padding: "8px 10px" }}><RefreshCw size={14} /></button>
      <button onClick={descargarExcel} disabled={!filas || !filas.length || generando} style={{ ...btn("#059669"), opacity: !filas || !filas.length || generando ? 0.5 : 1 }}><FileSpreadsheet size={15} />{generando ? "Creando…" : "Descargar Excel"}</button>
    </div>
    <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 12px" }}>
      Solo cuenta trabajo real: mouse, clics, scroll, teclado, toques en el celular y envíos por WhatsApp. Si pasan 2 minutos sin actividad, deja de contar.
    </p>

    {error && <div style={{ color: "#B91C1C", fontSize: 13 }}>No se pudo cargar: {error}</div>}
    {!error && !filas && <div style={{ color: "#64748B", fontSize: 13 }}>Cargando…</div>}
    {filas && !filas.length && <div style={{ color: "#64748B", fontSize: 13 }}>Todavía no hay tiempo registrado en {nombreMes(mes)}.</div>}

    {usuarios.length > 0 && <>
      <div style={{ fontSize: 13, color: "#334155", marginBottom: 8 }}>Total del mes (todos los usuarios): <strong>{duracion(totalMes)}</strong></div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}></th><th style={th}>Usuario</th><th style={th}>Total del mes</th><th style={th}>Días</th><th style={th}><Monitor size={12} /> Compu</th><th style={th}><Smartphone size={12} /> Celular</th><th style={th}>Clics</th><th style={th}>WhatsApp</th></tr></thead>
          <tbody>
            {usuarios.map((u) => {
              const abiertoU = abierto === u.id;
              const dias = [...u.dias.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
              return [
                <tr key={u.id} onClick={() => { setAbierto(abiertoU ? null : u.id); setDiaAbierto(null); }} style={{ cursor: "pointer" }}>
                  <td style={td}>{abiertoU ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{u.email}</td>
                  <td style={{ ...td, fontWeight: 800, color: "#EA580C" }}>{duracion(u.seg)}</td>
                  <td style={td}>{u.dias.size}</td>
                  <td style={td}>{duracion(u.compu)}</td>
                  <td style={td}>{duracion(u.celular)}</td>
                  <td style={td}>{u.clics}</td>
                  <td style={td}>{u.wa}</td>
                </tr>,
                abiertoU && <tr key={u.id + "-d"}><td colSpan={8} style={{ padding: "4px 0 12px 22px", background: "rgba(255,247,237,.5)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>Día</th><th style={th}>Desde</th><th style={th}>Hasta</th><th style={th}>Trabajo real</th><th style={th}>Clics</th><th style={th}>WhatsApp</th></tr></thead>
                    <tbody>{dias.map((d) => {
                      const abiertoD = diaAbierto === d.fecha;
                      return [
                        <tr key={d.fecha} onClick={() => setDiaAbierto(abiertoD ? null : d.fecha)} style={{ cursor: "pointer" }}>
                          <td style={td}>{abiertoD ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {fechaBonita(d.fecha)}</td>
                          <td style={td}>{horaCorta(d.primera)}</td>
                          <td style={td}>{horaCorta(d.ultima)}</td>
                          <td style={{ ...td, fontWeight: 700 }}>{duracion(d.seg)}</td>
                          <td style={td}>{d.clics}</td>
                          <td style={td}>{d.wa}</td>
                        </tr>,
                        abiertoD && [...d.horas.values()].sort((a, b) => a.hora - b.hora).map((h) =>
                          <tr key={d.fecha + h.hora} style={{ fontSize: 12, color: "#475569" }}>
                            <td style={{ ...td, fontSize: 12, paddingLeft: 26 }}>{rangoHora(h.hora)}</td>
                            <td style={{ ...td, fontSize: 12, whiteSpace: "normal" }} colSpan={2}>{[...h.secciones.entries()].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([n, s]) => `${n} (${duracion(s)})`).join(", ") || "—"}</td>
                            <td style={{ ...td, fontSize: 12 }}>{duracion(h.seg)}</td>
                            <td style={{ ...td, fontSize: 12 }}>{h.clics}</td>
                            <td style={{ ...td, fontSize: 12 }}>{h.wa}</td>
                          </tr>),
                      ];
                    })}</tbody>
                  </table>
                </td></tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
    </>}

    {archivo && <div onClick={() => setArchivo(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 22, padding: 24, width: "100%", maxWidth: 380, textAlign: "center", position: "relative" }}>
        <button onClick={() => setArchivo(null)} aria-label="Cerrar" style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={18} /></button>
        <div style={{ width: 54, height: 54, margin: "0 auto", borderRadius: 999, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><FileSpreadsheet size={26} /></div>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", margin: "10px 0 4px" }}>Reporte listo</h3>
        <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 16px", wordBreak: "break-all" }}>{archivo.nombre}</p>
        <a href={archivo.url} download={archivo.nombre} onClick={() => setTimeout(() => setArchivo(null), 400)} style={{ ...btn("#059669"), textDecoration: "none", justifyContent: "center", width: "100%", boxSizing: "border-box" }}><Download size={15} />Descargar Excel</a>
      </div>
    </div>}
  </div>);
}
