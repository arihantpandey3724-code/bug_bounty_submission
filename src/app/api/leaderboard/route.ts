import { NextResponse } from "next/server";
import { sql } from "@/lib/neonClient";
import localStore from "@/lib/localStore";
import { getCached, setCached } from "@/lib/memoryCache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };

  // 1. In-memory SWR cache (3000ms TTL) to eliminate Neon database query saturation
  const cached = getCached<any>("leaderboard", 3000);
  if (cached) {
    return NextResponse.json(cached, { headers });
  }

  try {
    // 2. High-performance parallel queries via Serverless Neon HTTPS driver
    const [teams, milestones] = await Promise.all([
      sql`
        SELECT 
          t.id, 
          t.name, 
          t.email, 
          t."totalScore", 
          t."validBugsCount", 
          t."hasMilestoneBonus", 
          t."createdAt",
          coalesce(count(distinct case when s.status = 'VERIFIED' and s."isSpeedBonus" = true then s.id end), 0)::int as "speedBonusCount",
          coalesce(count(distinct tr.id), 0)::int as "treasuresClaimedCount",
          coalesce(count(distinct case when s.status = 'VERIFIED' then s.id end), 0)::int as "verifiedSubmissionsCount"
        FROM "Team" t
        LEFT JOIN "RegularSubmission" s ON s."teamId" = t.id
        LEFT JOIN "TreasureBug" tr ON tr."claimedByTeamId" = t.id
        GROUP BY t.id, t.name, t.email, t."totalScore", t."validBugsCount", t."hasMilestoneBonus", t."createdAt"
        ORDER BY t."totalScore" DESC, t."validBugsCount" DESC, t."createdAt" ASC;
      `,
      sql`
        SELECT "awardedToTeamId", "awardedAt" FROM "MilestoneTracker" WHERE id = 1 LIMIT 1;
      `,
    ]);

    const milestone = milestones[0] || null;

    const leaderboard = teams.map((team: any, index: number) => ({
      rank: index + 1,
      id: team.id,
      name: team.name,
      email: team.email,
      totalScore: team.totalScore,
      validBugsCount: team.validBugsCount,
      hasMilestoneBonus: team.hasMilestoneBonus,
      speedBonusCount: team.speedBonusCount,
      treasuresClaimedCount: team.treasuresClaimedCount,
      verifiedSubmissionsCount: team.verifiedSubmissionsCount,
    }));

    const responsePayload = {
      leaderboard,
      milestoneBonusClaimedBy: milestone?.awardedToTeamId || null,
      milestoneBonusClaimedAt: milestone?.awardedAt || null,
      updatedAt: new Date().toISOString(),
    };

    setCached("leaderboard", responsePayload);

    return NextResponse.json(responsePayload, { headers });
  } catch (neonErr: any) {
    console.warn("[api/leaderboard] Neon HTTP error, falling back cleanly to localStore in 0ms:", neonErr.message);

    const localTeams = [...localStore.getTeams()].sort((a, b) => b.totalScore - a.totalScore);
    const leaderboard = localTeams.map((team, index) => ({
      rank: index + 1,
      id: team.id,
      name: team.name,
      email: team.email,
      totalScore: team.totalScore,
      validBugsCount: team.validBugsCount,
      hasMilestoneBonus: team.hasMilestoneBonus,
      speedBonusCount: 0,
      treasuresClaimedCount: 0,
      verifiedSubmissionsCount: team.validBugsCount,
    }));

    const fallbackPayload = {
      leaderboard,
      milestoneBonusClaimedBy: localStore.milestoneAwardedTo,
      milestoneBonusClaimedAt: localStore.milestoneAwardedAt,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(fallbackPayload, { headers });
  }
}
