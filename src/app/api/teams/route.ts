import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neonClient";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const id = searchParams.get("id");

    try {
      if (id) {
        const teams = await sql`
          SELECT id, name, email, "totalScore", "validBugsCount", "hasMilestoneBonus", "createdAt"
          FROM "Team"
          WHERE id = ${id} LIMIT 1;
        `;
        if (teams.length > 0) {
          const team = teams[0];
          const submissions = await sql`
            SELECT id, description, "codeSnippet", "screenshotUrl", status, "awardedPoints", "isSpeedBonus", "matchedBugId", "createdAt"
            FROM "RegularSubmission"
            WHERE "teamId" = ${id}
            ORDER BY "createdAt" DESC;
          `;
          const claimedTreasures = await sql`
            SELECT id, "claimedAt"
            FROM "TreasureBug"
            WHERE "claimedByTeamId" = ${id};
          `;
          return NextResponse.json({
            team: {
              ...team,
              submissions,
              claimedTreasures,
            },
          });
        }
        return NextResponse.json({ team: null });
      }

      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        const teams = await sql`
          SELECT id, name, email, "totalScore", "validBugsCount", "hasMilestoneBonus", "createdAt"
          FROM "Team"
          WHERE LOWER(email) = ${cleanEmail} LIMIT 1;
        `;
        if (teams.length > 0) {
          const team = teams[0];
          const submissions = await sql`
            SELECT id, description, "codeSnippet", "screenshotUrl", status, "awardedPoints", "isSpeedBonus", "matchedBugId", "createdAt"
            FROM "RegularSubmission"
            WHERE "teamId" = ${team.id}
            ORDER BY "createdAt" DESC;
          `;
          const claimedTreasures = await sql`
            SELECT id, "claimedAt"
            FROM "TreasureBug"
            WHERE "claimedByTeamId" = ${team.id};
          `;
          return NextResponse.json({
            team: {
              ...team,
              submissions,
              claimedTreasures,
            },
          });
        }
        return NextResponse.json({ team: null });
      }

      const allTeams = await sql`
        SELECT id, name, email, "totalScore", "validBugsCount", "hasMilestoneBonus", "createdAt"
        FROM "Team"
        ORDER BY "totalScore" DESC;
      `;
      return NextResponse.json({ teams: allTeams });
    } catch (neonErr: any) {
      console.warn("[api/teams GET] Neon HTTP fallback to Prisma:", neonErr.message);

      if (id) {
        const team = await prisma.team.findUnique({
          where: { id },
          include: {
            submissions: { orderBy: { createdAt: "desc" } },
            claimedTreasures: true,
          },
        });
        return NextResponse.json({ team });
      }
      if (email) {
        const team = await prisma.team.findFirst({
          where: { email: { equals: email.trim(), mode: "insensitive" } },
          include: {
            submissions: { orderBy: { createdAt: "desc" } },
            claimedTreasures: true,
          },
        });
        return NextResponse.json({ team });
      }

      const teams = await prisma.team.findMany({
        orderBy: { totalScore: "desc" },
        include: { claimedTreasures: true },
      });
      return NextResponse.json({ teams });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch teams", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Team Name and Email are required" },
        { status: 400 }
      );
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    try {
      let teams = await sql`
        SELECT id, name, email, "totalScore", "validBugsCount", "hasMilestoneBonus", "createdAt"
        FROM "Team"
        WHERE LOWER(email) = ${cleanEmail} OR LOWER(name) = ${cleanName.toLowerCase()}
        LIMIT 1;
      `;

      if (teams.length === 0) {
        const newId = `cmvv${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        teams = await sql`
          INSERT INTO "Team" ("id", "name", "email", "totalScore", "validBugsCount", "hasMilestoneBonus", "createdAt")
          VALUES (${newId}, ${cleanName}, ${cleanEmail}, 0, 0, false, NOW())
          ON CONFLICT ("name") DO UPDATE SET "name" = EXCLUDED."name"
          RETURNING id, name, email, "totalScore", "validBugsCount", "hasMilestoneBonus", "createdAt";
        `;
      }

      const team = teams[0];
      const submissions = await sql`
        SELECT id, description, "codeSnippet", "screenshotUrl", status, "awardedPoints", "isSpeedBonus", "matchedBugId", "createdAt"
        FROM "RegularSubmission"
        WHERE "teamId" = ${team.id}
        ORDER BY "createdAt" DESC;
      `;
      const claimedTreasures = await sql`
        SELECT id, "claimedAt"
        FROM "TreasureBug"
        WHERE "claimedByTeamId" = ${team.id};
      `;

      return NextResponse.json({
        team: {
          ...team,
          submissions,
          claimedTreasures,
        },
        message: "Team recognized and authenticated successfully across all team devices",
      });
    } catch (neonErr: any) {
      console.warn("[api/teams POST] Neon HTTP fallback to Prisma:", neonErr.message);

      let team = await prisma.team.findFirst({
        where: {
          OR: [
            { email: { equals: cleanEmail, mode: "insensitive" } },
            { name: { equals: cleanName, mode: "insensitive" } },
          ],
        },
        include: {
          submissions: { orderBy: { createdAt: "desc" } },
          claimedTreasures: true,
        },
      });

      if (!team) {
        team = await prisma.team.create({
          data: {
            name: cleanName,
            email: cleanEmail,
            totalScore: 0,
            validBugsCount: 0,
            hasMilestoneBonus: false,
          },
          include: {
            submissions: { orderBy: { createdAt: "desc" } },
            claimedTreasures: true,
          },
        });
      }

      return NextResponse.json({
        team,
        message: "Team authenticated successfully",
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to authenticate team", details: err.message },
      { status: 500 }
    );
  }
}
