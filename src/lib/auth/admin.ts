import { createServerAuthClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Check if the given email belongs to an admin.
 * Uses ADMIN_EMAILS environment variable (comma-separated).
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Resolve the current request's user and verify admin status.
 * Uses getUser() (server-side JWT verification) — never getSession(),
 * whose payload is read from the cookie without verification.
 *
 * Returns the authenticated admin User, or null if unauthenticated
 * or not an admin. Callers decide the rejection response/redirect.
 */
export async function requireAdmin(): Promise<User | null> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}
