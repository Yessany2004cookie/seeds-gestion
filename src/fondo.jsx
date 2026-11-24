// ════════════════════════════════════════════════════════════
//  SELECTOR DE FONDO: cada persona escoge cómo ver el sistema
//  (claro, oscuro, naranja suave o con Pulpi). Se recuerda en este equipo.
//  Solo cambia la apariencia; no toca datos.
// ════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from "react";
import { Palette, Check } from "lucide-react";

export const FONDOS = [
  { id: "claro", nombre: "Claro", muestra: "#F3F4F7" },
  { id: "oscuro", nombre: "Oscuro", muestra: "#0F1726" },
  { id: "naranja", nombre: "Naranja suave", muestra: "#F8E9DC" },
  { id: "pulpo", nombre: "Pulpi y burbujas", muestra: "linear-gradient(135deg,#FFD6B0,#E9D5FF 55%,#BAE6FD)" },
];
const CLAVE = "seeds_fondo";

export const leerFondo = () => {
  try { const v = localStorage.getItem(CLAVE); if (FONDOS.some((f) => f.id === v)) return v; } catch (e) {}
  return "claro";
};
export const aplicarFondo = (id) => { document.documentElement.dataset.fondo = id; };

// Mientras se arma un PDF (html2pdf pinta una copia dentro de esta misma
// página), se usa el fondo claro para que los PDF salgan siempre en blanco.
if (typeof window !== "undefined" && typeof MutationObserver !== "undefined") {
  const vigilar = () => new MutationObserver(() => {
    const armando = !!document.querySelector(".html2pdf__overlay, .html2pdf__container");
    const html = document.documentElement;
    if (armando && html.dataset.fondo !== "claro") { html.dataset.fondoGuardado = html.dataset.fondo || "claro"; html.dataset.fondo = "claro"; }
    else if (!armando && html.dataset.fondoGuardado) { html.dataset.fondo = html.dataset.fondoGuardado; delete html.dataset.fondoGuardado; }
  }).observe(document.body, { childList: true });
  if (document.body) vigilar(); else window.addEventListener("DOMContentLoaded", vigilar);
}

export function SelectorFondo() {
  const [fondo, setFondo] = useState(leerFondo);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  useEffect(() => { aplicarFondo(fondo); try { localStorage.setItem(CLAVE, fondo); } catch (e) {} }, [fondo]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);
  return (
    <div ref={caja} style={{ position: "relative", flexShrink: 0 }}>
      <button className="boton-fondo" onClick={() => setAbierto((a) => !a)} title="Cambiar fondo" aria-label="Cambiar fondo"
        style={{ background: "#fff", border: "1px solid #CDD3DC", borderRadius: 4, cursor: "pointer", padding: "5px 8px", display: "flex", alignItems: "center" }}>
        <Palette size={14} color="#5B6576" />
      </button>
      {abierto && (
        <div className="menu-fondo" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 200, width: 210, background: "#fff", border: "1px solid #DCE1E8", borderRadius: 6, boxShadow: "0 12px 30px rgba(16,24,40,.18)", padding: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .6, textTransform: "uppercase", color: "#5B6576", padding: "6px 8px 8px" }}>Fondo</div>
          {FONDOS.map((f) => (
            <button key={f.id} onClick={() => { setFondo(f.id); setAbierto(false); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px", border: "none", borderRadius: 4, cursor: "pointer", background: fondo === f.id ? "#F3F4F7" : "transparent", fontFamily: "inherit", fontSize: 13, color: "#1F2937", textAlign: "left" }}>
              <span style={{ width: 22, height: 22, borderRadius: 4, background: f.muestra, border: "1px solid rgba(16,24,40,.15)", flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{f.nombre}</span>
              {fondo === f.id && <Check size={15} color="#D9641E" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
