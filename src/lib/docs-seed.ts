import "server-only";
import { count } from "drizzle-orm";
import { db, docs } from "@/db";

// Contenido inicial de la biblioteca, armado con las respuestas del cuestionario. Todo se puede editar.
// Lo que va entre corchetes [así] es para completar o confirmar.
const DEFAULT_DOCS: { category: string; title: string; body: string }[] = [
  {
    category: "protocolo",
    title: "Protocolo de comunicación",
    body: `El trabajo se habla dentro del sistema. WhatsApp personal no se usa para temas de trabajo.

## Dónde se habla cada cosa
- Pedidos de clientes: por el enlace de pedidos del cliente o por el WhatsApp Business de la empresa. Nunca desde números personales.
- Brief, dudas y comentarios: en la conversación de cada orden. Usa @nombre para avisarle a alguien.
- Asignar trabajo: siempre como tarea dentro de la orden.
- Piezas para revisión: se suben a la orden y dirección las aprueba antes de enviarlas al cliente.
- Aprobación del cliente: con el enlace de aprobación de la orden. Su respuesta queda registrada.
- Cambios que el cliente pide en persona o por llamada: “Registrar cambio del cliente” en la orden, el mismo día.
- Urgencias: botón “Reportar una urgencia”. Avisa a dirección, que decide a qué área va.
- Anuncios para todo el equipo: en la reunión semanal o en la orden que corresponda.

## Tiempos de respuesta
- Entre el equipo: el mismo día hábil.
- Al cliente: [definir con dirección; propuesta: el mismo día hábil].
- Horario: lunes a viernes, de 9:00 a. m. a 6:00 p. m. Fuera de ese horario solo se atienden urgencias.

## Qué cuenta como urgencia
- Un problema o una crisis con un cliente: dirección debe saberlo de inmediato y luego avisa al área responsable.

## Escalamiento
- Si una orden se atrasa o alguien no responde, se avisa al líder del área: [definir el líder de cada área].
- Si un freelancer no acepta una tarea en 24 horas, quien la asignó la reasigna.

## Reuniones
- Planificación semanal: se revisa el tablero y cada acuerdo se anota como tarea.
- La reunión diaria se reemplaza por la pantalla “Hoy”.

## WhatsApp
- El WhatsApp Business de la empresa se atiende desde [teléfono o computadora de la empresa] y lo atiende [persona].
- Los grupos de WhatsApp de trabajo se cierran cuando el equipo empieza a usar el sistema.`,
  },
  { category: "mensaje", title: "Bienvenida a un cliente nuevo", body: `Hola [Nombre], ¡bienvenido/a a Sotech! A partir de ahora puedes hacernos tus pedidos desde este enlace: [enlace de pedidos]. Cada pedido nos llega directo y te confirmamos los detalles y la fecha de entrega. Cualquier duda, escríbenos por aquí.` },
  { category: "mensaje", title: "Pieza lista para aprobar", body: `Hola [Nombre], tu pieza “[nombre de la orden]” está lista. Puedes revisarla y aprobarla o pedirnos cambios aquí: [enlace de aprobación]. Incluye [2] rondas de cambios.` },
  { category: "mensaje", title: "Recordatorio de aprobación", body: `Hola [Nombre], te recordamos que “[nombre de la orden]” está esperando tu aprobación: [enlace de aprobación]. Así podemos cumplir con la fecha de [fecha].` },
  { category: "mensaje", title: "Pedido recibido", body: `Hola [Nombre], recibimos tu pedido “[pedido]”. Lo estamos revisando y te confirmamos la fecha de entrega a más tardar [mañana].` },
  { category: "mensaje", title: "Recordatorio de pago", body: `Hola [Nombre], te escribimos para recordarte el pago de [concepto] por [monto]. Puedes pagar por transferencia, pago móvil o Binance. Cuando lo hagas, envíanos la referencia por aquí. ¡Gracias!` },
  { category: "mensaje", title: "Pago recibido", body: `Hola [Nombre], confirmamos que recibimos tu pago de [monto] (ref. [referencia]). ¡Muchas gracias!` },
  { category: "mensaje", title: "Respuesta fuera de horario", body: `Hola, gracias por escribirnos. Nuestro horario es de lunes a viernes de 9:00 a. m. a 6:00 p. m. Te respondemos apenas abramos. Si es una urgencia, indícalo en tu mensaje.` },
  {
    category: "proceso",
    title: "Del pedido al cobro",
    body: `## 1. Entrada
- El pedido llega por el enlace del cliente o se registra como orden nueva (Tablero → + Nueva orden).
- Dirección revisa el brief, asigna responsable y fecha de entrega.

## 2. Producción
- El responsable divide el trabajo en tareas y las asigna. Los freelancers deben aceptar su tarea.
- Las dudas se hablan en la conversación de la orden.
- Al terminar, la orden pasa a “Revisión interna”.

## 3. Con el cliente
- Dirección aprueba la pieza y crea el enlace de aprobación.
- Se envía el enlace al cliente desde el WhatsApp Business o el correo de la empresa.
- Si pide cambios, se crea la tarea de ajustes y se cuenta la ronda.

## 4. Cierre
- Aprobada: se publica o entrega y se marca la etapa.
- Administración registra el número de factura de Profit y los cobros.
- Se registran los pagos a proveedores y freelancers de esa orden.
- Con todo pagado, la orden se cierra y queda su margen.`,
  },
  {
    category: "proceso",
    title: "Cierre de mes",
    body: `- Revisar en Finanzas → Resumen lo cobrado, lo pagado y lo que queda en caja.
- Revisar “Por cobrar” y enviar recordatorios de pago (ver mensajes predefinidos).
- Revisar “Pagos” y pagar lo pendiente a proveedores y freelancers.
- Revisar la rentabilidad por cliente del mes.
- Confirmar que las igualas del mes siguiente estén activas.`,
  },
  {
    category: "guia",
    title: "Guía para nuevos integrantes",
    body: `## Tu primer día
- Entra al sistema con el correo y la contraseña que te dieron, y cámbiala en tu perfil.
- En tu perfil activa las notificaciones en tu celular y guarda tu número de WhatsApp.
- En el celular, instala la app: en Android, desde el menú del navegador “Instalar app”; en iPhone, en Safari toca Compartir y luego “Agregar a inicio”.

## Cómo trabajamos
- “Hoy” te muestra lo que necesita tu atención.
- En Tablero → Mis tareas ves todo lo que tienes asignado. Si eres freelancer, acepta cada tarea al recibirla.
- Las dudas sobre un trabajo se hablan en la conversación de esa orden, no por WhatsApp.
- Lee el protocolo de comunicación en esta biblioteca.`,
  },
  { category: "tarifas", title: "Tarifas", body: `Completa los precios vigentes de cada servicio.

## Redes sociales
- Iguala básica: [US$ …] al mes, [x] posts y [x] historias
- Post adicional: [US$ …]

## Diseño
- Pieza digital: [US$ …]
- Pieza para impresión: [US$ …]

## Foto y video
- Sesión de fotos: [US$ …]
- Video corto: [US$ …]

## Rondas de cambios
- Incluidas: 2. Ronda adicional: [US$ …]` },
];

export async function ensureDefaultDocs() {
  const [{ n }] = await db.select({ n: count() }).from(docs);
  if (n > 0) return;
  await db.insert(docs).values(DEFAULT_DOCS.map((d, i) => ({ ...d, position: i })));
}
