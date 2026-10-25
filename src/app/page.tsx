import Link from "next/link";
import prisma from "@/lib/prisma";
import localStore from "@/lib/localStore";
import { Bug, Sparkles, Trophy, ListChecks, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let totalSubmissions = 0;
  let verifiedSubmissions = 0;
  let remainingTreasures = 10;
  let topTeam = "None yet";
  let topScore = 0;

  try {
    totalSubmissions = await prisma.regularSubmission.count();
    verifiedSubmissions = await prisma.regularSubmission.count({
      where: { status: "VERIFIED" },
    });
    const claimedTreasures = await prisma.treasureBug.count({
      where: { isClaimed: true },
    });
    remainingTreasures = 10 - claimedTreasures;

    const leader = await prisma.team.findFirst({
      orderBy: { totalScore: "desc" },
      select: { name: true, totalScore: true },
    });
    if (leader) {
      topTeam = leader.name;
      topScore = leader.totalScore;
    }
  } catch (err) {
    // Fallback to local store
    totalSubmissions = localStore.getSubmissions().length;
    verifiedSubmissions = localStore.getSubmissions({ status: "VERIFIED" }).length;
    const claimed = localStore.getTreasures().filter((t) => t.isClaimed).length;
    remainingTreasures = 10 - claimed;
    const teams = [...localStore.getTeams()].sort((a, b) => b.totalScore - a.totalScore);
    if (teams.length > 0 && teams[0].totalScore > 0) {
      topTeam = teams[0].name;
      topScore = teams[0].totalScore;
    }
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="border border-neutral-200 bg-white p-6 sm:p-8 rounded-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 bg-neutral-100 border border-neutral-300 text-neutral-800 text-xs font-mono font-bold rounded-sm mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE COMPETITION</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 font-sans">
              Entropy 2K26 QA Bug Bounty
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 mt-1.5 font-sans">
              Find bugs in the target store, submit evidence, and capture exclusive treasure flags.
            </p>
          </div>

          <div className="flex items-center space-x-3 flex-shrink-0">
            <Link
              href="/submit"
              className="px-5 py-2.5 bg-neutral-900 text-white hover:bg-neutral-800 text-sm font-mono font-bold rounded-sm inline-flex items-center space-x-2 shadow-sm"
            >
              <Bug className="w-4 h-4" />
              <span>REPORT BUG</span>
            </Link>
            <Link
              href="/treasures"
              className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-neutral-300 text-sm font-mono font-bold rounded-sm inline-flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>REDEEM FLAG</span>
            </Link>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-neutral-200 font-mono">
          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-sm">
            <span className="text-xs text-neutral-500 uppercase tracking-wider block font-bold">
              Reports Filed
            </span>
            <span className="text-2xl font-extrabold text-neutral-900 mt-1 block">
              {totalSubmissions}
            </span>
          </div>

          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-sm">
            <span className="text-xs text-neutral-500 uppercase tracking-wider block font-bold">
              Verified Bugs
            </span>
            <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
              {verifiedSubmissions}
            </span>
          </div>

          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-sm">
            <span className="text-xs text-neutral-500 uppercase tracking-wider block font-bold">
              Treasures Left
            </span>
            <span className="text-2xl font-extrabold text-amber-600 mt-1 block">
              {remainingTreasures} <span className="text-sm text-neutral-400 font-normal">/ 10</span>
            </span>
          </div>

          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-sm">
            <span className="text-xs text-neutral-500 uppercase tracking-wider block font-bold">
              Current Leader
            </span>
            <span className="text-base font-bold text-neutral-900 mt-1 truncate block">
              {topTeam} {topScore > 0 ? `(${topScore} pts)` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/submit"
          className="group block p-6 bg-white border border-neutral-200 hover:border-neutral-900 rounded-md transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-neutral-100 text-neutral-900 rounded-sm">
                <Bug className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-neutral-900 font-sans">
                Submit Bug Report
              </h2>
            </div>
            <span className="text-neutral-400 group-hover:text-neutral-900 font-mono text-base font-bold">
              →
            </span>
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed font-sans">
            Report bugs with steps, code snippets, and screenshots. All submissions are permanently saved.
          </p>
        </Link>

        <Link
          href="/treasures"
          className="group block p-6 bg-white border border-neutral-200 hover:border-neutral-900 rounded-md transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-amber-50 text-amber-800 rounded-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-neutral-900 font-sans">
                Treasure Bug Vault
              </h2>
            </div>
            <span className="text-neutral-400 group-hover:text-neutral-900 font-mono text-base font-bold">
              →
            </span>
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed font-sans">
            Redeem secret flags found in the app. Flat 10 points per flag (Rule of One: first team claims it).
          </p>
        </Link>

        <Link
          href="/my-submissions"
          className="group block p-6 bg-white border border-neutral-200 hover:border-neutral-900 rounded-md transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-neutral-100 text-neutral-900 rounded-sm">
                <ListChecks className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-neutral-900 font-sans">
                My Submissions
              </h2>
            </div>
            <span className="text-neutral-400 group-hover:text-neutral-900 font-mono text-base font-bold">
              →
            </span>
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed font-sans">
            Check approval status, points awarded, speed bonus rewards, and judge review notes.
          </p>
        </Link>

        <Link
          href="/leaderboard"
          className="group block p-6 bg-white border border-neutral-200 hover:border-neutral-900 rounded-md transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-neutral-100 text-neutral-900 rounded-sm">
                <Trophy className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-neutral-900 font-sans">
                Live Leaderboard
              </h2>
            </div>
            <span className="text-neutral-400 group-hover:text-neutral-900 font-mono text-base font-bold">
              →
            </span>
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed font-sans">
            Live rankings, verified counts, speed bonuses, and overall competition points.
          </p>
        </Link>
      </div>

      {/* Clean Points Table */}
      <div className="bg-white border border-neutral-200 rounded-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Target className="w-4 h-4 text-neutral-800" />
          <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-neutral-900">
            Points & Scoring Rules
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-mono border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-bold">
                <th className="py-3 px-4">DIFFICULTY</th>
                <th className="py-3 px-4">BUGS</th>
                <th className="py-3 px-4">BASE POINTS</th>
                <th className="py-3 px-4">FIRST-TO-FIND BONUS</th>
                <th className="py-3 px-4">MAX POINTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-900">
              <tr>
                <td className="py-3 px-4 font-bold text-emerald-700">EASY</td>
                <td className="py-3 px-4">18</td>
                <td className="py-3 px-4">3 pts</td>
                <td className="py-3 px-4 font-semibold text-amber-700">+2 pts</td>
                <td className="py-3 px-4 font-bold">5 pts</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-amber-700">MEDIUM</td>
                <td className="py-3 px-4">21</td>
                <td className="py-3 px-4">5 pts</td>
                <td className="py-3 px-4 font-semibold text-amber-700">+5 pts</td>
                <td className="py-3 px-4 font-bold">10 pts</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-rose-700">HARD</td>
                <td className="py-3 px-4">16</td>
                <td className="py-3 px-4">10 pts</td>
                <td className="py-3 px-4 font-semibold text-amber-700">+10 pts</td>
                <td className="py-3 px-4 font-bold">20 pts</td>
              </tr>
              <tr className="bg-amber-50/50">
                <td className="py-3 px-4 font-bold text-amber-900">TREASURE BUGS</td>
                <td className="py-3 px-4">10</td>
                <td className="py-3 px-4 font-bold text-amber-800">10 pts (flat)</td>
                <td className="py-3 px-4 text-neutral-400">—</td>
                <td className="py-3 px-4 font-bold text-amber-800">10 pts</td>
              </tr>
              <tr className="bg-neutral-50">
                <td className="py-3 px-4 font-bold text-neutral-900">MILESTONE BONUS</td>
                <td className="py-3 px-4">1</td>
                <td className="py-3 px-4 font-bold text-neutral-900" colSpan={3}>
                  +10 Points awarded to the first team to reach 10 verified bugs
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
