import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type User = {
  id: string;
  email_confirmed_at: string | null;
};

interface MockState {
  user: User | null;
  papers: Array<{ pmid: string }>;
  comments: Array<{
    id: string;
    paper_pmid: string;
    user_id: string | null;
    parent_id: string | null;
    anon_id: string;
    content: string;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  insertError?: { message: string } | null;
}

const state: MockState = {
  user: null,
  papers: [],
  comments: [],
  insertError: null,
};

function resetState(): void {
  state.user = null;
  state.papers = [];
  state.comments = [];
  state.insertError = null;
}

function makeSelectBuilder(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  const chain = (fn: (input: unknown) => unknown[] | unknown) => {
    return (...args: unknown[]) => {
      const next = fn(args);
      if (Array.isArray(next)) {
        rows = next;
      }
      return builder;
    };
  };
  builder.select = chain(() => rows);
  builder.eq = chain((args: unknown) => {
    const [col, val] = args as [string, unknown];
    return (rows as Record<string, unknown>[]).filter((r) => r[col] === val);
  });
  builder.is = chain((args: unknown) => {
    const [col, val] = args as [string, unknown];
    return (rows as Record<string, unknown>[]).filter((r) => r[col] === val);
  });
  builder.in = chain((args: unknown) => {
    const [col, vals] = args as [string, unknown[]];
    return (rows as Record<string, unknown>[]).filter((r) =>
      vals.includes(r[col])
    );
  });
  builder.neq = chain((args: unknown) => {
    const [col, val] = args as [string, unknown];
    return (rows as Record<string, unknown>[]).filter((r) => r[col] !== val);
  });
  builder.gt = chain(() => rows);
  builder.order = chain(() => rows);
  builder.limit = chain(() => rows);
  builder.single = vi.fn(async () => {
    if (rows.length === 0) return { data: null, error: { message: "not found" } };
    return { data: rows[0], error: null };
  });
  builder.then = (resolve: (v: unknown) => void) =>
    resolve({ data: rows, error: null });
  return builder;
}

function mockSupabaseFrom(table: string) {
  if (table === "papers") {
    return makeSelectBuilder(state.papers);
  }
  if (table === "paper_comments") {
    const builder = makeSelectBuilder(state.comments) as Record<string, unknown>;
    builder.insert = (row: Record<string, unknown>) => {
      if (state.insertError) {
        return {
          select: () => ({
            single: async () => ({ data: null, error: state.insertError }),
          }),
        };
      }
      const now = new Date().toISOString();
      const full = {
        id: `c-${state.comments.length + 1}`,
        deleted_at: null,
        created_at: now,
        updated_at: now,
        ...row,
      };
      state.comments.push(full as MockState["comments"][number]);
      return {
        select: () => ({
          single: async () => ({ data: full, error: null }),
        }),
      };
    };
    return builder;
  }
  throw new Error(`unexpected table: ${table}`);
}

vi.mock("@/lib/supabase/server", () => ({
  createServerAuthClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.user },
        error: null,
      }),
    },
    from: (table: string) => mockSupabaseFrom(table),
  }),
}));

const { limiterCounts } = vi.hoisted(() => ({
  limiterCounts: new Map<string, number>(),
}));

vi.mock("@/lib/comments/rate-limit", () => ({
  commentWriteLimiter: {
    check: (key: string) => {
      const n = (limiterCounts.get(key) ?? 0) + 1;
      limiterCounts.set(key, n);
      return {
        success: n <= 5,
        remaining: Math.max(0, 5 - n),
        resetAt: Date.now() + 60_000,
      };
    },
  },
}));

const CONFIRMED_USER: User = {
  id: "11111111-1111-1111-1111-111111111111",
  email_confirmed_at: "2026-01-01T00:00:00Z",
};

const UNCONFIRMED_USER: User = {
  id: "22222222-2222-2222-2222-222222222222",
  email_confirmed_at: null,
};

async function loadRoute() {
  return await import("../route");
}

function req(body: unknown): Request {
  return new Request("http://localhost/api/papers/999/comments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(pmid: string) {
  return { params: Promise.resolve({ pmid }) };
}

beforeEach(() => {
  resetState();
  limiterCounts.clear();
  process.env.COMMUNITY_SALT = "test-salt";
  state.papers = [{ pmid: "999" }];
});

afterEach(() => {
  vi.resetModules();
});

describe("POST /api/papers/[pmid]/comments", () => {
  it("rejects unauthenticated users with 401", async () => {
    const { POST } = await loadRoute();
    state.user = null;
    const res = await POST(
      req({ content: "hello" }) as never,
      params("999") as never
    );
    expect(res.status).toBe(401);
  });

  it("rejects users without confirmed email with 403", async () => {
    const { POST } = await loadRoute();
    state.user = UNCONFIRMED_USER;
    const res = await POST(
      req({ content: "hello" }) as never,
      params("999") as never
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/verification/i);
  });

  it("rejects empty content with 400", async () => {
    const { POST } = await loadRoute();
    state.user = CONFIRMED_USER;
    const res = await POST(req({ content: "   " }) as never, params("999") as never);
    expect(res.status).toBe(400);
  });

  it("creates a root comment with a deterministic anon_id", async () => {
    const { POST } = await loadRoute();
    state.user = CONFIRMED_USER;
    const res = await POST(
      req({ content: "nice paper" }) as never,
      params("999") as never
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.comment.content).toBe("nice paper");
    expect(body.comment.anon_id).toMatch(/^[0-9a-f]{6}$/);
    expect(body.comment.parent_id).toBeNull();
  });

  it("forbids reply-to-reply (2nd-level nesting)", async () => {
    const { POST } = await loadRoute();
    state.user = CONFIRMED_USER;

    // Insert a root (parent_id=null) and a reply (parent_id=root) directly.
    const now = new Date().toISOString();
    state.comments.push({
      id: "root-1",
      paper_pmid: "999",
      user_id: CONFIRMED_USER.id,
      parent_id: null,
      anon_id: "aaaaaa",
      content: "root",
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });
    state.comments.push({
      id: "reply-1",
      paper_pmid: "999",
      user_id: CONFIRMED_USER.id,
      parent_id: "root-1",
      anon_id: "bbbbbb",
      content: "reply",
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });

    const res = await POST(
      req({ content: "nope", parent_id: "reply-1" }) as never,
      params("999") as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/replies to replies/i);
  });

  it("enforces the per-user rate limit (5/min)", async () => {
    const { POST } = await loadRoute();
    state.user = CONFIRMED_USER;

    for (let i = 0; i < 5; i++) {
      const ok = await POST(
        req({ content: `msg ${i}` }) as never,
        params("999") as never
      );
      expect(ok.status).toBe(201);
    }
    const limited = await POST(
      req({ content: "one too many" }) as never,
      params("999") as never
    );
    expect(limited.status).toBe(429);
  });
});

describe("GET /api/papers/[pmid]/comments", () => {
  it("returns the thread grouped by parent_id", async () => {
    const { GET } = await loadRoute();
    const now = new Date().toISOString();
    state.comments.push({
      id: "r1",
      paper_pmid: "999",
      user_id: "u1",
      parent_id: null,
      anon_id: "aaaaaa",
      content: "root",
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });
    state.comments.push({
      id: "r2",
      paper_pmid: "999",
      user_id: "u2",
      parent_id: "r1",
      anon_id: "bbbbbb",
      content: "reply",
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });

    const res = await GET(
      new Request("http://localhost/api/papers/999/comments") as never,
      params("999") as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thread).toHaveLength(1);
    expect(body.thread[0].id).toBe("r1");
    expect(body.thread[0].children).toHaveLength(1);
    expect(body.thread[0].children[0].id).toBe("r2");
  });
});
