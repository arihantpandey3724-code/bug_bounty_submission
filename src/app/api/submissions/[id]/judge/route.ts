import { NextRequest, NextResponse } from "next/server";
import { executeJudgeVerdict } from "@/lib/scoring";
import localStore from "@/lib/localStore";
import { isJudgeAuthorized } from "@/lib/judgeAuth";

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
    const { status, matchedBugId, overridePoints, judgeNotes } = body;

    if (!status || (status !== "VERIFIED" && status !== "REJECTED")) {
      return NextResponse.json(
        { error: "status must be either 'VERIFIED' or 'REJECTED'" },
        { status: 400 }
      );
    }

    try {
      const updated = await executeJudgeVerdict({
        submissionId,
        status,
        matchedBugId: matchedBugId || null,
        overridePoints:
          typeof overridePoints === "number" ? overridePoints : null,
        judgeNotes: judgeNotes || undefined,
      });

      return NextResponse.json({
        success: true,
        submission: updated,
        message: `Submission ${submissionId} marked as ${status}.`,
      });
    } catch (dbErr: any) {
      console.warn("[api/submissions/[id]/judge fallback to localStore]:", dbErr.message);

      const localUpdated = localStore.judgeSubmission(
        submissionId,
        status,
        matchedBugId,
        overridePoints,
        judgeNotes
      );

      return NextResponse.json({
        success: true,
        submission: localUpdated,
        message: `Submission ${submissionId} marked as ${status} in local store.`,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to apply judge verdict", details: err.message },
      { status: 500 }
    );
  }
}
