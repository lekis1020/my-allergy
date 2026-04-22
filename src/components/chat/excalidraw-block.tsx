"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2, Loader2 } from "lucide-react";
import "@excalidraw/excalidraw/dist/prod/index.css";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => ({ default: mod.Excalidraw })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    ),
  }
);

interface ExcalidrawBlockProps {
  data: { elements: unknown[] };
}

export function ExcalidrawBlock({ data }: ExcalidrawBlockProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const viewer = (
    <Excalidraw
      initialData={{ elements: data.elements as any, scrollToContent: true }}
      viewModeEnabled={!fullscreen}
      UIOptions={{
        canvasActions: {
          export: false,
          loadScene: false,
          saveToActiveFile: false,
        },
      }}
    />
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950">
        <button
          onClick={() => setFullscreen(false)}
          className="absolute right-4 top-4 z-50 rounded-lg bg-gray-100 p-2 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <Minimize2 className="h-5 w-5" />
        </button>
        <div className="h-full w-full">{viewer}</div>
      </div>
    );
  }

  return (
    <div className="relative mt-2 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="h-64">{viewer}</div>
      <button
        onClick={() => setFullscreen(true)}
        className="absolute right-2 top-2 rounded-md bg-white/80 p-1.5 text-gray-600 hover:bg-white dark:bg-gray-900/80 dark:text-gray-400 dark:hover:bg-gray-900"
        title="전체화면 편집"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
}
