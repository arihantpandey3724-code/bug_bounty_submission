"use client";

import React, { useEffect, useState } from "react";

interface LiveMetricsProps {
  initialTotal: number;
  initialVerified: number;
  initialRemaining: number;
  initialTopTeam: string;
  initialTopScore: number;
}

export default function LiveMetricsGrid({
  initialTotal,
  initialVerified,
  initialRemaining,
  initialTopTeam,
  initialTopScore,
}: LiveMetricsProps) {
  const [totalSubmissions, setTotalSubmissions] = useState(initialTotal);
  const [verifiedSubmissions, setVerifiedSubmissions] = useState(initialVerified);
  const [remainingTreasures, setRemainingTreasures] = useState(initialRemaining);
  const [topTeam, setTopTeam] = useState(initialTopTeam);
  const [topScore, setTopScore] = useState(initialTopScore);

  async function fetchLiveMetrics() {
    try {
      const res = await fetch(`/api/stats?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTotalSubmissions(data.totalSubmissions);
        setVerifiedSubmissions(data.verifiedSubmissions);
        setRemainingTreasures(data.remainingTreasures);
        setTopTeam(data.topTeam);
        setTopScore(data.topScore);
      }
    } catch {
      // Quiet failover: keep current display if network blip
    }
  }

  useEffect(() => {
    fetchLiveMetrics();
    const interval = setInterval(fetchLiveMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-neutral-100">
      <div className="p-4 bg-neutral-50/70 border border-neutral-200/80 rounded-md">
        <span className="text-xs text-neutral-500 font-sans font-medium block">
          Reports Filed
        </span>
        <span className="text-2xl font-bold text-neutral-900 mt-1 block font-sans">
          {totalSubmissions}
        </span>
      </div>

      <div className="p-4 bg-neutral-50/70 border border-neutral-200/80 rounded-md">
        <span className="text-xs text-neutral-500 font-sans font-medium block">
          Verified Bugs
        </span>
        <span className="text-2xl font-bold text-emerald-700 mt-1 block font-sans">
          {verifiedSubmissions}
        </span>
      </div>

      <div className="p-4 bg-neutral-50/70 border border-neutral-200/80 rounded-md">
        <span className="text-xs text-neutral-500 font-sans font-medium block">
          Treasures Left
        </span>
        <span className="text-2xl font-bold text-amber-700 mt-1 block font-sans">
          {remainingTreasures} <span className="text-sm text-neutral-400 font-normal">/ 10</span>
        </span>
      </div>

      <div className="p-4 bg-neutral-50/70 border border-neutral-200/80 rounded-md">
        <span className="text-xs text-neutral-500 font-sans font-medium block">
          Current Leader
        </span>
        <span className="text-base font-semibold text-neutral-900 mt-1 truncate block font-sans">
          {topTeam} {topScore > 0 ? `(${topScore} pts)` : ""}
        </span>
      </div>
    </div>
  );
}
