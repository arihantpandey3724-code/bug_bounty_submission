import Link from "next/link";
import { headers } from "next/headers";
import { sql } from "@/lib/neonClient";
import localStore from "@/lib/localStore";
import { Bug, Sparkles, Trophy, ListChecks, Target } from "lucide-react";
import LiveMetricsGrid from "@/components/LiveMetricsGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  // Calling headers() explicitly marks this route dynamic and prevents static build-time CDN freezing
  headers();

  let totalSubmissions = 0;
  let verifiedSubmissions = 0;
  let remainingTreasures = 10;
  let topTeam = "None yet";
  let topScore = 0;

  try {
    const [subStats, claimedTreasuresRes, leaderRes] = await Promise.all([
      sql`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE status = 'VERIFIED')::int as verified FROM "RegularSubmission"`,
      sql`SELECT COUNT(*)::int as claimed FROM "TreasureBug" WHERE "isClaimed" = true`,
      sql`SELECT name, "totalScore" FROM "Team" ORDER BY "totalScore" DESC LIMIT 1`,
    ]);

    totalSubmissions = subStats[0]?.total || 0;
    verifiedSubmissions = subStats[0]?.verified || 0;
    const claimedTreasures = claimedTreasuresRes[0]?.claimed || 0;
    remainingTreasures = Math.max(0, 10 - claimedTreasures);

    if (leaderRes.length > 0 && leaderRes[0].totalScore > 0) {
      topTeam = leaderRes[0].name;
      topScore = leaderRes[0].totalScore;
    }
  } catch (err) {
    // Fallback to local store
    totalSubmissions = localStore.getSubmissions().length;
    verifiedSubmissions = localStore.getSubmissions({ status: "VERIFIED" }).length;
    const claimed = localStore.getTreasures().filter((t) => t.isClaimed).length;
    remainingTreasures = Math.max(0, 10 - claimed);
    const teams = [...localStore.getTeams()].sort((a, b) => b.totalScore - a.totalScore);
    if (teams.length > 0 && teams[0].totalScore > 0) {
      topTeam = teams[0].name;
      topScore = teams[0].totalScore;
    }
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="border border-neutral-200 bg-white p-6 sm:p-8 rounded-lg shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 bg-neutral-100 border border-neutral-200 text-neutral-800 text-xs font-sans font-medium rounded-md mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Live Competition</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 font-sans">
              Entropy 2K26 QA Bug Bounty
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 mt-1.5 font-sans">
              Explore the target store, report issues with clear steps, and uncover hidden treasure flags.
            </p>
          </div>

          <div className="flex items-center space-x-3 flex-shrink-0">
            <Link
              href="/submit"
              className="px-5 py-2.5 bg-neutral-900 text-white hover:bg-neutral-800 text-sm font-sans font-medium rounded-md inline-flex items-center space-x-2 shadow-xs transition-colors"
            >
              <Bug className="w-4 h-4" />
              <span>Report a Bug</span>
            </Link>
            <Link
              href="/treasures"
              className="px-5 py-2.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-900 border border-neutral-300 text-sm font-sans font-medium rounded-md inline-flex items-center space-x-2 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Redeem Flag</span>
            </Link>
          </div>
        </div>

        {/* Live Metrics Grid with dynamic auto-sync */}
        <LiveMetricsGrid
          initialTotal={totalSubmissions}
          initialVerified={verifiedSubmissions}
          initialRemaining={remainingTreasures}
          initialTopTeam={topTeam}
          initialTopScore={topScore}
        />
      </div>

      {/* Main Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/submit"
          className="group block p-6 bg-white border border-neutral-200 hover:border-neutral-900 rounded-lg transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-neutral-100 text-neutral-900 rounded-md">
                <Bug className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-neutral-900 font-sans">
                Submit Bug Report
              </h2>
            </div>
            <span className="text-neutral-400 group-hover:text-neutral-900 font-sans text-base">
              →
            </span>
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed font-sans">
            Report bugs with clear steps to reproduce, code snippets, and screenshot proof.
          </p>
        </Link>

        <Link
          href="/treasures"
          className="group block p-6 bg-white border border-neutral-200 hover:border-neutral-900 rounded-lg transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-amber-50 text-amber-800 rounded-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-neutral-900 font-sans">
                Treasure Bug Vault
              </h2>
            </div>
            <span className="text-neutral-400 group-hover:text-neutral-900 font-sans text-base">
              →
            </span>
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed font-sans">
            Redeem secret flags found across the store. Each flag is awarded to the first team to claim it.
          </p>
        </Link>

        <Link
          href="/my-submissions"
          className="group block p-6 bg-white border border-neutral-200 hover:border-neutral-900 rounded-lg transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-neutral-100 text-neutral-900 rounded-md">
                <ListChecks className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-neutral-900 font-sans">
                My Submissions
              </h2>
            </div>
            <span className="text-neutral-400 group-hover:text-neutral-900 font-sans text-base">
              →
            </span>
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed font-sans">
            Track verification status, awarded points, speed bonuses, and judge feedback.
          </p>
        </Link>

        <Link
          href="/leaderboard"
          className="group block p-6 bg-white border border-neutral-200 hover:border-neutral-900 rounded-lg transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-neutral-100 text-neutral-900 rounded-md">
                <Trophy className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-neutral-900 font-sans">
                Live Leaderboard
              </h2>
            </div>
            <span className="text-neutral-400 group-hover:text-neutral-900 font-sans text-base">
              →
            </span>
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed font-sans">
            View team rankings, verified bugs, speed bonuses, and total competition points.
          </p>
        </Link>
      </div>

      {/* Clean Points Table */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-xs">
        <div className="flex items-center space-x-2 mb-4">
          <Target className="w-4 h-4 text-neutral-800" />
          <h3 className="text-sm font-sans font-bold text-neutral-900">
            Points & Scoring Rules
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-sans border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/70 text-neutral-600 font-semibold text-xs">
                <th className="py-3 px-4">Difficulty</th>
                <th className="py-3 px-4">Available Bugs</th>
                <th className="py-3 px-4">Base Points</th>
                <th className="py-3 px-4">First-to-Find Bonus</th>
                <th className="py-3 px-4">Max Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-900">
              <tr>
                <td className="py-3 px-4 font-semibold text-emerald-700">Easy</td>
                <td className="py-3 px-4 text-neutral-600">18</td>
                <td className="py-3 px-4">3 pts</td>
                <td className="py-3 px-4 font-medium text-amber-700">+2 pts</td>
                <td className="py-3 px-4 font-semibold">5 pts</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-amber-700">Medium</td>
                <td className="py-3 px-4 text-neutral-600">21</td>
                <td className="py-3 px-4">5 pts</td>
                <td className="py-3 px-4 font-medium text-amber-700">+5 pts</td>
                <td className="py-3 px-4 font-semibold">10 pts</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-rose-700">Hard</td>
                <td className="py-3 px-4 text-neutral-600">16</td>
                <td className="py-3 px-4">10 pts</td>
                <td className="py-3 px-4 font-medium text-amber-700">+10 pts</td>
                <td className="py-3 px-4 font-semibold">20 pts</td>
              </tr>
              <tr className="bg-amber-50/40">
                <td className="py-3 px-4 font-semibold text-amber-900">Treasure Bugs</td>
                <td className="py-3 px-4 text-neutral-600">10</td>
                <td className="py-3 px-4 font-medium text-amber-800">10 pts (flat)</td>
                <td className="py-3 px-4 text-neutral-400">—</td>
                <td className="py-3 px-4 font-semibold text-amber-800">10 pts</td>
              </tr>
              <tr className="bg-neutral-50/50">
                <td className="py-3 px-4 font-semibold text-neutral-900">Milestone Bonus</td>
                <td className="py-3 px-4 text-neutral-600">1</td>
                <td className="py-3 px-4 text-neutral-700" colSpan={3}>
                  +10 bonus points awarded to the first team to reach 10 verified bugs
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
