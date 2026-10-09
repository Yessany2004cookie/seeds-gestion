// ── VISTA DE DOCENTES Y SU REVISIÓN DESDE ADMINISTRACIÓN ──
// Un docente solo puede leer sus grupos, alumnos y padres (lo garantiza la
// seguridad de la base de datos: supabase/roles_docentes.sql).
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { LOGO_SEEDS } from "./logo";
import SCRIPT_ROLES from "../supabase/roles_docentes.sql?raw";
import {
  LogOut, Users, BookOpen, Check, X, Menu, Send, Home, ClipboardList,
  MessageSquare, FileText, Phone, Plus, Trash2, RefreshCw, Save, Inbox, KeyRound, UserCheck,
} from "lucide-react";

// ── Estilos (mismos del sistema) ──
const NAR = "#EA580C";
const card = { background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: 20, marginBottom: 16 };
const input = { width: "100%", padding: "9px 12px", border: "1px solid #D1D5DB", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const btn = (c = NAR) => ({ padding: "9px 18px", background: c, color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 });
const btnO = { padding: "8px 14px", background: "transparent", color: "#64748B", border: "1px solid #D1D5DB", borderRadius: 7, cursor: "pointer", fontSize: 13, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 };
const label = { fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" };
const badge = (c) => ({ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: c + "18", color: c, whiteSpace: "nowrap" });
// Editor SQL del proyecto de Supabase (se arma con la URL del proyecto)
const EDITOR_SQL = (() => { const ref = (String(supabase.supabaseUrl || "").match(/https:\/\/([^.]+)\.supabase\.co/) || [])[1]; return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : "https://supabase.com/dashboard"; })();

// Aviso con los pasos para activar el módulo (botón para copiar el script)
export function AvisoActivarModulo({ showToast }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(SCRIPT_ROLES); setCopiado(true); showToast && showToast("✓ Script copiado. Ahora pégalo en Supabase"); }
    catch (e) { showToast && showToast("No se pudo copiar automáticamente", "error"); }
  };
  return (
    <div style={{ ...card, background: "#FFF7ED", border: "1px solid #FDBA74" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#9A3412", marginBottom: 6 }}>⚠ Falta activar el módulo de docentes (se hace una sola vez)</div>
      <ol style={{ fontSize: 13, color: "#7C2D12", margin: "0 0 12px", paddingLeft: 20, lineHeight: 1.7 }}>
        <li>Toca <strong>“1. Copiar script”</strong>.</li>
        <li>Toca <strong>“2. Abrir Supabase”</strong> (entra con tu cuenta si te lo pide).</li>
        <li>En el editor que se abre, pega con <strong>Ctrl + V</strong> y toca <strong>Run</strong>. Debe decir <em>Success</em>.</li>
        <li>Vuelve aquí y recarga la página con <strong>Ctrl + Shift + R</strong>.</li>
      </ol>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={copiar} style={btn()}>{copiado ? "✓ Copiado" : "1. Copiar script"}</button>
        <a href={EDITOR_SQL} target="_blank" rel="noreferrer" style={{ ...btn("#1E293B"), textDecoration: "none" }}>2. Abrir Supabase</a>
      </div>
      <div style={{ fontSize: 11, color: "#9A3412", marginTop: 8 }}>No borra ningún dato. Las cuentas que ya existen (como la tuya) quedan como administración.</div>
    </div>
  );
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hoyISO = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD en hora local
const fechaLarga = (f) => (f ? new Date(f + "T12:00:00").toLocaleDateString("es-HN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "");
const telLimpio = (t) => String(t || "").replace(/\D/g, "");
const waLink = (t) => { const n = telLimpio(t); return n ? `https://wa.me/${n.length === 8 ? "504" + n : n}` : null; };

const ESTADOS_ASIS = [
  { v: "presente", l: "Presente", c: "#059669", k: "P" },
  { v: "tarde", l: "Tarde", c: "#D97706", k: "T" },
  { v: "ausente", l: "Ausente", c: "#DC2626", k: "A" },
  { v: "justificado", l: "Justificado", c: "#2563EB", k: "J" },
];
const CATEGORIAS_REFLECTION = ["Académico", "Participación", "Conducta", "Logro", "Necesita apoyo", "Comunicación con padres", "Otro"];
const TIPOS_SOLICITUD = ["Material didáctico", "Permiso / ausencia", "Pago / planilla", "Aula o equipo", "Alumno o padre de familia", "Otro"];
const ESTADO_SOL = {
  pendiente: { l: "Pendiente", c: "#D97706" },
  en_proceso: { l: "En proceso", c: "#2563EB" },
  resuelta: { l: "Resuelta", c: "#059669" },
  rechazada: { l: "Rechazada", c: "#DC2626" },
};
// Formulario de clase. Cuando compartan el formulario actual, se ajustan estos campos.
const CAMPOS_REPORTE = [
  { k: "tema", l: "Tema / unidad trabajada", tipo: "texto", req: true },
  { k: "objetivo", l: "Objetivo de la clase", tipo: "area" },
  { k: "actividades", l: "Actividades realizadas", tipo: "area", req: true },
  { k: "tarea", l: "Tarea asignada", tipo: "area" },
  { k: "materiales", l: "Materiales o recursos usados", tipo: "texto" },
  { k: "logro", l: "¿Se cumplió el objetivo?", tipo: "opcion", opciones: ["Sí", "Parcialmente", "No"] },
  { k: "destacados", l: "Alumnos que destacaron", tipo: "texto" },
  { k: "dificultades", l: "Alumnos con dificultades", tipo: "texto" },
  { k: "observaciones", l: "Observaciones generales", tipo: "area" },
];

// Errores de la base de datos en palabras sencillas
const mensajeError = (e) => {
  const m = String(e?.message || e || "");
  if (/relation .* does not exist|Could not find the table|schema cache/i.test(m)) return "Falta activar el módulo de docentes en Supabase (script supabase/roles_docentes.sql).";
  if (/row-level security|permission denied/i.test(m)) return "No tienes permiso para hacer esto.";
  return m;
};

function Toast({ toast }) {
  if (!toast) return null;
  return <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", padding: "12px 20px", background: toast.type === "error" ? "#DC2626" : "#1E293B", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 300, maxWidth: "90vw" }}>{toast.msg}</div>;
}
function Vacio({ children }) {
  return <p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "20px 0", margin: 0 }}>{children}</p>;
}
function SelectorGrupo({ secciones, value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...input, width: "auto", minWidth: 200, cursor: "pointer" }}>
      {secciones.length === 0 && <option value="">Sin grupos asignados</option>}
      {secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
    </select>
  );
}

// ════════════════════════════════════════════════════════════
//  APLICACIÓN DEL DOCENTE
// ════════════════════════════════════════════════════════════
export function DocenteApp({ session, perfil, onVolver }) {
  const [page, setPage] = useState("inicio");
  const [menu, setMenu] = useState(false);
  const [datos, setDatos] = useState({ maestro: null, secciones: [], alumnos: [], padres: [] });
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState(null);
  const avisar = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [m, s, a, p] = await Promise.all([
        supabase.from("maestros").select("id,nombre,telefono,email,secciones_ids").eq("id", perfil.maestro_id).maybeSingle(),
        supabase.from("secciones").select("id,nombre,horario,descripcion,activa").order("nombre"),
        supabase.from("alumnos").select("id,nombre,telefono,email,padre_id,seccion_id,estado,fecha_ingreso").order("nombre"),
        supabase.from("padres").select("id,nombre,telefono,email"),
      ]);
      const err = m.error || s.error || a.error || p.error;
      if (err) throw err;
      // Solo los grupos de este maestro (la base ya lo limita para docentes;
      // aquí también, por si quien entra es administración en vista docente)
      const mios = new Set(m.data?.secciones_ids || []);
      const alumnos = (a.data || []).filter((x) => mios.has(x.seccion_id));
      const padresIds = new Set(alumnos.map((x) => x.padre_id));
      setDatos({ maestro: m.data, secciones: (s.data || []).filter((x) => x.activa !== false && mios.has(x.id)), alumnos, padres: (p.data || []).filter((x) => padresIds.has(x.id)) });
    } catch (e) { avisar("Error cargando tus datos: " + mensajeError(e), "error"); }
    setCargando(false);
  }, [perfil.maestro_id]);
  useEffect(() => { cargar(); }, [cargar]);

  const salir = async () => { await supabase.auth.signOut(); };
  const NAV = [
    { id: "inicio", label: "Inicio", icon: Home },
    { id: "grupos", label: "Mis grupos", icon: Users },
    { id: "asistencia", label: "Libreta de asistencia", icon: UserCheck },
    { id: "reflections", label: "Reflections", icon: MessageSquare },
    { id: "reporte", label: "Reporte de clase", icon: ClipboardList },
    { id: "solicitudes", label: "Solicitudes", icon: Inbox },
  ];
  const escritorio = window.innerWidth > 768;
  const props = { datos, maestroId: perfil.maestro_id, avisar, setPage };
  const paginas = {
    inicio: <InicioDocente {...props} />,
    grupos: <MisGrupos {...props} />,
    asistencia: <Asistencia {...props} />,
    reflections: <Reflections {...props} />,
    reporte: <ReporteClase {...props} />,
    solicitudes: <SolicitudesDocente {...props} />,
  };

  if (!perfil.maestro_id) {
    return <PantallaMensaje titulo="Tu cuenta no está enlazada a un maestro" texto="Pide a administración que revise tu acceso en la página Maestros." onSalir={salir} />;
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Segoe UI',system-ui,sans-serif", background: "#F1F5F9" }}>
      {menu && <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />}
      <aside style={{ position: "fixed", left: menu ? 0 : -260, top: 0, bottom: 0, width: 250, background: "#1E293B", color: "#fff", zIndex: 50, transition: "left 0.2s", display: "flex", flexDirection: "column", ...(escritorio ? { position: "relative", left: 0 } : {}) }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid #334155", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 8 }}><img src={LOGO_SEEDS} alt="Seeds" style={{ width: 96, height: 96, objectFit: "contain" }} /></div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#F97316" }}>Seeds English</div>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>Portal docente</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {NAV.map((n) => { const Icon = n.icon; const a = page === n.id; return (
            <button key={n.id} onClick={() => { setPage(n.id); setMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", border: "none", cursor: "pointer", background: a ? "#334155" : "transparent", color: a ? "#F97316" : "#CBD5E1", fontSize: 13, fontWeight: a ? 600 : 400, fontFamily: "inherit", borderLeft: a ? "3px solid #F97316" : "3px solid transparent", textAlign: "left" }}><Icon size={17} />{n.label}</button>
          ); })}
        </nav>
        {onVolver && <button onClick={onVolver} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", border: "none", borderTop: "1px solid #334155", background: "transparent", color: "#FDBA74", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}><RefreshCw size={16} />Volver a administración</button>}
        <button onClick={salir} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", border: "none", borderTop: "1px solid #334155", background: "transparent", color: "#EF4444", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}><LogOut size={16} />Cerrar sesión</button>
      </aside>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ background: "#fff", padding: "12px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {!escritorio && <button onClick={() => setMenu(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Menu size={22} color="#475569" /></button>}
            <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1E293B", margin: 0 }}>{NAV.find((n) => n.id === page)?.label}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {onVolver && <button onClick={onVolver} title="Volver a administración" style={{ ...btnO, padding: "5px 10px", fontSize: 12, color: NAR, borderColor: "#FED7AA" }}>Administración</button>}
            <button onClick={cargar} title="Actualizar" style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: 6, cursor: "pointer", padding: "5px 8px", display: "flex" }}><RefreshCw size={14} color="#64748B" /></button>
            <div style={{ fontSize: 12, color: "#64748B", textAlign: "right" }}><div style={{ fontWeight: 700, color: "#1E293B" }}>{datos.maestro?.nombre || ""}</div><div>{session.user.email}</div></div>
          </div>
        </header>
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>{cargando ? <Vacio>Cargando…</Vacio> : paginas[page]}</div>
      </main>
      <Toast toast={toast} />
    </div>
  );
}

export function PantallaMensaje({ titulo, texto, onSalir }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F1F5F9", fontFamily: "'Segoe UI',system-ui,sans-serif", padding: 20 }}>
      <div style={{ ...card, maxWidth: 420, textAlign: "center" }}>
        <img src={LOGO_SEEDS} alt="Seeds" style={{ width: 90, height: 90, objectFit: "contain" }} />
        <h2 style={{ fontSize: 17, color: "#1E293B", margin: "10px 0 6px" }}>{titulo}</h2>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px" }}>{texto}</p>
        <button onClick={onSalir} style={btn()}><LogOut size={15} />Cerrar sesión</button>
      </div>
    </div>
  );
}

// ── Inicio ──
function InicioDocente({ datos, setPage }) {
  const activos = datos.alumnos.filter((a) => a.estado === "activo");
  const accesos = [
    { id: "asistencia", t: "Libreta de asistencia", d: "Pasa lista de hoy y revisa los días anteriores", icon: UserCheck },
    { id: "reporte", t: "Reporte de clase", d: "Llena el formulario de la clase de hoy", icon: ClipboardList },
    { id: "reflections", t: "Escribir reflection", d: "Anota el avance o la conducta de un alumno", icon: MessageSquare },
    { id: "solicitudes", t: "Hacer una solicitud", d: "Pide algo a administración", icon: Inbox },
  ];
  return (<div>
    <div style={{ ...card, background: "linear-gradient(135deg,#1E293B,#334155)", color: "#fff", border: "none" }}>
      <div style={{ fontSize: 12, color: "#FDBA74", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Bienvenido</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{datos.maestro?.nombre}</div>
      <div style={{ fontSize: 13, color: "#CBD5E1", marginTop: 4 }}>{datos.secciones.length} {datos.secciones.length === 1 ? "grupo" : "grupos"} · {activos.length} alumnos activos</div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 16 }}>
      {accesos.map((a) => { const Icon = a.icon; return (
        <button key={a.id} onClick={() => setPage(a.id)} style={{ ...card, margin: 0, textAlign: "left", cursor: "pointer", display: "flex", gap: 12, alignItems: "center", fontFamily: "inherit" }}>
          <div style={{ background: "#FFF7ED", borderRadius: 10, padding: 10 }}><Icon size={22} color={NAR} /></div>
          <div><div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{a.t}</div><div style={{ fontSize: 12, color: "#64748B" }}>{a.d}</div></div>
        </button>
      ); })}
    </div>
    <div style={card}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: "0 0 10px" }}>Mis grupos</h3>
      {datos.secciones.length === 0 ? <Vacio>Aún no tienes grupos asignados. Pide a administración que te los asigne.</Vacio> :
        datos.secciones.map((s) => <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
          <div><strong>{s.nombre}</strong>{s.horario && <span style={{ color: "#94A3B8" }}> · {s.horario}</span>}</div>
          <span style={badge(NAR)}>{activos.filter((a) => a.seccion_id === s.id).length} alumnos</span>
        </div>)}
    </div>
  </div>);
}

// ── Mis grupos ──
function MisGrupos({ datos }) {
  const [sec, setSec] = useState(datos.secciones[0]?.id || "");
  const [busca, setBusca] = useState("");
  const alumnos = datos.alumnos.filter((a) => a.seccion_id === sec && a.estado === "activo" && a.nombre.toLowerCase().includes(busca.toLowerCase()));
  const s = datos.secciones.find((x) => x.id === sec);
  return (<div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      <SelectorGrupo secciones={datos.secciones} value={sec} onChange={setSec} />
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar alumno…" style={{ ...input, width: 220 }} />
    </div>
    {s && <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 12px" }}>{s.horario || "Sin horario"} · {alumnos.length} alumnos activos</p>}
    <div style={card}>
      {alumnos.length === 0 ? <Vacio>No hay alumnos en este grupo.</Vacio> : (
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ borderBottom: "2px solid #E2E8F0" }}>{["#", "Alumno", "Padre / encargado", "Teléfono", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "#64748B", fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>{alumnos.map((a, i) => { const p = datos.padres.find((x) => x.id === a.padre_id); const wa = waLink(p?.telefono); return (
            <tr key={a.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
              <td style={{ padding: "8px", color: "#94A3B8" }}>{i + 1}</td>
              <td style={{ padding: "8px", fontWeight: 600 }}>{a.nombre}</td>
              <td style={{ padding: "8px" }}>{p?.nombre || "—"}</td>
              <td style={{ padding: "8px" }}>{p?.telefono || "—"}</td>
              <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                {wa && <a href={wa} target="_blank" rel="noreferrer" style={{ ...btnO, padding: "4px 10px", fontSize: 12, textDecoration: "none", color: "#059669", borderColor: "#A7F3D0" }}><Phone size={12} />WhatsApp</a>}
              </td>
            </tr>
          ); })}</tbody>
        </table></div>
      )}
    </div>
  </div>);
}

// ── Asistencia: libreta (como el cuaderno de asistencia de papel) ──
// Filas = alumnos, columnas = días de clase del mes. Se toca la casilla para
// marcar: vacío → P → A → T → J → vacío. Los cambios se guardan con un botón.
const CICLO = ["", "presente", "ausente", "tarde", "justificado"];
const sumarMes = (mes, n) => { const [y, m] = mes.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const DIAS_SEM = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function Asistencia({ datos, maestroId, avisar }) {
  const hoy = hoyISO();
  const [sec, setSec] = useState(datos.secciones[0]?.id || "");
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [guardado, setGuardado] = useState({}); // "alumno|fecha" -> estado (lo que hay en la base)
  const [marcas, setMarcas] = useState({});     // lo que se ve (con cambios sin guardar)
  const [diasExtra, setDiasExtra] = useState([]); // días agregados a mano
  const [nuevoDia, setNuevoDia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const alumnos = datos.alumnos.filter((a) => a.seccion_id === sec && a.estado === "activo");
  const s = datos.secciones.find((x) => x.id === sec);

  const cargar = useCallback(async () => {
    if (!sec) return;
    const { data, error } = await supabase.from("asistencias").select("alumno_id,fecha,estado").eq("seccion_id", sec).gte("fecha", mes + "-01").lte("fecha", mes + "-31");
    if (error) { avisar(mensajeError(error), "error"); return; }
    const m = {};
    (data || []).forEach((r) => { m[`${r.alumno_id}|${r.fecha}`] = r.estado; });
    setGuardado(m); setMarcas(m); setDiasExtra([]);
  }, [sec, mes]);
  useEffect(() => { cargar(); }, [cargar]);

  // Columnas: días con registros + hoy (si es este mes) + días agregados
  const dias = [...new Set([
    ...Object.keys(guardado).map((k) => k.split("|")[1]),
    ...(hoy.slice(0, 7) === mes ? [hoy] : []),
    ...diasExtra,
  ])].sort();
  const cambios = Object.keys({ ...guardado, ...marcas }).filter((k) => (guardado[k] || "") !== (marcas[k] || ""));

  const tocar = (aid, d) => {
    const k = `${aid}|${d}`; const i = CICLO.indexOf(marcas[k] || "");
    setMarcas({ ...marcas, [k]: CICLO[(i + 1) % CICLO.length] });
  };
  const todosPresentes = (d) => { const m = { ...marcas }; alumnos.forEach((a) => { if (!m[`${a.id}|${d}`]) m[`${a.id}|${d}`] = "presente"; }); setMarcas(m); };
  const agregarDia = () => {
    if (!nuevoDia) return;
    if (nuevoDia.slice(0, 7) !== mes) setMes(nuevoDia.slice(0, 7));
    setDiasExtra((x) => [...new Set([...x, nuevoDia])]);
    setNuevoDia("");
  };
  const cambiarMes = (n) => {
    if (cambios.length && !confirm("Tienes cambios sin guardar en esta libreta. ¿Cambiar de mes sin guardar?")) return;
    setMes(sumarMes(mes, n));
  };
  const cambiarGrupo = (v) => {
    if (cambios.length && !confirm("Tienes cambios sin guardar. ¿Cambiar de grupo sin guardar?")) return;
    setSec(v);
  };

  const guardar = async () => {
    const poner = cambios.filter((k) => marcas[k]).map((k) => { const [aid, f] = k.split("|"); return { id: `${sec}_${aid}_${f}`, seccion_id: sec, alumno_id: aid, maestro_id: maestroId, fecha: f, estado: marcas[k] }; });
    const quitar = cambios.filter((k) => !marcas[k]);
    setGuardando(true);
    try {
      if (poner.length) { const { error } = await supabase.from("asistencias").upsert(poner, { onConflict: "seccion_id,alumno_id,fecha" }); if (error) throw error; }
      for (const k of quitar) { const [aid, f] = k.split("|"); const { error } = await supabase.from("asistencias").delete().eq("seccion_id", sec).eq("alumno_id", aid).eq("fecha", f); if (error) throw error; }
      avisar(`✓ Libreta guardada (${cambios.length} ${cambios.length === 1 ? "cambio" : "cambios"})`);
      await cargar();
    } catch (e) { avisar("No se guardó: " + mensajeError(e), "error"); }
    setGuardando(false);
  };

  const totales = (aid) => {
    const v = dias.map((d) => marcas[`${aid}|${d}`]).filter(Boolean);
    const asis = v.filter((e) => e === "presente" || e === "tarde").length;
    return { asis, faltas: v.filter((e) => e === "ausente").length, pct: v.length ? Math.round((asis / v.length) * 100) : null };
  };
  const nombreMes = (() => { const t = new Date(mes + "-15T12:00:00").toLocaleDateString("es-HN", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); })();
  const celdaBase = { borderRight: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0", textAlign: "center", padding: 0 };

  return (<div>
    {/* Controles */}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      <SelectorGrupo secciones={datos.secciones} value={sec} onChange={cambiarGrupo} />
      <div style={{ display: "flex", alignItems: "center", border: "1px solid #D1D5DB", borderRadius: 7, background: "#fff" }}>
        <button onClick={() => cambiarMes(-1)} title="Mes anterior" style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 10px", fontSize: 14, color: "#475569" }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", minWidth: 130, textAlign: "center" }}>{nombreMes}</span>
        <button onClick={() => cambiarMes(1)} disabled={mes >= hoy.slice(0, 7)} title="Mes siguiente" style={{ background: "none", border: "none", cursor: mes >= hoy.slice(0, 7) ? "default" : "pointer", padding: "8px 10px", fontSize: 14, color: mes >= hoy.slice(0, 7) ? "#CBD5E1" : "#475569" }}>›</button>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input type="date" value={nuevoDia} max={hoy} onChange={(e) => setNuevoDia(e.target.value)} style={{ ...input, width: 150, padding: "7px 8px" }} />
        <button onClick={agregarDia} disabled={!nuevoDia} style={{ ...btnO, padding: "7px 10px", fontSize: 12, opacity: nuevoDia ? 1 : 0.5 }}><Plus size={12} />Agregar día</button>
      </div>
    </div>

    {/* Libreta */}
    <div style={{ ...card, padding: 0, overflow: "hidden", background: "#FFFDF8", border: "1px solid #E7DCC8" }}>
      <div style={{ padding: "12px 16px", borderBottom: "2px solid #EA580C", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, background: "#fff" }}>
        <div>
          <div style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Registro de asistencia</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B" }}>{s?.nombre || "—"} <span style={{ fontWeight: 400, color: "#64748B", fontSize: 13 }}>{s?.horario ? `· ${s.horario}` : ""}</span></div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#64748B" }}>
          <div>Docente: <strong style={{ color: "#1E293B" }}>{datos.maestro?.nombre}</strong></div>
          <div>{nombreMes} · {alumnos.length} alumnos</div>
        </div>
      </div>
      {alumnos.length === 0 ? <Vacio>No hay alumnos en este grupo.</Vacio> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 13, minWidth: "100%" }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, zIndex: 2, background: "#FFF7ED", textAlign: "left", padding: "8px 10px", borderRight: "2px solid #E7DCC8", borderBottom: "2px solid #E7DCC8", minWidth: window.innerWidth > 600 ? 190 : 130, fontSize: 11, color: "#9A3412", textTransform: "uppercase", letterSpacing: 0.5 }}>N.º · Alumno</th>
                {dias.map((d) => { const dt = new Date(d + "T12:00:00"); const esHoy = d === hoy; return (
                  <th key={d} style={{ ...celdaBase, borderBottom: "2px solid #E7DCC8", background: esHoy ? "#FFEDD5" : "#FFF7ED", minWidth: 44, padding: "4px 2px" }}>
                    <div style={{ fontSize: 10, color: "#9A3412", fontWeight: 600 }}>{DIAS_SEM[dt.getDay()]}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: esHoy ? NAR : "#1E293B" }}>{dt.getDate()}</div>
                    <button onClick={() => todosPresentes(d)} title="Marcar presentes a los que faltan" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#059669", fontWeight: 700, padding: 0 }}>✓ todos</button>
                  </th>
                ); })}
                {dias.length === 0 && <th style={{ ...celdaBase, borderBottom: "2px solid #E7DCC8", background: "#FFF7ED", padding: "8px 12px", fontSize: 12, color: "#9A3412", fontWeight: 400 }}>Agrega un día de clase con “Agregar día”</th>}
                {["Asist.", "Faltas", "% asist."].map((h) => <th key={h} style={{ ...celdaBase, borderBottom: "2px solid #E7DCC8", background: "#F1F5F9", padding: "8px 8px", fontSize: 11, color: "#475569", minWidth: 48 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a, i) => { const t = totales(a.id); return (
                <tr key={a.id}>
                  <td style={{ position: "sticky", left: 0, zIndex: 1, background: i % 2 ? "#FFFBF2" : "#FFFDF8", padding: "0 10px", height: 38, borderRight: "2px solid #E7DCC8", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>
                    <span style={{ color: "#94A3B8", fontSize: 11, display: "inline-block", width: 22 }}>{i + 1}.</span><span style={{ fontWeight: 600, color: "#1E293B" }}>{a.nombre}</span>
                  </td>
                  {dias.map((d) => { const k = `${a.id}|${d}`; const e = ESTADOS_ASIS.find((x) => x.v === marcas[k]); const cambiado = (guardado[k] || "") !== (marcas[k] || ""); return (
                    <td key={d} style={{ ...celdaBase, background: d === hoy ? "#FFF7ED" : "transparent" }}>
                      <button onClick={() => tocar(a.id, d)} title={e ? e.l : "Sin marcar (toca para marcar)"} style={{ width: "100%", height: 37, border: "none", background: cambiado ? "#FEF3C7" : "transparent", cursor: "pointer", fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 15, fontWeight: 800, color: e ? e.c : "#E2E8F0" }}>{e ? e.k : "·"}</button>
                    </td>
                  ); })}
                  {dias.length === 0 && <td style={celdaBase} />}
                  <td style={{ ...celdaBase, fontWeight: 700, color: "#059669" }}>{t.asis}</td>
                  <td style={{ ...celdaBase, fontWeight: 700, color: t.faltas ? "#DC2626" : "#94A3B8" }}>{t.faltas}</td>
                  <td style={{ ...celdaBase, fontWeight: 800, color: t.pct !== null && t.pct < 75 ? "#DC2626" : "#1E293B" }}>{t.pct === null ? "—" : t.pct + "%"}</td>
                </tr>
              ); })}
              <tr>
                <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#F1F5F9", padding: "6px 10px", borderRight: "2px solid #E7DCC8", fontSize: 11, fontWeight: 700, color: "#475569" }}>Presentes del día</td>
                {dias.map((d) => <td key={d} style={{ ...celdaBase, background: "#F1F5F9", fontSize: 12, fontWeight: 700, color: "#475569", padding: "6px 0" }}>{alumnos.filter((a) => ["presente", "tarde"].includes(marcas[`${a.id}|${d}`])).length}</td>)}
                {dias.length === 0 && <td style={{ ...celdaBase, background: "#F1F5F9" }} />}
                <td colSpan={3} style={{ ...celdaBase, background: "#F1F5F9" }} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 16px", background: "#fff", borderTop: "1px solid #E7DCC8", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748B", flexWrap: "wrap" }}>
          {ESTADOS_ASIS.map((e) => <span key={e.v}><strong style={{ color: e.c, fontSize: 13 }}>{e.k}</strong> {e.l}</span>)}
          <span>· Toca una casilla para cambiarla</span>
        </div>
        <button onClick={guardar} disabled={guardando || !cambios.length} style={{ ...btn(), opacity: guardando || !cambios.length ? 0.5 : 1 }}><Save size={15} />{guardando ? "Guardando…" : cambios.length ? `Guardar (${cambios.length})` : "✓ Guardado"}</button>
      </div>
    </div>
  </div>);
}

// ── Reflections ──
function Reflections({ datos, maestroId, avisar }) {
  const [sec, setSec] = useState(datos.secciones[0]?.id || "");
  const [alumno, setAlumno] = useState("");
  const [form, setForm] = useState({ categoria: CATEGORIAS_REFLECTION[0], texto: "", fecha: hoyISO() });
  const [lista, setLista] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const alumnos = datos.alumnos.filter((a) => a.seccion_id === sec && a.estado === "activo");
  const nombre = (id) => datos.alumnos.find((a) => a.id === id)?.nombre || "—";

  const cargar = useCallback(async () => {
    if (!sec) return;
    const { data, error } = await supabase.from("reflections").select("*").eq("seccion_id", sec).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(200);
    if (error) { avisar(mensajeError(error), "error"); return; }
    setLista(data || []);
  }, [sec]);
  useEffect(() => { cargar(); setAlumno(""); }, [cargar]);

  const guardar = async () => {
    if (!alumno) { avisar("Elige el alumno", "error"); return; }
    if (!form.texto.trim()) { avisar("Escribe la reflection", "error"); return; }
    setGuardando(true);
    const { error } = await supabase.from("reflections").insert({ id: uid(), seccion_id: sec, alumno_id: alumno, maestro_id: maestroId, fecha: form.fecha, categoria: form.categoria, texto: form.texto.trim() });
    setGuardando(false);
    if (error) { avisar("No se guardó: " + mensajeError(error), "error"); return; }
    avisar("✓ Reflection guardada");
    setForm({ ...form, texto: "" });
    cargar();
  };
  const borrar = async (r) => {
    if (!confirm("¿Borrar esta reflection?")) return;
    const { error } = await supabase.from("reflections").delete().eq("id", r.id);
    if (error) { avisar(mensajeError(error), "error"); return; }
    cargar();
  };
  const visibles = alumno ? lista.filter((r) => r.alumno_id === alumno) : lista;

  return (<div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      <SelectorGrupo secciones={datos.secciones} value={sec} onChange={setSec} />
    </div>
    <div style={card}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: "0 0 12px" }}>Nueva reflection</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        <div><label style={label}>Alumno</label><select value={alumno} onChange={(e) => setAlumno(e.target.value)} style={{ ...input, cursor: "pointer" }}><option value="">Elige…</option>{alumnos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></div>
        <div><label style={label}>Tipo</label><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} style={{ ...input, cursor: "pointer" }}>{CATEGORIAS_REFLECTION.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label style={label}>Fecha</label><input type="date" value={form.fecha} max={hoyISO()} onChange={(e) => setForm({ ...form, fecha: e.target.value })} style={input} /></div>
      </div>
      <div style={{ marginTop: 10 }}><label style={label}>Reflection</label><textarea value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} rows={4} placeholder="Ej: Participó mucho en la actividad oral, mejoró su pronunciación…" style={{ ...input, resize: "vertical" }} /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button onClick={guardar} disabled={guardando} style={btn()}><Save size={15} />{guardando ? "Guardando…" : "Guardar"}</button></div>
    </div>
    <div style={card}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: "0 0 8px" }}>{alumno ? `Reflections de ${nombre(alumno)}` : "Reflections del grupo"} <span style={{ fontWeight: 400, color: "#94A3B8", fontSize: 12 }}>({visibles.length})</span></h3>
      {visibles.length === 0 ? <Vacio>Todavía no hay reflections.</Vacio> : visibles.map((r) => (
        <div key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 13 }}><strong>{nombre(r.alumno_id)}</strong> <span style={badge(NAR)}>{r.categoria || "General"}</span> <span style={{ fontSize: 11, color: "#94A3B8" }}>{fechaLarga(r.fecha)}</span></div>
            {r.maestro_id === maestroId && <button onClick={() => borrar(r)} title="Borrar" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Trash2 size={13} color="#EF4444" /></button>}
          </div>
          <div style={{ fontSize: 13, color: "#334155", marginTop: 4, whiteSpace: "pre-wrap" }}>{r.texto}</div>
        </div>
      ))}
    </div>
  </div>);
}

// ── Reporte de clase ──
function ReporteClase({ datos, maestroId, avisar }) {
  const vacio = () => ({ seccion_id: datos.secciones[0]?.id || "", fecha: hoyISO(), respuestas: {} });
  const [form, setForm] = useState(vacio);
  const [lista, setLista] = useState([]);
  const [abierto, setAbierto] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const grupo = (id) => datos.secciones.find((s) => s.id === id)?.nombre || "—";

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("reportes_clase").select("*").eq("maestro_id", maestroId).order("fecha", { ascending: false }).limit(60);
    if (error) { avisar(mensajeError(error), "error"); return; }
    setLista(data || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const set = (k, v) => setForm({ ...form, respuestas: { ...form.respuestas, [k]: v } });
  const guardar = async () => {
    if (!form.seccion_id) { avisar("Elige el grupo", "error"); return; }
    const falta = CAMPOS_REPORTE.find((c) => c.req && !String(form.respuestas[c.k] || "").trim());
    if (falta) { avisar(`Completa: ${falta.l}`, "error"); return; }
    setGuardando(true);
    const { error } = await supabase.from("reportes_clase").insert({ id: uid(), seccion_id: form.seccion_id, maestro_id: maestroId, fecha: form.fecha, respuestas: form.respuestas });
    setGuardando(false);
    if (error) { avisar("No se guardó: " + mensajeError(error), "error"); return; }
    avisar("✓ Reporte enviado");
    setForm(vacio());
    cargar();
  };

  return (<div>
    <div style={card}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: "0 0 12px" }}>Nuevo reporte de clase</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBottom: 10 }}>
        <div><label style={label}>Grupo</label><SelectorGrupo secciones={datos.secciones} value={form.seccion_id} onChange={(v) => setForm({ ...form, seccion_id: v })} /></div>
        <div><label style={label}>Fecha de la clase</label><input type="date" value={form.fecha} max={hoyISO()} onChange={(e) => setForm({ ...form, fecha: e.target.value })} style={input} /></div>
      </div>
      {CAMPOS_REPORTE.map((c) => (
        <div key={c.k} style={{ marginBottom: 10 }}>
          <label style={label}>{c.l}{c.req && <span style={{ color: NAR }}> *</span>}</label>
          {c.tipo === "area" ? <textarea value={form.respuestas[c.k] || ""} onChange={(e) => set(c.k, e.target.value)} rows={3} style={{ ...input, resize: "vertical" }} />
            : c.tipo === "opcion" ? <div style={{ display: "flex", gap: 6 }}>{c.opciones.map((o) => { const on = form.respuestas[c.k] === o; return <button key={o} onClick={() => set(c.k, o)} style={{ ...btnO, padding: "6px 14px", borderColor: on ? NAR : "#D1D5DB", background: on ? "#FFF7ED" : "#fff", color: on ? NAR : "#64748B", fontWeight: on ? 700 : 400 }}>{o}</button>; })}</div>
            : <input value={form.respuestas[c.k] || ""} onChange={(e) => set(c.k, e.target.value)} style={input} />}
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end" }}><button onClick={guardar} disabled={guardando} style={btn()}><Send size={15} />{guardando ? "Enviando…" : "Enviar reporte"}</button></div>
    </div>
    <div style={card}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: "0 0 8px" }}>Mis reportes enviados</h3>
      {lista.length === 0 ? <Vacio>Todavía no has enviado reportes.</Vacio> : lista.map((r) => (
        <div key={r.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
          <button onClick={() => setAbierto(abierto === r.id ? null : r.id)} style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 8, padding: "10px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
            <span style={{ fontSize: 13 }}><strong>{grupo(r.seccion_id)}</strong> · {r.respuestas?.tema || "Sin tema"}</span>
            <span style={{ fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap" }}>{fechaLarga(r.fecha)}</span>
          </button>
          {abierto === r.id && <RespuestasReporte r={r} />}
        </div>
      ))}
    </div>
  </div>);
}

function RespuestasReporte({ r }) {
  return (
    <div style={{ background: "#F8FAFC", borderRadius: 8, padding: 12, marginBottom: 10 }}>
      {CAMPOS_REPORTE.filter((c) => r.respuestas?.[c.k]).map((c) => (
        <div key={c.k} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.3 }}>{c.l}</div>
          <div style={{ fontSize: 13, color: "#1E293B", whiteSpace: "pre-wrap" }}>{r.respuestas[c.k]}</div>
        </div>
      ))}
    </div>
  );
}

// ── Solicitudes (docente) ──
function SolicitudesDocente({ maestroId, avisar }) {
  const [form, setForm] = useState({ tipo: TIPOS_SOLICITUD[0], asunto: "", detalle: "" });
  const [lista, setLista] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("solicitudes").select("*").eq("maestro_id", maestroId).order("created_at", { ascending: false });
    if (error) { avisar(mensajeError(error), "error"); return; }
    setLista(data || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const enviar = async () => {
    if (!form.asunto.trim()) { avisar("Escribe el asunto", "error"); return; }
    setEnviando(true);
    const { error } = await supabase.from("solicitudes").insert({ id: uid(), maestro_id: maestroId, tipo: form.tipo, asunto: form.asunto.trim(), detalle: form.detalle.trim(), estado: "pendiente" });
    setEnviando(false);
    if (error) { avisar("No se envió: " + mensajeError(error), "error"); return; }
    avisar("✓ Solicitud enviada a administración");
    setForm({ tipo: TIPOS_SOLICITUD[0], asunto: "", detalle: "" });
    cargar();
  };
  const borrar = async (s) => {
    if (!confirm("¿Cancelar esta solicitud?")) return;
    const { error } = await supabase.from("solicitudes").delete().eq("id", s.id);
    if (error) { avisar(mensajeError(error), "error"); return; }
    cargar();
  };

  return (<div>
    <div style={card}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: "0 0 12px" }}>Nueva solicitud a administración</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
        <div><label style={label}>Tipo</label><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={{ ...input, cursor: "pointer" }}>{TIPOS_SOLICITUD.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label style={label}>Asunto</label><input value={form.asunto} onChange={(e) => setForm({ ...form, asunto: e.target.value })} maxLength={140} placeholder="Ej: Necesito marcadores para la pizarra" style={input} /></div>
      </div>
      <div style={{ marginTop: 10 }}><label style={label}>Detalle</label><textarea value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} rows={3} style={{ ...input, resize: "vertical" }} /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button onClick={enviar} disabled={enviando} style={btn()}><Send size={15} />{enviando ? "Enviando…" : "Enviar"}</button></div>
    </div>
    <div style={card}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: "0 0 8px" }}>Mis solicitudes</h3>
      {lista.length === 0 ? <Vacio>No has hecho solicitudes.</Vacio> : lista.map((s) => { const e = ESTADO_SOL[s.estado] || ESTADO_SOL.pendiente; return (
        <div key={s.id} style={{ padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 13 }}><strong>{s.asunto}</strong> <span style={{ fontSize: 11, color: "#94A3B8" }}>· {s.tipo} · {new Date(s.created_at).toLocaleDateString("es-HN")}</span></div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={badge(e.c)}>{e.l}</span>
              {s.estado === "pendiente" && <button onClick={() => borrar(s)} title="Cancelar" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Trash2 size={13} color="#EF4444" /></button>}
            </div>
          </div>
          {s.detalle && <div style={{ fontSize: 12, color: "#64748B", marginTop: 3, whiteSpace: "pre-wrap" }}>{s.detalle}</div>}
          {s.respuesta && <div style={{ fontSize: 12, color: "#1E293B", background: "#FFF7ED", borderLeft: `3px solid ${NAR}`, padding: "6px 10px", borderRadius: 6, marginTop: 6, whiteSpace: "pre-wrap" }}><strong>Administración:</strong> {s.respuesta}</div>}
        </div>
      ); })}
    </div>
  </div>);
}

// ════════════════════════════════════════════════════════════
//  ADMINISTRACIÓN: revisar lo que hacen los docentes
// ════════════════════════════════════════════════════════════
export function AdminDocentesPage({ data, showToast }) {
  const [tab, setTab] = useState("solicitudes");
  const [error, setError] = useState("");
  const tBtn = (a) => ({ padding: "10px 16px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", borderBottom: a ? `3px solid ${NAR}` : "3px solid transparent", background: "transparent", color: a ? NAR : "#64748B" });
  const props = { data, showToast, setError };
  return (<div>
    {error && (error.startsWith("Falta activar") ? <AvisoActivarModulo showToast={showToast} /> : <div style={{ ...card, background: "#FFF7ED", border: "1px solid #FDBA74", color: "#9A3412", fontSize: 13 }}>⚠ {error}</div>)}
    <div style={{ display: "flex", borderBottom: "1px solid #E2E8F0", marginBottom: 16, flexWrap: "wrap" }}>
      <button onClick={() => setTab("solicitudes")} style={tBtn(tab === "solicitudes")}>📥 Solicitudes</button>
      <button onClick={() => setTab("asistencia")} style={tBtn(tab === "asistencia")}>✅ Asistencia</button>
      <button onClick={() => setTab("reflections")} style={tBtn(tab === "reflections")}>💬 Reflections</button>
      <button onClick={() => setTab("reportes")} style={tBtn(tab === "reportes")}>📋 Reportes de clase</button>
    </div>
    {tab === "solicitudes" && <AdminSolicitudes {...props} />}
    {tab === "asistencia" && <AdminAsistencia {...props} />}
    {tab === "reflections" && <AdminReflections {...props} />}
    {tab === "reportes" && <AdminReportes {...props} />}
  </div>);
}

const nombreMaestro = (data, id) => data.maestros.find((m) => m.id === id)?.nombre || "—";

function AdminSolicitudes({ data, showToast, setError }) {
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState("abiertas");
  const [resp, setResp] = useState({});
  const cargar = useCallback(async () => {
    const { data: d, error } = await supabase.from("solicitudes").select("*").order("created_at", { ascending: false });
    if (error) { setError(mensajeError(error)); return; }
    setError(""); setLista(d || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const actualizar = async (s, estado) => {
    const respuesta = (resp[s.id] ?? s.respuesta ?? "").trim() || null;
    const { error } = await supabase.from("solicitudes").update({ estado, respuesta, respondido_at: new Date().toISOString() }).eq("id", s.id);
    if (error) { showToast("Error: " + mensajeError(error), "error"); return; }
    showToast("✓ Solicitud actualizada");
    cargar();
  };
  const visibles = lista.filter((s) => filtro === "todas" || (filtro === "abiertas" ? ["pendiente", "en_proceso"].includes(s.estado) : s.estado === filtro));
  const abiertas = lista.filter((s) => ["pendiente", "en_proceso"].includes(s.estado)).length;
  return (<div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
      <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ ...input, width: 200, cursor: "pointer" }}>
        <option value="abiertas">Abiertas ({abiertas})</option>
        <option value="resuelta">Resueltas</option>
        <option value="rechazada">Rechazadas</option>
        <option value="todas">Todas ({lista.length})</option>
      </select>
      <button onClick={cargar} style={btnO}><RefreshCw size={13} />Actualizar</button>
    </div>
    {visibles.length === 0 ? <div style={card}><Vacio>No hay solicitudes {filtro === "abiertas" ? "abiertas" : ""}.</Vacio></div> : visibles.map((s) => { const e = ESTADO_SOL[s.estado] || ESTADO_SOL.pendiente; return (
      <div key={s.id} style={{ ...card, borderLeft: `3px solid ${e.c}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{s.asunto}</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>{nombreMaestro(data, s.maestro_id)} · {s.tipo} · {new Date(s.created_at).toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short" })}</div>
          </div>
          <span style={badge(e.c)}>{e.l}</span>
        </div>
        {s.detalle && <div style={{ fontSize: 13, color: "#334155", marginTop: 8, whiteSpace: "pre-wrap" }}>{s.detalle}</div>}
        <textarea value={resp[s.id] ?? s.respuesta ?? ""} onChange={(ev) => setResp({ ...resp, [s.id]: ev.target.value })} rows={2} placeholder="Respuesta para el docente (opcional)" style={{ ...input, resize: "vertical", marginTop: 10 }} />
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={() => actualizar(s, "en_proceso")} style={{ ...btnO, padding: "6px 12px", fontSize: 12 }}>En proceso</button>
          <button onClick={() => actualizar(s, "rechazada")} style={{ ...btnO, padding: "6px 12px", fontSize: 12, color: "#DC2626", borderColor: "#FECACA" }}><X size={12} />Rechazar</button>
          <button onClick={() => actualizar(s, "resuelta")} style={{ ...btn(), padding: "6px 14px", fontSize: 12 }}><Check size={12} />Resuelta</button>
        </div>
      </div>
    ); })}
  </div>);
}

// Tabla mensual de asistencia de un grupo (la usan administración y docentes)
function GridAsistencia({ secciones, alumnos: todos, setError }) {
  const [sec, setSec] = useState(secciones[0]?.id || "");
  const [mes, setMes] = useState(hoyISO().slice(0, 7));
  const [regs, setRegs] = useState([]);
  useEffect(() => { (async () => {
    if (!sec) return;
    const { data: d, error } = await supabase.from("asistencias").select("*").eq("seccion_id", sec).gte("fecha", mes + "-01").lte("fecha", mes + "-31");
    if (error) { setError(mensajeError(error)); return; }
    setError(""); setRegs(d || []);
  })(); }, [sec, mes]);
  const dias = [...new Set(regs.map((r) => r.fecha))].sort();
  // Alumnos activos del grupo y también los que ya no están pero tienen registros ese mes
  const conRegistro = new Set(regs.map((r) => r.alumno_id));
  const alumnos = todos.filter((a) => a.seccion_id === sec && a.estado === "activo" || conRegistro.has(a.id));
  const est = (aid, d) => regs.find((r) => r.alumno_id === aid && r.fecha === d)?.estado;
  const nombreMes = new Date(mes + "-15T12:00:00").toLocaleDateString("es-HN", { month: "long", year: "numeric" });
  return (<div>
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      <SelectorGrupo secciones={secciones} value={sec} onChange={setSec} />
      <input type="month" value={mes} max={hoyISO().slice(0, 7)} onChange={(e) => setMes(e.target.value)} style={{ ...input, width: 170 }} />
      <span style={{ fontSize: 12, color: "#64748B" }}>{dias.length} {dias.length === 1 ? "clase registrada" : "clases registradas"} en {nombreMes}</span>
    </div>
    <div style={card}>
      {dias.length === 0 ? <Vacio>No hay asistencia registrada para este grupo en {nombreMes}.</Vacio> : (
        <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
          <thead><tr style={{ borderBottom: "2px solid #E2E8F0" }}>
            <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748B" }}>Alumno</th>
            {dias.map((d) => <th key={d} title={fechaLarga(d)} style={{ padding: "6px 4px", color: "#64748B", fontWeight: 600 }}>{Number(d.slice(8))}</th>)}
            <th style={{ padding: "6px 8px", color: "#64748B", textAlign: "right" }}>Ausencias</th>
            <th style={{ padding: "6px 8px", color: "#64748B", textAlign: "right" }}>% asistencia</th>
          </tr></thead>
          <tbody>{alumnos.map((a) => { const r = regs.filter((x) => x.alumno_id === a.id); const ok = r.filter((x) => x.estado === "presente" || x.estado === "tarde").length; const aus = r.filter((x) => x.estado === "ausente").length; const pct = r.length ? Math.round((ok / r.length) * 100) : null; return (
            <tr key={a.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
              <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{a.nombre}{a.estado !== "activo" && <span style={{ ...badge("#94A3B8"), marginLeft: 6 }}>inactivo</span>}</td>
              {dias.map((d) => { const e = ESTADOS_ASIS.find((x) => x.v === est(a.id, d)); return <td key={d} style={{ textAlign: "center", padding: "4px" }}>{e ? <span title={e.l} style={{ display: "inline-block", width: 22, height: 22, lineHeight: "22px", borderRadius: 5, background: e.c + "1A", color: e.c, fontWeight: 800 }}>{e.k}</span> : <span style={{ color: "#CBD5E1" }}>·</span>}</td>; })}
              <td style={{ textAlign: "right", padding: "6px 8px", color: aus ? "#DC2626" : "#94A3B8" }}>{aus}</td>
              <td style={{ textAlign: "right", padding: "6px 8px", fontWeight: 700, color: pct !== null && pct < 75 ? "#DC2626" : "#1E293B" }}>{pct === null ? "—" : pct + "%"}</td>
            </tr>
          ); })}</tbody>
        </table></div>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "#64748B", flexWrap: "wrap" }}>{ESTADOS_ASIS.map((e) => <span key={e.v}><strong style={{ color: e.c }}>{e.k}</strong> {e.l}</span>)}</div>
    </div>
  </div>);
}

function AdminAsistencia({ data, setError }) {
  return <GridAsistencia secciones={data.secciones.filter((s) => s.activa !== false)} alumnos={data.alumnos} setError={setError} />;
}

function AdminReflections({ data, setError }) {
  const [sec, setSec] = useState("");
  const [lista, setLista] = useState([]);
  useEffect(() => { (async () => {
    let q = supabase.from("reflections").select("*").order("fecha", { ascending: false }).limit(300);
    if (sec) q = q.eq("seccion_id", sec);
    const { data: d, error } = await q;
    if (error) { setError(mensajeError(error)); return; }
    setError(""); setLista(d || []);
  })(); }, [sec]);
  const alumno = (id) => data.alumnos.find((a) => a.id === id)?.nombre || "—";
  const grupo = (id) => data.secciones.find((s) => s.id === id)?.nombre || "—";
  return (<div>
    <div style={{ marginBottom: 12 }}>
      <select value={sec} onChange={(e) => setSec(e.target.value)} style={{ ...input, width: 240, cursor: "pointer" }}>
        <option value="">Todos los grupos</option>
        {data.secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
    </div>
    <div style={card}>
      {lista.length === 0 ? <Vacio>No hay reflections.</Vacio> : lista.map((r) => (
        <div key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 13 }}><strong>{alumno(r.alumno_id)}</strong> <span style={{ color: "#94A3B8" }}>· {grupo(r.seccion_id)}</span> <span style={badge(NAR)}>{r.categoria || "General"}</span></div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>{fechaLarga(r.fecha)} · {nombreMaestro(data, r.maestro_id)}</div>
          <div style={{ fontSize: 13, color: "#334155", marginTop: 4, whiteSpace: "pre-wrap" }}>{r.texto}</div>
        </div>
      ))}
    </div>
  </div>);
}

function AdminReportes({ data, setError }) {
  const [sec, setSec] = useState("");
  const [lista, setLista] = useState([]);
  const [abierto, setAbierto] = useState(null);
  useEffect(() => { (async () => {
    let q = supabase.from("reportes_clase").select("*").order("fecha", { ascending: false }).limit(200);
    if (sec) q = q.eq("seccion_id", sec);
    const { data: d, error } = await q;
    if (error) { setError(mensajeError(error)); return; }
    setError(""); setLista(d || []);
  })(); }, [sec]);
  const grupo = (id) => data.secciones.find((s) => s.id === id)?.nombre || "—";
  return (<div>
    <div style={{ marginBottom: 12 }}>
      <select value={sec} onChange={(e) => setSec(e.target.value)} style={{ ...input, width: 240, cursor: "pointer" }}>
        <option value="">Todos los grupos</option>
        {data.secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
    </div>
    <div style={card}>
      {lista.length === 0 ? <Vacio>No hay reportes de clase.</Vacio> : lista.map((r) => (
        <div key={r.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
          <button onClick={() => setAbierto(abierto === r.id ? null : r.id)} style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 8, padding: "10px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
            <span style={{ fontSize: 13 }}><strong>{grupo(r.seccion_id)}</strong> · {r.respuestas?.tema || "Sin tema"} <span style={{ color: "#94A3B8" }}>· {nombreMaestro(data, r.maestro_id)}</span></span>
            <span style={{ fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap" }}>{fechaLarga(r.fecha)}</span>
          </button>
          {abierto === r.id && <RespuestasReporte r={r} />}
        </div>
      ))}
    </div>
  </div>);
}

// ════════════════════════════════════════════════════════════
//  ADMINISTRACIÓN: acceso de un maestro al portal (en la página Maestros)
// ════════════════════════════════════════════════════════════
const llamarApiDocentes = async (body) => {
  // Edge Function "docentes" en Supabase (supabase/functions/docentes)
  const { data, error } = await supabase.functions.invoke("docentes", { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) { /* sin detalle */ }
    if (/Failed to send|fetch/i.test(msg)) msg = "No se pudo conectar con el servidor. Revisa tu internet.";
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

export function useAccesosDocentes() {
  const [perfiles, setPerfiles] = useState(null); // null = módulo no activado
  const recargar = useCallback(async () => {
    const { data, error } = await supabase.from("perfiles").select("user_id,maestro_id,email,rol").not("maestro_id", "is", null);
    setPerfiles(error ? null : data || []);
  }, []);
  useEffect(() => { recargar(); }, [recargar]);
  return { perfiles, recargar };
}

export function AccesoDocente({ maestro, perfiles, recargar, showToast }) {
  const [modal, setModal] = useState(null); // "crear" | "contrasena"
  const [form, setForm] = useState({ email: "", password: "" });
  const [ocupado, setOcupado] = useState(false);
  if (perfiles === null) return <span style={{ fontSize: 11, color: "#94A3B8" }}>—</span>;
  const acceso = perfiles.find((p) => p.maestro_id === maestro.id);
  const sugerirClave = () => "Seeds-" + Math.random().toString(36).slice(2, 6) + Math.floor(1000 + Math.random() * 9000);
  const abrir = (tipo) => { setForm({ email: maestro.email || "", password: sugerirClave() }); setModal(tipo); };
  const enviar = async () => {
    setOcupado(true);
    try {
      let r;
      if (modal === "crear") r = await llamarApiDocentes({ accion: "crear", maestro_id: maestro.id, email: form.email, password: form.password });
      else r = await llamarApiDocentes({ accion: "contrasena", maestro_id: maestro.id, password: form.password });
      showToast(r?.vinculado ? `✓ Cuenta de administración vinculada a ${maestro.nombre}. Recarga la página (Ctrl + Shift + R) y usa el botón “Vista docente” de arriba.` : modal === "crear" ? `✓ Acceso creado para ${maestro.nombre}` : "✓ Contraseña cambiada");
      setModal(null); recargar();
    } catch (e) { showToast(e.message, "error"); }
    setOcupado(false);
  };
  const quitar = async () => {
    const esAdmin = acceso?.rol === "admin";
    if (!confirm(esAdmin ? `¿Desvincular ${acceso.email} de ${maestro.nombre}? La cuenta de administración sigue igual; solo deja de tener la vista docente.` : `¿Quitar el acceso de ${maestro.nombre}? Ya no podrá entrar al portal docente. Lo que registró (asistencia, reflections) se conserva.`)) return;
    try { await llamarApiDocentes({ accion: "quitar", maestro_id: maestro.id }); showToast("Acceso quitado", "error"); recargar(); }
    catch (e) { showToast(e.message, "error"); }
  };
  const copiar = () => { const t = `Portal docente Seeds\n${window.location.origin}\nCorreo: ${modal === "crear" ? form.email : acceso?.email}\nContraseña: ${form.password}`; navigator.clipboard?.writeText(t).then(() => showToast("✓ Datos copiados para enviar al docente")).catch(() => {}); };

  return (<>
    {acceso ? (
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <span title={acceso.email} style={badge(acceso.rol === "admin" ? "#7C3AED" : "#059669")}>{acceso.rol === "admin" ? "★ Admin · " : "✓ "}{acceso.email}</span>
        {acceso.rol !== "admin" && <button onClick={() => abrir("contrasena")} title="Cambiar contraseña" style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}><KeyRound size={14} color="#64748B" /></button>}
        <button onClick={quitar} title="Quitar acceso" style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}><X size={14} color="#EF4444" /></button>
      </div>
    ) : (
      <button onClick={() => abrir("crear")} style={{ ...btnO, padding: "4px 10px", fontSize: 12, color: NAR, borderColor: "#FED7AA" }}><Plus size={12} />Dar acceso</button>
    )}
    {modal && <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 420, padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: "#1E293B" }}>{modal === "crear" ? "Dar acceso al portal docente" : "Cambiar contraseña"}</h3>
        <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 14px" }}>{maestro.nombre}</p>
        {modal === "crear" && <div style={{ marginBottom: 12 }}><label style={label}>Correo del docente</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} placeholder="docente@correo.com" /></div>}
        <div style={{ marginBottom: 6 }}><label style={label}>Contraseña {modal === "crear" ? "temporal" : "nueva"}</label><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={input} /></div>
        <p style={{ fontSize: 11, color: "#94A3B8", margin: "0 0 14px" }}>Mínimo 8 caracteres. Copia los datos y envíaselos al docente por WhatsApp.{modal === "crear" && " Si el correo es de una cuenta de administración, no se crea otra: se vincula y esa persona usa el botón “Vista docente” (la contraseña de aquí se ignora)."}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={copiar} style={btnO}>Copiar datos</button>
          <button onClick={() => setModal(null)} style={btnO}>Cancelar</button>
          <button onClick={enviar} disabled={ocupado} style={{ ...btn(), opacity: ocupado ? 0.6 : 1 }}>{ocupado ? "Guardando…" : modal === "crear" ? "Crear acceso" : "Cambiar"}</button>
        </div>
      </div>
    </div>}
  </>);
}

// ════════════════════════════════════════════════════════════
//  ADMINISTRACIÓN (Inicio): alumnos activos sin asistencia en 2 meses
// ════════════════════════════════════════════════════════════
const DIAS_SIN_ASISTENCIA = 60;
const leerIgnorados = () => { try { return JSON.parse(localStorage.getItem("seeds_inactividad_ignorados")) || {}; } catch (e) { return {}; } };

export function AlertasInactividad({ data, loadData, showToast }) {
  const [regs, setRegs] = useState(null); // null = sin datos (módulo no activo o cargando)
  const [ultimas, setUltimas] = useState({}); // alumno_id -> última fecha que asistió (de cualquier época)
  const [ignorados, setIgnorados] = useState(leerIgnorados);
  const [ocupado, setOcupado] = useState(null);
  const desde = new Date(Date.now() - DIAS_SIN_ASISTENCIA * 86400000).toLocaleDateString("en-CA");

  useEffect(() => { (async () => {
    // Se lee por páginas: la base devuelve máximo 1000 filas por consulta
    const todas = [];
    for (let i = 0; i < 20; i++) {
      const { data: d, error } = await supabase.from("asistencias").select("seccion_id,alumno_id,fecha,estado").gte("fecha", desde).order("fecha").range(i * 1000, i * 1000 + 999);
      if (error) { setRegs(null); return; }
      todas.push(...(d || []));
      if (!d || d.length < 1000) break;
    }
    setRegs(todas);
  })(); }, [desde]);

  const hoyMs = Date.now();
  const gruposConLista = new Set((regs || []).map((r) => r.seccion_id));
  const asistio = new Set((regs || []).filter((r) => r.estado === "presente" || r.estado === "tarde").map((r) => r.alumno_id));
  const faltas = {};
  (regs || []).filter((r) => r.estado === "ausente").forEach((r) => { faltas[r.alumno_id] = (faltas[r.alumno_id] || 0) + 1; });
  // Alumnos activos, matriculados hace más de 2 meses, sin beca, que el docente
  // marcó ausente al menos 2 veces y que no asistieron ninguna vez en 2 meses
  // (si la casilla quedó en blanco no se cuenta como falta)
  const candidatos = regs ? data.alumnos.filter((a) =>
    a.estado === "activo" && a.beca !== true &&
    gruposConLista.has(a.seccion_id) && !asistio.has(a.id) && (faltas[a.id] || 0) >= 2 &&
    (!a.fecha_ingreso || a.fecha_ingreso <= desde) &&
    !(ignorados[a.id] && ignorados[a.id] > hoyMs)
  ) : [];
  const claveCand = candidatos.map((a) => a.id).join(",");

  // Última vez que asistió cada uno (puede ser antes de los 2 meses)
  useEffect(() => { (async () => {
    if (!claveCand) return;
    const { data: d } = await supabase.from("asistencias").select("alumno_id,fecha").in("alumno_id", claveCand.split(",")).in("estado", ["presente", "tarde"]).order("fecha", { ascending: false }).limit(1000);
    const m = {};
    (d || []).forEach((r) => { if (!m[r.alumno_id]) m[r.alumno_id] = r.fecha; });
    setUltimas(m);
  })(); }, [claveCand]);

  if (!regs || candidatos.length === 0) return null;

  const grupo = (id) => data.secciones.find((s) => s.id === id)?.nombre || "—";
  const pendientes = (aid) => data.facturas.filter((f) => f.alumno_id === aid && (f.tipo_factura || "cobro") === "cobro" && (f.estado === "pendiente" || f.estado === "parcial")).length;
  const inactivar = async (a) => {
    if (!confirm(`¿Pasar a ${a.nombre} a INACTIVO?\n\nYa no se le crearán cobros nuevos. Sus cobros pendientes y su historial se conservan. Puedes reactivarlo en Matrícula cuando quieras.`)) return;
    setOcupado(a.id);
    const { error } = await supabase.from("alumnos").update({ estado: "inactivo" }).eq("id", a.id);
    setOcupado(null);
    if (error) { showToast("Error: " + mensajeError(error), "error"); return; }
    showToast(`✓ ${a.nombre} pasó a inactivo`);
    loadData();
  };
  const ignorar = (a) => {
    const n = { ...leerIgnorados(), [a.id]: hoyMs + 30 * 86400000 };
    try { localStorage.setItem("seeds_inactividad_ignorados", JSON.stringify(n)); } catch (e) { /* sin almacenamiento */ }
    setIgnorados(n);
  };
  const th = { textAlign: "left", padding: "8px 10px", fontSize: 11, color: "#9A3412", textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid #FED7AA" };
  const td = { padding: "10px", borderBottom: "1px solid #FFEDD5", fontSize: 13, verticalAlign: "middle" };

  return (
    <div style={{ ...card, border: "1px solid #FDBA74", borderLeft: `4px solid ${NAR}`, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", background: "#FFF7ED" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#9A3412" }}>⚠ Alumnos que llevan 2 meses sin asistir ({candidatos.length})</div>
        <div style={{ fontSize: 12, color: "#9A3412", marginTop: 2 }}>Según las libretas de asistencia de los docentes. Te sugerimos pasarlos a inactivo para no seguir generándoles cobros.</div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Alumno</th><th style={th}>Grupo</th><th style={th}>Última asistencia</th><th style={th}>Sugerencia</th></tr></thead>
          <tbody>{candidatos.map((a) => { const u = ultimas[a.id]; const p = pendientes(a.id); return (
            <tr key={a.id}>
              <td style={{ ...td, fontWeight: 700, color: "#1E293B" }}>{a.nombre}{p > 0 && <div style={{ fontSize: 11, fontWeight: 400, color: "#DC2626" }}>{p} {p === 1 ? "cobro pendiente" : "cobros pendientes"}</div>}</td>
              <td style={td}><span style={badge(NAR)}>{grupo(a.seccion_id)}</span></td>
              <td style={{ ...td, color: "#64748B" }}>{u ? fechaLarga(u) : "Nunca ha asistido"}<div style={{ fontSize: 11, color: "#DC2626" }}>{faltas[a.id]} faltas en 2 meses</div></td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>
                <button onClick={() => inactivar(a)} disabled={ocupado === a.id} style={{ ...btn(), padding: "6px 12px", fontSize: 12, opacity: ocupado === a.id ? 0.6 : 1 }}>Pasar a inactivo</button>
                <button onClick={() => ignorar(a)} title="No mostrar por 30 días" style={{ ...btnO, padding: "5px 10px", fontSize: 12, marginLeft: 6 }}>Sigue activo</button>
              </td>
            </tr>
          ); })}</tbody>
        </table>
      </div>
    </div>
  );
}
