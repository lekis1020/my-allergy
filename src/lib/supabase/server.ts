import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

// Read-only client using anon key — respects RLS policies.
// Anon reads are stateless (no per-request cookies/session), so we reuse a
// single lazily-created instance instead of allocating one per request.
let anonClient: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createAnonClient() {
  if (!anonClient) {
    anonClient = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return anonClient;
}

// Admin client using service_role key — bypasses RLS
// Only use for sync/cron write operations
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Auth-aware server client — uses cookies for session management
// Use in Server Components, Route Handlers, Server Actions
export async function createServerAuthClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from Server Component — read-only cookies
          }
        },
      },
    }
  );
}
