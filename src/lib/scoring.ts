import prisma from "./prisma";

export const POINT_TABLE = {
  EASY: { base: 3, speed: 2, max: 5 },
  MEDIUM: { base: 5, speed: 5, max: 10 },
  HARD: { base: 10, speed: 10, max: 20 },
  TREASURE: { base: 10, speed: 0, max: 10 },
} as const;

export const MILESTONE_BONUS_POINTS = 10;
export const MILESTONE_THRESHOLD = 10; // 10 valid bugs

/**
 * Calculate standard points for a regular bug.
 */
export function calculateRegularPoints(
  category: string,
  isSpeedBonus: boolean
): number {
  const cat = category.toUpperCase() as keyof typeof POINT_TABLE;
  const config = POINT_TABLE[cat] || POINT_TABLE.EASY;
  return config.base + (isSpeedBonus ? config.speed : 0);
}

/**
 * Check and award Milestone Bonus (+10 pts) to the first team that reaches 10 valid bugs.
 */
export async function evaluateMilestoneBonus(teamId: string) {
  try {
    const tracker = await prisma.milestoneTracker.findUnique({
      where: { id: 1 },
    });

    // If milestone bonus already claimed by someone, exit
    if (tracker?.awardedToTeamId) {
      return false;
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) return false;

    // Check if team has reached 10 valid bugs
    if (team.validBugsCount >= MILESTONE_THRESHOLD && !team.hasMilestoneBonus) {
      // Award milestone bonus
      await prisma.$transaction([
        prisma.team.update({
          where: { id: teamId },
          data: {
            hasMilestoneBonus: true,
            totalScore: { increment: MILESTONE_BONUS_POINTS },
          },
        }),
        prisma.milestoneTracker.upsert({
          where: { id: 1 },
          update: {
            awardedToTeamId: teamId,
            awardedAt: new Date(),
          },
          create: {
            id: 1,
            awardedToTeamId: teamId,
            awardedAt: new Date(),
          },
        }),
      ]);

      console.log(`[scoring] Milestone bonus (+10 pts) awarded to Team ${team.name}!`);
      return true;
    }

    return false;
  } catch (err) {
    console.error("[scoring] Error evaluating milestone bonus:", err);
    return false;
  }
}

/**
 * Execute judge verdict for a submission.
 */
export async function executeJudgeVerdict({
  submissionId,
  status, // "VERIFIED" | "REJECTED" | "UNVERIFIED" | "PENDING"
  matchedBugId,
  overridePoints,
  judgeNotes,
  isSpeedBonus,
}: {
  submissionId: string;
  status: "VERIFIED" | "REJECTED" | "UNVERIFIED" | "PENDING";
  matchedBugId?: string | null;
  overridePoints?: number | null;
  judgeNotes?: string;
  isSpeedBonus?: boolean;
}) {
  const submission = await prisma.regularSubmission.findUnique({
    where: { id: submissionId },
    include: { team: true, matchedBug: true },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  const effectiveBugId = matchedBugId ?? submission.matchedBugId;
  const targetStatus = status === "PENDING" ? "UNVERIFIED" : status;

  if (targetStatus === "REJECTED" || targetStatus === "UNVERIFIED") {
    // If was previously verified, subtract points
    let pointsToSubtract = 0;
    if (submission.status === "VERIFIED" && submission.awardedPoints > 0) {
      pointsToSubtract = submission.awardedPoints;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (pointsToSubtract > 0) {
        await tx.team.update({
          where: { id: submission.teamId },
          data: {
            totalScore: { decrement: pointsToSubtract },
            validBugsCount: { decrement: 1 },
          },
        });
      }

      // If this submission had claimed the first-to-find speed bonus, release the lock on the master bug
      if (submission.isSpeedBonus && submission.matchedBugId) {
        await tx.masterBug.update({
          where: { id: submission.matchedBugId },
          data: {
            isFirstFound: false,
            firstFoundById: null,
          },
        });
      }

      return tx.regularSubmission.update({
        where: { id: submissionId },
        data: {
          status: targetStatus,
          awardedPoints: 0,
          isSpeedBonus: false,
          judgeOverride: true,
          matchedBugId: effectiveBugId,
          llmReasoning: judgeNotes
            ? `[Judge ${targetStatus === "REJECTED" ? "Rejected" : "Moved to Pending"}]: ${judgeNotes}`
            : submission.llmReasoning,
        },
      });
    });

    return updated;
  }

  // --- Process VERIFIED ---
  let isSpeed = false;
  let pointsToAward = 0;

  // Check if team already has another verified submission for this bug with awardedPoints > 0
  let isDuplicateAward = false;
  if (effectiveBugId) {
    const existingAward = await prisma.regularSubmission.findFirst({
      where: {
        teamId: submission.teamId,
        matchedBugId: effectiveBugId,
        status: "VERIFIED",
        id: { not: submissionId },
        awardedPoints: { gt: 0 },
      },
    });
    if (existingAward) {
      isDuplicateAward = true;
    }
  }

  if (isDuplicateAward) {
    pointsToAward = 0;
    isSpeed = false;
  } else if (overridePoints !== undefined && overridePoints !== null && overridePoints >= 0) {
    pointsToAward = overridePoints;
    isSpeed = isSpeedBonus ?? false;
  } else if (effectiveBugId) {
    const bug = await prisma.masterBug.findUnique({
      where: { id: effectiveBugId },
    });

    if (bug) {
      // Speed bonus if explicitly requested by Judge, OR if this bug hasn't been claimed yet
      if (isSpeedBonus !== undefined) {
        isSpeed = isSpeedBonus;
      } else if (!bug.isFirstFound) {
        isSpeed = true;
      }
      pointsToAward = calculateRegularPoints(bug.category, isSpeed);
    } else {
      pointsToAward = 3; // default easy base
      isSpeed = isSpeedBonus ?? false;
    }
  } else {
    pointsToAward = 3;
    isSpeed = isSpeedBonus ?? false;
  }

  const updatedSubmission = await prisma.$transaction(async (tx) => {
    // 1. Mark bug as first found if applicable
    if (effectiveBugId && isSpeed) {
      await tx.masterBug.update({
        where: { id: effectiveBugId },
        data: {
          isFirstFound: true,
          firstFoundById: submission.teamId,
        },
      });
    }

    // 2. Adjust team score
    const previousPoints = submission.status === "VERIFIED" ? submission.awardedPoints : 0;
    const pointDifference = pointsToAward - previousPoints;
    const countIncrement = submission.status === "VERIFIED" ? 0 : 1;

    await tx.team.update({
      where: { id: submission.teamId },
      data: {
        totalScore: { increment: pointDifference },
        validBugsCount: { increment: countIncrement },
      },
    });

    // 3. Update submission record
    return tx.regularSubmission.update({
      where: { id: submissionId },
      data: {
        status: "VERIFIED",
        awardedPoints: pointsToAward,
        isSpeedBonus: isSpeed,
        judgeOverride: true,
        matchedBugId: effectiveBugId,
        llmReasoning: judgeNotes
          ? `[Judge Approved]: ${judgeNotes}`
          : submission.llmReasoning,
      },
    });
  });

  // 4. Check Milestone Bonus (+10 pts) for 10 valid bugs
  await evaluateMilestoneBonus(submission.teamId);

  return updatedSubmission;
}
