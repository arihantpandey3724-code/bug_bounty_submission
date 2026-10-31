import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neonClient";
import localStore from "@/lib/localStore";
import { isJudgeAuthorized } from "@/lib/judgeAuth";
import { getCached, setCached } from "@/lib/memoryCache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const isJudge = isJudgeAuthorized(req);
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };

  const cacheKey = isJudge ? "treasures_judge" : "treasures_public";
  const cached = getCached<any>(cacheKey, 3000);
  if (cached) {
    return NextResponse.json(cached, { headers });
  }

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

    const responsePayload = { total, claimedCount, remainingCount, treasures };
    setCached(cacheKey, responsePayload);

    return NextResponse.json(responsePayload, { headers });
  } catch (neonErr: any) {
    console.warn("[api/treasures GET] Neon HTTP fallback to localStore in 0ms:", neonErr.message);

    const localTreasures = localStore.getTreasures(isJudge);
    const total = localTreasures.length || 10;
    const claimedCount = localTreasures.filter((t: any) => t.isClaimed).length;
    const remainingCount = total - claimedCount;

    return NextResponse.json({ total, claimedCount, remainingCount, treasures: localTreasures }, { headers });
  }
}
