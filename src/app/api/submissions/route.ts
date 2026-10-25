import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { evaluateSubmissionWithAI } from "@/lib/gemini";
import { appendToDiskBackup } from "@/lib/submissionStore";
import localStore from "@/lib/localStore";
import { isJudgeAuthorized } from "@/lib/judgeAuth";

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

      // Sanitize for participants: never expose internal AI evaluations or unverified bug IDs
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
                id: sub.matchedBug.id,
                title: sub.matchedBug.title,
                category: sub.matchedBug.category,
              }
            : null,
      }));

      return NextResponse.json({ submissions: sanitized });
    } catch (dbErr: any) {
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
                id: sub.matchedBug.id,
                title: sub.matchedBug.title,
                category: sub.matchedBug.category,
              }
            : null,
      }));

      return NextResponse.json({ submissions: sanitized });
    }
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

    if (!description && !codeSnippet && !screenshotUrl) {
      return NextResponse.json(
        { error: "Please provide a description, code snippet, or screenshot." },
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

    // 3. Persist to PostgreSQL if available
    try {
      const dbTeam = await prisma.team.findUnique({
        where: { id: teamId },
      });

      if (dbTeam) {
        const dbSubmission = await prisma.regularSubmission.create({
          data: {
            id: submissionId,
            teamId,
            description: initialRecord.description,
            codeSnippet: initialRecord.codeSnippet || null,
            screenshotUrl: initialRecord.screenshotUrl || null,
            status: "UNVERIFIED",
            matchedBugId: aiResult.matchedBugId,
            llmConfidence: aiResult.confidence,
            llmReasoning: aiResult.reasoning,
            awardedPoints: 0,
            isSpeedBonus: false,
          },
          include: {
            team: true,
            matchedBug: true,
          },
        });

        return NextResponse.json({
          success: true,
          submission: {
            id: submissionId,
            teamId,
            status: "UNVERIFIED",
            createdAt: initialRecord.createdAt,
          },
          message: "Report received and queued for review.",
        });
      }
    } catch (dbErr) {
      console.warn("[api/submissions] Database offline locally, served via disk store.");
    }

    // 4. Fallback to Local Store with disk persistence
    localStore.createSubmission({
      teamId,
      description: initialRecord.description,
      codeSnippet: initialRecord.codeSnippet,
      screenshotUrl: initialRecord.screenshotUrl,
      matchedBugId: aiResult.matchedBugId,
      llmConfidence: aiResult.confidence,
      llmReasoning: aiResult.reasoning,
    });

    return NextResponse.json({
      success: true,
      submission: {
        id: submissionId,
        teamId,
        status: "UNVERIFIED",
        createdAt: initialRecord.createdAt,
      },
      message: "Report received and queued for review.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to process submission", details: err.message },
      { status: 500 }
    );
  }
}
