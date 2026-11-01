import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neonClient";
import localStore from "@/lib/localStore";
import { invalidateCache } from "@/lib/memoryCache";

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
      // 0. Verify team exists in Neon PostgreSQL
      const teamExists = await sql`SELECT id FROM "Team" WHERE id = ${teamId} LIMIT 1;`;
      if (teamExists.length === 0) {
        return NextResponse.json(
          { error: "Team session not found or expired. Please re-enter your team name in the top right to log in." },
          { status: 401 }
        );
      }

      // 1. Atomic Compare-And-Swap (CAS) Claim on Neon PostgreSQL
      const claimed = await sql`
        UPDATE "TreasureBug"
        SET "isClaimed" = true, "claimedByTeamId" = ${teamId}, "claimedAt" = NOW()
        WHERE code = ${cleanCode} AND "isClaimed" = false
        RETURNING id, code, "claimedAt";
      `;

      if (claimed.length > 0) {
        const treasure = claimed[0];

        // Increment team score by 10 points and return new bug count in one query
        const teamUpdate = await sql`
          UPDATE "Team"
          SET "totalScore" = "totalScore" + 10, "validBugsCount" = "validBugsCount" + 1
          WHERE id = ${teamId}
          RETURNING "validBugsCount";
        `;

        // Check 10-bug milestone bonus
        if (teamUpdate[0]?.validBugsCount >= 10) {
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

        invalidateCache("treasures");
        invalidateCache("leaderboard");
        invalidateCache("stats");
        invalidateCache("team_");

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
      console.warn("[api/treasures/claim] Neon HTTP fallback to localStore in 0ms:", neonErr.message);

      const claimResult = localStore.claimTreasure(teamId, cleanCode);
      if ("success" in claimResult && claimResult.success) {
        invalidateCache();
        return NextResponse.json({
          success: true,
          treasureId: claimResult.treasureId,
          pointsAwarded: 10,
          message: `🎉 CONGRATULATIONS! You successfully claimed Treasure Bug #${claimResult.treasureId}! +10 points awarded to your team!`,
        });
      }

      return NextResponse.json(
        { error: claimResult.error || "Treasure claim could not be completed." },
        { status: claimResult.error?.includes("already claimed") ? 409 : 404 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Claim processing error", details: err.message },
      { status: 500 }
    );
  }
}
