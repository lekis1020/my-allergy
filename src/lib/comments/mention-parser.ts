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
