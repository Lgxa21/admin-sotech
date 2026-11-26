import { getUser } from "@/lib/auth";
import { contentStudioConfig } from "@/lib/content-studio";

export const dynamic = "force-dynamic";

const MIME = {
  html: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", avif: "image/avif", ico: "image/x-icon", json: "application/json",
  woff2: "font/woff2", woff: "font/woff", otf: "font/otf", ttf: "font/ttf", txt: "text/plain",
} as const;

const NO_CACHE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const STUDIO_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
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
  const extension = asset.at(-1)?.split(".").at(-1)?.toLowerCase() ?? "";
  const validFile = asset.every((segment) => /^[a-z\d][a-z\d_.-]*$/i.test(segment)) && Object.hasOwn(MIME, extension);
  if (path !== "estado" && !validFile) return new Response(null, { status: 404, headers: NO_CACHE });

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
  if (upstream?.status === 404) return new Response(null, { status: 404, headers: NO_CACHE });
  if (!upstream?.ok || !upstream.body) return unavailable();

  const expectedType = MIME[extension as keyof typeof MIME];
  const upstreamType = upstream.headers.get("content-type")?.split(";", 1)[0];
  if (upstreamType !== expectedType && !(expectedType.startsWith("font/") && upstreamType === "application/octet-stream")
    && !(expectedType === "text/javascript" && upstreamType === "application/javascript")) {
    await upstream.body.cancel();
    return unavailable();
  }

  return new Response(upstream.body, {
    headers: {
      ...NO_CACHE,
      "Content-Type": expectedType.startsWith("text/") ? `${expectedType}; charset=utf-8` : expectedType,
      "Content-Security-Policy": STUDIO_POLICY,
      "Referrer-Policy": "same-origin",
    },
  });
}
