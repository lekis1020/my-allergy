import { describe, it, expect } from "vitest";
import { buildNotificationRows } from "@/lib/notifications/generate";

describe("buildNotificationRows", () => {
  const commentAuthorId = "user-author";
  const pmid = "12345678";
  const commentId = "comment-1";

  it("creates bookmark_comment for users who bookmarked the paper", () => {
    const bookmarkUserIds = ["user-a", "user-b"];
    const commentUserIds: string[] = [];

    const rows = buildNotificationRows({
      commentAuthorId,
      commentId,
      pmid,
      bookmarkUserIds,
      commentUserIds,
    });

    expect(rows).toEqual([
      { user_id: "user-a", paper_pmid: pmid, comment_id: commentId, type: "bookmark_comment" },
      { user_id: "user-b", paper_pmid: pmid, comment_id: commentId, type: "bookmark_comment" },
    ]);
  });

  it("creates thread_comment for users who commented on the paper", () => {
    const bookmarkUserIds: string[] = [];
    const commentUserIds = ["user-c", "user-d"];

    const rows = buildNotificationRows({
      commentAuthorId,
      commentId,
      pmid,
      bookmarkUserIds,
      commentUserIds,
    });

    expect(rows).toEqual([
      { user_id: "user-c", paper_pmid: pmid, comment_id: commentId, type: "thread_comment" },
      { user_id: "user-d", paper_pmid: pmid, comment_id: commentId, type: "thread_comment" },
    ]);
  });

  it("excludes the comment author from notifications", () => {
    const bookmarkUserIds = [commentAuthorId, "user-a"];
    const commentUserIds = [commentAuthorId, "user-b"];

    const rows = buildNotificationRows({
      commentAuthorId,
      commentId,
      pmid,
      bookmarkUserIds,
      commentUserIds,
    });

    expect(rows).toEqual([
      { user_id: "user-a", paper_pmid: pmid, comment_id: commentId, type: "bookmark_comment" },
      { user_id: "user-b", paper_pmid: pmid, comment_id: commentId, type: "thread_comment" },
    ]);
  });

  it("bookmark_comment takes priority over thread_comment for same user", () => {
    const bookmarkUserIds = ["user-a"];
    const commentUserIds = ["user-a", "user-b"];

    const rows = buildNotificationRows({
      commentAuthorId,
      commentId,
      pmid,
      bookmarkUserIds,
      commentUserIds,
    });

    expect(rows).toEqual([
      { user_id: "user-a", paper_pmid: pmid, comment_id: commentId, type: "bookmark_comment" },
      { user_id: "user-b", paper_pmid: pmid, comment_id: commentId, type: "thread_comment" },
    ]);
  });

  it("returns empty array when no recipients", () => {
    const rows = buildNotificationRows({
      commentAuthorId,
      commentId,
      pmid,
      bookmarkUserIds: [],
      commentUserIds: [],
    });

    expect(rows).toEqual([]);
  });

  it("returns empty array when only the author bookmarked/commented", () => {
    const rows = buildNotificationRows({
      commentAuthorId,
      commentId,
      pmid,
      bookmarkUserIds: [commentAuthorId],
      commentUserIds: [commentAuthorId],
    });

    expect(rows).toEqual([]);
  });
});
