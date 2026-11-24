// ── RESPALDOS AUTOMÁTICOS ──
// La base de datos se copia sola todos los días a las 2:00 AM (hora de
// Honduras) dentro de Supabase (ver supabase/respaldos_automaticos.sql).
// Aquí administración ve cuándo fue la última copia, puede bajar cualquiera
// en el mismo formato que "Descargar respaldo" y hacer una copia en el momento.
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { btn, btnO } from "./estilo";

const fechaHN = (iso) => new Date(iso).toLocaleString("es-HN", {
  timeZone: "America/Tegucigalpa", weekday: "long", day: "numeric", month: "long",
  year: "numeric", hour: "numeric", minute: "2-digit",
});

const haceCuanto = (iso) => {
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 1) return "hace unos minutos";
  if (h < 24) return `hace ${Math.floor(h)} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
};

export function RespaldosAutomaticos({ showToast }) {
  const [copias, setCopias] = useState(null); // null = cargando
  const [falta, setFalta] = useState(false);  // la función aún no está instalada
  const [ocupado, setOcupado] = useState(false);
  const [verTodas, setVerTodas] = useState(false);

  const cargar = async () => {
    const { data, error } = await supabase.rpc("respaldos_lista");
    if (error) { setFalta(true); setCopias([]); return; }
    setFalta(false); setCopias(data || []);
  };
  useEffect(() => { cargar(); }, []);

  const descargar = async (c) => {
    setOcupado(true);
    const { data, error } = await supabase.rpc("respaldo_descargar", { p_id: c.id });
    setOcupado(false);
    if (error || !data) { showToast("No se pudo descargar la copia", "error"); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const dia = new Date(c.creado).toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" });
    a.download = `seeds_respaldo_${dia}_${c.tipo}.json`;
    a.href = URL.createObjectURL(blob); a.click();
    showToast("✓ Copia descargada");
  };

  const copiarAhora = async () => {
    setOcupado(true);
    const { error } = await supabase.rpc("respaldo_hacer_ahora");
    setOcupado(false);
    if (error) { showToast("No se pudo hacer la copia: " + error.message, "error"); return; }
    showToast("✓ Copia hecha");
    cargar();
  };

  if (copias === null) return <p style={{ fontSize: 12, color: "#64748B", marginTop: 14 }}>Revisando copias automáticas…</p>;

  if (falta) return (
    <div style={{ background: "#F1F5F9", borderRadius: 8, padding: 12, fontSize: 12, color: "#475569", marginTop: 14 }}>
      🕑 <strong>Copias automáticas:</strong> todavía no están activadas en la base de datos.
    </div>
  );

  const ultimaAuto = copias.find((c) => c.tipo === "automatico");
  const ultima = copias[0];
  const atrasada = !ultimaAuto || Date.now() - new Date(ultimaAuto.creado).getTime() > 36 * 36e5;
  const lista = verTodas ? copias : copias.slice(0, 5);

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ background: atrasada ? "#FEF3C7" : "#ECFDF5", borderRadius: 8, padding: 12, fontSize: 13, color: atrasada ? "#92400E" : "#065F46" }}>
        {ultimaAuto
          ? <>✅ <strong>Último respaldo automático:</strong> {fechaHN(ultimaAuto.creado)} ({haceCuanto(ultimaAuto.creado)}).</>
          : <>🕑 <strong>Aún no hay respaldo automático.</strong> El primero se hace esta noche a las 2:00 AM.</>}
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
          La base de datos se copia sola todos los días a las 2:00 AM. Se guardan los últimos 30 días y una copia de cada mes durante un año.
          {atrasada && ultimaAuto && " ⚠️ La última copia tiene más de un día: revise que el proyecto de Supabase no esté pausado."}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <button onClick={copiarAhora} disabled={ocupado} style={btnO}>💾 Hacer una copia ahora</button>
      </div>

      {ultima && (
        <div style={{ marginTop: 12, fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>Copias guardadas ({copias.length})</div>
          {lista.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid #E2E8F0", flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 200px", color: "#334155" }}>
                {fechaHN(c.creado)} · {c.tipo === "manual" ? "hecha a mano" : "automática"} · {c.filas} registros · {c.tamano_kb} KB
              </span>
              <button onClick={() => descargar(c)} disabled={ocupado} style={{ ...btn("#2563EB"), padding: "4px 10px", fontSize: 12 }}>Descargar</button>
            </div>
          ))}
          {copias.length > 5 && (
            <button onClick={() => setVerTodas(!verTodas)} style={{ background: "none", border: "none", color: "#2563EB", cursor: "pointer", fontSize: 12, padding: "6px 0" }}>
              {verTodas ? "Ver menos" : `Ver las ${copias.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
