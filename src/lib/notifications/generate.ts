interface NotificationRow {
  user_id: string;
  paper_pmid: string;
  comment_id: string;
  type: "bookmark_comment" | "thread_comment";
}

interface BuildNotificationRowsInput {
  commentAuthorId: string;
  commentId: string;
  pmid: string;
  bookmarkUserIds: string[];
  commentUserIds: string[];
}

/**
 * Build notification rows for a new comment.
 * - bookmark_comment: user bookmarked the paper
 * - thread_comment: user previously commented on the paper
 * - bookmark_comment takes priority (no duplicate for same user)
 * - comment author is excluded
 */
export function buildNotificationRows(
  input: BuildNotificationRowsInput
): NotificationRow[] {
  const { commentAuthorId, commentId, pmid, bookmarkUserIds, commentUserIds } =
    input;
  const rows: NotificationRow[] = [];
  const notified = new Set<string>();

  // bookmark_comment first (higher priority)
  for (const userId of bookmarkUserIds) {
    if (userId === commentAuthorId) continue;
    if (notified.has(userId)) continue;
    rows.push({
      user_id: userId,
      paper_pmid: pmid,
      comment_id: commentId,
      type: "bookmark_comment",
    });
    notified.add(userId);
  }

  // thread_comment for remaining users
  for (const userId of commentUserIds) {
    if (userId === commentAuthorId) continue;
    if (notified.has(userId)) continue;
    rows.push({
      user_id: userId,
      paper_pmid: pmid,
      comment_id: commentId,
      type: "thread_comment",
    });
    notified.add(userId);
  }

  return rows;
}
