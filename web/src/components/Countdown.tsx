"use client";

import { useEffect, useState } from "react";

export function Countdown({ targetIso }: { targetIso: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000); // 30s tick is enough
    return () => clearInterval(t);
  }, []);

  const target = new Date(targetIso).getTime();
  const diff = target - now;

  if (diff <= 0) return <span>any moment now</span>;

  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);

  if (hours > 0) return <span>in {hours}h {minutes}m</span>;
  if (minutes > 0) return <span>in {minutes}m</span>;
  return <span>in &lt;1m</span>;
}

export function TimeAgo({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const past = new Date(iso).getTime();
  const diff = now - past;

  if (diff < 60_000) return <span>just now</span>;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return <span>{minutes}m ago</span>;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return <span>{hours}h ago</span>;
  const days = Math.floor(hours / 24);
  return <span>{days}d ago</span>;
}
