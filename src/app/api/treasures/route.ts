import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import localStore from "@/lib/localStore";
import { isJudgeAuthorized } from "@/lib/judgeAuth";
import { isDbActiveSync, markDbOffline } from "@/lib/dbCircuitBreaker";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const isJudge = isJudgeAuthorized(req);

  // === DB PATH (fast-skip if circuit breaker is open) ===
  if (isDbActiveSync()) {
    try {
      const rawTreasures = await prisma.treasureBug.findMany({
        orderBy: { id: "asc" },
        include: {
          claimedByTeam: {
            select: { id: true, name: true },
          },
        },
      });

      const total = rawTreasures.length || 10;
      const claimedCount = rawTreasures.filter((t) => t.isClaimed).length;
      const remainingCount = total - claimedCount;

      const treasures = rawTreasures.map((t) => ({
        id: t.id,
        isClaimed: t.isClaimed,
        claimedByTeamId: t.claimedByTeamId,
        claimedByTeam: t.claimedByTeam,
        claimedAt: t.claimedAt,
        ...(isJudge ? { code: t.code } : {}),
      }));

      return NextResponse.json({ total, claimedCount, remainingCount, treasures });
    } catch (err: any) {
      markDbOffline();
      console.warn("[api/treasures GET] DB offline, switching to localStore:", err.message);
    }
  }

  // === LOCAL STORE FALLBACK ===
  const treasures = localStore.getTreasures(isJudge);
  const total = treasures.length || 10;
  const claimedCount = treasures.filter((t: any) => t.isClaimed).length;
  const remainingCount = total - claimedCount;

  return NextResponse.json({ total, claimedCount, remainingCount, treasures });
}

export async function PUT(req: NextRequest) {
  if (!isJudgeAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Judge authentication required to modify treasure codes" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { id, code } = body;

    if (!id || !code) {
      return NextResponse.json(
        { error: "id (1-10) and code are required" },
        { status: 400 }
      );
    }

    // === DB PATH ===
    if (isDbActiveSync()) {
      try {
        const updated = await prisma.treasureBug.upsert({
          where: { id: Number(id) },
          update: { code: code.trim() },
          create: { id: Number(id), code: code.trim(), isClaimed: false },
        });

        localStore.updateTreasureCode(Number(id), code.trim());
        return NextResponse.json({
          success: true,
          treasure: updated,
          message: `Treasure Bug #${id} code updated.`,
        });
      } catch (dbErr: any) {
        markDbOffline();
        console.warn("[api/treasures PUT] DB offline, switching to localStore:", dbErr.message);
      }
    }

    // === LOCAL STORE FALLBACK ===
    localStore.updateTreasureCode(Number(id), code.trim());
    return NextResponse.json({
      success: true,
      treasure: { id: Number(id), code: code.trim(), isClaimed: false },
      message: `Treasure Bug #${id} code updated in local store.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to update treasure bug", details: err.message },
      { status: 500 }
    );
  }
}
