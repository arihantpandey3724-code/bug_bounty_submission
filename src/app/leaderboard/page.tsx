"use client";

import React, { useEffect, useState } from "react";
import { Trophy, RefreshCw, Zap, Sparkles, Award } from "lucide-react";

interface LeaderboardTeam {
  rank: number;
  id: string;
  name: string;
  email: string;
  totalScore: number;
  validBugsCount: number;
  hasMilestoneBonus: boolean;
  speedBonusCount: number;
  treasuresClaimedCount: number;
}

export default function LeaderboardPage() {
  const [teams, setTeams] = useState<LeaderboardTeam[]>([]);
  const [milestoneTeam, setMilestoneTeam] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function fetchLeaderboard() {
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setTeams(data.leaderboard || []);
        setMilestoneTeam(data.milestoneBonusClaimedBy);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.warn("Failed to load leaderboard:", err);
    }
  }

  useEffect(() => {
    fetchLeaderboard();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const milestoneWinner = teams.find((t) => t.id === milestoneTeam);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="border border-neutral-200 bg-white p-6 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 text-neutral-900 mb-1">
            <Trophy className="w-6 h-6" />
            <h1 className="text-2xl font-bold tracking-tight font-sans">
              Live Leaderboard
            </h1>
          </div>
          <p className="text-sm text-neutral-600 font-mono">
            Entropy 2K26 E-Commerce Bug Bounty Standings
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs sm:text-sm font-mono">
          <label className="flex items-center space-x-2 cursor-pointer text-neutral-700">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded-sm border-neutral-300 text-neutral-900 focus:ring-0"
            />
            <span>Auto-sync (10s)</span>
          </label>
          <button
            onClick={fetchLeaderboard}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-sm font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      {/* Milestone Bonus Banner */}
      <div className="p-4 bg-neutral-900 text-white rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-sm">
        <div className="flex items-center space-x-2">
          <Award className="w-5 h-5 text-amber-400" />
          <span className="font-bold">10-BUG MILESTONE BONUS (+10 PTS):</span>
        </div>
        <div className="text-neutral-300 text-xs sm:text-sm">
          {milestoneWinner ? (
            <span>
              Awarded to <strong className="text-white uppercase">{milestoneWinner.name}</strong> (First to 10 verified bugs)!
            </span>
          ) : (
            <span className="text-amber-400 font-bold">
              UNCLAIMED — +10 pts to the first team to reach 10 verified bugs!
            </span>
          )}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white border border-neutral-200 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-mono border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-bold">
                <th className="py-3.5 px-4 w-16 text-center">RANK</th>
                <th className="py-3.5 px-4">TEAM NAME</th>
                <th className="py-3.5 px-4 text-center">VALID BUGS</th>
                <th className="py-3.5 px-4 text-center">SPEED BONUSES</th>
                <th className="py-3.5 px-4 text-center">TREASURES</th>
                <th className="py-3.5 px-4 text-center">MILESTONE</th>
                <th className="py-3.5 px-4 text-right">TOTAL POINTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-900">
              {teams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400">
                    No teams have registered or scored yet.
                  </td>
                </tr>
              ) : (
                teams.map((t) => {
                  const isTop1 = t.rank === 1;
                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-neutral-50 transition-colors ${
                        isTop1 ? "bg-amber-50/30 font-semibold" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block w-7 h-7 leading-7 text-center rounded-sm font-bold text-sm ${
                            t.rank === 1
                              ? "bg-amber-400 text-neutral-950 font-extrabold"
                              : t.rank === 2
                              ? "bg-neutral-300 text-neutral-900"
                              : t.rank === 3
                              ? "bg-amber-700 text-white"
                              : "text-neutral-500"
                          }`}
                        >
                          {t.rank}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-sans font-bold text-neutral-900 text-base">
                        <div className="flex items-center space-x-2">
                          <span className="uppercase">{t.name}</span>
                          {t.hasMilestoneBonus && (
                            <span title="10-Bug Milestone Bonus Winner">
                              <Award className="w-4 h-4 text-amber-500" />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center text-neutral-800 font-bold">
                        {t.validBugsCount}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {t.speedBonusCount > 0 ? (
                          <span className="inline-flex items-center space-x-1 text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                            <span>{t.speedBonusCount}</span>
                          </span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {t.treasuresClaimedCount > 0 ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-800 font-bold bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{t.treasuresClaimedCount}</span>
                          </span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {t.hasMilestoneBonus ? (
                          <span className="px-2.5 py-1 bg-neutral-900 text-amber-400 font-bold rounded-sm text-xs">
                            +10 PTS
                          </span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-black text-base text-neutral-900">
                        {t.totalScore} <span className="text-xs text-neutral-400 font-normal">PTS</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-xs font-mono text-neutral-400">
          <span>TIE-BREAKER: VALID BUGS COUNT, THEN SUBMISSION TIMESTAMP</span>
          <span>LAST SYNCED: {lastUpdated || "Live"}</span>
        </div>
      </div>
    </div>
  );
}
