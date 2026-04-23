import { NextResponse } from "next/server";
import { createServiceClient, createServerAuthClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/admin";

export async function GET(request: Request) {
  const authClient = await createServerAuthClient();
  const { data: { session } } = await authClient.auth.getSession();

  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get("perPage") || "20", 10)));

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.admin.listUsers({
    page,
    perPage,
  });

  if (error) {
    console.error("[Admin] listUsers error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const users = (data.users || []).map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.user_metadata?.full_name || null,
    avatar_url: u.user_metadata?.avatar_url || null,
    provider: u.app_metadata?.provider || null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));

  return NextResponse.json({
    users,
    total: data.total,
    page,
    perPage,
  });
}
