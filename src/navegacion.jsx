// ════════════════════════════════════════════════════════════
//  TARJETAS DE NAVEGACIÓN
//  Al tocar una categoría del menú (Escuela y alumnado, Cobros, Finanzas…)
//  se abre una página con una tarjeta por cada módulo de esa categoría y una
//  explicación corta de lo que se hace adentro. Mismo estilo Soft UI de Inicio.
//  Respeta módulos apagados y pestañas ocultas o renombradas: recibe el
//  grupo ya filtrado desde App.jsx.
// ════════════════════════════════════════════════════════════
import "./inicioSoft.css";
import "./navegacion.css";

// Qué se hace dentro de cada módulo (por id de pestaña)
export const DESCRIPCIONES = {
  secciones: "Arme los grupos de clase: programa, nivel, horario, maestro a cargo y mensualidad de cada sección.",
  maestros: "Datos de cada maestro, su salario mensual y las secciones que tiene asignadas.",
  alumnos: "Matricule alumnos nuevos, cámbielos de sección, registre a sus padres y vea quién está activo o de baja.",
  docentes: "Revise lo que envían los docentes: solicitudes, asistencia y parte mensual, reflections, check list de clase y bitácoras.",
  marketing: "Relación con las familias: encuesta a los alumnos dados de baja y encuestas de satisfacción a toda la escuela, por WhatsApp.",
  facturas: "Envíe los cobros de mensualidad a los padres y confirme los pagos que entran, con su comprobante.",
  historial: "Consulte todo lo que ha pagado y debe cada alumno, mes por mes.",
  recordatorios: "Mande recordatorios de pago por WhatsApp a los padres que tienen cobros pendientes.",
  materiales: "Venda libros y materiales, lleve lo que costó, lo que se cobró y la ganancia.",
  graduacion: "Organice los cobros y gastos de la graduación: conceptos, abonos de cada alumno y fondo del evento.",
  alertas: "Vea de un vistazo quién debe, qué gastos faltan por registrar y lo que necesita atención este mes.",
  finanzas: "Registre gastos, pagos de planilla, deudas y cuentas por pagar, y revise la caja del mes.",
  ingresos: "Anote el dinero que entra fuera de las mensualidades: donaciones, alquileres, cursos y otros.",
  reportes: "Reportes del mes listos para compartir en PDF o Excel: ingresos, gastos, ganancia y flujo.",
  c_resultados: "Cuánto ingresó, cuánto se gastó y la utilidad del período, como lo presenta un contador.",
  c_balance: "Lo que la escuela tiene, lo que debe y su patrimonio a una fecha.",
  c_flujo: "De dónde vino el efectivo y en qué se usó durante el período.",
  c_diario: "Todos los asientos contables en orden de fecha, con su débito y crédito.",
  c_mayor: "Los movimientos y el saldo de cada cuenta contable por separado.",
  c_balanza: "Compruebe que los débitos y créditos cuadran en todas las cuentas.",
  c_antiguedad: "Cuánto tiempo llevan sin pagarse las cuentas por cobrar y por pagar.",
  c_ajustes: "Registre asientos de ajuste para corregir o completar la contabilidad del mes.",
  c_cierre: "Cierre el mes contable para que sus números ya no cambien.",
  c_apertura: "Cargue los saldos con los que la escuela empezó a llevar contabilidad.",
  c_catalogo: "La lista de cuentas contables que usa el sistema y cómo se agrupan.",
  config: "Datos de la institución, sucursales, usuarios y accesos de los docentes.",
  sistema: "Respaldos de la información, módulos activos y la personalización del sistema.",
};

// Una frase que presenta cada categoría
export const INTRO_GRUPO = {
  escuela: "Todo lo que tiene que ver con la vida académica: grupos, maestros, alumnos y el trabajo de los docentes.",
  cobros: "El dinero que entra por los alumnos: mensualidades, materiales, graduación y recordatorios a los padres.",
  finanzas_g: "El día a día del dinero de la escuela: gastos, ingresos extra, alertas y reportes del mes.",
  contab_g: "Los libros y estados financieros de la escuela, como los lleva un contador.",
  sistema_g: "Ajustes de la institución y cuidado de la información.",
};

const dos = (n) => String(n).padStart(2, "0");

// Página de una categoría: una tarjeta por módulo
export function GrupoPage({ grupo, irA }) {
  const intro = INTRO_GRUPO[grupo.id];
  const GIcon = grupo.icon;
  return (
    <div className="nav-pagina">
      <header className="nav-encabezado">
        <div className="nav-eyebrow">{GIcon && <GIcon size={14} />}Categoría · {grupo.items.length} {grupo.items.length === 1 ? "módulo" : "módulos"}</div>
        <h2 className="nav-titulo">{grupo.label}</h2>
        {intro && <p className="nav-intro">{intro}</p>}
      </header>
      <div className="nav-rejilla">
        {grupo.items.map((it, i) => {
          const Icon = it.icon;
          const texto = DESCRIPCIONES[it.id];
          return (
            <button key={it.id} type="button" className="nav-tarjeta" onClick={() => irA(it.id)}>
              <span className="nav-linea" aria-hidden="true" />
              <span className="nav-cabeza">
                <span className="nav-num" aria-hidden="true">{dos(i + 1)}</span>
                <span className="nav-icono" aria-hidden="true">{Icon && <Icon size={18} />}</span>
              </span>
              <span className="nav-nombre">{it.label}</span>
              {texto && <span className="nav-texto">{texto}</span>}
              <span className="nav-entrar">Entrar<span className="nav-flecha" aria-hidden="true">→</span></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

