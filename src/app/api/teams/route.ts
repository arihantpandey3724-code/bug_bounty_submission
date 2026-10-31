import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neonClient";
import localStore from "@/lib/localStore";
import { getCached, setCached, invalidateCache } from "@/lib/memoryCache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const id = searchParams.get("id");

    try {
      if (id) {
        // Fast-path in-memory cache for polling teams (3s TTL)
        const cacheKey = `team_${id}`;
        const cached = getCached<any>(cacheKey, 3000);
        if (cached) {
          return NextResponse.json(cached);
        }

        const [teams, submissions, claimedTreasures] = await Promise.all([
          sql`
            SELECT id, name, email, "totalScore", "validBugsCount", "hasMilestoneBonus", "createdAt"
            FROM "Team"
            WHERE id = ${id} LIMIT 1;
          `,
          sql`
            SELECT id, description, "codeSnippet", "screenshotUrl", status, "awardedPoints", "isSpeedBonus", "matchedBugId", "createdAt"
            FROM "RegularSubmission"
            WHERE "teamId" = ${id}
            ORDER BY "createdAt" DESC;
          `,
          sql`
            SELECT id, "claimedAt"
            FROM "TreasureBug"
            WHERE "claimedByTeamId" = ${id};
          `,
        ]);

        if (teams.length > 0) {
          const payload = {
            team: {
              ...teams[0],
              submissions,
              claimedTreasures,
            },
          };
          setCached(cacheKey, payload);
          return NextResponse.json(payload);
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
          const [submissions, claimedTreasures] = await Promise.all([
            sql`
              SELECT id, description, "codeSnippet", "screenshotUrl", status, "awardedPoints", "isSpeedBonus", "matchedBugId", "createdAt"
              FROM "RegularSubmission"
              WHERE "teamId" = ${team.id}
              ORDER BY "createdAt" DESC;
            `,
            sql`
              SELECT id, "claimedAt"
              FROM "TreasureBug"
              WHERE "claimedByTeamId" = ${team.id};
            `,
          ]);

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
      console.warn("[api/teams GET] Neon HTTP fallback to localStore in 0ms:", neonErr.message);

      if (id) {
        const localTeam = localStore.findTeamById(id);
        if (localTeam) {
          const subs = localStore.getSubmissions({ teamId: id });
          return NextResponse.json({ team: { ...localTeam, submissions: subs, claimedTreasures: [] } });
        }
        return NextResponse.json({ team: null });
      }

      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        const localTeam = localStore.findTeamByEmail(cleanEmail);
        if (localTeam) {
          const subs = localStore.getSubmissions({ teamId: localTeam.id });
          return NextResponse.json({ team: { ...localTeam, submissions: subs, claimedTreasures: [] } });
        }
        return NextResponse.json({ team: null });
      }

      return NextResponse.json({ teams: localStore.getTeams() });
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
        invalidateCache("leaderboard");
      }

      const team = teams[0];
      const [submissions, claimedTreasures] = await Promise.all([
        sql`
          SELECT id, description, "codeSnippet", "screenshotUrl", status, "awardedPoints", "isSpeedBonus", "matchedBugId", "createdAt"
          FROM "RegularSubmission"
          WHERE "teamId" = ${team.id}
          ORDER BY "createdAt" DESC;
        `,
        sql`
          SELECT id, "claimedAt"
          FROM "TreasureBug"
          WHERE "claimedByTeamId" = ${team.id};
        `,
      ]);

      const payload = {
        team: {
          ...team,
          submissions,
          claimedTreasures,
        },
        message: "Team recognized and authenticated successfully across all team devices",
      };

      setCached(`team_${team.id}`, { team: payload.team });

      return NextResponse.json(payload);
    } catch (neonErr: any) {
      console.warn("[api/teams POST] Neon HTTP fallback to localStore in 0ms:", neonErr.message);

      let localTeam = localStore.findTeamByEmail(cleanEmail);
      if (!localTeam) {
        localTeam = localStore.createTeam(cleanName, cleanEmail);
      }

      const subs = localStore.getSubmissions({ teamId: localTeam.id });

      return NextResponse.json({
        team: {
          ...localTeam,
          submissions: subs,
          claimedTreasures: [],
        },
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
