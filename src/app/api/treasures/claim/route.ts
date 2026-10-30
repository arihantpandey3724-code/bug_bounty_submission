import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neonClient";
import prisma from "@/lib/prisma";

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

    if (cleanCode === "FLAG{inspect_more_closely_first_level_decoy}") {
      return NextResponse.json(
        {
          error: "⚠️ Decoy Flag Detected! Nice attempt asking AI, but do not rely solely on automated shortcuts. Inspect the actual UI components manually to find the true treasure flag!",
        },
        { status: 400 }
      );
    }

    try {
      // 1. Atomic Compare-And-Swap (CAS) Claim on Neon PostgreSQL
      const claimed = await sql`
        UPDATE "TreasureBug"
        SET "isClaimed" = true, "claimedByTeamId" = ${teamId}, "claimedAt" = NOW()
        WHERE code = ${cleanCode} AND "isClaimed" = false
        RETURNING id, code, "claimedAt";
      `;

      if (claimed.length > 0) {
        const treasure = claimed[0];

        // Increment team score by 10 points
        await sql`
          UPDATE "Team"
          SET "totalScore" = "totalScore" + 10, "validBugsCount" = "validBugsCount" + 1
          WHERE id = ${teamId};
        `;

        // Check 10-bug milestone bonus
        const milestoneCheck = await sql`
          SELECT "validBugsCount" FROM "Team" WHERE id = ${teamId};
        `;
        if (milestoneCheck[0]?.validBugsCount >= 10) {
          const milestoneClaim = await sql`
            UPDATE "MilestoneTracker"
            SET "awardedToTeamId" = ${teamId}, "awardedAt" = NOW()
            WHERE id = 1 AND "awardedToTeamId" IS NULL
            RETURNING id;
          `;
          if (milestoneClaim.length > 0) {
            await sql`
              UPDATE "Team"
              SET "totalScore" = "totalScore" + 10, "hasMilestoneBonus" = true
              WHERE id = ${teamId};
            `;
          }
        }

        return NextResponse.json({
          success: true,
          treasureId: treasure.id,
          pointsAwarded: 10,
          message: `🎉 CONGRATULATIONS! You successfully claimed Treasure Bug #${treasure.id}! +10 points awarded to your team!`,
        });
      }

      // If update returned 0 rows, check if it's already claimed or invalid
      const checkExisting = await sql`
        SELECT tr.id, tr."isClaimed", tr."claimedByTeamId", t.name as "claimedByName"
        FROM "TreasureBug" tr
        LEFT JOIN "Team" t ON t.id = tr."claimedByTeamId"
        WHERE tr.code = ${cleanCode}
        LIMIT 1;
      `;

      if (checkExisting.length === 0) {
        return NextResponse.json(
          { error: "Invalid flag code. No matching treasure bug found." },
          { status: 404 }
        );
      }

      const existing = checkExisting[0];
      if (existing.isClaimed) {
        return NextResponse.json(
          {
            error: `Treasure Bug #${existing.id} has already been claimed by ${
              existing.claimedByName || "another team"
            }!`,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Could not claim treasure at this time. Please retry." },
        { status: 409 }
      );
    } catch (neonErr: any) {
      console.warn("[api/treasures/claim] Neon HTTP fallback to Prisma:", neonErr.message);

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

      return NextResponse.json({
        success: true,
        treasureId: treasure.id,
        pointsAwarded: 10,
        message: `🎉 CONGRATULATIONS! You successfully claimed Treasure Bug #${treasure.id}! +10 points awarded to your team!`,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to process treasure claim", details: err.message },
      { status: 500 }
    );
  }
}
