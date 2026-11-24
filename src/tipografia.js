// ════════════════════════════════════════════════════════════
//  TIPOGRAFÍA DEL SISTEMA
//  Pantallas: Manrope (títulos y tarjetas) e Inter (texto, botones, tablas).
//  Reportes y resúmenes financieros: IBM Plex Sans (títulos, descripciones y
//  cuentas) e IBM Plex Mono (cifras, porcentajes, códigos y saldos).
// ════════════════════════════════════════════════════════════
export const FUENTES_URL = "https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap";

// Para los documentos que se abren en otra ventana (imprimir / guardar PDF)
export const LINK_FUENTES = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${FUENTES_URL}" rel="stylesheet">`;

export const INFORME = "'IBM Plex Sans',Arial,sans-serif";
export const CIFRAS = "'IBM Plex Mono',Consolas,'Courier New',monospace";

// Cifras de los documentos impresos: todas las clases de números usan Plex Mono
export const CSS_CIFRAS = `.r,.num,.pct,.monto,.der,.cifra,.kv{font-family:${CIFRAS};font-variant-numeric:tabular-nums}`;

// El PDF se dibuja con las letras que el navegador ya tiene cargadas: antes de
// armarlo nos aseguramos de que IBM Plex esté descargada (así queda incrustada).
export async function cargarFuentesInforme() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.race([
      Promise.all([
        "400 12px 'IBM Plex Sans'", "600 12px 'IBM Plex Sans'", "700 12px 'IBM Plex Sans'",
        "400 12px 'IBM Plex Mono'", "600 12px 'IBM Plex Mono'", "700 12px 'IBM Plex Mono'",
      ].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
    await document.fonts.ready;
  } catch (e) { /* si no carga, se usa Arial */ }
}

// Excel: el texto en IBM Plex Sans y los números en IBM Plex Mono.
// Si la computadora no tiene esas letras instaladas, Excel usa una parecida.
export const EXCEL_TEXTO = "IBM Plex Sans";
export const EXCEL_CIFRAS = "IBM Plex Mono";
const esNumero = (c) => c && typeof c === "object" && (c.type === Number || typeof c.value === "number");
const filas = (data) => (data || []).map((fila) => Array.isArray(fila) ? fila.map((c) => esNumero(c) && !c.fontFamily ? { ...c, fontFamily: EXCEL_CIFRAS } : c) : fila);
export function fuentesExcel(libro) {
  if (!Array.isArray(libro)) return libro;
  // Varias hojas: [{ data, sheet, ... }]; una hoja: [[celda, celda], ...]
  if (libro.length && libro[0] && !Array.isArray(libro[0]) && "data" in libro[0]) return libro.map((h) => ({ ...h, data: filas(h.data) }));
  return filas(libro);
}
