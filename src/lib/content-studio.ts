import "server-only";
import type { RoleT } from "./labels";

export function contentStudioConfig(role: RoleT) {
  if (process.env.CONTENT_STUDIO_ENABLED !== "true" || role === "FREELANCER") return null;
  const token = process.env.CONTENT_STUDIO_SITE_TOKEN?.trim();
  const origin = process.env.CONTENT_STUDIO_SITE_ORIGIN?.trim();
  if (!token || !origin || !/^https:\/\/(?:[a-z0-9-]+\.)+chatgpt\.site$/.test(origin)) return null;
  return { origin, token };
}
