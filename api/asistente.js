// Asistente financiero con Claude (función de Vercel).
// La clave de Anthropic vive solo aquí, en la variable de entorno
// ANTHROPIC_API_KEY de Vercel; nunca llega al navegador.
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../src/supabaseClient.js";

export const config = { maxDuration: 60 };

const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_MENSAJES = 16;
const MAX_CARACTERES = 4000;

const INSTRUCCIONES = `Eres el asistente financiero de Seeds English School, una escuela de inglés en Jesús de Otoro, Intibucá, Honduras. Ayudas a la administración a entender sus números y a tomar decisiones. La moneda es el lempira (L).

Cómo trabajar:
- Básate solo en los DATOS que recibes. Si falta información para responder bien, dilo y sugiere qué registrar en el sistema.
- Cuando calcules, muestra la operación en una línea (por ejemplo: 7,500 ÷ 700 = 10.7 → 11 alumnos). Los alumnos siempre se redondean hacia arriba.
- Para preguntas de "cuántos alumnos necesito", usa el bloque punto_de_equilibrio de los datos; ya está calculado con las fórmulas del sistema.
- Criterios contables del sistema: los ingresos cuentan en el mes al que se asignó el pago; los gastos en el mes al que se restan; de materiales y graduación solo se resta lo que cuestan (editorial, certificados); utilidad neta = ingresos − costo de ventas − gastos de operación (planilla, renta, otros).
- Responde en español sencillo y directo, pensando en la dueña de una escuela pequeña, no en un economista. Sé breve (unas 250 palabras) salvo que te pidan detalle. Usa viñetas cuando ayuden.
- Cuando la pregunta lo amerite, termina con 1 a 3 recomendaciones concretas y realistas para una escuela de este tamaño.
- Los datos no incluyen nombres de alumnos ni de padres; no los inventes.
- En temas de impuestos o legales, da orientación general y sugiere confirmar con un contador.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  // Solo usuarios con sesión iniciada en el sistema
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Inicia sesión para usar el asistente." });
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth?.user) return res.status(401).json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "El asistente aún no está configurado: falta la variable ANTHROPIC_API_KEY en Vercel." });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const mensajes = (Array.isArray(body.mensajes) ? body.mensajes : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MENSAJES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CARACTERES) }));
  while (mensajes.length && mensajes[0].role !== "user") mensajes.shift();
  if (!mensajes.length || mensajes[mensajes.length - 1].role !== "user") {
    return res.status(400).json({ error: "Escribe una pregunta." });
  }
  const datos = JSON.stringify(body.datos || {});
  if (datos.length > 80000) return res.status(400).json({ error: "Demasiados datos para analizar." });

  const client = new Anthropic();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  try {
    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: INSTRUCCIONES },
        { type: "text", text: `DATOS DEL SISTEMA (JSON, cifras en lempiras):\n${datos}`, cache_control: { type: "ephemeral" } },
      ],
      messages: mensajes,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(event.delta.text);
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      res.write("\n\nNo puedo ayudar con esa pregunta. Intenta preguntarlo de otra forma.");
    } else if (final.stop_reason === "max_tokens") {
      res.write("\n\n…(la respuesta quedó incompleta; pide que continúe)");
    }
    res.end();
  } catch (error) {
    let mensaje = "No se pudo obtener respuesta del asistente. Intenta de nuevo.";
    if (error instanceof Anthropic.AuthenticationError) mensaje = "La clave ANTHROPIC_API_KEY configurada en Vercel no es válida.";
    else if (error instanceof Anthropic.RateLimitError) mensaje = "El asistente está recibiendo muchas preguntas. Espera un momento y vuelve a intentar.";
    else if (error instanceof Anthropic.BadRequestError) mensaje = `El asistente rechazó la solicitud: ${error.message}`;
    else if (error instanceof Anthropic.APIError) mensaje = `Error del servicio de IA (${error.status}). Intenta de nuevo en un momento.`;
    if (!res.headersSent) return res.status(500).json({ error: mensaje });
    res.write(`\n\n⚠ ${mensaje}`);
    res.end();
  }
}
