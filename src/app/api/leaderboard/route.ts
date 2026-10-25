import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import localStore from "@/lib/localStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      orderBy: [{ totalScore: "desc" }, { validBugsCount: "desc" }, { createdAt: "asc" }],
      include: {
        claimedTreasures: {
          select: { id: true, claimedAt: true },
        },
        submissions: {
          where: { status: "VERIFIED" },
          select: {
            id: true,
            isSpeedBonus: true,
            awardedPoints: true,
            matchedBugId: true,
          },
        },
      },
    });

    const milestone = await prisma.milestoneTracker.findUnique({
      where: { id: 1 },
    });

    const leaderboard = teams.map((team, index) => {
      const speedBonusCount = team.submissions.filter((s) => s.isSpeedBonus).length;
      return {
        rank: index + 1,
        id: team.id,
        name: team.name,
        email: team.email,
        totalScore: team.totalScore,
        validBugsCount: team.validBugsCount,
        hasMilestoneBonus: team.hasMilestoneBonus,
        speedBonusCount,
        treasuresClaimedCount: team.claimedTreasures.length,
        verifiedSubmissionsCount: team.submissions.length,
      };
    });

    return NextResponse.json({
      leaderboard,
      milestoneBonusClaimedBy: milestone?.awardedToTeamId || null,
      milestoneBonusClaimedAt: milestone?.awardedAt || null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn("[api/leaderboard GET fallback to localStore]:", err.message);
    const sortedTeams = [...localStore.getTeams()].sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.validBugsCount !== a.validBugsCount) return b.validBugsCount - a.validBugsCount;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const submissions = localStore.getSubmissions({ status: "VERIFIED" });
    const treasures = localStore.getTreasures().filter((t) => t.isClaimed);

    const leaderboard = sortedTeams.map((t, index) => {
      const teamSubs = submissions.filter((s) => s.teamId === t.id);
      const teamTreasures = treasures.filter((tr) => tr.claimedByTeamId === t.id);
      const speedBonusCount = teamSubs.filter((s) => s.isSpeedBonus).length;

      return {
        rank: index + 1,
        id: t.id,
        name: t.name,
        email: t.email,
        totalScore: t.totalScore,
        validBugsCount: t.validBugsCount,
        hasMilestoneBonus: t.hasMilestoneBonus,
        speedBonusCount,
        treasuresClaimedCount: teamTreasures.length,
        verifiedSubmissionsCount: teamSubs.length,
      };
    });

    return NextResponse.json({
      leaderboard,
      milestoneBonusClaimedBy: localStore.milestoneAwardedTo,
      milestoneBonusClaimedAt: localStore.milestoneAwardedAt,
      updatedAt: new Date().toISOString(),
    });
  }
}
