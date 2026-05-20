"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Counts how many browser tabs are currently joined to the global "online"
 * Supabase Realtime presence channel. Each invocation tracks the current tab
 * with a freshly-generated presence key (per-tab, not per-user), so a user
 * with three tabs open is counted three times — which matches what the
 * right-rail label implies ("N명 접속 중").
 *
 * No DB writes, no migration. Presence state is ephemeral and cleaned up
 * automatically on channel unsubscribe.
 */
export function useOnlineCount(): { count: number; ready: boolean } {
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Per-tab presence key — keeps refresh/multi-tab counts honest.
    const key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const channel = supabase.channel("presence:home", {
      config: { presence: { key } },
    });

    const recompute = () => {
      const state = channel.presenceState();
      setCount(Object.keys(state).length);
      setReady(true);
    };

    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Fire-and-forget — track failures are not fatal for the counter.
          void channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      void channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, []);

  return { count, ready };
}
