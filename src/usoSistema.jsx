// ════════════════════════════════════════════════════════════
//  TIEMPO DE TRABAJO (uso real del sistema por cada administrador)
//
//  1) useContadorUso: escucha la actividad REAL en el panel de administración
//     (mover el mouse, clics, scroll, teclado, toques en el celular y envíos
//     por WhatsApp). Solo suma el tiempo entre una acción y la siguiente si no
//     pasaron más de 2 minutos (5 en pantallas de lectura como Reportes o
//     Finanzas); si alguien deja la pestaña abierta sin usarla, NO cuenta.
//     Al enviar por WhatsApp se esperan hasta 5 minutos, porque la persona sale
//     un momento a la app de WhatsApp y vuelve.
//     Para que no se infle el tiempo: mover el mouse sin hacer nada más no
//     cuenta pasado ese límite, y los clics seguidos en el mismo lugar (más de
//     6) o teclas sostenidas tampoco. Ese tiempo queda como "descartado".
//     Cada minuto guarda lo acumulado en la tabla uso_sistema (por usuario,
//     día, hora, sección y dispositivo).
//
//  2) UsoSistemaPanel: resumen para quien gestiona pagos: horas del mes por
//     usuario, días con entrada y salida, y descarga a Excel.
// ════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { card, input, btn, btnO } from "./estilo";
import { Clock, FileSpreadsheet, Download, X, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

const INACTIVO_MS = 2 * 60 * 1000;     // sin actividad por 2 min → deja de contar
const LECTURA_MS = 5 * 60 * 1000;      // en pantallas de lectura (reportes, finanzas…) se espera hasta 5 min
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
// Pantallas donde se lee mucho (reportes, finanzas…): se da más tiempo de
// lectura sin mover nada antes de pausar el contador.
const SECCIONES_LECTURA = new Set(["dashboard", "reportes", "finanzas", "contabilidad", "alertas", "historial"]);
const limiteDe = (sec) => (SECCIONES_LECTURA.has(sec) ? LECTURA_MS : INACTIVO_MS);
const REPETIDOS_MAX = 6;     // 6 clics seguidos en lo mismo → los siguientes no cuentan
const TECLA_REPETIDA_MAX = 15;

// Estado en vivo para el contador visible (sin volver a dibujar toda la app)
const vivo = { fecha: "", base: 0, local: 0, ultima: 0, ultimaReal: 0, limite: INACTIVO_MS, repetitivo: 0, activo: false };

const firmaElemento = (el) => {
  if (!el || !el.tagName) return "";
  const b = el.closest ? (el.closest("button,a,[role=button],input,select,label,tr,td,li") || el) : el;
  const txt = (b.innerText || b.value || b.getAttribute?.("aria-label") || "").trim().slice(0, 30);
  return `${b.tagName}|${b.id || ""}|${b.className && typeof b.className === "string" ? b.className.slice(0, 40) : ""}|${txt}`;
};

export function useContadorUso({ activo, seccion, userId }) {
  const secRef = useRef(seccion);
  secRef.current = seccion;

  useEffect(() => {
    if (!activo) { vivo.activo = false; return; }
    const dispositivo = esCelular() ? "celular" : "compu";
    const pendiente = new Map();   // "fecha|hora|sección" → acumulado sin guardar
    let ultima = 0;                // última actividad de cualquier tipo
    let ultimaReal = 0;            // última acción de trabajo (clic, tecla, scroll, WhatsApp)
    let limite = INACTIVO_MS;      // cuánto puede durar la pausa y seguir contando
    let ultimoWA = 0, ultimoMov = 0, ultimoScroll = 0;
    let firmaClic = "", seguidosClic = 0, ultimoClic = 0;
    let teclaPrev = "", seguidasTecla = 0;

    // Total de hoy ya guardado (para el contador visible)
    const hoy = fechaLocal(new Date());
    Object.assign(vivo, { fecha: hoy, base: 0, local: 0, ultima: 0, ultimaReal: 0, repetitivo: 0, activo: true });
    if (userId) supabase.from("uso_sistema").select("segundos").eq("user_id", userId).eq("fecha", hoy)
      .then(({ data }) => { if (data && vivo.fecha === hoy) vivo.base = data.reduce((s, r) => s + (r.segundos || 0), 0); });

    const cubeta = (t) => {
      const d = new Date(t);
      const fecha = fechaLocal(d), hora = d.getHours(), sec = secRef.current || "";
      const k = `${fecha}|${hora}|${sec}`;
      let b = pendiente.get(k);
      if (!b) { b = { fecha, hora, sec, seg: 0, desc: 0, rep: 0, clics: 0, scrolls: 0, teclas: 0, wa: 0, primera: t, ultima: t }; pendiente.set(k, b); }
      b.ultima = t;
      if (vivo.fecha !== fecha) { vivo.fecha = fecha; vivo.base = 0; vivo.local = 0; }
      return b;
    };
    // real = true para acciones de trabajo; con solo mover el mouse el tiempo
    // cuenta hasta el límite desde la última acción real, y después se descarta.
    const actividad = (tipo, real) => {
      const t = Date.now();
      const b = cubeta(t);
      const gap = ultima ? t - ultima : Infinity;
      if (gap <= limite) {
        if (t - ultimaReal <= limite || real) { b.seg += gap / 1000; vivo.local += gap / 1000; }
        else b.desc += gap / 1000;
      }
      ultima = t;
      if (real) { ultimaReal = t; limite = limiteDe(secRef.current); }
      if (tipo) b[tipo] += 1;
      vivo.ultima = ultima; vivo.ultimaReal = ultimaReal; vivo.limite = limite;
    };
    const repetido = () => { const b = cubeta(Date.now()); b.rep += 1; vivo.repetitivo = Date.now(); actividad(null, false); };
    const marcarWA = () => { actividad("wa", true); ultimoWA = Date.now(); limite = ESPERA_WA_MS; vivo.limite = limite; };

    // Eventos de actividad
    const onMove = () => { const t = Date.now(); if (t - ultimoMov > 1000) { ultimoMov = t; actividad(null, false); } };
    const onClick = (e) => {
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      const esWA = a && esLinkWhatsApp(a.getAttribute("href"));
      if (e.isTrusted && !esWA) {
        const t = Date.now();
        const firma = `${secRef.current}|${firmaElemento(e.target)}|${Math.round(e.clientX / 25)},${Math.round(e.clientY / 25)}`;
        if (firma === firmaClic) seguidosClic += 1; else { firmaClic = firma; seguidosClic = 1; }
        const rafaga = firma === firmaClic && seguidosClic > 1 && t - ultimoClic < 250;
        ultimoClic = t;
        if (seguidosClic > REPETIDOS_MAX || rafaga) repetido();
        else actividad("clics", true);
      } else if (e.isTrusted) actividad("clics", true);
      if (esWA) marcarWA();   // después del clic, para que quede la espera de 5 min
    };
    const onScroll = () => { const t = Date.now(); if (t - ultimoScroll > 2000) { ultimoScroll = t; actividad("scrolls", true); } else actividad(null, false); };
    const onKey = (e) => {
      if (!e.isTrusted || e.repeat) { if (e.repeat) repetido(); return; }
      if (e.key === teclaPrev) seguidasTecla += 1; else { teclaPrev = e.key; seguidasTecla = 1; }
      if (seguidasTecla > TECLA_REPETIDA_MAX) repetido(); else actividad("teclas", true);
    };
    const onToque = () => actividad(null, false);
    const onVisible = () => {
      if (document.visibilityState === "visible") { actividad(null, Date.now() - ultimoWA <= ESPERA_WA_MS); return; }
      // Al salir de la pestaña: si fue para mandar por WhatsApp, se espera a que vuelva;
      // si no, el tiempo fuera no cuenta.
      if (Date.now() - ultimoWA > 15000) { ultima = 0; vivo.ultima = 0; }
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
        const seg = Math.round(b.seg), desc = Math.round(b.desc);
        if (!seg && !desc && !b.rep && !b.clics && !b.scrolls && !b.teclas && !b.wa) continue;
        const { error } = await supabase.rpc("registrar_uso", {
          p_fecha: b.fecha, p_hora: b.hora, p_seccion: b.sec, p_dispositivo: dispositivo,
          p_segundos: seg, p_descartados: desc, p_repetidos: b.rep,
          p_clics: b.clics, p_scrolls: b.scrolls, p_teclas: b.teclas, p_whatsapp: b.wa,
          p_primera: new Date(b.primera).toISOString(), p_ultima: new Date(b.ultima).toISOString(),
        });
        if (error) {
          // Se devuelve a la cola para intentar en el siguiente minuto
          const k = `${b.fecha}|${b.hora}|${b.sec}`;
          const ya = pendiente.get(k);
          if (ya) { for (const c of ["seg", "desc", "rep", "clics", "scrolls", "teclas", "wa"]) ya[c] += b[c]; ya.primera = Math.min(ya.primera, b.primera); }
          else pendiente.set(k, b);
        }
      }
      guardando = false;
    };

    const opc = { capture: true, passive: true };
    const eventos = [["mousemove", onMove], ["click", onClick], ["scroll", onScroll], ["wheel", onScroll], ["keydown", onKey], ["touchstart", onToque], ["touchmove", onScroll]];
    eventos.forEach(([n, f]) => document.addEventListener(n, f, opc));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", guardar);
    const reloj = setInterval(guardar, GUARDAR_CADA_MS);
    actividad(null, true);

    return () => {
      eventos.forEach(([n, f]) => document.removeEventListener(n, f, opc));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", guardar);
      clearInterval(reloj);
      if (window.open !== openOriginal) window.open = openOriginal;
      if (sharePatch) { try { delete navigator.share; } catch (e) { /* nada */ } }
      vivo.activo = false;
      guardar();
    };
  }, [activo, userId]);
}

// Contador visible en la barra de arriba: tiempo de trabajo real de HOY.
const reloj = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };
export function ContadorVisible() {
  const [, setTic] = useState(0);
  useEffect(() => { const i = setInterval(() => setTic((n) => n + 1), 1000); return () => clearInterval(i); }, []);
  if (!vivo.activo) return null;
  const t = Date.now();
  const contando = vivo.ultima && t - vivo.ultima <= vivo.limite && t - vivo.ultimaReal <= vivo.limite;
  const enCurso = contando ? (t - vivo.ultima) / 1000 : 0;
  const repit = t - vivo.repetitivo < 20000;
  const estado = repit ? { c: "#D97706", f: "#FFFBEB", b: "#FDE68A", l: "Clics repetidos: no cuentan" }
    : contando ? { c: "#059669", f: "#ECFDF5", b: "#A7F3D0", l: "Contando tiempo de trabajo" }
      : { c: "#94A3B8", f: "#F8FAFC", b: "#E2E8F0", l: "En pausa: sin actividad" };
  return (<div title={`${estado.l}. Hoy llevas ${duracion(vivo.base + vivo.local + enCurso)} de trabajo real.`}
    style={{ display: "flex", alignItems: "center", gap: 6, background: estado.f, border: `1px solid ${estado.b}`, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: "#334155", whiteSpace: "nowrap" }}>
    <span style={{ width: 8, height: 8, borderRadius: 999, background: estado.c, boxShadow: contando && !repit ? `0 0 0 3px ${estado.c}33` : "none" }} />
    <Clock size={13} color={estado.c} />
    <span className="hide-mobile" style={{ fontWeight: 600, color: "#64748B" }}>Hoy</span>
    <span style={{ fontVariantNumeric: "tabular-nums" }}>{reloj(vivo.base + vivo.local + enCurso)}</span>
  </div>);
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

function agrupar(filas, nombreSeccion) {
  const usuarios = new Map();
  for (const r of filas) {
    let u = usuarios.get(r.user_id);
    if (!u) { u = { id: r.user_id, email: r.email || "(sin correo)", seg: 0, desc: 0, rep: 0, lectura: 0, clics: 0, scrolls: 0, teclas: 0, wa: 0, compu: 0, celular: 0, dias: new Map() }; usuarios.set(r.user_id, u); }
    u.desc += r.descartados || 0; u.rep += r.repetidos || 0;
    if (SECCIONES_LECTURA.has(r.seccion)) u.lectura += r.segundos;
    u.seg += r.segundos; u.clics += r.clics; u.scrolls += r.scrolls; u.teclas += r.teclas; u.wa += r.whatsapp;
    u[r.dispositivo === "celular" ? "celular" : "compu"] += r.segundos;
    let d = u.dias.get(r.fecha);
    if (!d) { d = { fecha: r.fecha, seg: 0, desc: 0, acciones: 0, clics: 0, wa: 0, primera: r.primera, ultima: r.ultima, horas: new Map() }; u.dias.set(r.fecha, d); }
    d.seg += r.segundos; d.desc += r.descartados || 0; d.clics += r.clics; d.wa += r.whatsapp;
    d.acciones += r.clics + r.teclas + r.scrolls + r.whatsapp;
    if (r.primera && (!d.primera || r.primera < d.primera)) d.primera = r.primera;
    if (r.ultima && (!d.ultima || r.ultima > d.ultima)) d.ultima = r.ultima;
    let h = d.horas.get(r.hora);
    if (!h) { h = { hora: r.hora, seg: 0, clics: 0, wa: 0, secciones: new Map() }; d.horas.set(r.hora, h); }
    h.seg += r.segundos; h.clics += r.clics; h.wa += r.whatsapp;
    const sn = nombreSeccion(r.seccion);
    h.secciones.set(sn, (h.secciones.get(sn) || 0) + r.segundos);
  }
  // Ritmo = acciones de trabajo por minuto. Un día con ritmo muy por debajo del
  // normal de esa misma persona se marca para revisar (puede ser trabajo lento
  // a propósito o una tarea que de verdad requiere leer mucho).
  for (const u of usuarios.values()) {
    const dias = [...u.dias.values()];
    for (const d of dias) d.ritmo = d.seg >= 60 ? d.acciones / (d.seg / 60) : null;
    const ritmos = dias.filter((d) => d.seg >= 15 * 60 && d.ritmo != null).map((d) => d.ritmo).sort((a, b) => a - b);
    u.ritmoNormal = ritmos.length >= 3 ? ritmos[Math.floor(ritmos.length / 2)] : null;
    for (const d of dias) d.lento = !!(u.ritmoNormal && d.seg >= 30 * 60 && d.ritmo < u.ritmoNormal * 0.4);
    u.diasLentos = dias.filter((d) => d.lento).length;
  }
  return [...usuarios.values()].sort((a, b) => b.seg - a.seg);
}

// Nota corta para quien paga: solo aparece si hay algo que revisar.
const observacion = (u) => {
  const n = [];
  if (u.diasLentos > 0) n.push(`${u.diasLentos} ${u.diasLentos === 1 ? "día" : "días"} con ritmo muy bajo`);
  if (u.desc >= 30 * 60 && u.desc > u.seg * 0.15) n.push(`${duracion(u.desc)} sin trabajo real descontado`);
  return n.join(" · ");
};

export function UsoSistemaPanel({ secciones = [], showToast }) {
  const hoy = new Date();
  const [mes, setMes] = useState(`${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}`);
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(null);     // usuario abierto
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
        [{ value: `Horas trabajadas · ${nombreMes(mes)}`, fontWeight: "bold", fontSize: 14 }],
        [{ value: "Solo cuenta tiempo de trabajo real en el sistema." }],
        [],
        ["Usuario", "Días trabajados", "Horas del mes", "Horas (decimal)", "Observación"].map(titulo),
        ...usuarios.map((u) => [u.email, u.dias.size, duracion(u.seg), horasDec(u.seg), observacion(u)]),
        [{ value: "TOTAL", fontWeight: "bold" }, "", { value: duracion(totalMes), fontWeight: "bold" }, { value: horasDec(totalMes), fontWeight: "bold" }],
      ];
      const porDia = [["Usuario", "Fecha", "Entrada", "Salida", "Horas", "Horas (decimal)", "Observación"].map(titulo)];
      for (const u of usuarios) {
        for (const d of [...u.dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
          porDia.push([u.email, d.fecha, horaCorta(d.primera), horaCorta(d.ultima), duracion(d.seg), horasDec(d.seg), d.lento ? "Revisar: ritmo muy bajo" : ""]);
        }
      }
      const blob = await writeExcelFile([
        { data: resumen, sheet: "Resumen", columns: [{ width: 34 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 40 }] },
        { data: porDia, sheet: "Por día", stickyRowsCount: 1, columns: [{ width: 34 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 26 }] },
      ], { fontFamily: "Calibri", fontSize: 11 }).toBlob();
      const nombre = `Horas trabajadas ${nombreMes(mes)}.xlsx`;
      setArchivo({ url: URL.createObjectURL(blob), nombre });
    } catch (e) { showToast && showToast("No se pudo crear el Excel: " + e.message, "error"); }
    setGenerando(false);
  };

  const th = { padding: "8px 6px", fontSize: 11, color: "#64748B", fontWeight: 700, textAlign: "left", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" };
  const td = { padding: "9px 6px", fontSize: 13, borderBottom: "1px solid #EEF2F7", whiteSpace: "nowrap" };

  return (<div style={card}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
      <Clock size={18} color="#EA580C" />
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E293B" }}>Horas trabajadas</h3>
      <span style={{ flex: 1 }} />
      <input type="month" value={mes} max={`${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}`} onChange={(e) => e.target.value && setMes(e.target.value)} style={{ ...input, width: 170 }} />
      <button onClick={() => setRecarga((n) => n + 1)} title="Actualizar" style={{ ...btnO, padding: "8px 10px" }}><RefreshCw size={14} /></button>
      <button onClick={descargarExcel} disabled={!filas || !filas.length || generando} style={{ ...btn("#059669"), opacity: !filas || !filas.length || generando ? 0.5 : 1 }}><FileSpreadsheet size={15} />{generando ? "Creando…" : "Descargar Excel"}</button>
    </div>
    <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 12px" }}>Resumen del mes para pagos. Solo cuenta tiempo de trabajo real en el sistema.</p>

    {error && <div style={{ color: "#B91C1C", fontSize: 13 }}>No se pudo cargar: {error}</div>}
    {!error && !filas && <div style={{ color: "#64748B", fontSize: 13 }}>Cargando…</div>}
    {filas && !filas.length && <div style={{ color: "#64748B", fontSize: 13 }}>Todavía no hay horas registradas en {nombreMes(mes)}.</div>}

    {usuarios.length > 0 && <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}></th><th style={th}>Usuario</th><th style={th}>Días</th><th style={th}>Horas del mes</th><th style={th}>Observación</th></tr></thead>
        <tbody>
          {usuarios.map((u) => {
            const abiertoU = abierto === u.id;
            const dias = [...u.dias.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
            const obs = observacion(u);
            return [
              <tr key={u.id} onClick={() => setAbierto(abiertoU ? null : u.id)} style={{ cursor: "pointer" }} title="Ver días">
                <td style={td}>{abiertoU ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                <td style={{ ...td, fontWeight: 700 }}>{u.email}</td>
                <td style={td}>{u.dias.size}</td>
                <td style={{ ...td, fontWeight: 800, color: "#EA580C" }}>{duracion(u.seg)}</td>
                <td style={{ ...td, color: obs ? "#B45309" : "#94A3B8", whiteSpace: "normal", fontSize: 12 }}>{obs ? `⚠ ${obs}` : "—"}</td>
              </tr>,
              abiertoU && <tr key={u.id + "-d"}><td colSpan={5} style={{ padding: "4px 0 12px 22px", background: "rgba(255,247,237,.5)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Día</th><th style={th}>Entrada</th><th style={th}>Salida</th><th style={th}>Horas</th></tr></thead>
                  <tbody>{dias.map((d) => <tr key={d.fecha}>
                    <td style={td}>{fechaBonita(d.fecha)}</td>
                    <td style={td}>{horaCorta(d.primera)}</td>
                    <td style={td}>{horaCorta(d.ultima)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{duracion(d.seg)}{d.lento && <span title="Ritmo muy por debajo de lo normal: revisar" style={{ color: "#D97706" }}> ⚠</span>}</td>
                  </tr>)}</tbody>
                </table>
              </td></tr>,
            ];
          })}
          <tr><td style={td}></td><td style={{ ...td, fontWeight: 800 }}>Total</td><td style={td}></td><td style={{ ...td, fontWeight: 800 }}>{duracion(totalMes)}</td><td style={td}></td></tr>
        </tbody>
      </table>
    </div>}

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
