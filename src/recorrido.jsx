// ── RECORRIDO GUIADO Y NOVEDADES ──
// - La primera vez que alguien entra ve el recorrido completo de su portal.
// - Una vez al mes se le ofrece repasarlo (puede decir "Ahora no").
// - Cuando hay funciones nuevas (lista NOVEDADES), se le avisan una sola vez.
// Lo que ya vio se guarda en los datos del usuario de Supabase Auth
// (user_metadata), así no se repite al cambiar de computadora o celular.
// No usa tablas de la base de datos. Si no se puede guardar ahí, se recuerda
// en el navegador.
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { btn, btnO, vidrio } from "./estilo";

// ════════════════════════════════════════════════════════════
//  NOVEDADES: al publicar una función nueva, agréguela aquí con un id único
//  (nunca reutilice un id). rol: "admin" o "docente". ir: página a la que
//  lleva el botón "Ver" (opcional).
// ════════════════════════════════════════════════════════════
export const NOVEDADES = [
  { id: "2026-11-menu-agrupado", rol: "admin", fecha: "2026-11-23", titulo: "Menú ordenado por áreas",
    texto: "El menú ahora se agrupa en Escuela y alumnado, Cobros, Finanzas, Contabilidad y Configuración. Toque un grupo para abrirlo." },
  { id: "2026-11-alertas", rol: "admin", fecha: "2026-11-23", titulo: "Alertas financieras", ir: "alertas",
    texto: "Avisos automáticos de cobros atrasados, gastos fuera de lo normal y otros puntos que conviene revisar." },
  { id: "2026-11-contabilidad", rol: "admin", fecha: "2026-11-23", titulo: "Contabilidad", ir: "c_resultados",
    texto: "Estado de resultados, balance general, flujo de efectivo, libro diario y mayor, cierre de mes y catálogo de cuentas." },
  { id: "2026-11-recorrido", rol: "todos", fecha: "2026-11-23", titulo: "Recorrido guiado",
    texto: "El botón ? de la barra de arriba le muestra otra vez el recorrido por el sistema cuando lo necesite." },
];

// ════════════════════════════════════════════════════════════
//  PASOS DE CADA RECORRIDO. objetivo: valor del atributo data-tour del
//  elemento a resaltar (sin objetivo, la tarjeta sale al centro).
//  menu: true si el elemento está en el menú lateral (en celular se abre).
// ════════════════════════════════════════════════════════════
export const PASOS_ADMIN = [
  { titulo: "¡Bienvenida a Seeds!", texto: "Le mostramos en un minuto dónde está cada cosa. Puede saltar el recorrido cuando quiera y repetirlo con el botón ? de arriba." },
  { objetivo: "n-dashboard", menu: true, titulo: "Inicio", texto: "El resumen del día: alumnos activos, cobros pendientes y los números del mes de un vistazo." },
  { objetivo: "g-escuela", menu: true, titulo: "Escuela y alumnado", texto: "Secciones, maestros, matrícula de alumnos y la gestión curricular (asistencia, parte mensual, bitácoras, reflections, check list y solicitudes de docentes)." },
  { objetivo: "g-cobros", menu: true, titulo: "Cobros", texto: "Facturas y pagos de mensualidades, el historial de cada alumno, recordatorios por WhatsApp o correo, venta de materiales y cobros de graduación." },
  { objetivo: "g-finanzas_g", menu: true, titulo: "Finanzas", texto: "Alertas financieras, gastos, deudas y caja, ingresos extra y los reportes en PDF para compartir." },
  { objetivo: "g-contab_g", menu: true, titulo: "Contabilidad", texto: "Estados financieros, libro diario y mayor, cierre de mes y catálogo de cuentas." },
  { objetivo: "g-sistema_g", menu: true, titulo: "Configuración", texto: "Datos de la institución, sucursales y accesos, y en Sistema los respaldos de la información." },
  { objetivo: "sucursal", titulo: "Sucursal", texto: "Elija aquí la sucursal con la que trabaja. Todas las pantallas muestran solo los datos de esa sucursal." },
  { objetivo: "refrescar", titulo: "Actualizar datos", texto: "Si alguien más hizo cambios, toque aquí para ver la información más reciente." },
  { objetivo: "asistente", titulo: "Asistente financiero", texto: "Pregúntele en palabras sencillas por sus números: cobros, gastos, utilidad o qué grupos conviene unir." },
  { objetivo: "ayuda", titulo: "¿Necesita repasar?", texto: "Con este botón vuelve a ver el recorrido cuando quiera. ¡Listo, a trabajar!" },
];

export const PASOS_DOCENTE = [
  { titulo: "¡Bienvenido al portal docente!", texto: "Le mostramos en un minuto dónde está cada cosa. Puede saltar el recorrido cuando quiera y repetirlo con el botón ? de arriba." },
  { objetivo: "n-inicio", menu: true, titulo: "Inicio", texto: "Su resumen: grupos, alumnos y lo que tiene pendiente." },
  { objetivo: "n-grupos", menu: true, titulo: "Mis grupos", texto: "Sus grupos con la lista de alumnos y los datos de contacto de los padres." },
  { objetivo: "n-asistencia", menu: true, titulo: "Libreta de asistencia", texto: "Pase lista cada clase: presente, ausente o tarde." },
  { objetivo: "n-parte", menu: true, titulo: "Parte mensual", texto: "El resumen de asistencia del mes de cada grupo, listo para descargar en Excel." },
  { objetivo: "n-bitacora", menu: true, titulo: "Bitácora", texto: "Anote lo que trabajó en cada clase." },
  { objetivo: "n-reflections", menu: true, titulo: "Reflections", texto: "Comparta sus reflexiones sobre las clases con coordinación." },
  { objetivo: "n-reporte", menu: true, titulo: "Check list de la clase", texto: "Revise y envíe el check list de cada clase." },
  { objetivo: "n-solicitudes", menu: true, titulo: "Solicitudes", texto: "Pida permisos, materiales u otras cosas a administración y vea si se aprobaron." },
  { objetivo: "ayuda", titulo: "¿Necesita repasar?", texto: "Con este botón vuelve a ver el recorrido cuando quiera. ¡Buenas clases!" },
];

const mesActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const claveLocal = (uid, rol) => `seeds_recorrido_${uid}_${rol}`;

// Decide qué mostrar al entrar y guarda lo que el usuario ya vio.
// Devuelve { modo, novedades, abrir, cerrar }.
// modo: null | "recorrido" | "repaso" (invitación mensual) | "novedades"
export function useRecorrido(session, rol) {
  const uid = session?.user?.id;
  const [modo, setModo] = useState(null);
  const [novedades, setNovedades] = useState([]);
  const estadoRef = useRef(null);
  const sesionRef = useRef(session); sesionRef.current = session;

  useEffect(() => {
    if (!uid) return;
    let local = null;
    try { local = JSON.parse(localStorage.getItem(claveLocal(uid, rol))); } catch (e) { local = null; }
    const remoto = sesionRef.current?.user?.user_metadata?.recorrido?.[rol] || null;
    const est = remoto || local || {};
    estadoRef.current = est;
    const nuevas = NOVEDADES.filter((n) => (n.rol === rol || n.rol === "todos") && !(est.novedades || []).includes(n.id));
    setNovedades(nuevas);
    const t = setTimeout(() => {
      if (!est.visto) setModo("recorrido");
      else if (nuevas.length) setModo("novedades");
      else if (est.mes !== mesActual()) setModo("repaso");
    }, 600); // deja que la pantalla termine de cargar
    return () => clearTimeout(t);
  }, [uid, rol]);

  const guardar = useCallback(async () => {
    if (!uid) return;
    const est = {
      visto: true, mes: mesActual(),
      novedades: NOVEDADES.filter((n) => n.rol === rol || n.rol === "todos").map((n) => n.id),
    };
    estadoRef.current = est;
    setNovedades([]);
    try { localStorage.setItem(claveLocal(uid, rol), JSON.stringify(est)); } catch (e) {}
    try {
      const { data } = await supabase.auth.getUser();
      const previo = data?.user?.user_metadata?.recorrido || {};
      await supabase.auth.updateUser({ data: { recorrido: { ...previo, [rol]: est } } });
    } catch (e) { /* queda guardado en el navegador */ }
  }, [uid, rol]);

  const abrir = useCallback(() => setModo("recorrido"), []);
  const cerrar = useCallback(() => { setModo(null); guardar(); }, [guardar]);
  return { modo, novedades, abrir, cerrar };
}

// Botón "?" de la barra superior para repetir el recorrido
export function BotonAyuda({ onClick }) {
  return (
    <button data-tour="ayuda" onClick={onClick} title="Ver el recorrido guiado" aria-label="Ver el recorrido guiado"
      style={{ background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.85)", borderRadius: 999, cursor: "pointer", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#EA580C", fontFamily: "inherit", flexShrink: 0 }}>?</button>
  );
}

const capa = { position: "fixed", inset: 0, zIndex: 1000 };
const tarjeta = { ...vidrio, background: "rgba(255,255,255,.94)", borderRadius: 22, padding: 20, width: "min(340px, calc(100vw - 32px))", boxSizing: "border-box", fontFamily: "inherit", color: "#1E293B" };

// Lo que se muestra encima de la app según el modo
export function Recorrido({ estado, pasos, abrirMenu, irA }) {
  const { modo, novedades, abrir, cerrar } = estado;
  if (modo === "recorrido") return <Pasos pasos={pasos} abrirMenu={abrirMenu} onCerrar={cerrar} />;
  if (modo === "repaso") return (
    <Centro>
      <div style={{ fontSize: 28, marginBottom: 6 }}>🧭</div>
      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Repaso del mes</div>
      <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, marginBottom: 16 }}>¿Quiere dar un recorrido rápido por el sistema para recordar dónde está cada cosa?</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button onClick={cerrar} style={btnO}>Ahora no</button>
        <button onClick={abrir} style={btn()}>Ver recorrido</button>
      </div>
    </Centro>
  );
  if (modo === "novedades") return (
    <Centro>
      <div style={{ fontSize: 28, marginBottom: 6 }}>✨</div>
      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 12 }}>Novedades en Seeds</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "50vh", overflowY: "auto", marginBottom: 16 }}>
        {novedades.map((n) => (
          <div key={n.id} style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 14, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{n.titulo}</div>
              {n.ir && irA && <button onClick={() => { cerrar(); irA(n.ir); }} style={{ ...btnO, padding: "4px 10px", fontSize: 12, color: "#EA580C", borderColor: "#FED7AA" }}>Ver</button>}
            </div>
            <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.45, marginTop: 4 }}>{n.texto}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button onClick={abrir} style={btnO}>Ver recorrido</button>
        <button onClick={cerrar} style={btn()}>Entendido</button>
      </div>
    </Centro>
  );
  return null;
}

function Centro({ children }) {
  return (
    <div style={{ ...capa, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} role="dialog" aria-modal="true">
      <div style={tarjeta}>{children}</div>
    </div>
  );
}

function Pasos({ pasos, abrirMenu, onCerrar }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const paso = pasos[i];
  const celular = vp.w <= 768;

  // Ubicar el elemento a resaltar (y abrir el menú en celular si hace falta)
  useLayoutEffect(() => {
    let vivo = true;
    if (abrirMenu) abrirMenu(!!(paso.menu && celular));
    const medir = () => {
      if (!vivo) return;
      const el = paso.objetivo && document.querySelector(`[data-tour="${paso.objetivo}"]`);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: "nearest" });
      const r = el.getBoundingClientRect();
      setRect(r.width > 0 && r.left >= -5 && r.left < window.innerWidth ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
    };
    medir();
    const t = setTimeout(medir, 320); // espera la animación del menú
    return () => { vivo = false; clearTimeout(t); };
  }, [i, paso, celular, abrirMenu]);

  useEffect(() => {
    const r = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    const tecla = (e) => { if (e.key === "Escape") terminar(); if (e.key === "ArrowRight") sig(); if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); };
    window.addEventListener("resize", r); window.addEventListener("keydown", tecla);
    return () => { window.removeEventListener("resize", r); window.removeEventListener("keydown", tecla); };
  });

  const terminar = () => { if (abrirMenu) abrirMenu(false); onCerrar(); };
  const sig = () => (i < pasos.length - 1 ? setI(i + 1) : terminar());

  // Posición de la tarjeta: a la derecha del elemento, si no cabe abajo o arriba
  const W = Math.min(340, vp.w - 32), M = 16, pad = 6;
  let pos = null;
  if (rect) {
    if (rect.x + rect.w + pad + 12 + W <= vp.w - M) pos = { left: rect.x + rect.w + pad + 12, top: Math.min(Math.max(M, rect.y - 10), vp.h - 260) };
    else {
      const left = Math.min(Math.max(M, rect.x + rect.w / 2 - W / 2), vp.w - W - M);
      pos = rect.y + rect.h + 240 < vp.h ? { left, top: rect.y + rect.h + pad + 12 } : { left, bottom: vp.h - rect.y + pad + 12 };
    }
  }

  return (
    <div style={capa} role="dialog" aria-modal="true" aria-label={paso.titulo}>
      {rect
        ? <div style={{ position: "fixed", left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2, borderRadius: 14, boxShadow: "0 0 0 9999px rgba(15,23,42,.55)", border: "2px solid #F97316", transition: "all .25s ease", pointerEvents: "none" }} />
        : <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)" }} />}
      <div style={{ position: "fixed", inset: 0 }} onClick={(e) => e.stopPropagation()} />
      <div style={{ ...tarjeta, position: "fixed", ...(pos || { left: "50%", top: "50%", transform: "translate(-50%,-50%)" }), transition: "top .25s ease, left .25s ease" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#EA580C", marginBottom: 4 }}>Paso {i + 1} de {pasos.length}</div>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{paso.titulo}</div>
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, marginBottom: 14 }}>{paso.texto}</div>
        <div style={{ height: 4, background: "#F1F5F9", borderRadius: 999, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ width: `${((i + 1) / pasos.length) * 100}%`, height: "100%", background: "#F97316", transition: "width .25s" }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {i < pasos.length - 1 && <button onClick={terminar} style={{ background: "none", border: "none", color: "#64748B", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Saltar</button>}
          <div style={{ flex: 1 }} />
          {i > 0 && <button onClick={() => setI(i - 1)} style={{ ...btnO, padding: "7px 14px" }}>Anterior</button>}
          <button onClick={sig} style={{ ...btn(), padding: "8px 16px" }}>{i < pasos.length - 1 ? "Siguiente" : "Terminar"}</button>
        </div>
      </div>
    </div>
  );
}
