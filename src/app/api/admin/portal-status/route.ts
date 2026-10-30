import { NextRequest, NextResponse } from "next/server";
import localStore from "@/lib/localStore";
import { isJudgeAuthorized } from "@/lib/judgeAuth";

export const dynamic = "force-dynamic";

/**
 * Public GET: check if submission portal is currently accepting submissions.
 */
export async function GET() {
  return NextResponse.json(
    {
      submissionsOpen: localStore.isSubmissionsOpen(),
      updatedAt: localStore.submissionsStatusUpdatedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      },
    }
  );
}

/**
 * Judge-Protected POST: Start or Pause/Stop the submission portal.
 */
export async function POST(req: NextRequest) {
  if (!isJudgeAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Judge authentication required to change portal status." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { submissionsOpen } = body;

    if (typeof submissionsOpen !== "boolean") {
      return NextResponse.json(
        { error: "submissionsOpen must be a boolean (true to start, false to pause)" },
        { status: 400 }
      );
    }

    const updated = localStore.setSubmissionsOpen(submissionsOpen);

    return NextResponse.json({
      success: true,
      submissionsOpen: updated,
      updatedAt: localStore.submissionsStatusUpdatedAt,
      message: updated
        ? "🟢 Bug submission portal is now OPEN and accepting submissions."
        : "🔴 Bug submission portal is now PAUSED. Submissions are temporarily blocked.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to update portal status", details: err.message },
      { status: 500 }
    );
  }
}
