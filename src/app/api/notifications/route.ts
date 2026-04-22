import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

  let query = supabase
    .from("notifications")
    .select(
      `
      id, type, read, created_at, paper_pmid, comment_id,
      paper_comments(id, anon_id, content, created_at, deleted_at),
      papers(pmid, title)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  const notifications = items
    .filter((row) => {
      // Filter out notifications for deleted or missing comments/papers
      const comment = row.paper_comments as unknown as {
        deleted_at: string | null;
      } | null;
      const paper = row.papers as unknown as { pmid: string } | null;
      return comment !== null && comment.deleted_at === null && paper !== null;
    })
    .map((row) => {
      const comment = row.paper_comments as unknown as {
        id: string;
        anon_id: string;
        content: string;
        created_at: string;
      };
      const paper = row.papers as unknown as {
        pmid: string;
        title: string;
      };

      return {
        id: row.id,
        type: row.type,
        read: row.read,
        created_at: row.created_at,
        paper_pmid: row.paper_pmid,
        paper_title: paper.title,
        comment: {
          id: comment.id,
          anon_id: comment.anon_id,
          content_preview:
            comment.content.length > 100
              ? comment.content.slice(0, 100) + "…"
              : comment.content,
          created_at: comment.created_at,
        },
      };
    });

  return NextResponse.json({
    notifications,
    next_cursor: hasMore ? items[items.length - 1].created_at : null,
  });
}

interface PatchBody {
  notification_ids?: string[];
  read_all?: boolean;
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  if (body.read_all) {
    const { data, error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: data?.length ?? 0 });
  }

  if (
    !body.notification_ids ||
    !Array.isArray(body.notification_ids) ||
    body.notification_ids.length === 0
  ) {
    return NextResponse.json(
      { error: "notification_ids or read_all required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .in("id", body.notification_ids)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length ?? 0 });
}
