import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { evaluateSubmissionWithAI } from "@/lib/gemini";
import { appendToDiskBackup } from "@/lib/submissionStore";
import localStore from "@/lib/localStore";
import { isJudgeAuthorized } from "@/lib/judgeAuth";
import { calculateRegularPoints, evaluateMilestoneBonus } from "@/lib/scoring";
import { MASTER_BUGS } from "@/config/masterBugs";
import { isDbActiveSync, markDbOffline } from "@/lib/dbCircuitBreaker";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    const status = searchParams.get("status");
    const bugId = searchParams.get("bugId");

    const isJudge = isJudgeAuthorized(req);

    // Only allow global querying across all teams if authenticated as Judge
    if (!teamId && !isJudge) {
      return NextResponse.json(
        { error: "Unauthorized: teamId parameter or Judge authentication is required." },
        { status: 401 }
      );
    }

    // === DB PATH (fast-skip if circuit breaker is open) ===
    if (isDbActiveSync()) {
      try {
        const where: any = {};
        if (teamId) where.teamId = teamId;
        if (status && status !== "ALL") where.status = status;
        if (bugId) where.matchedBugId = bugId;

        const rawSubmissions = await prisma.regularSubmission.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: {
            team: {
              select: { id: true, name: true, email: true },
            },
            matchedBug: true,
          },
        });

        if (isJudge) {
          return NextResponse.json({ submissions: rawSubmissions });
        }

        const sanitized = rawSubmissions.map((sub) => ({
          id: sub.id,
          teamId: sub.teamId,
          team: sub.team,
          description: sub.description,
          codeSnippet: sub.codeSnippet,
          screenshotUrl: sub.screenshotUrl,
          status: sub.status,
          awardedPoints: sub.awardedPoints,
          isSpeedBonus: sub.isSpeedBonus,
          createdAt: sub.createdAt,
          matchedBug:
            sub.status === "VERIFIED" && sub.matchedBug
              ? {
                  title: sub.matchedBug.title,
                  category: sub.matchedBug.category,
                }
              : null,
        }));

        return NextResponse.json({ submissions: sanitized });
      } catch (dbErr: any) {
        markDbOffline();
        console.warn("[api/submissions GET] DB offline, switching to localStore:", dbErr.message);
      }
    }

    // === LOCAL STORE FALLBACK ===
    const rawSubmissions = localStore.getSubmissions({
      teamId: teamId || undefined,
      status: status || undefined,
    });

    if (isJudge) {
      return NextResponse.json({ submissions: rawSubmissions });
    }

    const sanitized = rawSubmissions.map((sub: any) => ({
      id: sub.id,
      teamId: sub.teamId,
      team: sub.team,
      description: sub.description,
      codeSnippet: sub.codeSnippet,
      screenshotUrl: sub.screenshotUrl,
      status: sub.status,
      awardedPoints: sub.awardedPoints,
      isSpeedBonus: sub.isSpeedBonus,
      createdAt: sub.createdAt,
      matchedBug:
        sub.status === "VERIFIED" && sub.matchedBug
          ? {
              title: sub.matchedBug.title,
              category: sub.matchedBug.category,
            }
          : null,
    }));

    return NextResponse.json({ submissions: sanitized });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch submissions", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { teamId, description, codeSnippet, screenshotUrl } = body;

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    }

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: "Bug description and reproduction steps are required." },
        { status: 400 }
      );
    }

    // 1. GUARANTEED PERSISTENCE STEP:
    // Generate deterministic ID and append to local disk backup IMMEDIATELY.
    // This happens synchronously before any DB or AI calls so no report is EVER lost.
    const submissionId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const team = localStore.findTeamById(teamId);

    const initialRecord = {
      id: submissionId,
      teamId,
      teamName: team?.name || "Team",
      description: description?.trim() || "",
      codeSnippet: codeSnippet?.trim() || undefined,
      screenshotUrl: screenshotUrl || undefined,
      status: "UNVERIFIED",
      awardedPoints: 0,
      isSpeedBonus: false,
      createdAt: new Date().toISOString(),
    };

    appendToDiskBackup(initialRecord);

    // 2. Run AI Evaluation
    let aiResult = {
      matchedBugId: null as string | null,
      confidence: 0,
      reasoning: "Queued for judge review.",
      suggestedStatus: "UNVERIFIED" as "VERIFIED" | "REJECTED" | "UNVERIFIED",
    };

    try {
      aiResult = await evaluateSubmissionWithAI({
        description: initialRecord.description,
        codeSnippet: initialRecord.codeSnippet,
        screenshotUrl: initialRecord.screenshotUrl,
      });
    } catch (evalErr) {
      console.warn("[api/submissions] AI evaluation error:", evalErr);
    }

    // 3. Auto-Verification Threshold: If AI confidence is >= 80% (0.80) and matched a bug
    const isAutoVerified =
      Boolean(aiResult.matchedBugId) &&
      typeof aiResult.confidence === "number" &&
      aiResult.confidence >= 0.8;

    const targetStatus: "VERIFIED" | "UNVERIFIED" = isAutoVerified ? "VERIFIED" : "UNVERIFIED";
    let awardedPoints = 0;
    let isSpeedBonus = false;

    // 4. Persist to PostgreSQL only if DB is reachable
    if (isDbActiveSync()) {
      try {
        const dbTeam = await prisma.team.findUnique({ where: { id: teamId } });

        if (dbTeam) {
          if (isAutoVerified && aiResult.matchedBugId) {
            const alreadyVerified = await prisma.regularSubmission.findFirst({
              where: {
                teamId,
                matchedBugId: aiResult.matchedBugId,
                status: "VERIFIED",
                awardedPoints: { gt: 0 },
              },
            });

            if (alreadyVerified) {
              awardedPoints = 0;
              isSpeedBonus = false;
              aiResult.reasoning = `[DUPLICATE] Team has already been credited points for Bug ${aiResult.matchedBugId}. Duplicate submissions for the same defect do not award additional score.`;
            } else {
              const bug = await prisma.masterBug.findUnique({
                where: { id: aiResult.matchedBugId },
              });

              if (bug) {
                if (!bug.isFirstFound) {
                  isSpeedBonus = true;
                  await prisma.masterBug.update({
                    where: { id: aiResult.matchedBugId },
                    data: { isFirstFound: true, firstFoundById: teamId },
                  });
                }
                awardedPoints = calculateRegularPoints(bug.category, isSpeedBonus);
              } else {
                awardedPoints = 3;
              }

              await prisma.team.update({
                where: { id: teamId },
                data: {
                  totalScore: { increment: awardedPoints },
                  validBugsCount: { increment: 1 },
                },
              });

              await evaluateMilestoneBonus(teamId);
            }
          }

          await prisma.regularSubmission.create({
            data: {
              id: submissionId,
              teamId,
              description: initialRecord.description,
              codeSnippet: initialRecord.codeSnippet || null,
              screenshotUrl: initialRecord.screenshotUrl || null,
              status: targetStatus,
              matchedBugId: aiResult.matchedBugId,
              llmConfidence: aiResult.confidence,
              llmReasoning: aiResult.reasoning,
              awardedPoints,
              isSpeedBonus,
            },
          });

          return NextResponse.json({
            success: true,
            submission: { id: submissionId, teamId, status: targetStatus, createdAt: initialRecord.createdAt },
            message: isAutoVerified
              ? "Report verified and points awarded!"
              : "Report received and queued for review.",
          });
        }
      } catch (dbErr: any) {
        markDbOffline();
        console.warn("[api/submissions POST] DB offline, serving via disk store:", dbErr.message);
      }
    }

    // 5. Fallback to Local Store with disk persistence
    if (isAutoVerified && aiResult.matchedBugId) {
      const bug = localStore.getBug(aiResult.matchedBugId);
      if (bug) {
        if (!bug.isFirstFound) {
          isSpeedBonus = true;
        }
        awardedPoints = bug.basePoints + (isSpeedBonus ? bug.speedBonusPoints : 0);
      } else {
        awardedPoints = 3;
      }
    }

    localStore.createSubmission({
      teamId,
      description: initialRecord.description,
      codeSnippet: initialRecord.codeSnippet,
      screenshotUrl: initialRecord.screenshotUrl,
      matchedBugId: aiResult.matchedBugId,
      llmConfidence: aiResult.confidence,
      llmReasoning: aiResult.reasoning,
      status: targetStatus,
      awardedPoints,
      isSpeedBonus,
    });

    return NextResponse.json({
      success: true,
      submission: { id: submissionId, teamId, status: targetStatus, createdAt: initialRecord.createdAt },
      message: isAutoVerified
        ? "Report verified and points awarded!"
        : "Report received and queued for review.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to process submission", details: err.message },
      { status: 500 }
    );
  }
}
