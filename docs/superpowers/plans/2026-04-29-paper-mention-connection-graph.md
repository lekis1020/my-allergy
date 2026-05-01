# Paper Mention & Connection Graph — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable `@` mention of bookmarked papers in comments and visualize paper connections (citation + mention) as an interactive D3.js force-directed network graph.

**Architecture:** Comment form gets `@` detection + autocomplete dropdown searching bookmarked paper titles. Server parses `[@title](pmid:XXXX)` patterns on save and stores relationships in `paper_mentions` table. A new connections API aggregates citation + mention data. D3.js renders an interactive force-directed graph in a preview card (paper detail page) that expands to a fullscreen modal.

**Tech Stack:** Next.js 16 App Router, Supabase PostgreSQL, D3.js (d3-force, d3-selection, d3-zoom, d3-drag), SWR, TypeScript, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-04-29-paper-mention-connection-graph-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| CREATE | `supabase/migrations/00032_paper_mentions.sql` | paper_mentions table + RLS |
| CREATE | `src/app/api/bookmarks/with-titles/route.ts` | Bookmarks + paper titles API |
| CREATE | `src/hooks/use-bookmarks-with-titles.ts` | SWR hook for bookmarks with titles |
| CREATE | `src/components/comments/mention-dropdown.tsx` | @ autocomplete dropdown |
| CREATE | `src/lib/comments/mention-parser.ts` | Parse/render mention patterns |
| CREATE | `src/app/api/papers/[pmid]/connections/route.ts` | Connection graph data API |
| CREATE | `src/components/graph/paper-connection-graph.tsx` | D3 force-directed graph |
| CREATE | `src/components/graph/connection-graph-preview.tsx` | Preview card (client) |
| CREATE | `src/components/graph/connection-graph-modal.tsx` | Fullscreen modal |
| MODIFY | `src/components/comments/comment-form.tsx` | Add @ detection + dropdown |
| MODIFY | `src/components/comments/comment-item.tsx` | Render mention links |
| MODIFY | `src/app/api/papers/[pmid]/comments/route.ts` | Parse mentions on POST, save to paper_mentions |
| MODIFY | `src/app/paper/[pmid]/page.tsx` | Add graph preview card |

---

### Task 1: Install D3.js

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install d3 and types**

```bash
cd /Users/napler/projects/my-allergy && npm install d3 @types/d3
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('d3-force'); console.log('d3 OK')"
```
Expected: `d3 OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add d3 dependency for connection graph"
```

---

### Task 2: Database Migration — paper_mentions

**Files:**
- Create: `supabase/migrations/00032_paper_mentions.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Paper mention relationships from user comments.
-- When a user @-mentions a paper in a comment, store the link here.

CREATE TABLE paper_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES paper_comments(id) ON DELETE CASCADE,
  source_pmid TEXT NOT NULL,
  mentioned_pmid TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE paper_mentions
  ADD CONSTRAINT uq_mention_per_comment UNIQUE (comment_id, mentioned_pmid);

CREATE INDEX idx_paper_mentions_source ON paper_mentions(source_pmid);
CREATE INDEX idx_paper_mentions_mentioned ON paper_mentions(mentioned_pmid);

ALTER TABLE paper_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read mentions"
  ON paper_mentions FOR SELECT TO authenticated
  USING (true);
```

- [ ] **Step 2: Apply migration to remote Supabase**

```bash
cd /Users/napler/projects/my-allergy && npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00032_paper_mentions.sql
git commit -m "feat: add paper_mentions table for comment @-mentions"
```

---

### Task 3: Mention Parser Utility

**Files:**
- Create: `src/lib/comments/mention-parser.ts`

- [ ] **Step 1: Create mention-parser.ts**

```typescript
/** Regex to match [@Title](pmid:12345678) patterns in comment text */
const MENTION_REGEX = /\[@([^\]]*)\]\(pmid:(\d+)\)/g;

export interface ParsedMention {
  fullMatch: string;
  title: string;
  pmid: string;
}

/** Extract all paper mentions from comment content */
export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);
  while ((match = regex.exec(content)) !== null) {
    mentions.push({
      fullMatch: match[0],
      title: match[1],
      pmid: match[2],
    });
  }
  return mentions;
}

/** Split comment content into text segments and mention segments for rendering */
export interface ContentSegment {
  type: "text" | "mention";
  value: string;
  pmid?: string;
  title?: string;
}

export function segmentContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "mention",
      value: match[0],
      title: match[1],
      pmid: match[2],
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/comments/mention-parser.ts
git commit -m "feat: add mention parser utility for [@title](pmid:XXX) patterns"
```

---

### Task 4: Bookmarks With Titles API + Hook

**Files:**
- Create: `src/app/api/bookmarks/with-titles/route.ts`
- Create: `src/hooks/use-bookmarks-with-titles.ts`

- [ ] **Step 1: Create API route**

```typescript
// src/app/api/bookmarks/with-titles/route.ts
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

  const { data, error } = await supabase
    .from("bookmarks")
    .select("pmid, papers!inner(title)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const papers = (data ?? []).map((b) => ({
    pmid: b.pmid,
    title: String((b.papers as unknown as { title: string }).title ?? ""),
  }));

  return NextResponse.json({ papers });
}
```

- [ ] **Step 2: Create SWR hook**

```typescript
// src/hooks/use-bookmarks-with-titles.ts
"use client";

import useSWR from "swr";
import { useAuth } from "./use-auth";

export interface BookmarkPaper {
  pmid: string;
  title: string;
}

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => (d.papers as BookmarkPaper[]) ?? []);

export function useBookmarksWithTitles() {
  const { user } = useAuth();

  const { data, isLoading } = useSWR<BookmarkPaper[]>(
    user ? "/api/bookmarks/with-titles" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return { papers: data ?? [], loading: isLoading };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bookmarks/with-titles/route.ts src/hooks/use-bookmarks-with-titles.ts
git commit -m "feat: add bookmarks-with-titles API and SWR hook"
```

---

### Task 5: Mention Dropdown Component

**Files:**
- Create: `src/components/comments/mention-dropdown.tsx`

- [ ] **Step 1: Create MentionDropdown component**

```tsx
// src/components/comments/mention-dropdown.tsx
"use client";

import { useMemo } from "react";
import { FileText } from "lucide-react";
import type { BookmarkPaper } from "@/hooks/use-bookmarks-with-titles";

interface MentionDropdownProps {
  query: string;
  papers: BookmarkPaper[];
  onSelect: (paper: BookmarkPaper) => void;
  visible: boolean;
}

export function MentionDropdown({ query, papers, onSelect, visible }: MentionDropdownProps) {
  const filtered = useMemo(() => {
    if (!query) return papers.slice(0, 8);
    const lower = query.toLowerCase();
    return papers
      .filter((p) => p.title.toLowerCase().includes(lower) || p.pmid.includes(query))
      .slice(0, 8);
  }, [query, papers]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
      {filtered.map((paper) => (
        <button
          key={paper.pmid}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(paper);
          }}
          className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xs text-gray-800 dark:text-gray-200">
              {paper.title}
            </p>
            <p className="text-[10px] text-gray-400">PMID: {paper.pmid}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/comments/mention-dropdown.tsx
git commit -m "feat: add MentionDropdown component for paper autocomplete"
```

---

### Task 6: Integrate @ Mention Into Comment Form

**Files:**
- Modify: `src/components/comments/comment-form.tsx`

- [ ] **Step 1: Add mention state and dropdown integration**

Modifications to `comment-form.tsx`:

1. Import new dependencies at the top:
```typescript
import { useBookmarksWithTitles, type BookmarkPaper } from "@/hooks/use-bookmarks-with-titles";
import { MentionDropdown } from "./mention-dropdown";
import { useRef } from "react";
```

2. Add `useRef` to the existing `useState` import. Inside `CommentForm`, after existing state declarations, add:
```typescript
const { papers: bookmarkPapers } = useBookmarksWithTitles();
const textareaRef = useRef<HTMLTextAreaElement>(null);
const [mentionQuery, setMentionQuery] = useState<string | null>(null);
const [mentionActive, setMentionActive] = useState(false);
```

3. Add mention detection handler — new function inside the component:
```typescript
function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
  const val = e.target.value;
  setContent(val);

  const cursor = e.target.selectionStart;
  const textBeforeCursor = val.slice(0, cursor);
  // Find @ that starts a mention (after space, newline, or at start)
  const mentionMatch = textBeforeCursor.match(/(?:^|[\s])@([^\s@]*)$/);
  if (mentionMatch) {
    setMentionQuery(mentionMatch[1]);
    setMentionActive(true);
  } else {
    setMentionActive(false);
    setMentionQuery(null);
  }
}
```

4. Add select handler:
```typescript
function handleMentionSelect(paper: BookmarkPaper) {
  const textarea = textareaRef.current;
  if (!textarea) return;

  const cursor = textarea.selectionStart;
  const textBeforeCursor = content.slice(0, cursor);
  const atIndex = textBeforeCursor.lastIndexOf("@");
  if (atIndex === -1) return;

  const shortTitle = paper.title.length > 60
    ? paper.title.slice(0, 57) + "..."
    : paper.title;
  const mention = `[@${shortTitle}](pmid:${paper.pmid})`;
  const before = content.slice(0, atIndex);
  const after = content.slice(cursor);
  const newContent = before + mention + " " + after;

  setContent(newContent);
  setMentionActive(false);
  setMentionQuery(null);

  // Restore focus and cursor position
  requestAnimationFrame(() => {
    textarea.focus();
    const newCursor = before.length + mention.length + 1;
    textarea.setSelectionRange(newCursor, newCursor);
  });
}
```

5. Replace the `<textarea>` element — wrap in relative container and add dropdown:
```tsx
<div className="relative">
  <MentionDropdown
    query={mentionQuery ?? ""}
    papers={bookmarkPapers}
    onSelect={handleMentionSelect}
    visible={mentionActive}
  />
  <textarea
    ref={textareaRef}
    value={content}
    onChange={handleContentChange}
    onKeyDown={(e) => {
      if (e.key === "Escape" && mentionActive) {
        setMentionActive(false);
        setMentionQuery(null);
      }
    }}
    onBlur={() => {
      // Delay to allow dropdown click
      setTimeout(() => setMentionActive(false), 200);
    }}
    placeholder={placeholder}
    autoFocus={autoFocus}
    rows={parentId ? 2 : 3}
    maxLength={2000}
    className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
  />
</div>
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/napler/projects/my-allergy && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/comments/comment-form.tsx
git commit -m "feat: integrate @ mention autocomplete into comment form"
```

---

### Task 7: Render Mention Links in Comment Item

**Files:**
- Modify: `src/components/comments/comment-item.tsx`

- [ ] **Step 1: Add mention rendering**

1. Add import at top of `comment-item.tsx`:
```typescript
import Link from "next/link";
import { segmentContent } from "@/lib/comments/mention-parser";
```

2. Add a helper component inside the file (before `CommentItem`):
```tsx
function CommentContent({ content }: { content: string }) {
  const segments = segmentContent(content);

  return (
    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
      {segments.map((seg, i) =>
        seg.type === "mention" ? (
          <Link
            key={i}
            href={`/paper/${seg.pmid}`}
            className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-100 hover:underline dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/40"
            title={`PMID: ${seg.pmid}`}
          >
            📄 {seg.title}
          </Link>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </p>
  );
}
```

3. Replace the existing plain text rendering (the `<p>` that shows `{comment.content}`):
```tsx
// Replace:
<p className="mt-1 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
  {comment.content}
</p>

// With:
<CommentContent content={comment.content} />
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/napler/projects/my-allergy && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/comments/comment-item.tsx
git commit -m "feat: render @-mentioned papers as clickable links in comments"
```

---

### Task 8: Save Mentions on Comment POST

**Files:**
- Modify: `src/app/api/papers/[pmid]/comments/route.ts`

- [ ] **Step 1: Add mention parsing to POST handler**

1. Add import at top:
```typescript
import { parseMentions } from "@/lib/comments/mention-parser";
```

2. After the notification generation block (after the `catch (err)` for notifications), add mention extraction before the final return:
```typescript
  // Extract and save paper mentions (fire-and-forget)
  try {
    const mentions = parseMentions(content);
    if (mentions.length > 0) {
      const serviceClient = createServiceClient();
      await serviceClient.from("paper_mentions").upsert(
        mentions.map((m) => ({
          comment_id: inserted.id,
          source_pmid: pmid,
          mentioned_pmid: m.pmid,
        })),
        { onConflict: "comment_id,mentioned_pmid", ignoreDuplicates: true }
      );
    }
  } catch (err) {
    console.error("[Mentions] Failed to save paper mentions:", err);
  }
```

Note: `createServiceClient` is already imported. The `serviceClient` variable needs to be created in this new block since the existing one from the notification block is scoped inside that try block. Alternatively, hoist the serviceClient creation above both blocks.

- [ ] **Step 2: Verify build**

```bash
cd /Users/napler/projects/my-allergy && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/papers/[pmid]/comments/route.ts
git commit -m "feat: parse and save paper mentions from comment content"
```

---

### Task 9: Connections API

**Files:**
- Create: `src/app/api/papers/[pmid]/connections/route.ts`

- [ ] **Step 1: Create connections API route**

```typescript
// src/app/api/papers/[pmid]/connections/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAnonClient, createServiceClient } from "@/lib/supabase/server";

interface ConnectionNode {
  pmid: string;
  title: string;
  journal_abbreviation: string;
  journal_color: string;
  publication_date: string;
}

interface MentionDetail {
  comment_id: string;
  anon_id: string;
  content_snippet: string;
  created_at: string;
}

interface ConnectionEdge {
  source: string;
  target: string;
  type: "citation" | "mention" | "both";
  direction: "references" | "cited_by" | "bidirectional";
  mentions: MentionDetail[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pmid: string }> }
) {
  const { pmid } = await params;
  const supabase = createAnonClient();

  // 1. Focal paper
  const { data: paper } = await supabase
    .from("papers")
    .select("pmid, title, journals!inner(abbreviation, color)")
    .eq("pmid", pmid)
    .single();

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  // 2. Citations (both directions)
  const [{ data: outgoing }, { data: incoming }] = await Promise.all([
    supabase.from("paper_citations").select("target_pmid").eq("source_pmid", pmid),
    supabase.from("paper_citations").select("source_pmid").eq("target_pmid", pmid),
  ]);

  const citationMap = new Map<string, "references" | "cited_by" | "bidirectional">();
  for (const row of outgoing ?? []) {
    citationMap.set(row.target_pmid, "references");
  }
  for (const row of incoming ?? []) {
    const existing = citationMap.get(row.source_pmid);
    citationMap.set(row.source_pmid, existing === "references" ? "bidirectional" : "cited_by");
  }

  // 3. Mentions (both directions)
  const serviceClient = createServiceClient();
  const [{ data: mentionsFrom }, { data: mentionsTo }] = await Promise.all([
    serviceClient
      .from("paper_mentions")
      .select("mentioned_pmid, comment_id, paper_comments!inner(anon_id, content, created_at)")
      .eq("source_pmid", pmid),
    serviceClient
      .from("paper_mentions")
      .select("source_pmid, comment_id, paper_comments!inner(anon_id, content, created_at)")
      .eq("mentioned_pmid", pmid),
  ]);

  const mentionMap = new Map<string, MentionDetail[]>();

  for (const row of mentionsFrom ?? []) {
    const comment = row.paper_comments as unknown as { anon_id: string; content: string; created_at: string };
    const arr = mentionMap.get(row.mentioned_pmid) ?? [];
    arr.push({
      comment_id: row.comment_id,
      anon_id: comment.anon_id,
      content_snippet: comment.content.slice(0, 100),
      created_at: comment.created_at,
    });
    mentionMap.set(row.mentioned_pmid, arr);
  }

  for (const row of mentionsTo ?? []) {
    const comment = row.paper_comments as unknown as { anon_id: string; content: string; created_at: string };
    const arr = mentionMap.get(row.source_pmid) ?? [];
    arr.push({
      comment_id: row.comment_id,
      anon_id: comment.anon_id,
      content_snippet: comment.content.slice(0, 100),
      created_at: comment.created_at,
    });
    mentionMap.set(row.source_pmid, arr);
  }

  // 4. Collect all related PMIDs
  const allPmids = new Set([...citationMap.keys(), ...mentionMap.keys()]);
  if (allPmids.size === 0) {
    const journal = paper.journals as unknown as { abbreviation: string; color: string };
    return NextResponse.json({
      focal: {
        pmid: paper.pmid,
        title: String(paper.title),
        journal_abbreviation: String(journal.abbreviation),
        journal_color: String(journal.color),
      },
      nodes: [],
      edges: [],
    });
  }

  // 5. Fetch paper metadata for all related papers
  const { data: relatedPapers } = await supabase
    .from("papers")
    .select("pmid, title, publication_date, journals!inner(abbreviation, color)")
    .in("pmid", [...allPmids]);

  const paperMap = new Map<string, ConnectionNode>();
  for (const rp of relatedPapers ?? []) {
    const journal = rp.journals as unknown as { abbreviation: string; color: string };
    paperMap.set(String(rp.pmid), {
      pmid: String(rp.pmid),
      title: String(rp.title),
      journal_abbreviation: String(journal.abbreviation),
      journal_color: String(journal.color),
      publication_date: String(rp.publication_date),
    });
  }

  // 6. Build edges
  const edges: ConnectionEdge[] = [];
  const processedPmids = new Set<string>();

  for (const relatedPmid of allPmids) {
    if (!paperMap.has(relatedPmid)) continue; // skip papers not in our DB
    processedPmids.add(relatedPmid);

    const hasCitation = citationMap.has(relatedPmid);
    const hasMention = mentionMap.has(relatedPmid);
    const type = hasCitation && hasMention ? "both" : hasCitation ? "citation" : "mention";
    const direction = citationMap.get(relatedPmid) ?? "cited_by";

    edges.push({
      source: pmid,
      target: relatedPmid,
      type,
      direction,
      mentions: mentionMap.get(relatedPmid) ?? [],
    });
  }

  const nodes = [...processedPmids].map((p) => paperMap.get(p)!);
  const journal = paper.journals as unknown as { abbreviation: string; color: string };

  return NextResponse.json({
    focal: {
      pmid: paper.pmid,
      title: String(paper.title),
      journal_abbreviation: String(journal.abbreviation),
      journal_color: String(journal.color),
    },
    nodes,
    edges,
  });
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/napler/projects/my-allergy && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/papers/[pmid]/connections/route.ts
git commit -m "feat: add connections API aggregating citation + mention data"
```

---

### Task 10: D3 Force-Directed Graph Component

**Files:**
- Create: `src/components/graph/paper-connection-graph.tsx`

- [ ] **Step 1: Create the D3 graph component**

```tsx
// src/components/graph/paper-connection-graph.tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";

interface GraphNode extends d3.SimulationNodeDatum {
  pmid: string;
  title: string;
  journal_abbreviation: string;
  journal_color: string;
  isFocal: boolean;
}

interface MentionDetail {
  comment_id: string;
  anon_id: string;
  content_snippet: string;
  created_at: string;
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  type: "citation" | "mention" | "both";
  direction: "references" | "cited_by" | "bidirectional";
  mentions: MentionDetail[];
}

interface PaperConnectionGraphProps {
  focal: { pmid: string; title: string; journal_abbreviation: string; journal_color: string };
  nodes: Array<{ pmid: string; title: string; journal_abbreviation: string; journal_color: string; publication_date: string }>;
  edges: Array<{
    source: string; target: string;
    type: "citation" | "mention" | "both";
    direction: "references" | "cited_by" | "bidirectional";
    mentions: MentionDetail[];
  }>;
  width: number;
  height: number;
  interactive?: boolean;
}

export function PaperConnectionGraph({
  focal, nodes, edges, width, height, interactive = true,
}: PaperConnectionGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const navigate = useCallback((pmid: string) => {
    router.push(`/paper/${pmid}`);
  }, [router]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);
    svg.selectAll("*").remove();

    // Build graph data
    const graphNodes: GraphNode[] = [
      { pmid: focal.pmid, title: focal.title, journal_abbreviation: focal.journal_abbreviation, journal_color: focal.journal_color, isFocal: true },
      ...nodes.map((n) => ({
        pmid: n.pmid, title: n.title, journal_abbreviation: n.journal_abbreviation, journal_color: n.journal_color, isFocal: false,
      })),
    ];

    const graphEdges: GraphEdge[] = edges.map((e) => ({
      source: e.source, target: e.target,
      type: e.type, direction: e.direction, mentions: e.mentions,
    }));

    // Defs for arrow markers
    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrow-citation")
      .attr("viewBox", "0 0 10 6").attr("refX", 28).attr("refY", 3)
      .attr("markerWidth", 8).attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path").attr("d", "M0,0L10,3L0,6").attr("fill", "#9CA3AF");

    defs.append("marker")
      .attr("id", "arrow-mention")
      .attr("viewBox", "0 0 10 6").attr("refX", 28).attr("refY", 3)
      .attr("markerWidth", 8).attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path").attr("d", "M0,0L10,3L0,6").attr("fill", "#3B82F6");

    // Container with zoom
    const g = svg.append("g");

    if (interactive) {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on("zoom", (event) => g.attr("transform", event.transform));
      svg.call(zoom);
    }

    // Force simulation
    const simulation = d3.forceSimulation<GraphNode>(graphNodes)
      .force("link", d3.forceLink<GraphNode, GraphEdge>(graphEdges).id((d) => d.pmid).distance(160))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));

    // Fix focal node to center
    const focalNode = graphNodes.find((n) => n.isFocal);
    if (focalNode) {
      focalNode.fx = width / 2;
      focalNode.fy = height / 2;
    }

    // Draw edges
    const link = g.selectAll<SVGLineElement, GraphEdge>(".link")
      .data(graphEdges).enter().append("line")
      .attr("class", "link")
      .attr("stroke", (d) => d.type === "citation" ? "#9CA3AF" : d.type === "mention" ? "#3B82F6" : "#8B5CF6")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", (d) => d.type === "citation" ? "6,3" : "none")
      .attr("marker-end", (d) => d.type === "citation" ? "url(#arrow-citation)" : "url(#arrow-mention)");

    if (interactive) {
      link.on("mouseenter", function (event, d) {
        const label = d.type === "citation"
          ? (d.direction === "references" ? "References" : d.direction === "cited_by" ? "Cited by" : "Bidirectional")
          : "";
        const mentionText = d.mentions.map((m) =>
          `💬 ${m.content_snippet}`
        ).join("\n");
        const text = [label, mentionText].filter(Boolean).join("\n");
        tooltip.style("opacity", 1)
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY - 12 + "px")
          .text(text);
      }).on("mouseleave", () => tooltip.style("opacity", 0));
    }

    // Draw nodes
    const node = g.selectAll<SVGGElement, GraphNode>(".node")
      .data(graphNodes).enter().append("g")
      .attr("class", "node")
      .style("cursor", interactive ? "pointer" : "default");

    if (interactive) {
      node.on("click", (_event, d) => navigate(d.pmid));
      node.call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            if (!d.isFocal) { d.fx = d.x; d.fy = d.y; }
          })
          .on("drag", (event, d) => {
            if (!d.isFocal) { d.fx = event.x; d.fy = event.y; }
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            if (!d.isFocal) { d.fx = null; d.fy = null; }
          })
      );
    }

    node.append("circle")
      .attr("r", (d) => d.isFocal ? 28 : 18)
      .attr("fill", (d) => d.journal_color)
      .attr("stroke", (d) => d.isFocal ? "#1F2937" : "white")
      .attr("stroke-width", (d) => d.isFocal ? 3 : 2)
      .attr("opacity", 0.9);

    node.append("text")
      .text((d) => d.journal_abbreviation)
      .attr("text-anchor", "middle").attr("dy", "0.35em")
      .attr("fill", "white").attr("font-size", (d) => d.isFocal ? "9px" : "7px")
      .attr("font-weight", "bold")
      .style("pointer-events", "none");

    // Title labels below nodes
    node.append("text")
      .text((d) => d.title.length > 30 ? d.title.slice(0, 27) + "..." : d.title)
      .attr("text-anchor", "middle").attr("dy", (d) => d.isFocal ? 42 : 30)
      .attr("fill", "currentColor").attr("font-size", "10px")
      .style("pointer-events", "none")
      .attr("class", "text-gray-700 dark:text-gray-300");

    // Tooltip on hover
    if (interactive) {
      node.on("mouseenter", function (event, d) {
        tooltip.style("opacity", 1)
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY - 12 + "px")
          .text(`${d.title}\n${d.journal_abbreviation}`);
      }).on("mouseleave", () => tooltip.style("opacity", 0));
    }

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [focal, nodes, edges, width, height, interactive, navigate]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="rounded-xl bg-gray-50 dark:bg-gray-900/50"
      />
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-[100] max-w-xs whitespace-pre-wrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg opacity-0 transition-opacity dark:bg-gray-700"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/napler/projects/my-allergy && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/graph/paper-connection-graph.tsx
git commit -m "feat: add D3 force-directed paper connection graph component"
```

---

### Task 11: Preview Card + Modal Components

**Files:**
- Create: `src/components/graph/connection-graph-preview.tsx`
- Create: `src/components/graph/connection-graph-modal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
// src/components/graph/connection-graph-modal.tsx
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { PaperConnectionGraph } from "./paper-connection-graph";

interface ConnectionGraphModalProps {
  focal: { pmid: string; title: string; journal_abbreviation: string; journal_color: string };
  nodes: Array<{ pmid: string; title: string; journal_abbreviation: string; journal_color: string; publication_date: string }>;
  edges: Array<{
    source: string; target: string;
    type: "citation" | "mention" | "both";
    direction: "references" | "cited_by" | "bidirectional";
    mentions: Array<{ comment_id: string; anon_id: string; content_snippet: string; created_at: string }>;
  }>;
  onClose: () => void;
}

export function ConnectionGraphModal({ focal, nodes, edges, onClose }: ConnectionGraphModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              Paper Connections
            </h2>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {focal.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Graph */}
        <div className="flex-1 overflow-hidden p-2">
          <PaperConnectionGraph
            focal={focal}
            nodes={nodes}
            edges={edges}
            width={960}
            height={600}
            interactive
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 border-t border-gray-200 px-6 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-gray-400" />
            Citation
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 bg-blue-500" />
            User Mention
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 bg-purple-500" />
            Both
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the preview card component**

```tsx
// src/components/graph/connection-graph-preview.tsx
"use client";

import { useState } from "react";
import useSWR from "swr";
import { Network, Loader2 } from "lucide-react";
import { PaperConnectionGraph } from "./paper-connection-graph";
import { ConnectionGraphModal } from "./connection-graph-modal";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ConnectionsData {
  focal: { pmid: string; title: string; journal_abbreviation: string; journal_color: string };
  nodes: Array<{ pmid: string; title: string; journal_abbreviation: string; journal_color: string; publication_date: string }>;
  edges: Array<{
    source: string; target: string;
    type: "citation" | "mention" | "both";
    direction: "references" | "cited_by" | "bidirectional";
    mentions: Array<{ comment_id: string; anon_id: string; content_snippet: string; created_at: string }>;
  }>;
}

interface ConnectionGraphPreviewProps {
  pmid: string;
}

export function ConnectionGraphPreview({ pmid }: ConnectionGraphPreviewProps) {
  const { data, isLoading } = useSWR<ConnectionsData>(
    `/api/papers/${pmid}/connections`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const [modalOpen, setModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/50">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data || (data.nodes.length === 0 && data.edges.length === 0)) {
    return null; // No connections — hide the card
  }

  const totalConnections = data.edges.length;
  const citationCount = data.edges.filter((e) => e.type === "citation" || e.type === "both").length;
  const mentionCount = data.edges.filter((e) => e.type === "mention" || e.type === "both").length;

  return (
    <>
      <div
        onClick={() => setModalOpen(true)}
        className="cursor-pointer rounded-2xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
      >
        <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <Network className="h-3.5 w-3.5" />
          Connections
        </h2>

        {/* Mini preview graph (non-interactive) */}
        <div className="mb-3 overflow-hidden rounded-lg">
          <PaperConnectionGraph
            focal={data.focal}
            nodes={data.nodes}
            edges={data.edges}
            width={280}
            height={180}
            interactive={false}
          />
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300">
          <span className="font-medium">{totalConnections}</span>개 논문 연결
          {citationCount > 0 && <span className="text-gray-400"> · 인용 {citationCount}</span>}
          {mentionCount > 0 && <span className="text-blue-500"> · 멘션 {mentionCount}</span>}
        </p>
        <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
          클릭하여 확대
        </p>
      </div>

      {modalOpen && (
        <ConnectionGraphModal
          focal={data.focal}
          nodes={data.nodes}
          edges={data.edges}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/napler/projects/my-allergy && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/graph/
git commit -m "feat: add connection graph preview card and fullscreen modal"
```

---

### Task 12: Integrate Preview Into Paper Detail Page

**Files:**
- Modify: `src/app/paper/[pmid]/page.tsx`

- [ ] **Step 1: Add import at top of file**

```typescript
import { ConnectionGraphPreview } from "@/components/graph/connection-graph-preview";
```

- [ ] **Step 2: Add preview card in desktop sidebar**

In the `<aside>` section, add the preview card **before** the existing "Citation Graph (DB 내)" block. Find the `{hasCitations && (` line inside `<aside>` and insert above it:

```tsx
<ConnectionGraphPreview pmid={pmid} />
```

- [ ] **Step 3: Add preview card in mobile section**

In the mobile `<div className="space-y-8 lg:hidden">` section, add the preview card before the citations section. Find the `{hasCitations && (` line inside the mobile section and insert above it:

```tsx
<ConnectionGraphPreview pmid={pmid} />
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/napler/projects/my-allergy && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/paper/[pmid]/page.tsx
git commit -m "feat: add connection graph preview to paper detail page"
```

---

### Task 13: Manual Integration Test

- [ ] **Step 1: Start dev server**

```bash
cd /Users/napler/projects/my-allergy && npm run dev
```

- [ ] **Step 2: Test @ mention flow**

1. Navigate to any paper detail page
2. Log in if not already
3. In comment form, type `@` followed by a search term
4. Verify dropdown appears with bookmarked papers
5. Select a paper — verify `[@title](pmid:XXXX)` is inserted
6. Submit the comment
7. Verify the mention renders as a clickable blue link

- [ ] **Step 3: Test connection graph**

1. On the same paper detail page, check sidebar for "Connections" card
2. If connections exist, verify the mini preview renders
3. Click the card — verify fullscreen modal opens
4. Test zoom/drag/hover interactions in the modal
5. Click a node — verify navigation to that paper
6. Press ESC — verify modal closes

- [ ] **Step 4: Commit any fixes if needed**
