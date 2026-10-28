import "server-only";

export const emailReady = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Correo con Resend (https://resend.com). Requiere RESEND_API_KEY y EMAIL_FROM, p. ej. "Sotech <avisos@sotech.com>".
export async function sendEmail(to: string, subject: string, text: string, url: string) {
  if (!emailReady()) return false;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f3ef;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#111;padding:18px 24px;color:#f4f3ef;font-weight:bold;font-size:18px">sotech</td></tr>
<tr><td style="padding:28px 24px;font-size:16px;line-height:1.5">${esc(text).replace(/\n/g, "<br>")}</td></tr>
<tr><td style="padding:0 24px 28px"><a href="${esc(url)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">Abrir en el sistema</a></td></tr>
<tr><td style="padding:16px 24px;background:#f4f3ef;font-size:12px;color:#5a5850">Puedes elegir qué avisos recibir en tu perfil del sistema.</td></tr>
</table></td></tr></table></body></html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject: subject.slice(0, 140), text: `${text}\n\n${url}`, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) console.error("email", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("email", (e as Error).message);
    return false;
  }
}
