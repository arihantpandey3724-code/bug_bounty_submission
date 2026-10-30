import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import localStore from "@/lib/localStore";
import { clearDiskBackup } from "@/lib/submissionStore";
import { isJudgeAuthorized } from "@/lib/judgeAuth";
import { INITIAL_TREASURES } from "@/config/masterBugs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isJudgeAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Judge authentication required to reset competition." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  if (body?.onlyStressSubmissions) {
    try {
      const del = await prisma.regularSubmission.deleteMany({
        where: { description: { startsWith: "[STRESS-TEST" } },
      });

      // Automatically recalibrate team scores after removing synthetic submissions
      const teams = await prisma.team.findMany({
        include: {
          submissions: { where: { status: "VERIFIED" } },
        },
      });

      for (const t of teams) {
        const totalPoints = t.submissions.reduce((sum, s) => sum + s.awardedPoints, 0);
        const validCount = t.submissions.length;
        const hasMilestone = validCount >= 10;
        await prisma.team.update({
          where: { id: t.id },
          data: {
            totalScore: totalPoints + (hasMilestone ? 10 : 0),
            validBugsCount: validCount,
            hasMilestoneBonus: hasMilestone,
          },
        });
      }

      const milestoneWinner = teams.find((t) => t.submissions.length >= 10);
      await prisma.milestoneTracker.upsert({
        where: { id: 1 },
        update: {
          awardedToTeamId: milestoneWinner ? milestoneWinner.id : null,
          awardedAt: milestoneWinner ? new Date() : null,
        },
        create: {
          id: 1,
          awardedToTeamId: milestoneWinner ? milestoneWinner.id : null,
          awardedAt: milestoneWinner ? new Date() : null,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Deleted ${del.count} synthetic stress-test submissions and recalibrated standings.`,
        deletedCount: del.count,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  const results: any = {
    prismaReset: false,
    localStoreReset: false,
    diskBackupReset: false,
  };

  // 1. Reset local store in memory
  try {
    localStore.resetAll();
    results.localStoreReset = true;
  } catch (err: any) {
    results.localStoreError = err.message;
  }

  // 2. Clear disk backup JSONL
  try {
    clearDiskBackup();
    results.diskBackupReset = true;
  } catch (err: any) {
    results.diskBackupError = err.message;
  }

  // 3. Reset PostgreSQL database via Prisma if connected
  try {
    // Delete all regular submissions
    await prisma.regularSubmission.deleteMany({});

    // Reset all 10 treasures to unclaimed
    for (const t of INITIAL_TREASURES) {
      await prisma.treasureBug.upsert({
        where: { id: t.id },
        update: {
          code: t.code,
          isClaimed: false,
          claimedByTeamId: null,
          claimedAt: null,
        },
        create: {
          id: t.id,
          code: t.code,
          isClaimed: false,
        },
      });
    }

    // Reset all Master Bugs first-to-find tracking
    await prisma.masterBug.updateMany({
      data: {
        isFirstFound: false,
        firstFoundById: null,
      },
    });

    // Reset Milestone tracker
    await prisma.milestoneTracker.upsert({
      where: { id: 1 },
      update: {
        awardedToTeamId: null,
        awardedAt: null,
      },
      create: {
        id: 1,
      },
    });

    // Delete all registered teams (or delete test teams)
    await prisma.team.deleteMany({});

    results.prismaReset = true;
  } catch (dbErr: any) {
    results.prismaNote = `Database reset bypassed (local mode active): ${dbErr.message}`;
  }

  return NextResponse.json({
    success: true,
    message: "🏆 Competition state completely wiped and reset to a pristine clean slate!",
    details: results,
  });
}
