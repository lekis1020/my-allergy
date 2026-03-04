"use client";

import type { AuthorLocationPoint } from "@/lib/utils/author-location";

interface AuthorWorldMapProps {
  points: AuthorLocationPoint[];
}

export function AuthorWorldMap({ points }: AuthorWorldMapProps) {
  const maxCount = Math.max(...points.map((point) => point.count), 1);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="relative aspect-[950/620] w-full">
        <img
          src="/world-map.svg"
          alt="World map"
          className="h-full w-full object-cover opacity-95 dark:opacity-80"
        />

        {points.map((point) => {
          const position = projectToMap(point.lat, point.lon);
          const size = 10 + Math.round((point.count / maxCount) * 10);

          return (
            <div
              key={`${point.location}-${point.count}`}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
            >
              <div
                className="rounded-full border-2 border-white bg-blue-500/80 shadow-md dark:border-gray-900 dark:bg-blue-400/85"
                style={{ width: `${size}px`, height: `${size}px` }}
              />
              <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white group-hover:block dark:bg-gray-100 dark:text-gray-900">
                {point.location} · {point.count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function projectToMap(lat: number, lon: number): { x: number; y: number } {
  // Approximate equirectangular projection for this static world SVG.
  const x = ((lon + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return {
    x: clamp(x, 1, 99),
    y: clamp(y, 1, 99),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
