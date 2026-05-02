import type { User } from "@supabase/supabase-js";

/** Nombre legible para exportaciones (PDF, etc.); sin tocar auth. */
export function getUserDisplayNameForExport(user: User): string {
  const meta = user.user_metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const m = meta as Record<string, unknown>;
    const full = m.full_name;
    const name = m.name;
    if (typeof full === "string" && full.trim().length > 0) return full.trim();
    if (typeof name === "string" && name.trim().length > 0) return name.trim();
  }
  if (typeof user.email === "string" && user.email.trim().length > 0) {
    return user.email.trim();
  }
  return "Usuario";
}
