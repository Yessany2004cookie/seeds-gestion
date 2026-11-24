// ── MÓDULOS DEL SISTEMA ──
// Administración puede activar o desactivar partes del sistema desde
// Configuración → Sistema y respaldos. Un módulo apagado desaparece del menú,
// del recorrido guiado, de las novedades y de las alertas. NO se borra ningún
// dato: al volver a encenderlo, todo está como estaba.
// Se guarda en la tabla modulos_sistema (una sola fila, columna "apagados").
// Si la tabla aún no existe, todo queda encendido como siempre.
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { card } from "./estilo";
import { cambiarModulosConClave, ConfirmarConClave } from "./marca";

// padre: si el módulo padre está apagado, este también queda apagado.
export const MODULOS = [
  { id: "docentes", titulo: "Portal de docentes y Gestión curricular", texto: "Los maestros entran a su portal y administración revisa su trabajo en Gestión curricular. Si se apaga, los maestros no pueden entrar." },
  { id: "asistencia", padre: "docentes", titulo: "Asistencia y parte mensual", texto: "Libreta de asistencia, parte mensual en Excel y el aviso de alumnos que dejaron de venir." },
  { id: "bitacoras", padre: "docentes", titulo: "Bitácoras", texto: "Lo que cada maestro trabajó en clase." },
  { id: "reflections", padre: "docentes", titulo: "Reflections y check list de clase", texto: "Reflexiones de los maestros y el check list de cada clase." },
  { id: "solicitudes", padre: "docentes", titulo: "Solicitudes de docentes", texto: "Permisos, materiales u otros pedidos de los maestros." },
  { id: "recordatorios", titulo: "Recordatorios", texto: "Avisos de cobro a padres por WhatsApp o correo." },
  { id: "materiales", titulo: "Materiales", texto: "Venta de libros y materiales a los alumnos." },
  { id: "graduacion", titulo: "Graduación", texto: "Cobros y gastos de graduación." },
  { id: "ingresos", titulo: "Ingresos extra", texto: "Ingresos que no son mensualidades (cursos, donaciones, alquileres…)." },
  { id: "alertas", titulo: "Alertas financieras", texto: "Avisos automáticos de cobros atrasados y gastos fuera de lo normal." },
  { id: "contabilidad", titulo: "Contabilidad", texto: "Estado de resultados, balance general, flujo de efectivo, libros, cierre de mes y catálogo de cuentas." },
  { id: "contador", titulo: "Contador de tiempo de trabajo", texto: "Mide el tiempo de trabajo real de cada administrador (se ve en Reportes)." },
  { id: "asistente", titulo: "Asistente con IA", texto: "El botón para preguntar por los números en palabras sencillas." },
];

// Estado compartido por toda la app (administración y portal docente)
let apagados = [];
let cargado = false;
let cargando = null;
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f(apagados));

const cargar = () => {
  if (cargando) return cargando;
  cargando = (async () => {
    const { data, error } = await supabase.from("modulos_sistema").select("apagados").eq("id", 1).maybeSingle();
    apagados = !error && Array.isArray(data?.apagados) ? data.apagados : [];
    cargado = true;
    cargando = null;
    avisar();
  })();
  return cargando;
};

const estaActivo = (lista, id) => {
  if (!id) return true;
  if (lista.includes(id)) return false;
  const m = MODULOS.find((x) => x.id === id);
  return m?.padre ? estaActivo(lista, m.padre) : true;
};

// Devuelve { listo, activo(id), apagados, recargar }
export function useModulos(session) {
  const [lista, setLista] = useState(apagados);
  const [listo, setListo] = useState(cargado);
  useEffect(() => {
    const f = (l) => { setLista(l); setListo(true); };
    oyentes.add(f);
    if (session && !cargado) cargar();
    return () => oyentes.delete(f);
  }, [session]);
  return { listo, apagados: lista, activo: (id) => estaActivo(lista, id), recargar: cargar };
}

// Panel con un interruptor por módulo (en Sistema y respaldos)
export function ModulosPanel({ showToast }) {
  const { listo, apagados: lista, activo } = useModulos(true);
  const [guardando, setGuardando] = useState(null);
  const [apagar, setApagar] = useState(null);
  // Encender no pide clave. Apagar pide la clave de seguridad (lo revisa la base de datos).
  const guardar = async (id, clave) => {
    const nueva = lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];
    setGuardando(id);
    const motivo = await cambiarModulosConClave(nueva, clave);
    setGuardando(null);
    if (motivo) return motivo;
    apagados = nueva; avisar();
    const m = MODULOS.find((x) => x.id === id);
    showToast(nueva.includes(id) ? `${m.titulo}: desactivado` : `${m.titulo}: activado`);
    return null;
  };
  const cambiar = async (id) => {
    if (!lista.includes(id)) { setApagar(MODULOS.find((x) => x.id === id)); return; }
    const motivo = await guardar(id, null);
    if (motivo) showToast(motivo, "error");
  };
  return (
    <div style={card}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: "0 0 6px" }}>🧩 Módulos del sistema</h3>
      <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px" }}>Encienda solo lo que esta institución usa. Al apagar un módulo desaparece del menú, del recorrido guiado y de las alertas. <strong>No se borra ningún dato</strong>: si lo vuelve a encender, todo está como estaba.</p>
      {!listo ? <div style={{ fontSize: 13, color: "#94A3B8" }}>Cargando…</div> : MODULOS.map((m) => {
        const propio = !lista.includes(m.id);
        const padreApagado = m.padre && !activo(m.padre);
        const on = propio && !padreApagado;
        return (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", paddingLeft: m.padre ? 22 : 0, borderTop: "1px solid #F1F5F9", opacity: padreApagado ? 0.5 : 1 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{m.titulo}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{padreApagado ? "Se apagó junto con el Portal de docentes." : m.texto}</div>
            </div>
            <button role="switch" aria-checked={on} aria-label={m.titulo} disabled={!!guardando || padreApagado} onClick={() => cambiar(m.id)}
              style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 13, border: "none", padding: 3, cursor: guardando || padreApagado ? "default" : "pointer", background: on ? "#059669" : "#CBD5E1", transition: "background .2s", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", display: "block" }} />
            </button>
          </div>
        );
      })}
      {apagar && <ConfirmarConClave titulo={`Apagar «${apagar.titulo}»`} que="apagar un módulo"
        consecuencia={<>El módulo <strong>{apagar.titulo}</strong> desaparecerá del menú, del recorrido y de las alertas para todos{apagar.id === "docentes" ? ", y los maestros no podrán entrar a su portal" : ""}. <strong>No se borra ningún dato</strong>: si lo vuelve a encender, todo está como estaba.</>}
        textoBoton="Apagar módulo" accion={(c) => guardar(apagar.id, c)} onCerrar={() => setApagar(null)} />}
      <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 8 }}>🔒 Para apagar un módulo se pide la clave de seguridad. Siempre encendidos: Inicio, Secciones, Maestros, Matrícula, Facturas y pagos, Historial, Gastos y caja, Reportes y Configuración.</div>
    </div>
  );
}
