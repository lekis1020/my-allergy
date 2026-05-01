import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: bookmarks, error: bmError } = await supabase
    .from("bookmarks")
    .select("pmid")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (bmError) {
    return NextResponse.json({ error: bmError.message }, { status: 500 });
  }

  const pmids = (bookmarks ?? []).map((b) => b.pmid);
  if (pmids.length === 0) {
    return NextResponse.json({ papers: [] });
  }

  const { data: paperRows } = await supabase
    .from("papers")
    .select("pmid, title")
    .in("pmid", pmids);

  const titleMap = new Map(
    (paperRows ?? []).map((p) => [String(p.pmid), String(p.title ?? "")])
  );

  const papers = pmids
    .filter((pmid) => titleMap.has(pmid))
    .map((pmid) => ({ pmid, title: titleMap.get(pmid)! }));

  return NextResponse.json({ papers });
}
