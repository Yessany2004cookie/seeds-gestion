// ════════════════════════════════════════════════════════════
//  ESTILO DEL SISTEMA (vidrio tipo iOS: transparencias y degradados; botones
//  sobrios). Todas las pantallas usan estos mismos estilos.
// ════════════════════════════════════════════════════════════
export const NARANJA = "#F97316";

// Superficie de vidrio esmerilado
export const vidrio = {
  background: "rgba(255,255,255,.58)",
  backdropFilter: "blur(22px) saturate(180%)",
  WebkitBackdropFilter: "blur(22px) saturate(180%)",
  border: "1px solid rgba(255,255,255,.75)",
  boxShadow: "0 10px 30px rgba(30,41,59,.08), inset 0 1px 0 rgba(255,255,255,.9)",
};

export const card = { ...vidrio, borderRadius: 22, padding: 20, marginBottom: 16 };

export const input = {
  width: "100%", padding: "10px 14px", border: "1px solid rgba(255,255,255,.85)", borderRadius: 14,
  fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  background: "rgba(255,255,255,.7)", boxShadow: "inset 0 1px 3px rgba(15,23,42,.06)",
};

// Aclara un color #rrggbb (para el brillo de arriba de la burbuja)
const aclarar = (c, p = 0.28) => {
  const m = /^#([0-9a-f]{6})$/i.exec(String(c)); if (!m) return c;
  const n = parseInt(m[1], 16); const ch = (s) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * p);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// Botón principal: píldora con un degradado suave y sombra de su color
export const btn = (c = NARANJA) => ({
  padding: "10px 20px", background: `linear-gradient(180deg, ${aclarar(c, 0.12)} 0%, ${c} 100%)`, color: "#fff",
  border: "none", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 600,
  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
  boxShadow: `0 4px 12px ${/^#[0-9a-f]{6}$/i.test(c) ? c + "40" : "rgba(249,115,22,.25)"}`,
});

// Botón secundario: blanco translúcido con borde fino
export const btnO = {
  padding: "9px 16px", background: "rgba(255,255,255,.78)", color: "#475569",
  border: "1px solid rgba(15,23,42,.10)", borderRadius: 999, cursor: "pointer", fontSize: 13,
  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5,
  boxShadow: "0 1px 3px rgba(15,23,42,.06)",
};

export const label = { fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5, display: "block" };
export const badge = (c) => ({ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: c + "1F", color: c, border: `1px solid ${c}33`, whiteSpace: "nowrap" });
