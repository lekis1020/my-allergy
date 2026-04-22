import { User, Bot } from "lucide-react";
import { ExcalidrawBlock } from "./excalidraw-block";
import { MermaidBlock } from "./mermaid-block";
import type { ChatMessage as ChatMessageType } from "@/types/database";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Extract mermaid code blocks
  const mermaidBlocks: string[] = [];
  const contentWithoutDiagrams = message.content
    .replace(/```mermaid\s*([\s\S]*?)```/g, (_match, code) => {
      mermaidBlocks.push(code.trim());
      return "";
    })
    .replace(/```excalidraw[\s\S]*?```/g, "")
    .trim();

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-blue-100 dark:bg-blue-900/30"
            : "bg-purple-100 dark:bg-purple-900/30"
        }`}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        )}
      </div>
      <div
        className={`min-w-0 max-w-[85%] rounded-xl px-3 py-2 text-sm ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        }`}
      >
        <div
          className="prose prose-sm max-w-none dark:prose-invert [&_table]:text-xs"
          dangerouslySetInnerHTML={{
            __html: simpleMarkdown(contentWithoutDiagrams),
          }}
        />
        {mermaidBlocks.map((code, i) => (
          <MermaidBlock key={i} code={code} />
        ))}
        {message.excalidraw && (
          <ExcalidrawBlock data={message.excalidraw} />
        )}
      </div>
    </div>
  );
}

/** Minimal markdown to HTML (bold, italic, bullets, code) */
function simpleMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*<\/li>)/, "<ul>$1</ul>")
    .replace(/\n/g, "<br>");
}
