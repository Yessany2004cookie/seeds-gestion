// ════════════════════════════════════════════════════════════
//  ESTILO DEL SISTEMA (ejecutivo): superficies blancas sólidas, bordes finos,
//  esquinas poco redondeadas y la paleta de la escuela (azul marino y naranja)
//  en tonos sobrios. Todas las pantallas usan estos mismos estilos.
// ════════════════════════════════════════════════════════════
export const AZUL = "#1B2A4A";      // azul marino de la marca (el mismo de las facturas)
export const NARANJA = "#D9641E";   // naranja de la marca, un poco más sobrio
export const BORDE = "#DCE1E8";
export const TEXTO = "#1F2937";
export const SUAVE = "#5B6576";

// Los colores vivos que usan las pantallas se cambian por su versión sobria,
// para que botones, etiquetas e iconos se vean de la misma familia.
const SOBRIOS = {
  "#2563EB": "#2B4C7E", "#3B82F6": "#2B4C7E", "#1D4ED8": "#233F6A", "#0891B2": "#2D6A7F", "#0EA5E9": "#2D6A7F",
  "#059669": "#2F6B4F", "#10B981": "#2F6B4F", "#16A34A": "#2F6B4F", "#15803D": "#2A5E45", "#166534": "#24533D",
  "#DC2626": "#A33A3A", "#EF4444": "#A33A3A", "#B91C1C": "#8E3131",
  "#7C3AED": "#4E4A7E", "#8B5CF6": "#4E4A7E", "#6D28D9": "#45416F", "#A855F7": "#4E4A7E",
  "#F97316": NARANJA, "#EA580C": "#C2571A", "#FB923C": NARANJA,
  "#D97706": "#A8701E", "#F59E0B": "#A8701E", "#B45309": "#8F5E1A",
  "#1E293B": AZUL, "#0F172A": AZUL, "#000000": AZUL,
};
export const tono = (c) => (typeof c === "string" && SOBRIOS[c.toUpperCase()]) || c;

// Superficie sólida (antes era vidrio; se deja el nombre para no romper nada)
export const vidrio = {
  background: "#FFFFFF",
  border: `1px solid ${BORDE}`,
  boxShadow: "0 1px 2px rgba(16,24,40,.05)",
};

export const card = { ...vidrio, borderRadius: 6, padding: 20, marginBottom: 16 };

export const input = {
  width: "100%", padding: "9px 12px", border: `1px solid #CDD3DC`, borderRadius: 4,
  fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  background: "#FFFFFF", color: TEXTO,
};

// Botón principal: color sólido, esquinas casi rectas
export const btn = (c = NARANJA) => {
  const t = tono(c);
  return {
    padding: "9px 18px", background: t, color: "#fff",
    border: `1px solid ${t}`, borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 600,
    fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: .2,
    boxShadow: "0 1px 2px rgba(16,24,40,.08)",
  };
};

// Botón secundario: blanco con borde fino
export const btnO = {
  padding: "8px 14px", background: "#FFFFFF", color: "#344054",
  border: "1px solid #CDD3DC", borderRadius: 4, cursor: "pointer", fontSize: 13,
  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5,
  boxShadow: "0 1px 2px rgba(16,24,40,.05)",
};

export const label = { fontSize: 12, fontWeight: 600, color: "#3F4A5A", marginBottom: 5, display: "block", letterSpacing: .2 };
export const badge = (c) => { const t = tono(c); return { padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 600, background: t + "14", color: t, border: `1px solid ${t}40`, whiteSpace: "nowrap" }; };
