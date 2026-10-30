import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neonClient";
import prisma from "@/lib/prisma";
import { isJudgeAuthorized } from "@/lib/judgeAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const isJudge = isJudgeAuthorized(req);
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  };

  try {
    const rawTreasures = await sql`
      SELECT 
        tr.id, 
        tr.code, 
        tr."isClaimed", 
        tr."claimedByTeamId", 
        tr."claimedAt",
        case when t.id is not null then json_build_object('id', t.id, 'name', t.name) else null end as "claimedByTeam"
      FROM "TreasureBug" tr
      LEFT JOIN "Team" t ON t.id = tr."claimedByTeamId"
      ORDER BY tr.id ASC;
    `;

    const total = rawTreasures.length || 10;
    const claimedCount = rawTreasures.filter((t: any) => t.isClaimed).length;
    const remainingCount = total - claimedCount;

    const treasures = rawTreasures.map((t: any) => ({
      id: t.id,
      isClaimed: t.isClaimed,
      claimedByTeamId: t.claimedByTeamId,
      claimedByTeam: t.claimedByTeam,
      claimedAt: t.claimedAt,
      ...(isJudge ? { code: t.code } : {}),
    }));

    return NextResponse.json({ total, claimedCount, remainingCount, treasures }, { headers });
  } catch (neonErr: any) {
    console.warn("[api/treasures GET] Neon HTTP fallback to Prisma:", neonErr.message);

    const rawTreasures = await prisma.treasureBug.findMany({
      orderBy: { id: "asc" },
      include: {
        claimedByTeam: { select: { id: true, name: true } },
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

    return NextResponse.json({ total, claimedCount, remainingCount, treasures }, { headers });
  }
}
