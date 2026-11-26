import { getUser } from "@/lib/auth";
import { contentStudioConfig } from "@/lib/content-studio";

export const dynamic = "force-dynamic";

const MIME = {
  "index.html": "text/html; charset=utf-8",
  "style.css": "text/css; charset=utf-8",
  "studio.mjs": "text/javascript; charset=utf-8",
  "model.mjs": "text/javascript; charset=utf-8",
  "storage.mjs": "text/javascript; charset=utf-8",
  "design.mjs": "text/javascript; charset=utf-8",
  "icon.svg": "image/svg+xml",
  "assets/barlow-800.woff2": "font/woff2",
  "assets/dm-sans.woff2": "font/woff2",
  "assets/barlow-OFL.txt": "text/plain; charset=utf-8",
  "assets/dm-sans-OFL.txt": "text/plain; charset=utf-8",
} as const;

const NO_CACHE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const STUDIO_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function unavailable() {
  return new Response("Content Studio no está disponible. Intenta de nuevo más tarde.", { status: 502, headers: NO_CACHE });
}

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await params;
  const path = asset.join("/");
  if (path !== "estado" && !Object.hasOwn(MIME, path)) return new Response(null, { status: 404, headers: NO_CACHE });

  const user = await getUser();
  const config = user && contentStudioConfig(user.role);
  if (!config) return new Response(null, { status: 404, headers: NO_CACHE });
  if (path === "estado") return new Response(null, { status: 204, headers: NO_CACHE });

  const upstreamPath = path === "index.html" ? "/" : `/${path}`;
  const upstream = await fetch(new URL(upstreamPath, config.origin), {
    headers: { "OAI-Sites-Authorization": `Bearer ${config.token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return unavailable();

  const contentType = MIME[path as keyof typeof MIME];
  const upstreamType = upstream.headers.get("content-type")?.split(";", 1)[0];
  const expectedType = contentType.split(";", 1)[0];
  if (upstreamType !== expectedType && !(expectedType === "font/woff2" && upstreamType === "application/octet-stream")) {
    await upstream.body.cancel();
    return unavailable();
  }

  return new Response(upstream.body, {
    headers: {
      ...NO_CACHE,
      "Content-Type": contentType,
      "Content-Security-Policy": STUDIO_POLICY,
      "Referrer-Policy": "same-origin",
    },
  });
}
