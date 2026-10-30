import { NextResponse } from "next/server";
import { sql } from "@/lib/neonClient";
import localStore from "@/lib/localStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };

  try {
    const [subStats, claimedTreasuresRes, leaderRes] = await Promise.all([
      sql`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE status = 'VERIFIED')::int as verified FROM "RegularSubmission"`,
      sql`SELECT COUNT(*)::int as claimed FROM "TreasureBug" WHERE "isClaimed" = true`,
      sql`SELECT name, "totalScore" FROM "Team" ORDER BY "totalScore" DESC LIMIT 1`,
    ]);

    const totalSubmissions = subStats[0]?.total || 0;
    const verifiedSubmissions = subStats[0]?.verified || 0;
    const claimedTreasures = claimedTreasuresRes[0]?.claimed || 0;
    const remainingTreasures = Math.max(0, 10 - claimedTreasures);
    const topTeam = leaderRes.length > 0 && leaderRes[0].totalScore > 0 ? leaderRes[0].name : "None yet";
    const topScore = leaderRes.length > 0 ? leaderRes[0].totalScore : 0;

    return NextResponse.json(
      {
        totalSubmissions,
        verifiedSubmissions,
        remainingTreasures,
        topTeam,
        topScore,
        updatedAt: new Date().toISOString(),
      },
      { headers }
    );
  } catch (err: any) {
    console.warn("[api/stats] Neon DB error, falling back to localStore:", err.message);
    const totalSubmissions = localStore.getSubmissions().length;
    const verifiedSubmissions = localStore.getSubmissions({ status: "VERIFIED" }).length;
    const claimed = localStore.getTreasures().filter((t) => t.isClaimed).length;
    const remainingTreasures = Math.max(0, 10 - claimed);
    const teams = [...localStore.getTeams()].sort((a, b) => b.totalScore - a.totalScore);
    const topTeam = teams.length > 0 && teams[0].totalScore > 0 ? teams[0].name : "None yet";
    const topScore = teams.length > 0 ? teams[0].totalScore : 0;

    return NextResponse.json(
      {
        totalSubmissions,
        verifiedSubmissions,
        remainingTreasures,
        topTeam,
        topScore,
        updatedAt: new Date().toISOString(),
      },
      { headers }
    );
  }
}
