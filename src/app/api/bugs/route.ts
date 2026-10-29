import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import localStore from "@/lib/localStore";
import { isJudgeAuthorized } from "@/lib/judgeAuth";
import { isDbActiveSync, markDbOffline } from "@/lib/dbCircuitBreaker";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isJudgeAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Judge authentication required to view master bug specifications." },
      { status: 401 }
    );
  }

  // === DB PATH (fast-skip if offline) ===
  if (isDbActiveSync()) {
    try {
      const bugs = await prisma.masterBug.findMany({
        orderBy: [{ category: "asc" }, { id: "asc" }],
        include: {
          submissions: {
            select: {
              id: true,
              status: true,
              teamId: true,
              createdAt: true,
            },
          },
        },
      });

      const teams = await prisma.team.findMany({
        select: { id: true, name: true },
      });
      const teamMap = new Map(teams.map((t) => [t.id, t.name]));

      const enrichedBugs = bugs.map((bug) => {
        const verifiedSubmissions = bug.submissions.filter((s) => s.status === "VERIFIED");
        return {
          id: bug.id,
          title: bug.title,
          category: bug.category,
          basePoints: bug.basePoints,
          speedBonusPoints: bug.speedBonusPoints,
          maxPoints: bug.basePoints + bug.speedBonusPoints,
          expected: bug.expected,
          actual: bug.actual,
          location: bug.location,
          isFirstFound: bug.isFirstFound,
          firstFoundByTeam: bug.firstFoundById ? teamMap.get(bug.firstFoundById) || null : null,
          totalReports: bug.submissions.length,
          verifiedReports: verifiedSubmissions.length,
        };
      });

      return NextResponse.json({
        totalCount: bugs.length,
        bugs: enrichedBugs,
      });
    } catch (err: any) {
      markDbOffline();
      console.warn("[api/bugs GET fallback to localStore]:", err.message);
    }
  }

  // === LOCAL STORE FALLBACK ===
  const bugs = localStore.getBugs().map((b) => ({
    ...b,
    maxPoints: b.basePoints + b.speedBonusPoints,
  }));

  return NextResponse.json({
    totalCount: bugs.length,
    bugs,
  });
}
