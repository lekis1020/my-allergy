/** True when the request carries a Supabase SSR auth cookie (`sb-*-auth-token`). */
export function hasSupabaseAuthCookie(
  cookieSource: { getAll: () => { name: string }[] },
): boolean {
  return cookieSource
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}
