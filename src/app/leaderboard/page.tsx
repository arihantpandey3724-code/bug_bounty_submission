"use client";

import React, { useEffect, useState } from "react";
import { Trophy, RefreshCw, Zap, Sparkles, Award, Info } from "lucide-react";

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
      <div className="border border-neutral-200 bg-white p-6 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 text-neutral-900 mb-1">
            <Trophy className="w-6 h-6 text-neutral-800" />
            <h1 className="text-2xl font-bold tracking-tight font-sans">
              Live Leaderboard
            </h1>
          </div>
          <p className="text-sm text-neutral-600 font-sans">
            Current standings for the Entropy 2K26 QA Bug Bounty
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs sm:text-sm font-sans">
          <label className="flex items-center space-x-2 cursor-pointer text-neutral-700">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
            />
            <span>Auto-refresh (10s)</span>
          </label>
          <button
            onClick={fetchLeaderboard}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Milestone Bonus Banner */}
      <div className="p-4 bg-neutral-900 text-white rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-sans text-sm">
        <div className="flex items-center space-x-2">
          <Award className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-amber-400">10-Bug Milestone Bonus (+10 pts):</span>
        </div>
        <div className="text-neutral-300 text-xs sm:text-sm">
          {milestoneWinner ? (
            <span>
              Awarded to <strong className="text-white font-semibold">{milestoneWinner.name}</strong> (First to 10 verified bugs)!
            </span>
          ) : (
            <span className="text-neutral-300">
              Unclaimed — +10 pts to the first team to reach 10 verified bugs!
            </span>
          )}
        </div>
      </div>

      {/* Formal Competition Guidelines & Scoring Notice */}
      <div className="bg-white border border-neutral-200 rounded-lg p-5 sm:p-6 shadow-xs space-y-3 font-sans">
        <div className="flex items-center space-x-2 text-neutral-900 border-b border-neutral-100 pb-3">
          <Info className="w-5 h-5 text-neutral-700 flex-shrink-0" />
          <h2 className="text-sm sm:text-base font-bold tracking-tight">
            Important Scoring Guidelines & Leaderboard Notice
          </h2>
        </div>
        <ul className="text-xs sm:text-sm text-neutral-700 space-y-2.5 list-disc pl-5 leading-relaxed">
          <li>
            <strong>Tentative Standings:</strong> The leaderboard scores and team rankings displayed here are real-time and provisional. As submissions undergo continuous evaluation and manual audit by the judging panel, team scores may be revised upwards or downwards upon final review.
          </li>
          <li>
            <strong>Score Inquiries & Clarifications:</strong> Teams are welcome to approach the judging panel at any time during the event to seek clarification or request an audit on the evaluation status of any submitted bug report.
          </li>
          <li>
            <strong>Zero Negative Marking:</strong> There are no negative score deductions or penalties for filing invalid, duplicated, or rejected reports.
          </li>
          <li>
            <strong>Maximize Your Submissions:</strong> Participants are strongly advised to report every anomaly, defect, or unexpected behavior observed across the application. Submitting as many distinct bug reports as possible significantly maximizes your opportunity to earn base points, capture first-to-find speed bonuses, and unlock the 10-bug milestone award (+10 points).
          </li>
        </ul>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-sans border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/70 text-neutral-600 font-semibold text-xs">
                <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                <th className="py-3.5 px-4">Team</th>
                <th className="py-3.5 px-4 text-center">Verified Bugs</th>
                <th className="py-3.5 px-4 text-center">Speed Bonuses</th>
                <th className="py-3.5 px-4 text-center">Treasures</th>
                <th className="py-3.5 px-4 text-center">Milestone</th>
                <th className="py-3.5 px-4 text-right">Total Points</th>
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
                      className={`hover:bg-neutral-50/80 transition-colors ${
                        isTop1 ? "bg-amber-50/40 font-medium" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-semibold text-neutral-700">
                        {t.rank === 1 ? "🥇 1" : t.rank === 2 ? "🥈 2" : t.rank === 3 ? "🥉 3" : `#${t.rank}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-neutral-900">{t.name}</div>
                        <div className="text-xs text-neutral-500">{t.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium text-neutral-800">
                        {t.validBugsCount}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {t.speedBonusCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            ⚡ {t.speedBonusCount}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {t.treasuresClaimedCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            ★ {t.treasuresClaimedCount}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {t.hasMilestoneBonus ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            ✓ +10 pts
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-neutral-900 text-base">
                        {t.totalScore} pts
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3.5 bg-neutral-50/70 border-t border-neutral-100 flex items-center justify-between text-xs font-sans text-neutral-500">
          <span>Tie-breaker: Highest valid bug count, followed by earliest submission time.</span>
          <span>Last refreshed: {lastUpdated || "Live"}</span>
        </div>
      </div>
    </div>
  );
}
