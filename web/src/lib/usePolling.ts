"use client";

import { useEffect, useState } from "react";

/**
 * Tiny polling hook. Fetches `url` every `intervalMs`. Returns the latest data.
 */
export function usePolling<T>(url: string, intervalMs: number, initial?: T): T | null {
  const [data, setData] = useState<T | null>(initial ?? null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchOnce = async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return;
        const json = await r.json();
        if (!cancelled) setData(json);
      } catch {
        // ignore
      }
    };

    void fetchOnce();
    timer = setInterval(fetchOnce, intervalMs);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [url, intervalMs]);

  return data;
}
