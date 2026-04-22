"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2, Loader2 } from "lucide-react";
import "@excalidraw/excalidraw/index.css";

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

const LOAD_TIMEOUT_MS = 8000;

interface ExcalidrawBlockProps {
  data: { elements: unknown[] };
}

export function ExcalidrawBlock({ data }: ExcalidrawBlockProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  if (timedOut) {
    return (
      <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        도식화를 불러올 수 없습니다. 새 대화에서 다시 요청해주세요.
      </div>
    );
  }

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
