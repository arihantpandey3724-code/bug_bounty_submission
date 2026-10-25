import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { evaluateMilestoneBonus } from "@/lib/scoring";
import localStore from "@/lib/localStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { teamId, code } = body;

    if (!teamId || !code) {
      return NextResponse.json(
        { error: "Team ID and Treasure Flag Code are required." },
        { status: 400 }
      );
    }

    const cleanCode = code.trim();

    // Check for AI Decoy Honeypot Flag
    if (cleanCode === "FLAG{inspect_more_closely_first_level_decoy}") {
      return NextResponse.json(
        {
          error: "⚠️ Decoy Flag Detected! Nice attempt asking AI, but do not rely solely on automated shortcuts. Inspect the actual UI components manually to find the true treasure flag!",
        },
        { status: 400 }
      );
    }

    try {
      const treasure = await prisma.treasureBug.findUnique({
        where: { code: cleanCode },
        include: { claimedByTeam: true },
      });

      if (!treasure) {
        return NextResponse.json(
          { error: "Invalid flag code. No matching treasure bug found." },
          { status: 404 }
        );
      }

      if (treasure.isClaimed) {
        return NextResponse.json(
          {
            error: `Treasure Bug #${treasure.id} has already been claimed by ${
              treasure.claimedByTeam?.name || "another team"
            }!`,
          },
          { status: 409 }
        );
      }

      try {
        await prisma.$transaction(async (tx) => {
          const updateResult = await tx.treasureBug.updateMany({
            where: { id: treasure.id, isClaimed: false },
            data: {
              isClaimed: true,
              claimedByTeamId: teamId,
              claimedAt: new Date(),
            },
          });

          if (updateResult.count === 0) {
            throw new Error("ALREADY_CLAIMED");
          }

          await tx.team.update({
            where: { id: teamId },
            data: {
              totalScore: { increment: 10 },
              validBugsCount: { increment: 1 },
            },
          });
        });
      } catch (claimErr: any) {
        if (claimErr.message === "ALREADY_CLAIMED") {
          return NextResponse.json(
            { error: `Treasure Bug #${treasure.id} was just claimed by another team!` },
            { status: 409 }
          );
        }
        throw claimErr;
      }

      await evaluateMilestoneBonus(teamId);

      const updatedTeam = await prisma.team.findUnique({
        where: { id: teamId },
      });

      return NextResponse.json({
        success: true,
        treasureId: treasure.id,
        pointsAwarded: 10,
        newTotalScore: updatedTeam?.totalScore,
        message: `🎉 Treasure Bug #${treasure.id} claimed! +10 Points awarded to your team!`,
      });
    } catch (dbErr: any) {
      console.warn("[api/treasures/claim fallback to localStore]:", dbErr.message);
      const res = localStore.claimTreasure(teamId, cleanCode);
      if (res.error) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        treasureId: res.treasureId,
        pointsAwarded: 10,
        newTotalScore: res.newScore,
        message: `🎉 Treasure Bug #${res.treasureId} claimed! +10 Points awarded to your team!`,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to claim treasure bug", details: err.message },
      { status: 500 }
    );
  }
}
