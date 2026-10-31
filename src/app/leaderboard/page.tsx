"use client";

import React, { useEffect, useState } from "react";
import {
  Trophy,
  RefreshCw,
  Zap,
  Sparkles,
  Award,
  Info,
  Target,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

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
    window.addEventListener("focus", fetchLeaderboard);
    if (!autoRefresh) return () => window.removeEventListener("focus", fetchLeaderboard);
    const interval = setInterval(fetchLeaderboard, 8000);
    return () => {
      window.removeEventListener("focus", fetchLeaderboard);
      clearInterval(interval);
    };
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

      {/* Primary Focus: Live Leaderboard Table */}
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

      {/* Official Rule Book & Competition Guidelines (Positioned Below Leaderboard) */}
      <div className="space-y-4 pt-2 font-sans">
        {/* Section Header */}
        <div className="flex items-center space-x-2 text-neutral-900">
          <Info className="w-5 h-5 text-neutral-700 flex-shrink-0" />
          <h2 className="text-base font-bold tracking-tight">
            Official Event Guidelines & Rule Book
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Official Scoring Matrix (Rule 3.2 & 3.4) */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-neutral-900 border-b border-neutral-100 pb-2">
              <Target className="w-4 h-4 text-neutral-700" />
              <h3 className="text-sm font-bold">1. Official Scoring Matrix (Rule 3.2)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
                    <th className="py-1.5 px-2">Tier</th>
                    <th className="py-1.5 px-2">Base</th>
                    <th className="py-1.5 px-2">First-to-Find</th>
                    <th className="py-1.5 px-2">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-800">
                  <tr>
                    <td className="py-1.5 px-2 font-semibold text-emerald-700">Easy Bugs</td>
                    <td className="py-1.5 px-2">3 pts</td>
                    <td className="py-1.5 px-2 text-amber-700 font-medium">+2 pts</td>
                    <td className="py-1.5 px-2 font-semibold">5 pts</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 font-semibold text-amber-700">Medium Bugs</td>
                    <td className="py-1.5 px-2">5 pts</td>
                    <td className="py-1.5 px-2 text-amber-700 font-medium">+5 pts</td>
                    <td className="py-1.5 px-2 font-semibold">10 pts</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 font-semibold text-rose-700">Hard Bugs</td>
                    <td className="py-1.5 px-2">10 pts</td>
                    <td className="py-1.5 px-2 text-amber-700 font-medium">+10 pts</td>
                    <td className="py-1.5 px-2 font-semibold">20 pts</td>
                  </tr>
                  <tr className="bg-amber-50/50">
                    <td className="py-1.5 px-2 font-semibold text-amber-900">Treasure Flags (10)</td>
                    <td className="py-1.5 px-2 font-medium" colSpan={2}>Flat 10 pts • Rule of One</td>
                    <td className="py-1.5 px-2 font-semibold">10 pts</td>
                  </tr>
                  <tr className="bg-neutral-50">
                    <td className="py-1.5 px-2 font-semibold text-neutral-900">Milestone Award</td>
                    <td className="py-1.5 px-2 font-medium" colSpan={2}>First team to 10 valid bugs</td>
                    <td className="py-1.5 px-2 font-semibold">+10 pts</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-neutral-500 leading-normal">
              * The first team to submit a valid report for any regular bug captures the First-to-Find Speed Bonus.
            </p>
          </div>

          {/* Card 2: Submission Proof Requirements & Judging Criteria (Rule 3.3 & 4.1) */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-neutral-900 border-b border-neutral-100 pb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-bold">2. Proof & Evaluation Criteria (Rule 4.1)</h3>
            </div>
            <ul className="text-xs text-neutral-700 space-y-2 list-disc pl-4 leading-relaxed">
              <li>
                <strong>Evidence Required (Rule 3.3):</strong> Submissions should include a screenshot (SS) showing the defect, a code/inspector snippet, and step-by-step reproduction instructions.
              </li>
              <li>
                <strong>Validity:</strong> The issue must be a genuine defect within the mock e-commerce store and within competition scope.
              </li>
              <li>
                <strong>Reproducibility:</strong> The judging panel must be able to independently reproduce the issue following your submitted steps.
              </li>
              <li>
                <strong>Tentative Standings:</strong> Leaderboard scores are real-time and provisional. As submissions undergo continuous verification and audit, scores may be adjusted upwards or downwards upon final review.
              </li>
            </ul>
          </div>
        </div>

        {/* Card 3: Code of Conduct, Rules & Scoring Clarifications (Rule 4.2) */}
        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-neutral-900 border-b border-neutral-100 pb-2">
            <ShieldCheck className="w-4 h-4 text-neutral-700" />
            <h3 className="text-sm font-bold">3. Competition Rules & Code of Conduct (Rule 4.2)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-neutral-700 leading-relaxed">
            <div>
              <span className="font-semibold text-emerald-800 block mb-1">✓ Permitted & Recommended:</span>
              <ul className="space-y-1.5 list-disc pl-4">
                <li>
                  <strong>Zero Negative Marking:</strong> There are no point deductions or penalties for filing invalid, duplicate, or rejected reports.
                </li>
                <li>
                  <strong>Maximize Submissions:</strong> Report every potential bug found to maximize your chances of securing base points, speed bonuses, and the milestone award.
                </li>
                <li>
                  <strong>Score Clarifications:</strong> Teams are welcome to approach the judging panel at any time during the event to request review or clarification on any submission.
                </li>
                <li>
                  <strong>Team Collaboration:</strong> Full collaboration within your registered team members is permitted.
                </li>
              </ul>
            </div>

            <div>
              <span className="font-semibold text-rose-800 block mb-1">✕ Prohibited Actions:</span>
              <ul className="space-y-1.5 list-disc pl-4">
                <li>
                  <strong>Manual Testing Only:</strong> Do not use automated vulnerability scanners, fuzzers, or brute-force tools.
                </li>
                <li>
                  <strong>No Disruptive Attacks:</strong> Do not attempt Denial of Service (DoS) attacks, flood requests, or intentionally crash the server.
                </li>
                <li>
                  <strong>No Cross-Team Sharing:</strong> Do not share bug details or flag tokens with competing teams.
                </li>
                <li>
                  <strong>Scope Limit:</strong> Only the provided mock e-commerce store is in-scope.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
