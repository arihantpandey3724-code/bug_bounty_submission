"use client";

import React, { useEffect, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { Sparkles, CheckCircle, AlertCircle, RefreshCw, KeyRound } from "lucide-react";

interface TreasureItem {
  id: number;
  code: string;
  isClaimed: boolean;
  claimedAt: string | null;
  claimedByTeam: { id: string; name: string } | null;
}

export default function TreasuresPage() {
  const { team, setIsAuthModalOpen, refreshTeam } = useTeam();
  const [treasures, setTreasures] = useState<TreasureItem[]>([]);
  const [totalCount, setTotalCount] = useState(10);
  const [remainingCount, setRemainingCount] = useState(10);
  const [flagCode, setFlagCode] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function fetchTreasures() {
    try {
      const res = await fetch("/api/treasures");
      if (res.ok) {
        const data = await res.json();
        setTreasures(data.treasures || []);
        setTotalCount(data.total || 10);
        setRemainingCount(data.remainingCount !== undefined ? data.remainingCount : 10);
      }
    } catch (err) {
      console.warn("Failed to fetch treasure bugs:", err);
    }
  }

  useEffect(() => {
    fetchTreasures();
    const interval = setInterval(fetchTreasures, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!team) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!flagCode.trim()) return;

    setIsClaiming(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/treasures/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          code: flagCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to redeem flag code");
      }

      setSuccessMsg(data.message || `Treasure Bug claimed! +10 Points awarded!`);
      setFlagCode("");
      await fetchTreasures();
      await refreshTeam();
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while redeeming flag.");
    } finally {
      setIsClaiming(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header & Live Tracker */}
      <div className="border border-neutral-200 bg-white p-6 sm:p-8 rounded-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <div className="flex items-center space-x-2 text-amber-700 mb-1">
              <Sparkles className="w-6 h-6" />
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 font-sans">
                Treasure Bug Vault
              </h1>
            </div>
            <p className="text-sm text-neutral-600 font-sans">
              10 exclusive flags. Each can only be captured once. Flat 10 points per flag.
            </p>
          </div>

          <button
            onClick={fetchTreasures}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-mono font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-sm self-start"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>SYNC TRACKER</span>
          </button>
        </div>

        {/* Live Countdown Display */}
        <div className="mt-6 p-6 bg-neutral-950 text-white rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono">
          <div>
            <span className="text-xs text-neutral-400 tracking-wider uppercase block font-bold">
              TREASURE BUGS REMAINING
            </span>
            <div className="flex items-baseline space-x-3 mt-1.5">
              <span className="text-4xl sm:text-5xl font-black text-amber-400">
                {remainingCount}
              </span>
              <span className="text-base text-neutral-400">/ {totalCount} UNCLAIMED</span>
            </div>
          </div>

          <div className="text-right text-sm text-neutral-300 space-y-1">
            <div className="font-bold text-amber-400">+10 POINTS PER FLAG</div>
            <div className="text-xs text-neutral-400">First team to submit captures it</div>
          </div>
        </div>
      </div>

      {/* Flag Redemption Box */}
      <div className="bg-white border border-neutral-200 rounded-md p-6 sm:p-8">
        <div className="flex items-center space-x-2 mb-3">
          <KeyRound className="w-5 h-5 text-neutral-800" />
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-neutral-900">
            Redeem Flag Code
          </h2>
        </div>

        {successMsg && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-mono rounded-sm flex items-center space-x-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-300 text-rose-800 text-sm font-mono rounded-sm flex items-center space-x-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleClaim} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            required
            placeholder="FLAG{enter_secret_flag_here}"
            value={flagCode}
            onChange={(e) => setFlagCode(e.target.value)}
            className="flex-1 px-4 py-3 text-sm sm:text-base font-mono bg-neutral-50 border border-neutral-300 rounded-sm focus:outline-none focus:border-neutral-900 uppercase"
          />
          <button
            type="submit"
            disabled={isClaiming || !flagCode.trim()}
            className="px-6 py-3 text-sm font-mono font-bold tracking-wider uppercase text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 rounded-sm transition-colors whitespace-nowrap shadow-sm"
          >
            {isClaiming ? "VERIFYING..." : "REDEEM FLAG"}
          </button>
        </form>
      </div>

      {/* Grid of 10 Treasure Bug Slots */}
      <div className="bg-white border border-neutral-200 rounded-md p-6 sm:p-8">
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-neutral-900 mb-4">
          All 10 Treasure Bug Slots
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {treasures.map((t) => (
            <div
              key={t.id}
              className={`p-4 border rounded-sm font-mono text-sm flex flex-col justify-between transition-colors ${
                t.isClaimed
                  ? "bg-neutral-50 border-neutral-200 opacity-80"
                  : "bg-white border-amber-300 hover:border-amber-400"
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-extrabold text-neutral-900">
                  TREASURE #{t.id.toString().padStart(2, "0")}
                </span>
                {t.isClaimed ? (
                  <span className="px-2.5 py-0.5 bg-neutral-200 text-neutral-700 text-xs font-bold rounded-sm">
                    CLAIMED
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-xs font-bold rounded-sm">
                    AVAILABLE • 10 PTS
                  </span>
                )}
              </div>

              <div className="text-xs text-neutral-500 pt-2 border-t border-neutral-100 flex items-center justify-between">
                <span>
                  {t.isClaimed
                    ? `Captured by: ${t.claimedByTeam?.name || "Team"}`
                    : "Not yet claimed"}
                </span>
                {t.claimedAt && (
                  <span className="text-neutral-400">
                    {new Date(t.claimedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
