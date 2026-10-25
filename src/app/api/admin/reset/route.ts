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
