import "server-only";

// WhatsApp Cloud API de Meta, desde el número de WhatsApp Business de la empresa.
// Los avisos que inicia la empresa necesitan una plantilla aprobada por Meta con 2 variables:
//   {{1}} = el aviso   {{2}} = el enlace al sistema
export const whatsappReady = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE);

// "0412-123.45.67" → "584121234567"
export function normalizePhone(raw: string | null | undefined) {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = "58" + d.slice(1);
  if (d.length === 10 && d.startsWith("4")) d = "58" + d;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

// Las variables de una plantilla no admiten saltos de línea ni más de 4 espacios seguidos.
const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 900);

export async function sendWhatsapp(phone: string, text: string, url: string) {
  if (!whatsappReady()) return false;
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "es" },
          components: [{ type: "body", parameters: [{ type: "text", text: clean(text) }, { type: "text", text: url }] }],
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) console.error("whatsapp", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("whatsapp", (e as Error).message);
    return false;
  }
}

// "584121234567" → "0412 123 4567" para mostrarlo; otros países quedan con "+".
export function displayPhone(p: string | null | undefined) {
  if (!p) return "";
  if (p.startsWith("58") && p.length === 12) return `0${p.slice(2, 5)} ${p.slice(5, 8)} ${p.slice(8)}`;
  return `+${p}`;
}
