import { NextRequest, NextResponse } from "next/server";
import { executeJudgeVerdict } from "@/lib/scoring";
import localStore from "@/lib/localStore";
import { isJudgeAuthorized } from "@/lib/judgeAuth";
import { isDbActiveSync, markDbOffline } from "@/lib/dbCircuitBreaker";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isJudgeAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Judge authentication required to apply verdicts." },
      { status: 401 }
    );
  }

  try {
    const submissionId = params.id;
    const body = await req.json();
    const { status, matchedBugId, overridePoints, judgeNotes, isSpeedBonus } = body;

    const validStatuses = ["VERIFIED", "REJECTED", "UNVERIFIED", "PENDING"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "status must be 'VERIFIED', 'REJECTED', or 'PENDING'" },
        { status: 400 }
      );
    }

    // === DB PATH (fast-skip if circuit breaker is open) ===
    if (isDbActiveSync()) {
      try {
        const updated = await executeJudgeVerdict({
          submissionId,
          status,
          matchedBugId: matchedBugId || null,
          overridePoints: typeof overridePoints === "number" ? overridePoints : null,
          judgeNotes: judgeNotes || undefined,
          isSpeedBonus: typeof isSpeedBonus === "boolean" ? isSpeedBonus : undefined,
        });

        return NextResponse.json({
          success: true,
          submission: updated,
          message: `Submission ${submissionId} marked as ${status}.`,
        });
      } catch (dbErr: any) {
        markDbOffline();
        console.warn("[api/submissions/[id]/judge] DB offline, switching to localStore:", dbErr.message);
      }
    }

    // === LOCAL STORE FALLBACK ===
    const localUpdated = localStore.judgeSubmission(
      submissionId,
      status,
      matchedBugId,
      overridePoints,
      judgeNotes,
      typeof isSpeedBonus === "boolean" ? isSpeedBonus : undefined
    );

    return NextResponse.json({
      success: true,
      submission: localUpdated,
      message: `Submission ${submissionId} marked as ${status} in local store.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to apply judge verdict", details: err.message },
      { status: 500 }
    );
  }
}
